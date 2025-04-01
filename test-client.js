const { io } = require('socket.io-client');

// 连接到服务器
const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZTkzZmE0YjcxY2NhZTE1OTdkY2ExMyIsImlhdCI6MTc0MzUwNzE1MiwiZXhwIjoxNzQ2MDk5MTUyfQ.dj3BRUm934DKswEuT8JOA3FkT9MLOJX8dTbl7YA8sbE'
  },
  query: {
    avatar: 'https://example.com/avatar.jpg'
  }
});

// 连接成功
socket.on('connect', () => {
  console.log('Connected to server');
  
  // 加入大厅
  socket.emit('joinLobby');
  
  // 发送测试消息
  socket.emit('lobbyMessage', {
    content: 'Hello from test client!',
    type: 'text'
  });
  
  // 获取聊天历史
  socket.emit('getLobbyHistory', {}, (history) => {
    console.log('Chat history:', history);
  });
});

// 监听大厅消息
socket.on('lobbyMessage', (message) => {
  console.log('Received message:', message);
});

// 监听用户状态更新
socket.on('lobbyUserStatus', (update) => {
  console.log('User status update:', update);
});

// 监听错误
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// 监听连接错误
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// 断开连接
socket.on('disconnect', () => {
  console.log('Disconnected from server');
}); 