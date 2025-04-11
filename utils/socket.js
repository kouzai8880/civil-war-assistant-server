/**
 * Socket.IO通信工具类
 * 处理WebSocket连接和语音通信
 */

const socketIO = require('socket.io');
const { verifySocketToken } = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');

// 存储活跃连接的用户
const activeUsers = new Map();
// 存储房间信息
const rooms = new Map();

// 存储用户的Socket连接
const userSockets = new Map();
// 存储房间的用户
const roomUsers = new Map();
// 存储房间的观众
const roomSpectators = new Map();
// 存储正在进行语音通话的用户
const voiceUsers = new Map();

// Socket.IO 实例
let io = null;

/**
 * 初始化Socket.IO服务
 * @param {Object} server - HTTP服务器实例
 * @returns {Object} Socket.IO服务器实例
 */
function initSocketServer(server) {
  io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // 中间件：验证用户身份
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('认证失败: 未提供token'));
    }

    const userId = verifySocketToken(token);
    if (!userId) {
      return next(new Error('认证失败: 无效的token'));
    }

    // 将用户ID和角色信息附加到socket对象
    socket.userId = userId;

    try {
      // 从token中获取用户信息
      const decodedToken = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      socket.username = decodedToken.username;
      socket.teamId = decodedToken.teamId;
      socket.role = decodedToken.role || 'player';
    } catch (error) {
      // 如果解析token出错，使用userId作为用户名，测试情况下允许连接成功
      console.log('Token解析出错，使用默认值:', error.message);
      socket.username = userId;
      socket.teamId = socket.handshake.query.teamId || null;
      socket.role = socket.handshake.query.role || 'player';
    }

    next();
  });

  // 连接事件处理
  io.on('connection', (socket) => {
    console.log(`用户连接: ${socket.userId}`);

    // 存储用户连接
    activeUsers.set(socket.userId, {
      socket,
      userId: socket.userId,
      username: socket.username,
      teamId: socket.teamId,
      role: socket.role,
      rooms: new Set()
    });

    // 加入房间
    socket.on('joinRoom', async ({ roomId, password }) => {
      try {
        if (!roomId) {
          socket.emit('error', { message: '房间ID不能为空' });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('error', { message: '房间不存在', code: 3001 });
          return;
        }

        // 验证密码
        if (room.hasPassword) {
          const isValid = await room.verifyPassword(password);
          if (!isValid) {
            socket.emit('error', { message: '密码错误', code: 3004 });
            return;
          }
        }

        // 检查用户是否已经在房间中（玩家列表或观众席）
        const existingPlayer = room.players.find(p => p.userId.toString() === socket.userId);
        const existingSpectator = room.spectators.find(s => s.userId.toString() === socket.userId);

        if (existingPlayer || existingSpectator) {
          // 用户已经在房间中，直接加入Socket.IO房间
          socket.join(roomId);

          // 更新内存中的房间信息
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }

          const roomUsers = rooms.get(roomId);
          roomUsers.set(socket.userId, {
            userId: socket.userId,
            username: socket.username,
            teamId: existingPlayer ? existingPlayer.teamId : null,
            role: existingPlayer ? 'player' : 'spectator'
          });

          // 更新用户的房间列表
          activeUsers.get(socket.userId).rooms.add(roomId);

          // 通知房间内其他用户有用户重新连接
          socket.to(roomId).emit('userReconnected', {
            userId: socket.userId,
            username: socket.username,
            teamId: existingPlayer ? existingPlayer.teamId : null,
            role: existingPlayer ? 'player' : 'spectator'
          });

          // 获取房间详细信息并发送给用户
          const populatedRoom = await Room.findById(roomId)
            .populate('creatorId', 'username avatar')
            .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
            .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
            .populate('teams.captainId', 'username avatar');

          // 格式化房间数据
          const formattedRoom = formatRoomData(populatedRoom, roomUsers);

          socket.emit('roomJoined', {
            status: 'success',
            data: { room: formattedRoom },
            message: '重新连接房间成功'
          });

          console.log(`用户 ${socket.userId} 重新连接房间 ${roomId}`);
          return;
        }

        // 添加用户到观众席
        const isCreator = !room.players.length && !room.spectators.length;
        const spectator = room.addSpectator(socket.userId, isCreator);

        // 如果是创建者，更新房间的creatorId
        if (isCreator) {
          room.creatorId = socket.userId;
        }

        await room.save();

        // 获取用户信息
        const user = await User.findById(socket.userId, 'username avatar stats.totalGames stats.wins gameId');

        // 将用户添加到Socket.IO房间
        socket.join(roomId);

        // 更新内存中的房间信息
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        const roomUsers = rooms.get(roomId);
        roomUsers.set(socket.userId, {
          userId: socket.userId,
          username: socket.username,
          teamId: null,
          role: 'spectator',
          isCreator: spectator.isCreator
        });

        // 更新用户的房间列表
        activeUsers.get(socket.userId).rooms.add(roomId);

        // 通知房间内其他用户有新用户加入
        socket.to(roomId).emit('spectator.joined', {
          userId: user._id,
          username: user.username,
          avatar: user.avatar,
          totalGames: user.stats.totalGames,
          wins: user.stats.wins,
          isCreator: spectator.isCreator
        });

        // 获取房间详细信息并发送给用户
        const populatedRoom = await Room.findById(roomId)
          .populate('creatorId', 'username avatar')
          .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('teams.captainId', 'username avatar');

        // 格式化房间数据
        const formattedRoom = formatRoomData(populatedRoom, roomUsers);

        socket.emit('roomJoined', {
          status: 'success',
          data: { room: formattedRoom },
          message: '加入房间成功，已进入观众席'
        });

        console.log(`用户 ${socket.userId} 加入房间 ${roomId}`);
      } catch (error) {
        console.error('加入房间失败:', error);
        socket.emit('error', { message: '加入房间失败: ' + error.message, code: 3002 });
      }
    });

    // 离开房间
    socket.on('leaveRoom', async ({ roomId }) => {
      try {
        if (!roomId) {
          socket.emit('error', { message: '房间ID不能为空' });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('error', { message: '房间不存在', code: 3001 });
          return;
        }

        // 检查用户是否在房间中
        const existingPlayer = room.players.find(p => p.userId.toString() === socket.userId);
        const existingSpectator = room.spectators.find(s => s.userId.toString() === socket.userId);

        if (existingPlayer) {
          // 从玩家列表中移除用户
          room.removePlayer(socket.userId);
        } else if (existingSpectator) {
          // 从观众席中移除用户
          room.removeSpectator(socket.userId);
        } else {
          // 用户不在房间中
          socket.emit('error', { message: '您不在该房间中', code: 3003 });
          return;
        }

        await room.save();

        // 获取用户信息
        const user = await User.findById(socket.userId, 'username avatar');

        // 将用户从房间中移除
        socket.leave(roomId);

        // 更新内存中的房间信息
        if (rooms.has(roomId)) {
          const roomUsers = rooms.get(roomId);
          roomUsers.delete(socket.userId);

          // 如果房间中没有用户了，删除房间
          if (roomUsers.size === 0) {
            rooms.delete(roomId);
          }
        }

        // 更新用户的房间列表
        const userInfo = activeUsers.get(socket.userId);
        if (userInfo) {
          userInfo.rooms.delete(roomId);
        }

        // 通知房间内其他用户有用户离开
        if (existingPlayer) {
          socket.to(roomId).emit('player.left', {
            userId: socket.userId,
            username: user.username,
            roomId
          });
        } else {
          socket.to(roomId).emit('spectator.left', {
            userId: socket.userId,
            username: user.username,
            roomId
          });
        }

        socket.emit('roomLeft', {
          status: 'success',
          data: { roomId },
          message: '离开房间成功'
        });

        console.log(`用户 ${socket.userId} 离开房间 ${roomId}`);
      } catch (error) {
        console.error('离开房间失败:', error);
        socket.emit('error', { message: '离开房间失败: ' + error.message, code: 3002 });
      }
    });

    // 从观众席加入玩家列表
    socket.on('joinAsPlayer', async ({ roomId, teamId }) => {
      try {
        if (!roomId) {
          socket.emit('error', { message: '房间ID不能为空' });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('error', { message: '房间不存在', code: 3001 });
          return;
        }

        // 检查用户是否在观众席中
        const existingSpectator = room.spectators.find(s => s.userId.toString() === socket.userId);

        if (!existingSpectator) {
          socket.emit('error', { message: '您不在观众席中', code: 3003 });
          return;
        }

        // 检查玩家列表是否已满
        if (room.players.length >= room.playerCount) {
          socket.emit('error', { message: '玩家列表已满', code: 3005 });
          return;
        }

        // 将用户从观众席移动到玩家列表
        const player = room.moveSpectatorToPlayer(socket.userId, teamId);
        await room.save();

        // 获取用户信息
        const user = await User.findById(socket.userId, 'username avatar stats.totalGames stats.wins gameId');

        // 更新内存中的用户角色
        if (rooms.has(roomId)) {
          const roomUsers = rooms.get(roomId);
          const userInfo = roomUsers.get(socket.userId);
          if (userInfo) {
            userInfo.role = 'player';
            userInfo.teamId = teamId;
            roomUsers.set(socket.userId, userInfo);
          }
        }

        // 更新socket的角色
        socket.role = 'player';
        socket.teamId = teamId;

        // 通知房间内其他用户
        socket.to(roomId).emit('spectator.moveToPlayer', {
          userId: user._id,
          username: user.username,
          avatar: user.avatar,
          totalGames: user.stats.totalGames,
          wins: user.stats.wins,
          teamId,
          isCreator: player.isCreator,
          roomId
        });

        // 获取房间详细信息并发送给用户
        const populatedRoom = await Room.findById(roomId)
          .populate('creatorId', 'username avatar')
          .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('teams.captainId', 'username avatar');

        // 格式化房间数据
        const formattedRoom = formatRoomData(populatedRoom, rooms.get(roomId) || new Map());

        socket.emit('roleChanged', {
          status: 'success',
          data: {
            room: formattedRoom,
            role: 'player',
            teamId
          },
          message: '已加入玩家列表'
        });

        console.log(`用户 ${socket.userId} 从观众席加入玩家列表，房间 ${roomId}`);
      } catch (error) {
        console.error('加入玩家列表失败:', error);
        socket.emit('error', { message: '加入玩家列表失败: ' + error.message, code: 3002 });
      }
    });

    // 从玩家列表加入观众席
    socket.on('joinAsSpectator', async ({ roomId }) => {
      try {
        if (!roomId) {
          socket.emit('error', { message: '房间ID不能为空' });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('error', { message: '房间不存在', code: 3001 });
          return;
        }

        // 检查用户是否在玩家列表中
        const existingPlayer = room.players.find(p => p.userId.toString() === socket.userId);

        if (!existingPlayer) {
          socket.emit('error', { message: '您不在玩家列表中', code: 3003 });
          return;
        }

        // 将用户从玩家列表移动到观众席
        const spectator = room.movePlayerToSpectator(socket.userId);
        await room.save();

        // 获取用户信息
        const user = await User.findById(socket.userId, 'username avatar stats.totalGames stats.wins gameId');

        // 更新内存中的用户角色
        if (rooms.has(roomId)) {
          const roomUsers = rooms.get(roomId);
          const userInfo = roomUsers.get(socket.userId);
          if (userInfo) {
            userInfo.role = 'spectator';
            userInfo.teamId = null;
            roomUsers.set(socket.userId, userInfo);
          }
        }

        // 更新socket的角色
        socket.role = 'spectator';
        socket.teamId = null;

        // 通知房间内其他用户
        socket.to(roomId).emit('player.moveToSpectator', {
          userId: user._id,
          username: user.username,
          avatar: user.avatar,
          totalGames: user.stats.totalGames,
          wins: user.stats.wins,
          isCreator: spectator.isCreator,
          roomId
        });

        // 获取房间详细信息并发送给用户
        const populatedRoom = await Room.findById(roomId)
          .populate('creatorId', 'username avatar')
          .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('teams.captainId', 'username avatar');

        // 格式化房间数据
        const formattedRoom = formatRoomData(populatedRoom, rooms.get(roomId) || new Map());

        socket.emit('roleChanged', {
          status: 'success',
          data: {
            room: formattedRoom,
            role: 'spectator'
          },
          message: '已加入观众席'
        });

        console.log(`用户 ${socket.userId} 从玩家列表加入观众席，房间 ${roomId}`);
      } catch (error) {
        console.error('加入观众席失败:', error);
        socket.emit('error', { message: '加入观众席失败: ' + error.message, code: 3002 });
      }
    });

    // 获取房间详情
    socket.on('getRoomDetail', async ({ roomId }, callback) => {
      try {
        if (!callback || typeof callback !== 'function') {
          socket.emit('error', { message: '缺少回调函数', code: 3002 });
          return;
        }

        if (!roomId) {
          callback({
            status: 'error',
            message: '房间ID不能为空',
            code: 3002
          });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const room = await Room.findById(roomId)
          .populate('creatorId', 'username avatar')
          .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
          .populate('teams.captainId', 'username avatar');

        if (!room) {
          callback({
            status: 'error',
            message: '房间不存在',
            code: 3001
          });
          return;
        }

        // 格式化房间数据
        const formattedRoom = formatRoomData(room, rooms.get(roomId) || new Map());

        // 返回房间详情
        callback({
          status: 'success',
          data: { room: formattedRoom },
          message: '获取房间详情成功'
        });

        console.log(`用户 ${socket.userId} 获取房间 ${roomId} 详情`);
      } catch (error) {
        console.error('获取房间详情失败:', error);
        callback({
          status: 'error',
          message: '获取房间详情失败: ' + error.message,
          code: 3002
        });
      }
    });

    // 开始语音通信
    socket.on('voiceStart', ({ roomId }) => {
      if (!roomId || !rooms.has(roomId)) {
        socket.emit('error', { message: '无效的房间ID' });
        return;
      }

      const user = activeUsers.get(socket.userId);
      const isSpectator = socket.role === 'spectator';

      // 向相关用户通知语音状态变更
      socket.rooms.forEach(room => {
        if (room !== socket.id && room === roomId) {
          // 如果是玩家，通知同队伍的玩家和所有观众
          // 如果是观众，只通知其他观众
          if (isSpectator) {
            // 获取房间中的所有观众
            const spectators = Array.from(rooms.get(roomId).values())
              .filter(u => u.role === 'spectator' && u.userId !== socket.userId)
              .map(u => activeUsers.get(u.userId))
              .filter(u => u && u.socket);

            // 向其他观众通知
            spectators.forEach(spectator => {
              spectator.socket.emit('voiceStateUpdate', {
                userId: socket.userId,
                username: socket.username,
                state: 'started'
              });
            });
          } else {
            // 获取房间中同队的玩家和所有观众
            const roomUsers = Array.from(rooms.get(roomId).values());
            const relevantUsers = roomUsers
              .filter(u => (
                // 同队伍玩家或观众，排除自己
                (u.teamId === socket.teamId && u.role === 'player') ||
                u.role === 'spectator'
              ) && u.userId !== socket.userId)
              .map(u => activeUsers.get(u.userId))
              .filter(u => u && u.socket);

            // 向相关用户通知
            relevantUsers.forEach(relevantUser => {
              relevantUser.socket.emit('voiceStateUpdate', {
                userId: socket.userId,
                username: socket.username,
                state: 'started'
              });
            });
          }
        }
      });

      console.log(`用户 ${socket.userId} 开始语音通信`);
    });

    // 结束语音通信
    socket.on('voiceEnd', ({ roomId }) => {
      if (!roomId || !rooms.has(roomId)) {
        socket.emit('error', { message: '无效的房间ID' });
        return;
      }

      const user = activeUsers.get(socket.userId);
      const isSpectator = socket.role === 'spectator';

      // 向相关用户通知语音状态变更
      socket.rooms.forEach(room => {
        if (room !== socket.id && room === roomId) {
          // 如果是玩家，通知同队伍的玩家和所有观众
          // 如果是观众，只通知其他观众
          if (isSpectator) {
            // 获取房间中的所有观众
            const spectators = Array.from(rooms.get(roomId).values())
              .filter(u => u.role === 'spectator' && u.userId !== socket.userId)
              .map(u => activeUsers.get(u.userId))
              .filter(u => u && u.socket);

            // 向其他观众通知
            spectators.forEach(spectator => {
              spectator.socket.emit('voiceStateUpdate', {
                userId: socket.userId,
                username: socket.username,
                state: 'ended'
              });
            });
          } else {
            // 获取房间中同队的玩家和所有观众
            const roomUsers = Array.from(rooms.get(roomId).values());
            const relevantUsers = roomUsers
              .filter(u => (
                // 同队伍玩家或观众，排除自己
                (u.teamId === socket.teamId && u.role === 'player') ||
                u.role === 'spectator'
              ) && u.userId !== socket.userId)
              .map(u => activeUsers.get(u.userId))
              .filter(u => u && u.socket);

            // 向相关用户通知
            relevantUsers.forEach(relevantUser => {
              relevantUser.socket.emit('voiceStateUpdate', {
                userId: socket.userId,
                username: socket.username,
                state: 'ended'
              });
            });
          }
        }
      });

      console.log(`用户 ${socket.userId} 结束语音通信`);
    });

    // 处理语音数据
    socket.on('voiceData', ({ roomId, data }) => {
      if (!roomId || !rooms.has(roomId) || !data) {
        return;
      }

      const isSpectator = socket.role === 'spectator';

      // 获取房间内的用户
      if (rooms.has(roomId)) {
        const roomUsers = Array.from(rooms.get(roomId).values());

        // 如果是观众发送的语音，只发给其他观众
        if (isSpectator) {
          const spectators = roomUsers
            .filter(u => u.role === 'spectator' && u.userId !== socket.userId)
            .map(u => activeUsers.get(u.userId))
            .filter(u => u && u.socket);

          // 向其他观众发送语音数据
          spectators.forEach(spectator => {
            spectator.socket.emit('voiceData', {
              from: socket.userId,
              username: socket.username,
              data
            });
          });
        }
        // 如果是队伍成员发送的语音，发给同队成员和所有观众
        else {
          const relevantUsers = roomUsers
            .filter(u =>
              // 同队伍玩家或观众，排除自己
              ((u.teamId === socket.teamId && u.role === 'player') || u.role === 'spectator') &&
              u.userId !== socket.userId
            )
            .map(u => activeUsers.get(u.userId))
            .filter(u => u && u.socket);

          // 向相关用户发送语音数据
          relevantUsers.forEach(user => {
            user.socket.emit('voiceData', {
              from: socket.userId,
              username: socket.username,
              data
            });
          });
        }
      }
    });

    // 语音控制事件处理
    socket.on('voiceMute', ({ roomId, isMuted }) => {
      if (!roomId || !rooms.has(roomId)) {
        socket.emit('error', { message: '无效的房间ID' });
        return;
      }

      const user = activeUsers.get(socket.userId);
      if (!user) {
        socket.emit('error', { message: '用户未连接' });
        return;
      }

      // 更新用户的静音状态
      user.isMuted = isMuted;

      // 通知房间内相关用户
      const roomData = rooms.get(roomId);
      const isSpectator = socket.role === 'spectator';

      if (isSpectator) {
        // 如果是观众，只通知其他观众
        const spectators = Array.from(roomData.values())
          .filter(u => u.role === 'spectator' && u.userId !== socket.userId)
          .map(u => activeUsers.get(u.userId))
          .filter(u => u && u.socket);

        spectators.forEach(spectator => {
          spectator.socket.emit('voiceMuteUpdate', {
            userId: socket.userId,
            username: socket.username,
            isMuted
          });
        });
      } else {
        // 如果是玩家，通知同队伍的玩家和所有观众
        const relevantUsers = Array.from(roomData.values())
          .filter(u => (
            (u.teamId === socket.teamId && u.role === 'player' && u.userId !== socket.userId) ||
            u.role === 'spectator'
          ))
          .map(u => activeUsers.get(u.userId))
          .filter(u => u && u.socket);

        relevantUsers.forEach(user => {
          user.socket.emit('voiceMuteUpdate', {
            userId: socket.userId,
            username: socket.username,
            isMuted
          });
        });
      }

      console.log(`用户 ${socket.userId} 在房间 ${roomId} 的静音状态更新为: ${isMuted}`);
    });

    // 断开连接
    socket.on('disconnect', () => {
      const user = activeUsers.get(socket.userId);
      if (user) {
        // 从所有房间中移除用户
        user.rooms.forEach(roomId => {
          if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.delete(socket.userId);

            // 如果房间为空，删除房间
            if (room.size === 0) {
              rooms.delete(roomId);
            } else {
              // 通知房间内其他用户该用户已离开
              socket.to(roomId).emit('userLeft', {
                userId: socket.userId
              });
            }
          }
        });

        // 从活跃用户列表中移除
        activeUsers.delete(socket.userId);
      }

      console.log(`用户断开连接: ${socket.userId}`);
    });
  });

  return io;
}

// 格式化房间数据
function formatRoomData(room, roomUsers) {
  // 获取在线状态
  const onlineStatus = {};

  try {
    const onlineUsers = Array.from(roomUsers.keys());
    room.players.forEach(player => {
      onlineStatus[player.userId._id] = onlineUsers.includes(player.userId._id.toString());
    });
    room.spectators.forEach(spectator => {
      onlineStatus[spectator.userId._id] = onlineUsers.includes(spectator.userId._id.toString());
    });
  } catch (error) {
    console.error('获取在线用户状态失败:', error);
    // 默认所有用户在线
    room.players.forEach(player => {
      onlineStatus[player.userId._id] = true;
    });
    room.spectators.forEach(spectator => {
      onlineStatus[spectator.userId._id] = true;
    });
  }

  // 格式化玩家数据
  const players = room.players.map(player => {
    const user = player.userId;
    return {
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      gameId: user.gameId,
      totalGames: user.stats ? user.stats.totalGames : 0,
      wins: user.stats ? user.stats.wins : 0,
      teamId: player.teamId,
      isCaptain: player.isCaptain,
      isCreator: player.isCreator,
      status: onlineStatus[user._id] ? player.status : 'offline',
      joinTime: player.joinTime
    };
  });

  // 格式化观众数据
  const spectators = room.spectators.map(spectator => {
    const user = spectator.userId;
    return {
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      gameId: user.gameId,
      totalGames: user.stats ? user.stats.totalGames : 0,
      wins: user.stats ? user.stats.wins : 0,
      isCreator: spectator.isCreator,
      status: onlineStatus[user._id] ? spectator.status : 'offline',
      joinTime: spectator.joinTime
    };
  });

  // 格式化房间数据
  return {
    id: room._id,
    name: room.name,
    creatorId: room.creatorId._id,
    creatorName: room.creatorId.username,
    creatorAvatar: room.creatorId.avatar,
    gameType: room.gameType,
    playerCount: room.playerCount,
    teamCount: room.teamCount,
    pickMode: room.pickMode,
    hasPassword: room.hasPassword,
    description: room.description,
    status: room.status,
    players,
    spectators,
    teams: room.teams,
    nextTeamPick: room.nextTeamPick,
    createTime: room.createTime,
    startTime: room.startTime,
    endTime: room.endTime
  };
}

// 房间状态更新处理函数
function emitRoomStatusUpdate(roomId, statusData) {
  if (!roomId || !rooms.has(roomId)) {
    return;
  }

  // 向房间内所有用户广播状态更新
  io.to(roomId).emit('roomStatusUpdate', {
    roomId,
    ...statusData,
    updateTime: new Date().toISOString()
  });
}

// 玩家状态更新处理函数
function emitPlayerStatusUpdate(roomId, userId, statusData) {
  if (!roomId || !rooms.has(roomId)) {
    return;
  }

  // 向房间内所有用户广播玩家状态更新
  io.to(roomId).emit('playerStatusUpdate', {
    roomId,
    userId,
    ...statusData,
    updateTime: new Date().toISOString()
  });
}

// 队伍状态更新处理函数
function emitTeamUpdate(roomId, teamId, teamData) {
  if (!roomId || !rooms.has(roomId)) {
    return;
  }

  // 向房间内所有用户广播队伍状态更新
  io.to(roomId).emit('teamUpdate', {
    roomId,
    teamId,
    ...teamData,
    updateTime: new Date().toISOString()
  });
}

// 通知房间内所有用户
function notifyRoom(roomId, event, data) {
  if (!roomId || !io) return false;
  io.to(roomId).emit(event, {
    ...data,
    updateTime: new Date().toISOString()
  });
  return true;
}

// 通知特定用户
function notifyUser(userId, event, data) {
  if (!userId || !io) return false;
  const userSocket = activeUsers.get(userId)?.socket;
  if (userSocket) {
    userSocket.emit(event, {
      ...data,
      updateTime: new Date().toISOString()
    });
    return true;
  }
  return false;
}

// 通知队伍成员
function notifyTeam(roomId, teamId, event, data) {
  if (!roomId || !teamId || !io) return false;

  // 获取队伍成员
  const teamMembers = Array.from(rooms.get(roomId)?.values() || [])
    .filter(user => user.teamId === teamId)
    .map(user => user.userId);

  // 向队伍成员发送通知
  teamMembers.forEach(userId => {
    const userSocket = activeUsers.get(userId)?.socket;
    if (userSocket) {
      userSocket.emit(event, {
        ...data,
        updateTime: new Date().toISOString()
      });
    }
  });

  return true;
}

// 通知观众
function notifySpectators(roomId, event, data) {
  if (!roomId || !io) return false;

  // 获取观众
  const spectators = Array.from(rooms.get(roomId)?.values() || [])
    .filter(user => user.role === 'spectator')
    .map(user => user.userId);

  // 向观众发送通知
  spectators.forEach(userId => {
    const userSocket = activeUsers.get(userId)?.socket;
    if (userSocket) {
      userSocket.emit(event, {
        ...data,
        updateTime: new Date().toISOString()
      });
    }
  });

  return true;
}

// 获取房间在线用户
function getRoomOnlineUsers(roomId) {
  if (!roomId || !rooms.has(roomId)) return [];
  return Array.from(rooms.get(roomId).keys());
}

// 获取房间在线观众
function getRoomSpectators(roomId) {
  if (!roomId || !rooms.has(roomId)) return [];

  return Array.from(rooms.get(roomId).entries())
    .filter(([_, user]) => user.role === 'spectator')
    .map(([userId, _]) => userId);
}

// 暴露状态更新函数，以便控制器使用
module.exports = {
  initSocketServer,
  getIO: () => io,
  emitRoomStatusUpdate,
  emitPlayerStatusUpdate,
  emitTeamUpdate,
  notifyRoom,
  notifyUser,
  notifyTeam,
  notifySpectators,
  getRoomOnlineUsers,
  getRoomSpectators,

  // 添加踢出玩家的事件处理
  notifyPlayerKicked: (roomId, userId, kickedBy) => {
    if (!roomId || !rooms.has(roomId)) {
      return;
    }

    // 向被踢出的用户发送通知
    const userSocket = activeUsers.get(userId)?.socket;
    if (userSocket) {
      userSocket.emit('player.kicked', {
        roomId,
        kickedBy
      });
    }

    // 向房间内其他用户广播
    io.to(roomId).emit('player.kicked', {
      userId,
      kickedBy,
      updateTime: new Date().toISOString()
    });
  },

  // 添加踢出观众的事件处理
  notifySpectatorKicked: (roomId, userId, kickedBy) => {
    if (!roomId || !rooms.has(roomId)) {
      return;
    }

    // 向被踢出的用户发送通知
    const userSocket = activeUsers.get(userId)?.socket;
    if (userSocket) {
      userSocket.emit('spectator.kicked', {
        roomId,
        kickedBy
      });
    }

    // 向房间内其他用户广播
    io.to(roomId).emit('spectator.kicked', {
      userId,
      kickedBy,
      updateTime: new Date().toISOString()
    });
  },

  // 通知用户从观众席加入玩家列表
  notifySpectatorToPlayer: (roomId, userData) => {
    if (!roomId || !userData || !userData.userId) return false;

    // 更新内存中的用户角色
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const user = room.get(userData.userId);
      if (user) {
        user.role = 'player';
        room.set(userData.userId, user);
      }
    }

    // 通知房间内所有用户
    return notifyRoom(roomId, 'spectator.moveToPlayer', userData);
  },

  // 通知用户从玩家列表加入观众席
  notifyPlayerToSpectator: (roomId, userData) => {
    if (!roomId || !userData || !userData.userId) return false;

    // 更新内存中的用户角色
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const user = room.get(userData.userId);
      if (user) {
        user.role = 'spectator';
        room.set(userData.userId, user);
      }
    }

    // 通知房间内所有用户
    return notifyRoom(roomId, 'player.moveToSpectator', userData);
  }
};