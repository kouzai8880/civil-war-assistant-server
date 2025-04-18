/**
 * Socket.IO通信工具类
 * 处理WebSocket连接和语音通信
 */

const socketIO = require('socket.io');
const { verifySocketToken } = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const socketHelper = require('./socketHelper');
const socketShared = require('./socketShared');

// 使用共享模块中的变量
const activeUsers = socketShared.activeUsers;
const rooms = socketShared.rooms;

// 房间列表更新通知频道
const ROOM_LIST_CHANNEL = 'roomList';

// 存储用户的Socket连接
const userSockets = new Map();
// 存储房间的用户
const roomUsers = new Map();
// 存储房间的观众
const roomSpectators = new Map();
// 存储正在进行语音通话的用户
const voiceUsers = new Map();

// 使用共享模块中的getIO函数获取io实例

/**
 * 初始化Socket.IO服务
 * @param {Object} server - HTTP服务器实例
 * @returns {Object} Socket.IO服务器实例
 */
function initSocketServer(server) {
  const io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // 设置共享模块中的IO实例
  socketShared.setIO(io);

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
      rooms: new Set(),
      voiceChannel: 'none' // 默认不在任何语音房间，可选值: 'none', 'public', 'team1', 'team2'
    });

    // 加入房间
    socket.on('joinRoom', async ({ roomId, password }) => {
      try {
        if (!roomId) {
          socket.emit('error', { message: '房间ID不能为空' });
          return;
        }

        // 打印用户信息
        console.log(`用户 ${socket.userId} 尝试加入房间 ${roomId}`);

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('error', { message: '房间不存在', code: 3001 });
          return;
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
            role: existingPlayer ? 'player' : 'spectator',
            voiceChannel: 'none' // 默认不在任何语音房间
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

          // 获取房间历史聊天记录
          console.log(`[聊天记录] 开始获取房间 ${roomId} 的历史聊天记录（重新连接）`);
          const Message = require('../models/Message');
          const messages = await Message.find({ roomId })
            .sort({ createTime: -1 })
            .limit(50)
            .populate('userId', 'username avatar')
            .lean();

          console.log(`[聊天记录] 从数据库获取到 ${messages.length} 条消息（重新连接）`);

          // 记录消息类型统计
          const messageTypes = {};
          const messageChannels = {};

          // 格式化消息数据
          const formattedMessages = messages.map(msg => {
            // 统计消息类型
            messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
            messageChannels[msg.channel] = (messageChannels[msg.channel] || 0) + 1;

            // 如果是系统消息，不需要用户信息
            if (msg.type === 'system') {
              return {
                id: msg._id,
                type: 'system',
                content: msg.content,
                createTime: msg.createTime
              };
            }

            // 普通用户消息
            return {
              id: msg._id,
              userId: msg.userId._id,
              username: msg.userId.username,
              avatar: msg.userId.avatar,
              content: msg.content,
              type: msg.type,
              channel: msg.channel,
              teamId: msg.teamId,
              createTime: msg.createTime
            };
          }).reverse(); // 将消息按时间正序排列

          // console.log(`[聊天记录] 获取房间 ${roomId} 的历史消息，共 ${formattedMessages.length} 条（重新连接）`);
          // console.log(`[聊天记录] 消息类型统计: ${JSON.stringify(messageTypes)}（重新连接）`);
          // console.log(`[聊天记录] 消息频道统计: ${JSON.stringify(messageChannels)}（重新连接）`);

          // 打印前几条消息的摘要信息供调试
          // if (formattedMessages.length > 0) {
          //   console.log(`[聊天记录] 最近消息摘要（重新连接）:`);
          //   const previewCount = Math.min(formattedMessages.length, 3);
          //   for (let i = 0; i < previewCount; i++) {
          //     const msg = formattedMessages[i];
          //     const contentPreview = msg.content.length > 20 ? msg.content.substring(0, 20) + '...' : msg.content;
          //     console.log(`  - [${new Date(msg.createTime).toLocaleString()}] ${msg.username}: ${contentPreview} (${msg.channel})`);
          //   }
          // }

          // 格式化房间数据
          const formattedRoom = formatRoomData(populatedRoom, roomUsers);

          // 获取各语音房间的用户列表
          const voiceChannels = {
            public: getVoiceChannelUsers(roomId, 'public'),
            team1: getVoiceChannelUsers(roomId, 'team1'),
            team2: getVoiceChannelUsers(roomId, 'team2')
          };

          // 将消息和语音房间数据添加到房间结构中
          formattedRoom.messages = formattedMessages;
          formattedRoom.voiceChannels = voiceChannels;

          socket.emit('roomJoined', {
            status: 'success',
            data: {
              room: formattedRoom
            },
            message: '重新连接房间成功'
          });

          console.log(`用户 ${socket.userId} 重新连接房间 ${roomId}`);
          return;
        } else {
            // 验证密码
          if (room.hasPassword) {
            const isValid = await room.verifyPassword(password);
            if (!isValid) {
              socket.emit('error', { message: '密码错误', code: 3004 });
              return;
            }
          }
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
          isCreator: spectator.isCreator,
          voiceChannel: 'none' // 默认不在任何语音房间
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

        // 获取房间历史聊天记录
        console.log(`[聊天记录] 开始获取房间 ${roomId} 的历史聊天记录`);
        const Message = require('../models/Message');
        const messages = await Message.find({ roomId })
          .sort({ createTime: -1 })
          .limit(50)
          .populate('userId', 'username avatar')
          .lean();

        console.log(`[聊天记录] 从数据库获取到 ${messages.length} 条消息`);

        // 记录消息类型统计
        const messageTypes = {};
        const messageChannels = {};

        // 格式化消息数据
        const formattedMessages = messages.map(msg => {
          // 统计消息类型
          messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
          messageChannels[msg.channel] = (messageChannels[msg.channel] || 0) + 1;

          // 如果是系统消息，不需要用户信息
          if (msg.type === 'system') {
            return {
              id: msg._id,
              type: 'system',
              content: msg.content,
              createTime: msg.createTime
            };
          }

          // 普通用户消息
          return {
            id: msg._id,
            userId: msg.userId._id,
            username: msg.userId.username,
            avatar: msg.userId.avatar,
            content: msg.content,
            type: msg.type,
            channel: msg.channel,
            teamId: msg.teamId,
            createTime: msg.createTime
          };
        }).reverse(); // 将消息按时间正序排列

        // console.log(`[聊天记录] 获取房间 ${roomId} 的历史消息，共 ${formattedMessages.length} 条`);
        // console.log(`[聊天记录] 消息类型统计: ${JSON.stringify(messageTypes)}`);
        // console.log(`[聊天记录] 消息频道统计: ${JSON.stringify(messageChannels)}`);

        // 格式化房间数据
        const formattedRoom = formatRoomData(populatedRoom, roomUsers);

        // 获取各语音房间的用户列表
        const voiceChannels = {
          public: getVoiceChannelUsers(roomId, 'public'),
          team1: getVoiceChannelUsers(roomId, 'team1'),
          team2: getVoiceChannelUsers(roomId, 'team2')
        };

        // 将消息和语音房间数据添加到房间结构中
        formattedRoom.messages = formattedMessages;
        formattedRoom.voiceChannels = voiceChannels;

        socket.emit('roomJoined', {
          status: 'success',
          data: {
            room: formattedRoom
          },
          message: '加入房间成功，已进入观众席'
        });

        console.log(`用户 ${socket.userId} 加入房间 ${roomId}`);

        // 发送系统消息通知房间内所有用户，并保存到数据库
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${user.username} 加入了房间`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }
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

        // 检查房间状态，只有在waiting状态才能离开房间
        if (room.status !== 'waiting') {
          // 观众可以随时离开
          const existingSpectator = room.spectators.find(s => s.userId.toString() === socket.userId);
          if (!existingSpectator) {
            socket.emit('error', {
              message: '游戏已经开始，玩家不能离开房间',
              code: 3004
            });
            return;
          }
        }

        // 检查用户是否在房间中
        const existingPlayer = room.players.find(p => p.userId.toString() === socket.userId);
        const existingSpectator = room.spectators.find(s => s.userId.toString() === socket.userId);

        let removeResult;
        if (existingPlayer) {
          // 从玩家列表中移除用户
          removeResult = room.removePlayer(socket.userId);
        } else if (existingSpectator) {
          // 从观众席中移除用户
          removeResult = room.removeSpectator(socket.userId);
        } else {
          // 用户不在房间中
          socket.emit('error', { message: '您不在该房间中', code: 3003 });
          return;
        }

        // 获取用户信息
        const user = await User.findById(socket.userId, 'username avatar');

        // 如果有新房主，发送roleChanged事件
        if (removeResult && removeResult.newCreator) {
          // 获取新房主的用户信息
          const newCreatorUser = await User.findById(removeResult.newCreator.userId, 'username avatar stats.totalGames stats.wins gameId');

          if (newCreatorUser) {
            // 获取房间详细信息
            const populatedRoom = await Room.findById(roomId)
              .populate('creatorId', 'username avatar')
              .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
              .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
              .populate('teams.captainId', 'username avatar');

            // 格式化房间数据
            const formattedRoom = formatRoomData(populatedRoom, rooms.get(roomId) || new Map());

            // 获取各语音房间的用户列表
            const voiceChannels = {
              public: getVoiceChannelUsers(roomId, 'public'),
              team1: getVoiceChannelUsers(roomId, 'team1'),
              team2: getVoiceChannelUsers(roomId, 'team2')
            };

            // 将消息和语音房间数据添加到房间结构中
            formattedRoom.voiceChannels = voiceChannels;
            formattedRoom.creatorName = removeResult.newCreator.role;
            formattedRoom.creatorId = removeResult.newCreator.userId;
            formattedRoom.creatorAvatar = newCreatorUser.avatar;

            // 通知房间内所有用户房主已更改
            socketShared.getIO().to(roomId).emit('roleChanged', {
              status: 'success',
              data: {
                room: formattedRoom,
                role: '',
                userId: removeResult.newCreator.userId,
                isCreator: true
              },
              message: `${user.username} 离开房间，${newCreatorUser.username} 成为新房主`
            });

            // 发送系统消息
            const creatorChangeMessage = await socketHelper.sendSystemMessage(
              roomId,
              `${user.username} 离开房间，${newCreatorUser.username} 成为新房主`
            );

            if (creatorChangeMessage.success) {
              socketShared.getIO().to(roomId).emit('new_message', creatorChangeMessage.message);
            }
          }
        }

        await room.save();

        // 将用户从房间中移除
        socket.leave(roomId);

        // 更新内存中的房间信息
        if (rooms.has(roomId)) {
          const roomUsers = rooms.get(roomId);
          roomUsers.delete(socket.userId);

          // 如果房间中没有用户了，从内存中删除房间信息
          if (roomUsers.size === 0) {
            rooms.delete(roomId);
            console.log(`房间 ${roomId} 没有在线用户了，从内存中删除房间信息`);

            // 通知所有客户端房间列表已更新
            const roomListNotifier = require('../utils/roomListNotifier');
            roomListNotifier.notifyRoomListUpdated('update', roomId);
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

        // 发送系统消息通知房间内所有用户，并保存到数据库
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${user.username} 离开了房间`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }
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

        // 检查房间状态，只有在waiting状态才能加入玩家列表
        if (room.status !== 'waiting') {
          socket.emit('error', {
            message: '游戏已经开始，不能加入玩家列表',
            code: 3004
          });
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

        // 确保用户加入Socket.IO房间
        socket.join(roomId);
        console.log(`用户 ${socket.userId} 在加入玩家列表时加入了Socket.IO房间 ${roomId}`);

        // 更新内存中的用户角色
        if (rooms.has(roomId)) {
          const roomUsers = rooms.get(roomId);
          const userInfo = roomUsers.get(socket.userId);
          if (userInfo) {
            userInfo.role = 'player';
            userInfo.teamId = teamId;
            roomUsers.set(socket.userId, userInfo);
          }
        } else {
          // 如果房间不存在，创建新的房间
          const roomUsers = new Map();
          roomUsers.set(socket.userId, {
            userId: socket.userId,
            username: socket.username,
            teamId: teamId,
            role: 'player',
            isCreator: player.isCreator,
            voiceChannel: 'none' // 默认不在任何语音房间
          });
          rooms.set(roomId, roomUsers);
        }

        // 更新用户的房间列表
        if (activeUsers.has(socket.userId)) {
          activeUsers.get(socket.userId).rooms.add(roomId);
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

        // 发送系统消息通知房间内所有用户，并保存到数据库
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${user.username} 从观众席加入了玩家列表`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }
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

        // 检查房间状态，只有在waiting状态才能切换到观众席
        if (room.status !== 'waiting') {
          socket.emit('error', {
            message: '游戏已经开始，不能切换到观众席',
            code: 3004
          });
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

        // 确保用户加入Socket.IO房间
        socket.join(roomId);
        console.log(`用户 ${socket.userId} 在加入观众席时加入了Socket.IO房间 ${roomId}`);

        // 更新内存中的用户角色
        if (rooms.has(roomId)) {
          const roomUsers = rooms.get(roomId);
          const userInfo = roomUsers.get(socket.userId);
          if (userInfo) {
            userInfo.role = 'spectator';
            userInfo.teamId = null;
            roomUsers.set(socket.userId, userInfo);
          }
        } else {
          // 如果房间不存在，创建新的房间
          const roomUsers = new Map();
          roomUsers.set(socket.userId, {
            userId: socket.userId,
            username: socket.username,
            teamId: null,
            role: 'spectator',
            isCreator: spectator.isCreator
          });
          rooms.set(roomId, roomUsers);
        }

        // 更新用户的房间列表
        if (activeUsers.has(socket.userId)) {
          activeUsers.get(socket.userId).rooms.add(roomId);
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

        // 发送系统消息通知房间内所有用户，并保存到数据库
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${user.username} 从玩家列表加入了观众席`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }
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

        // 检查用户是否在房间中
        const userInRoom = room.players.some(p => p.userId.toString() === socket.userId) ||
                          room.spectators.some(s => s.userId.toString() === socket.userId);

        // 将用户添加到Socket.IO房间
        socket.join(roomId);
        console.log(`用户 ${socket.userId} 在获取房间详情时加入了Socket.IO房间 ${roomId}`);

        // 更新内存中的房间信息
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        if (userInRoom) {
          const roomUsers = rooms.get(roomId);
          const isPlayer = room.players.some(p => p.userId.toString() === socket.userId);
          const player = room.players.find(p => p.userId.toString() === socket.userId);
          const spectator = room.spectators.find(s => s.userId.toString() === socket.userId);

          roomUsers.set(socket.userId, {
            userId: socket.userId,
            username: socket.username,
            teamId: isPlayer ? player.teamId : null,
            role: isPlayer ? 'player' : 'spectator',
            isCreator: isPlayer ? player.isCreator : (spectator ? spectator.isCreator : false)
          });

          // 更新用户的房间列表
          if (activeUsers.has(socket.userId)) {
            activeUsers.get(socket.userId).rooms.add(roomId);
          }

          // 更新socket的角色
          socket.role = isPlayer ? 'player' : 'spectator';
          socket.teamId = isPlayer ? player.teamId : null;
        }

        // 获取房间历史聊天记录
        console.log(`[聊天记录] 开始获取房间 ${roomId} 的历史聊天记录（getRoomDetail）`);
        const Message = require('../models/Message');
        const messages = await Message.find({ roomId })
          .sort({ createTime: -1 })
          .limit(50)
          .populate('userId', 'username avatar')
          .lean();

        console.log(`[聊天记录] 从数据库获取到 ${messages.length} 条消息（getRoomDetail）`);

        // 记录消息类型统计
        const messageTypes = {};
        const messageChannels = {};

        // 格式化消息数据
        const formattedMessages = messages.map(msg => {
          // 统计消息类型
          messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
          messageChannels[msg.channel] = (messageChannels[msg.channel] || 0) + 1;

          // 如果是系统消息，不需要用户信息
          if (msg.type === 'system') {
            return {
              id: msg._id,
              type: 'system',
              content: msg.content,
              createTime: msg.createTime
            };
          }

          // 普通用户消息
          return {
            id: msg._id,
            userId: msg.userId._id,
            username: msg.userId.username,
            avatar: msg.userId.avatar,
            content: msg.content,
            type: msg.type,
            channel: msg.channel,
            teamId: msg.teamId,
            createTime: msg.createTime
          };
        }).reverse(); // 将消息按时间正序排列

        // console.log(`[聊天记录] 获取房间 ${roomId} 的历史消息，共 ${formattedMessages.length} 条（getRoomDetail）`);
        // console.log(`[聊天记录] 消息类型统计: ${JSON.stringify(messageTypes)}（getRoomDetail）`);
        // console.log(`[聊天记录] 消息频道统计: ${JSON.stringify(messageChannels)}（getRoomDetail）`);

        // 格式化房间数据
        const formattedRoom = formatRoomData(room, rooms.get(roomId) || new Map());

        // 获取各语音房间的用户列表
        const voiceChannels = {
          public: getVoiceChannelUsers(roomId, 'public'),
          team1: getVoiceChannelUsers(roomId, 'team1'),
          team2: getVoiceChannelUsers(roomId, 'team2')
        };

        // 将消息和语音房间数据添加到房间结构中
        formattedRoom.messages = formattedMessages;
        formattedRoom.voiceChannels = voiceChannels;

        // 返回房间详情
        callback({
          status: 'success',
          data: {
            room: formattedRoom
          },
          message: '获取房间详情成功'
        });

        // 获取房间内的用户数量
        const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        console.log(`用户 ${socket.userId} 获取房间 ${roomId} 详情，房间内有 ${roomSize} 个连接`);
      } catch (error) {
        console.error('获取房间详情失败:', error);
        callback({
          status: 'error',
          message: '获取房间详情失败: ' + error.message,
          code: 3002
        });
      }
    });

    // 队长选择队员
    socket.on('captain.selectPlayer', async ({ roomId, teamId, playerId }, callback) => {
      try {
        if (!callback || typeof callback !== 'function') {
          socket.emit('error', { message: '缺少回调函数', code: 3002 });
          return;
        }

        if (!roomId || !teamId || !playerId) {
          callback({
            status: 'error',
            message: '缺少必要参数',
            code: 1001
          });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const room = await Room.findById(roomId);

        if (!room) {
          callback({
            status: 'error',
            message: '房间不存在',
            code: 3001
          });
          return;
        }

        // 检查房间状态
        if (room.status !== 'picking') {
          callback({
            status: 'error',
            message: '房间不在选人阶段',
            code: 3003
          });
          return;
        }

        // 检查是否是队长
        const captain = room.players.find(p =>
          p.userId.toString() === socket.userId &&
          p.teamId === parseInt(teamId) &&
          p.isCaptain
        );

        if (!captain) {
          callback({
            status: 'error',
            message: '只有队长可以选择队员',
            code: 1003
          });
          return;
        }

        // 查看未分配的玩家数量
        const unassignedPlayers = room.players.filter(p => p.teamId === null);

        // 队长选择队员
        const result = room.captainSelectPlayer(parseInt(teamId), playerId);

        // 如果只剩最后一名队员，自动分配
        if (unassignedPlayers.length === 2) { // 选择当前玩家后，将只剩1名未分配的玩家
          const lastPlayer = room.players.find(p => p.teamId === null);
          if (lastPlayer) {
            // 根据pickMode决定分配给哪个队伍
            if (room.pickMode === '12221') {
              lastPlayer.teamId = 1; // 12221模式分配给蓝队
            } else {
              lastPlayer.teamId = 2; // 其他模式分配给红队
            }
            // 进入选边阶段
            room.status = 'side_picking';
            room.nextTeamPick = null;
          }
        }

        await room.save();

        // 获取被选择的玩家信息
        const player = await User.findById(playerId, 'username avatar');

        // 通知房间内所有玩家
        notifyRoom(roomId, 'player.selected', {
          userId: playerId,
          username: player.username,
          avatar: player.avatar,
          teamId: parseInt(teamId),
          nextTeamPick: result.nextTeam,
          remainingPlayers: result.remainingPlayers.length
        });

        // 发送系统消息通知房间内所有用户，并保存到数据库
        const teamName = parseInt(teamId) === 1 ? '蓝队' : '红队';
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${player.username} 被选入${teamName}`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }

        // 如果自动分配了最后一名队员，也通知
        if (unassignedPlayers.length === 2 && room.status === 'gaming') {
          const lastPlayer = room.players.find(p => p.userId.toString() !== playerId);
          const lastPlayerInfo = await User.findById(lastPlayer.userId, 'username avatar');

          notifyRoom(roomId, 'player.selected', {
            userId: lastPlayer.userId,
            username: lastPlayerInfo.username,
            avatar: lastPlayerInfo.avatar,
            teamId: lastPlayer.teamId, // 使用实际分配的队伍ID
            nextTeamPick: null,
            remainingPlayers: 0,
            isAutoAssigned: true
          });
        }

        callback({
          status: 'success',
          data: {
            player: {
              userId: playerId,
              username: player.username,
              avatar: player.avatar,
              teamId: parseInt(teamId)
            },
            nextTeamPick: result.nextTeam,
            remainingPlayers: result.remainingPlayers.length,
            status: room.status,
            teams: room.teams
          },
          message: '队员选择成功'
        });
      } catch (error) {
        console.error('队长选择队员失败:', error);
        callback({
          status: 'error',
          message: error.message,
          code: 3004
        });
      }
    });

    // 队长选择红蓝方
    socket.on('captain.selectSide', async ({ roomId, teamId, side }, callback) => {
      try {
        if (!callback || typeof callback !== 'function') {
          socket.emit('error', { message: '缺少回调函数', code: 3002 });
          return;
        }

        if (!roomId || !teamId || !side) {
          callback({
            status: 'error',
            message: '请提供队伍ID和阵营',
            code: 1001
          });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const room = await Room.findById(roomId);

        if (!room) {
          callback({
            status: 'error',
            message: '房间不存在',
            code: 3001
          });
          return;
        }

        // 检查房间状态
        if (room.status !== 'gaming') {
          callback({
            status: 'error',
            message: '房间不在游戏阶段',
            code: 3003
          });
          return;
        }

        // 检查是否是队长
        const captain = room.players.find(p =>
          p.userId.toString() === socket.userId &&
          p.teamId === parseInt(teamId) &&
          p.isCaptain
        );

        if (!captain) {
          callback({
            status: 'error',
            message: '只有队长可以选择阵营',
            code: 1003
          });
          return;
        }

        // 选择阵营
        const teams = room.selectSide(parseInt(teamId), side);
        await room.save();

        // 通知房间内所有玩家
        notifyRoom(roomId, 'team.selected_side', {
          teamId: parseInt(teamId),
          side,
          teams: room.teams
        });

        // 发送系统消息通知房间内所有用户，并保存到数据库
        const teamName = parseInt(teamId) === 1 ? '蓝队' : '红队';
        const sideName = side === 'blue' ? '蓝方' : '红方';
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${teamName}选择了${sideName}，游戏即将开始`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }

        callback({
          status: 'success',
          data: {
            teams,
            teamId: parseInt(teamId),
            side,
            status: room.status
          },
          message: '阵营选择成功'
        });
      } catch (error) {
        console.error('选择阵营失败:', error);
        callback({
          status: 'error',
          message: error.message,
          code: 3004
        });
      }
    });

    // 发送消息
    socket.on('sendMessage', async ({ roomId, content, type = 'text', channel = 'public', teamId = null }, callback) => {
      console.log(`[消息处理] 收到发送消息请求，房间ID: ${roomId}, 发送者: ${socket.userId}, 频道: ${channel}`);

      try {
        if (!callback || typeof callback !== 'function') {
          socket.emit('error', { message: '缺少回调函数', code: 3002 });
          return;
        }

        if (!roomId || !content) {
          callback({
            status: 'error',
            message: '房间ID和消息内容不能为空',
            code: 3002
          });
          return;
        }

        // 查找房间
        const Room = require('../models/Room');
        const User = require('../models/User');
        const Message = require('../models/Message');
        const room = await Room.findById(roomId);

        if (!room) {
          callback({
            status: 'error',
            message: '房间不存在',
            code: 3001
          });
          return;
        }

        // 检查用户是否在房间中
        const player = room.players.find(p => p.userId.toString() === socket.userId);
        const spectator = room.spectators.find(s => s.userId.toString() === socket.userId);

        if (!player && !spectator) {
          callback({
            status: 'error',
            message: '您不在该房间中',
            code: 1003
          });
          return;
        }

        // 检查频道权限
        if (channel === 'team') {
          if (!teamId) {
            callback({
              status: 'error',
              message: '队伍消息必须指定队伍ID',
              code: 1001
            });
            return;
          }

          if (!player) {
            callback({
              status: 'error',
              message: '观众不能发送队伍消息',
              code: 1003
            });
            return;
          }

          if (player.teamId !== parseInt(teamId)) {
            callback({
              status: 'error',
              message: '您不在该队伍中',
              code: 1003
            });
            return;
          }
        }

        // 创建消息
        const message = new Message({
          roomId,
          userId: socket.userId,
          content,
          type,
          channel,
          teamId: channel === 'team' ? parseInt(teamId) : null,
          createTime: Date.now()
        });

        await message.save();

        // 获取用户信息
        const user = await User.findById(socket.userId, 'username avatar');

        // 格式化消息
        const formattedMessage = {
          id: message._id,
          userId: socket.userId,
          username: user.username,
          avatar: user.avatar,
          content: message.content,
          type: message.type,
          channel: message.channel,
          teamId: message.teamId,
          createTime: message.createTime
        };

        console.log(`[消息处理] 消息已保存到数据库，消息ID: ${message._id}`);

        // 通过Socket.IO广播消息
        if (channel === 'team') {
          console.log(`[消息处理] 发送队伍消息，队伍ID: ${teamId}, 消息ID: ${message._id}`);

          // 发送给队伍成员
          const teamNotifyResult = notifyTeam(roomId, parseInt(teamId), 'new_message', formattedMessage);
          console.log(`[消息处理] 队伍消息发送结果: ${teamNotifyResult ? '成功' : '失败'}`);

          // 同时发送给观众，但标记为队伍消息
          formattedMessage.isTeamMessage = true;
          const spectatorsNotifyResult = notifySpectators(roomId, 'new_message', formattedMessage);
          console.log(`[消息处理] 观众消息发送结果: ${spectatorsNotifyResult ? '成功' : '失败'}`);
        } else {
          console.log(`[消息处理] 发送公共消息，消息ID: ${message._id}`);

          // 公共消息发送给房间内除了发送者以外的所有人
          const roomNotifyResult = notifyRoom(roomId, 'new_message', formattedMessage, socket.userId);
          console.log(`[消息处理] 公共消息发送结果: ${roomNotifyResult ? '成功' : '失败'}`);

          // 获取房间在线用户数
          try {
            if (rooms.has(roomId)) {
              const onlineUsers = Array.from(rooms.get(roomId).keys());
              console.log(`[消息处理] 房间在线用户数: ${onlineUsers.length}, 用户列表: ${JSON.stringify(onlineUsers)}`);
            }
          } catch (error) {
            console.error(`[消息处理] 获取房间在线用户失败:`, error);
          }
        }

        // 返回成功响应
        callback({
          status: 'success',
          data: { message: formattedMessage },
          message: '消息发送成功'
        });

        console.log(`用户 ${socket.userId} 在房间 ${roomId} 发送了消息`);
      } catch (error) {
        console.error('发送消息失败:', error);
        callback({
          status: 'error',
          message: '发送消息失败: ' + error.message,
          code: 3002
        });
      }
    });

    // 加入语音房间
    socket.on('joinVoiceChannel', async ({ roomId, channel }) => {
      console.log(`[语音房间] 用户 ${socket.userId} 请求加入房间 ${roomId} 的 ${channel} 语音频道`);

      if (!roomId || !rooms.has(roomId)) {
        console.log(`[语音房间] 用户 ${socket.userId} 加入语音房间失败: 无效的房间ID ${roomId}`);
        socket.emit('error', { message: '无效的房间ID' });
        return;
      }

      // 验证语音房间类型
      if (!['public', 'team1', 'team2'].includes(channel)) {
        console.log(`[语音房间] 用户 ${socket.userId} 加入语音房间失败: 无效的语音房间类型 ${channel}`);
        socket.emit('error', { message: '无效的语音房间类型' });
        return;
      }

      // 获取用户信息
      const user = activeUsers.get(socket.userId);
      if (!user) {
        console.log(`[语音房间] 用户 ${socket.userId} 加入语音房间失败: 用户未连接`);
        socket.emit('error', { message: '用户未连接' });
        return;
      }

      // 获取房间用户信息
      const roomUsers = rooms.get(roomId);
      const roomUser = roomUsers.get(socket.userId);
      if (!roomUser) {
        console.log(`[语音房间] 用户 ${socket.userId} 加入语音房间失败: 用户不在房间 ${roomId} 中`);
        socket.emit('error', { message: '您不在该房间中' });
        return;
      }

      console.log(`[语音房间] 用户 ${socket.userId} 当前的语音房间状态: ${roomUser.voiceChannel}`);
      console.log(`[语音房间] 房间 ${roomId} 的语音房间用户数量: public=${getVoiceChannelUsers(roomId, 'public').length}, team1=${getVoiceChannelUsers(roomId, 'team1').length}, team2=${getVoiceChannelUsers(roomId, 'team2').length}`);


      // 如果用户已经在该语音房间中，则不做任何操作
      if (roomUser.voiceChannel === channel) {
        console.log(`[语音房间] 用户 ${socket.userId} 已经在房间 ${roomId} 的 ${channel} 语音频道中，不需要重新加入`);
        socket.emit('voiceChannelJoined', {
          status: 'success',
          data: { channel },
          message: `您已经在${getChannelName(channel)}中`
        });
        return;
      }

      // 如果用户在其他语音房间中，先离开原来的语音房间
      if (roomUser.voiceChannel !== 'none') {
        console.log(`[语音房间] 用户 ${socket.userId} 先从房间 ${roomId} 的 ${roomUser.voiceChannel} 语音频道离开，然后加入 ${channel} 频道`);

        // 获取原语音房间的其他用户数量
        const previousChannelUsers = getVoiceChannelUsers(roomId, roomUser.voiceChannel).filter(u => u.userId !== socket.userId);
        console.log(`[语音房间] 房间 ${roomId} 的 ${roomUser.voiceChannel} 频道有 ${previousChannelUsers.length} 个其他用户`);

        // 通知原语音房间的其他用户
        notifyVoiceChannelUsers(roomId, roomUser.voiceChannel, 'userLeftVoiceChannel', {
          userId: socket.userId,
          username: socket.username,
          previousChannel: roomUser.voiceChannel,
          newChannel: channel
        }, socket.userId);

        // 从数据库中获取用户信息，确保我们有正确的用户名
        let username = socket.username || user.username || socket.userId || '未知用户';
        try {
          const User = require('../models/User');
          const userDoc = await User.findById(socket.userId, 'username');
          if (userDoc && userDoc.username) {
            username = userDoc.username;
            console.log(`从数据库中获取到用户名: ${username}`);
          }
        } catch (error) {
          console.error('从数据库中获取用户名失败:', error);
        }

        // 发送系统消息
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${username} 离开了${getChannelName(roomUser.voiceChannel)}`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }
      }

      // 更新用户的语音房间
      roomUser.voiceChannel = channel;
      roomUsers.set(socket.userId, roomUser);
      user.voiceChannel = channel;

      // 通知新语音房间的其他用户
      notifyVoiceChannelUsers(roomId, channel, 'userJoinedVoiceChannel', {
        userId: socket.userId,
        username: socket.username,
        channel
      }, socket.userId);

      // 从数据库中获取用户信息，确保我们有正确的用户名
      let username = socket.username || user.username || socket.userId || '未知用户';
      try {
        const User = require('../models/User');
        const userDoc = await User.findById(socket.userId, 'username');
        if (userDoc && userDoc.username) {
          username = userDoc.username;
          console.log(`从数据库中获取到用户名: ${username}`);
        }
      } catch (error) {
        console.error('从数据库中获取用户名失败:', error);
      }

      // 发送系统消息
      const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${username} 加入了${getChannelName(channel)}`);
      if (systemMessageResult.success) {
        notifyRoom(roomId, 'new_message', systemMessageResult.message);
      }

      // // 向用户发送加入成功的消息
      // socket.emit('voiceChannelJoined', {
      //   status: 'success',
      //   data: { channel },
      //   message: `加入${getChannelName(channel)}成功`
      // });

      // 向房间内所有用户广播用户加入语音房间的事件
      socketShared.getIO().to(roomId).emit('voiceChannelJoined', {
        status: 'success',
        data: {
          userId: socket.userId,
          username: username,
          channel: channel,
          teamId: roomUser.teamId,
          role: roomUser.role
        },
        message: `${username} 加入了${getChannelName(channel)}`
      });

      // 向用户发送当前语音房间的其他用户列表
      const channelUsers = getVoiceChannelUsers(roomId, channel);
      socket.emit('voiceChannelUsers', {
        channel,
        users: channelUsers
      });

      console.log(`用户 ${socket.userId} 加入了语音房间 ${channel}`);
    });

    // 离开语音房间
    socket.on('leaveVoiceChannel', async ({ roomId }) => {
      if (!roomId || !rooms.has(roomId)) {
        socket.emit('error', { message: '无效的房间ID' });
        return;
      }

      // 获取用户信息
      const user = activeUsers.get(socket.userId);
      if (!user) {
        socket.emit('error', { message: '用户未连接' });
        return;
      }

      // 获取房间用户信息
      const roomUsers = rooms.get(roomId);
      const roomUser = roomUsers.get(socket.userId);
      if (!roomUser) {
        socket.emit('error', { message: '您不在该房间中' });
        return;
      }

      // 如果用户不在任何语音房间中，则不做任何操作
      if (roomUser.voiceChannel === 'none') {
        socket.emit('voiceChannelLeft', {
          status: 'success',
          message: '您已经不在任何语音房间中'
        });
        return;
      }

      // 保存当前的语音房间，用于通知其他用户
      const previousChannel = roomUser.voiceChannel;

      // 更新用户的语音房间
      roomUser.voiceChannel = 'none';
      roomUsers.set(socket.userId, roomUser);
      user.voiceChannel = 'none';

      // 通知原语音房间的其他用户
      notifyVoiceChannelUsers(roomId, previousChannel, 'userLeftVoiceChannel', {
        userId: socket.userId,
        username: socket.username,
        previousChannel
      }, socket.userId);

      // 从数据库中获取用户信息，确保我们有正确的用户名
      let username = socket.username || user.username || socket.userId || '未知用户';
      try {
        const User = require('../models/User');
        const userDoc = await User.findById(socket.userId, 'username');
        if (userDoc && userDoc.username) {
          username = userDoc.username;
          console.log(`从数据库中获取到用户名: ${username}`);
        }
      } catch (error) {
        console.error('从数据库中获取用户名失败:', error);
      }

      // 发送系统消息
      const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${username} 离开了${getChannelName(previousChannel)}`);
      if (systemMessageResult.success) {
        notifyRoom(roomId, 'new_message', systemMessageResult.message);
      }

      // 向用户发送离开成功的消息
      socket.emit('voiceChannelLeft', {
        status: 'success',
        message: `离开${getChannelName(previousChannel)}成功`
      });

      // 向房间内所有用户广播用户离开语音房间的事件
      socketShared.getIO().to(roomId).emit('voiceChannelLeft', {
        status: 'success',
        data: {
          userId: socket.userId,
          username: username,
          previousChannel: previousChannel,
          teamId: roomUser.teamId,
          role: roomUser.role
        },
        message: `${username} 离开了${getChannelName(previousChannel)}`
      });

      console.log(`用户 ${socket.userId} 离开了语音房间 ${previousChannel}`);
    });

    // 踢出玩家
    socket.on('kickPlayer', async ({ roomId, targetUserId }) => {
      if (!roomId || !rooms.has(roomId)) {
        socket.emit('error', { message: '无效的房间ID' });
        return;
      }

      if (!targetUserId) {
        socket.emit('error', { message: '请提供要踢出的用户ID' });
        return;
      }

      try {
        // 查找房间
        const Room = require('../models/Room');
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('error', { message: '房间不存在' });
          return;
        }

        // 检查是否是房主
        if (room.creatorId.toString() !== socket.userId) {
          socket.emit('error', { message: '只有房主可以踢出玩家' });
          return;
        }

        // 检查目标用户是否在房间中
        const playerIndex = room.players.findIndex(p => p.userId.toString() === targetUserId);
        const spectatorIndex = room.spectators.findIndex(s => s.userId.toString() === targetUserId);

        if (playerIndex === -1 && spectatorIndex === -1) {
          socket.emit('error', { message: '该用户不在房间中' });
          return;
        }

        // 不能踢出自己
        if (targetUserId === socket.userId) {
          socket.emit('error', { message: '不能踢出自己' });
          return;
        }

        // 从数据库中获取目标用户的用户名
        const User = require('../models/User');
        const targetUser = await User.findById(targetUserId, 'username');
        if (!targetUser) {
          socket.emit('error', { message: '目标用户不存在' });
          return;
        }

        // 使用removeUser方法移除用户
        const result = room.removeUser(targetUserId);

        if (!result) {
          socket.emit('error', { message: '踢出用户失败' });
          return;
        }

        const { type: leaveType } = result;

        // 保存房间
        await room.save();

        // 发送系统消息
        const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${targetUser.username} 被房主踢出了房间`);
        if (systemMessageResult.success) {
          notifyRoom(roomId, 'new_message', systemMessageResult.message);
        }

        // 直接通知被踢出的用户
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === targetUserId);
        if (targetSocket) {
          if (leaveType === 'player') {
            targetSocket.emit('player.kicked', {
              roomId,
              kickedBy: socket.userId
            });
          } else {
            targetSocket.emit('spectator.kicked', {
              roomId,
              kickedBy: socket.userId
            });
          }

          // 将用户从房间中移除
          targetSocket.leave(roomId);

          // 更新用户的房间列表
          const targetUser = activeUsers.get(targetUserId);
          if (targetUser) {
            targetUser.rooms.delete(roomId);
          }

          // 从房间用户列表中移除
          if (rooms.has(roomId)) {
            const roomUsers = rooms.get(roomId);
            roomUsers.delete(targetUserId);
          }
        }

        // 通知房间内其他用户
        if (leaveType === 'player') {
          notifyRoom(roomId, 'player.kicked', {
            userId: targetUserId,
            kickedBy: socket.userId
          }, targetUserId);
        } else {
          notifyRoom(roomId, 'spectator.kicked', {
            userId: targetUserId,
            kickedBy: socket.userId
          }, targetUserId);
        }

        // 发送成功响应
        socket.emit('kickPlayer.success', {
          targetUserId,
          message: '已踢出用户'
        });
      } catch (error) {
        console.error('踢出用户失败:', error);
        socket.emit('error', { message: `踢出用户失败: ${error.message}` });
      }
    });

    // 处理语音数据
    socket.on('voiceData', ({ roomId, data }) => {
      if (!roomId || !rooms.has(roomId) || !data) {
        return;
      }

      // 每100个语音包记录一次日志，避免日志过多
      if (Math.random() < 0.01) {
        console.log(`[语音数据] 收到用户 ${socket.userId} 在房间 ${roomId} 的语音数据，大小: ${data.length} 字节`);
      }

      // 获取用户信息
      const user = activeUsers.get(socket.userId);
      if (!user) return;

      // 获取房间用户信息
      const roomUsers = rooms.get(roomId);
      const roomUser = roomUsers.get(socket.userId);
      if (!roomUser) return;

      // 如果用户不在任何语音房间中，则不发送语音数据
      if (roomUser.voiceChannel === 'none') return;

      // 获取同一语音房间的其他用户
      const channelUsers = Array.from(roomUsers.values())
        .filter(u => u.voiceChannel === roomUser.voiceChannel && u.userId !== socket.userId)
        .map(u => activeUsers.get(u.userId))
        .filter(u => u && u.socket);

      // 向同一语音房间的其他用户发送语音数据
      channelUsers.forEach(channelUser => {
        channelUser.socket.emit('voiceData', {
          from: socket.userId,
          username: socket.username,
          channel: roomUser.voiceChannel,
          data
        });
      });
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

      // 获取房间用户信息
      const roomUsers = rooms.get(roomId);
      const roomUser = roomUsers.get(socket.userId);
      if (!roomUser) {
        socket.emit('error', { message: '您不在该房间中' });
        return;
      }

      // 如果用户不在任何语音房间中，则不做任何操作
      if (roomUser.voiceChannel === 'none') {
        socket.emit('error', { message: '您不在任何语音房间中' });
        return;
      }

      // 更新用户的静音状态
      user.isMuted = isMuted;

      // 通知同一语音房间的其他用户
      notifyVoiceChannelUsers(roomId, roomUser.voiceChannel, 'voiceMuteUpdate', {
        userId: socket.userId,
        username: socket.username,
        channel: roomUser.voiceChannel,
        isMuted
      }, socket.userId);

      console.log(`用户 ${socket.userId} 在房间 ${roomId} 的静音状态更新为: ${isMuted}`);
    });

    // 断开连接
    socket.on('disconnect', async () => {
      const user = activeUsers.get(socket.userId);
      if (user) {
        // 从数据库中获取用户信息，确保我们有正确的用户名
        let username = user.username || socket.userId || '未知用户';
        try {
          const User = require('../models/User');
          const userDoc = await User.findById(socket.userId, 'username');
          if (userDoc && userDoc.username) {
            username = userDoc.username;
            console.log(`从数据库中获取到用户名: ${username}`);
          }
        } catch (error) {
          console.error('从数据库中获取用户名失败:', error);
        }

        // 从所有房间中移除用户
        for (const roomId of user.rooms) {
          if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.delete(socket.userId);

            // 如果用户在语音房间中，先离开语音房间
            const roomUser = room.get(socket.userId);
            if (roomUser && roomUser.voiceChannel !== 'none') {
              // 通知同一语音房间的其他用户
              notifyVoiceChannelUsers(roomId, roomUser.voiceChannel, 'userLeftVoiceChannel', {
                userId: socket.userId,
                username,
                previousChannel: roomUser.voiceChannel
              }, socket.userId);

              // 发送系统消息
              const voiceSystemMessageResult = await socketHelper.sendSystemMessage(roomId, `${username} 离开了${getChannelName(roomUser.voiceChannel)}`);
              if (voiceSystemMessageResult.success) {
                socketShared.getIO().to(roomId).emit('new_message', voiceSystemMessageResult.message);
              }
            }

            // 如果用户是房主，需要处理房主转移
            if (roomUser && roomUser.isCreator) {
              try {
                const Room = require('../models/Room');
                const dbRoom = await Room.findById(roomId);

                if (dbRoom) {
                  let removeResult;
                  if (roomUser.role === 'player') {
                    removeResult = dbRoom.removePlayer(socket.userId);
                  } else if (roomUser.role === 'spectator') {
                    removeResult = dbRoom.removeSpectator(socket.userId);
                  }

                  // 如果有新房主，发送roleChanged事件
                  if (removeResult && removeResult.newCreator) {
                    // 获取新房主的用户信息
                    const User = require('../models/User');
                    const newCreatorUser = await User.findById(removeResult.newCreator.userId, 'username avatar stats.totalGames stats.wins gameId');

                    if (newCreatorUser) {
                      // 获取房间详细信息
                      const populatedRoom = await dbRoom.constructor.findById(roomId)
                        .populate('creatorId', 'username avatar')
                        .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
                        .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
                        .populate('teams.captainId', 'username avatar');

                      // 格式化房间数据
                      const formattedRoom = formatRoomData(populatedRoom, rooms.get(roomId) || new Map());

                      // 获取各语音房间的用户列表
                      const voiceChannels = {
                        public: getVoiceChannelUsers(roomId, 'public'),
                        team1: getVoiceChannelUsers(roomId, 'team1'),
                        team2: getVoiceChannelUsers(roomId, 'team2')
                      };

                      // 将语音房间数据添加到房间结构中
                      formattedRoom.voiceChannels = voiceChannels;

                      // 通知房间内所有用户房主已更改
                      socketShared.getIO().to(roomId).emit('roleChanged', {
                        status: 'success',
                        data: {
                          room: formattedRoom,
                          role: removeResult.newCreator.role,
                          userId: removeResult.newCreator.userId,
                          isCreator: true
                        },
                        message: `${username} 断开连接，${newCreatorUser.username} 成为新房主`
                      });

                      // 发送系统消息
                      const creatorChangeMessage = await socketHelper.sendSystemMessage(
                        roomId,
                        `${username} 断开连接，${newCreatorUser.username} 成为新房主`
                      );

                      if (creatorChangeMessage.success) {
                        socketShared.getIO().to(roomId).emit('new_message', creatorChangeMessage.message);
                      }
                    }
                  }

                  await dbRoom.save();
                }
              } catch (error) {
                console.error(`处理房主断开连接时出错:`, error);
              }
            }

            // 如果房间为空，从内存中删除房间信息
            if (room.size === 0) {
              rooms.delete(roomId);
              console.log(`房间 ${roomId} 没有在线用户了，从内存中删除房间信息`);

              // 通知所有客户端房间列表已更新
              const roomListNotifier = require('../utils/roomListNotifier');
              roomListNotifier.notifyRoomListUpdated('update', roomId);
            } else {
              // 通知房间内其他用户该用户已离开
              socket.to(roomId).emit('userLeft', {
                userId: socket.userId
              });

              // 发送系统消息通知房间内所有用户，并保存到数据库
              const systemMessageResult = await socketHelper.sendSystemMessage(roomId, `${username} 断开了连接`);
              if (systemMessageResult.success) {
                // 使用io直接发送，因为用户已经断开连接，socket不可用
                socketShared.getIO().to(roomId).emit('new_message', systemMessageResult.message);
              }
            }
          }
        }

        // 从活跃用户列表中移除
        activeUsers.delete(socket.userId);
      }

      console.log(`用户断开连接: ${socket.userId}`);
    });
  });

  return io;
}

// 获取语音房间名称
function getChannelName(channel) {
  switch (channel) {
    case 'public': return '公共语音房间';
    case 'team1': return '一队语音房间';
    case 'team2': return '二队语音房间';
    default: return '未知语音房间';
  }
}

// 获取语音房间的用户列表
function getVoiceChannelUsers(roomId, channel) {
  if (!roomId || !rooms.has(roomId)) return [];

  return Array.from(rooms.get(roomId).values())
    .filter(u => u.voiceChannel === channel)
    .map(u => ({
      userId: u.userId,
      username: u.username,
      teamId: u.teamId,
      role: u.role
    }));
}

// 通知语音房间的用户
function notifyVoiceChannelUsers(roomId, channel, event, data, excludeUserId = null) {
  if (!roomId || !rooms.has(roomId)) return false;

  const roomUsers = rooms.get(roomId);
  const channelUsers = Array.from(roomUsers.values())
    .filter(u => u.voiceChannel === channel && u.userId !== excludeUserId)
    .map(u => activeUsers.get(u.userId))
    .filter(u => u && u.socket);

  channelUsers.forEach(user => {
    user.socket.emit(event, {
      ...data,
      updateTime: new Date().toISOString()
    });
  });

  return true;
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
  socketShared.getIO().to(roomId).emit('roomStatusUpdate', {
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
  socketShared.getIO().to(roomId).emit('playerStatusUpdate', {
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
  socketShared.getIO().to(roomId).emit('teamUpdate', {
    roomId,
    teamId,
    ...teamData,
    updateTime: new Date().toISOString()
  });
}

// 通知房间内所有用户
function notifyRoom(roomId, event, data, excludeUserId = null) {
  console.log(`[Socket通知] 准备向房间 ${roomId} 发送事件 ${event}${excludeUserId ? '，排除用户 ' + excludeUserId : ''}`);

  if (!roomId || !socketShared.getIO()) {
    console.error(`[Socket通知] 房间ID无效或io实例不存在，无法发送事件 ${event}`);
    return false;
  }

  // 获取房间内的用户数量
  const roomSize = socketShared.getIO().sockets.adapter.rooms.get(roomId)?.size || 0;
  console.log(`[Socket通知] 房间 ${roomId} 当前有 ${roomSize} 个连接`);

  const eventData = {
    ...data,
    updateTime: new Date().toISOString()
  };

  if (excludeUserId) {
    // 如果需要排除特定用户，则使用广播到房间内除了该用户以外的所有用户
    const userSocket = activeUsers.get(excludeUserId)?.socket;
    if (userSocket) {
      userSocket.to(roomId).emit(event, eventData);
      console.log(`[Socket通知] 已向房间 ${roomId} 中除用户 ${excludeUserId} 外的所有用户发送事件 ${event}`);
    } else {
      // 如果找不到要排除的用户的socket，则发送给所有人
      socketShared.getIO().to(roomId).emit(event, eventData);
      console.log(`[Socket通知] 找不到用户 ${excludeUserId} 的socket，已向房间 ${roomId} 所有用户发送事件 ${event}`);
    }
  } else {
    // 如果不需要排除任何用户，则发送给房间内所有用户
    socketShared.getIO().to(roomId).emit(event, eventData);
    console.log(`[Socket通知] 已向房间 ${roomId} 所有用户发送事件 ${event}`);
  }

  return true;
}

// 通知特定用户
function notifyUser(userId, event, data) {
  if (!userId || !socketShared.getIO()) return false;
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
  console.log(`[Socket通知] 准备向房间 ${roomId} 的队伍 ${teamId} 发送事件 ${event}`);

  if (!roomId || !teamId || !socketShared.getIO()) {
    console.error(`[Socket通知] 房间ID或队伍ID无效，无法发送队伍事件 ${event}`);
    return false;
  }

  // 获取队伍成员
  const teamMembers = Array.from(rooms.get(roomId)?.values() || [])
    .filter(user => user.teamId === teamId)
    .map(user => user.userId);

  console.log(`[Socket通知] 队伍 ${teamId} 有 ${teamMembers.length} 名成员: ${JSON.stringify(teamMembers)}`);

  // 向队伍成员发送通知
  let sentCount = 0;
  teamMembers.forEach(userId => {
    const userSocket = activeUsers.get(userId)?.socket;
    if (userSocket) {
      userSocket.emit(event, {
        ...data,
        updateTime: new Date().toISOString()
      });
      sentCount++;
    } else {
      console.log(`[Socket通知] 用户 ${userId} 的Socket不存在，无法发送队伍事件`);
    }
  });

  console.log(`[Socket通知] 已向 ${sentCount}/${teamMembers.length} 名队伍成员发送事件 ${event}`);
  return true;
}

// 通知观众
function notifySpectators(roomId, event, data) {
  console.log(`[Socket通知] 准备向房间 ${roomId} 的观众发送事件 ${event}`);

  if (!roomId || !socketShared.getIO()) {
    console.error(`[Socket通知] 房间ID无效，无法发送观众事件 ${event}`);
    return false;
  }

  // 获取观众
  const spectators = Array.from(rooms.get(roomId)?.values() || [])
    .filter(user => user.role === 'spectator')
    .map(user => user.userId);

  console.log(`[Socket通知] 房间 ${roomId} 有 ${spectators.length} 名观众: ${JSON.stringify(spectators)}`);

  // 向观众发送通知
  let sentCount = 0;
  spectators.forEach(userId => {
    const userSocket = activeUsers.get(userId)?.socket;
    if (userSocket) {
      userSocket.emit(event, {
        ...data,
        updateTime: new Date().toISOString()
      });
      sentCount++;
    } else {
      console.log(`[Socket通知] 用户 ${userId} 的Socket不存在，无法发送观众事件`);
    }
  });

  console.log(`[Socket通知] 已向 ${sentCount}/${spectators.length} 名观众发送事件 ${event}`);
  return true;
}

// 获取房间在线用户
// 使用共享模块中的函数
const getRoomOnlineUsers = socketShared.getRoomOnlineUsers;
const getRoomSpectators = socketShared.getRoomSpectators;

// 暴露状态更新函数，以便控制器使用
module.exports = {
  initSocketServer,
  getIO: socketShared.getIO,
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
    socketShared.getIO().to(roomId).emit('player.kicked', {
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
    socketShared.getIO().to(roomId).emit('spectator.kicked', {
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