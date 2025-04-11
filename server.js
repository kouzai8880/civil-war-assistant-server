/**
 * 游戏内战助手服务器程序
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { errorHandler } = require('./middleware/errorHandler');
const config = require('./config');
const { initSocketServer } = require('./utils/socket');
const socketHelper = require('./utils/socketHelper');
const lobby = require('./utils/lobby');
const lobbyRoutes = require('./routes/lobby');

// 路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const matchRoutes = require('./routes/matches');
const gameRoutes = require('./routes/games');

// 加载环境变量
dotenv.config();

// 初始化Express应用
const app = express();
const server = http.createServer(app);

// 配置中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS配置
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 初始化Socket.IO服务
const io = initSocketServer(server);

// 初始化socketHelper
socketHelper.init(io);

// 将socketHelper注入到req对象中
app.use((req, res, next) => {
  req.socketHelper = socketHelper;
  next();
});

// 注册大厅聊天事件处理
io.on('connection', (socket) => {
  // 加入大厅
  socket.on('joinLobby', () => {
    lobby.joinLobby({
      id: socket.userId,
      username: socket.username,
      avatar: socket.handshake.query.avatar
    }, socket);
  });

  // 离开大厅
  socket.on('leaveLobby', () => {
    lobby.leaveLobby(socket.userId);
  });

  // 发送大厅消息
  socket.on('lobbyMessage', (message) => {
    try {
      const newMessage = lobby.addMessage({
        userId: socket.userId,
        username: socket.username,
        avatar: socket.handshake.query.avatar,
        content: message.content,
        type: message.type
      });

      // 广播消息给所有大厅用户
      io.emit('lobbyMessage', newMessage);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // 获取历史消息
  socket.on('getLobbyHistory', (options, callback) => {
    try {
      const history = lobby.getChatHistory(options);
      callback(history);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // 更新用户状态
  socket.on('updateStatus', (data) => {
    lobby.updateUserStatus(socket.userId, data.status, data.currentRoom);
  });

  // 获取用户详情
  socket.on('getUserDetails', (userId, callback) => {
    const userDetails = lobby.getUserDetails(userId);
    callback({ user: userDetails });
  });

  // 断开连接
  socket.on('disconnect', () => {
    lobby.leaveLobby(socket.userId);
  });
});

// 设置API版本和基础路径
const API_VERSION = 'v1';
const BASE_PATH = `/api/${API_VERSION}`;

// 路由注册
app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/users`, userRoutes);
app.use(`${BASE_PATH}/rooms`, roomRoutes);
app.use(`${BASE_PATH}/matches`, matchRoutes);
app.use(`${BASE_PATH}/games`, gameRoutes);
app.use(`${BASE_PATH}/lobby`, lobbyRoutes);

// 基础路由
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: '游戏内战助手API服务正在运行',
    version: '1.0.0'
  });
});

// 错误处理中间件
app.use(errorHandler);

// 未找到路由处理
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 404
  });
});

// 启动服务器函数
const startServer = () => {
  const PORT = config.server.port;

  server.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
  });
};

// 数据库连接
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB 连接成功');
    startServer();
  })
  .catch(err => {
    console.error('MongoDB 连接失败:', err.message);
    console.log('将以无数据库模式启动服务器...');
    startServer();
  });

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM 信号接收到，关闭服务器');
  server.close(() => {
    console.log('服务器已关闭');
    mongoose.connection.close()
      .then(() => {
        console.log('MongoDB 连接已关闭');
        process.exit(0);
      })
      .catch((err) => {
        console.error('关闭MongoDB连接时出错:', err);
        process.exit(1);
      });
  });
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

module.exports = { app, server };