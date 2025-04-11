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
    socket.on('joinRoom', ({ roomId }) => {
      if (!roomId) {
        socket.emit('error', { message: '房间ID不能为空' });
        return;
      }
      
      // 将用户添加到房间
      socket.join(roomId);
      
      // 更新房间信息
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      
      const room = rooms.get(roomId);
      room.set(socket.userId, {
        userId: socket.userId,
        username: socket.username,
        teamId: socket.teamId,
        role: socket.role
      });
      
      // 更新用户的房间列表
      activeUsers.get(socket.userId).rooms.add(roomId);
      
      // 通知房间内其他用户有新用户加入
      socket.to(roomId).emit('userJoined', {
        userId: socket.userId,
        username: socket.username,
        teamId: socket.teamId,
        role: socket.role
      });
      
      // 向新加入的用户发送房间当前状态
      const roomState = {
        roomId,
        users: Array.from(room.values())
      };
      socket.emit('roomState', roomState);
      
      console.log(`用户 ${socket.userId} 加入房间 ${roomId}`);
    });
    
    // 离开房间
    socket.on('leaveRoom', ({ roomId }) => {
      if (!roomId) {
        socket.emit('error', { message: '房间ID不能为空' });
        return;
      }
      
      socket.leave(roomId);
      
      // 更新房间信息
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
      
      // 更新用户的房间列表
      if (activeUsers.has(socket.userId)) {
        activeUsers.get(socket.userId).rooms.delete(roomId);
      }
      
      console.log(`用户 ${socket.userId} 离开房间 ${roomId}`);
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

// 暴露状态更新函数，以便控制器使用
module.exports = {
  initSocketServer,
  getIO: () => io,
  emitRoomStatusUpdate,
  emitPlayerStatusUpdate,
  emitTeamUpdate,
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
  }
}; 