/**
 * 大厅聊天功能测试
 * 测试内容：
 * 1. 加入/离开大厅
 * 2. 发送和接收消息
 * 3. 获取历史消息
 * 4. 用户状态更新
 * 5. 获取用户详情
 */

const io = require('socket.io-client');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const config = require('../config');

// 配置
const SERVER_URL = config.test.socketUrl;
const JWT_SECRET = config.server.jwtSecret;

// 测试用户
const users = {
  user1: {
    id: 'test-user-1',
    username: 'TestUser1',
    avatar: 'https://example.com/avatar1.jpg'
  },
  user2: {
    id: 'test-user-2',
    username: 'TestUser2',
    avatar: 'https://example.com/avatar2.jpg'
  },
  user3: {
    id: 'test-user-3',
    username: 'TestUser3',
    avatar: 'https://example.com/avatar3.jpg'
  }
};

// 创建用户令牌
function createUserToken(userId, username) {
  return jwt.sign(
    { id: userId, username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// 创建Socket连接
function createSocketConnection(user) {
  const token = createUserToken(user.id, user.username);
  console.log(`创建连接 - 用户: ${user.username}`);
  
  return io(SERVER_URL, {
    auth: { token },
    query: {
      avatar: user.avatar
    },
    transports: ['websocket'],
    reconnection: false
  });
}

// 等待指定时间
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
async function runTests() {
  console.log('开始大厅聊天测试...');
  
  // 连接所有用户
  const sockets = {};
  for (const [key, user] of Object.entries(users)) {
    sockets[key] = createSocketConnection(user);
    
    sockets[key].on('connect', () => {
      console.log(`${user.username} 已连接`);
    });
    
    sockets[key].on('connect_error', (error) => {
      console.error(`${user.username} 连接错误:`, error.message);
    });
  }
  
  // 等待连接建立
  await wait(1000);
  
  // 测试1: 加入大厅
  console.log('\n测试1: 加入大厅');
  for (const [key, socket] of Object.entries(sockets)) {
    socket.emit('joinLobby');
  }
  await wait(1000);
  
  // 测试2: 发送和接收消息
  console.log('\n测试2: 发送和接收消息');
  const messageContent = '大家好！';
  const receivedMessages = new Set();
  
  // 设置消息接收监听器
  for (const [key, socket] of Object.entries(sockets)) {
    socket.on('lobbyMessage', (message) => {
      console.log(`${users[key].username} 收到消息:`, message.content);
      receivedMessages.add(message.id);
    });
  }
  
  // 发送消息
  sockets.user1.emit('lobbyMessage', {
    content: messageContent,
    type: 'text'
  });
  
  // 等待消息传递
  await wait(1000);
  
  // 验证所有用户都收到了消息
  assert.strictEqual(receivedMessages.size, 3, '所有用户都应该收到消息');
  console.log('测试2通过: 消息发送和接收正常工作');
  
  // 测试3: 获取历史消息
  console.log('\n测试3: 获取历史消息');
  const historyMessages = new Set();
  
  // 发送更多消息
  for (let i = 0; i < 5; i++) {
    sockets.user2.emit('lobbyMessage', {
      content: `测试消息 ${i + 1}`,
      type: 'text'
    });
    await wait(100);
  }
  
  // 获取历史消息
  sockets.user3.emit('getLobbyHistory', { limit: 5 }, (response) => {
    console.log('历史消息:', response.messages);
    response.messages.forEach(msg => historyMessages.add(msg.id));
  });
  
  await wait(1000);
  
  // 验证历史消息
  assert.strictEqual(historyMessages.size, 5, '应该获取到5条历史消息');
  console.log('测试3通过: 历史消息获取正常工作');
  
  // 测试4: 用户状态更新
  console.log('\n测试4: 用户状态更新');
  const statusUpdates = new Set();
  
  // 设置状态更新监听器
  for (const [key, socket] of Object.entries(sockets)) {
    socket.on('lobbyUserStatus', (update) => {
      console.log(`${users[key].username} 收到状态更新:`, update);
      statusUpdates.add(update.userId);
    });
  }
  
  // 模拟用户进入游戏
  sockets.user1.emit('updateStatus', { status: 'in-game', currentRoom: 'room-123' });
  
  await wait(1000);
  
  // 验证状态更新
  assert.strictEqual(statusUpdates.size, 3, '所有用户都应该收到状态更新');
  console.log('测试4通过: 用户状态更新正常工作');
  
  // 测试5: 获取用户详情
  console.log('\n测试5: 获取用户详情');
  let userDetails = null;
  
  sockets.user2.emit('getUserDetails', users.user1.id, (response) => {
    console.log('用户详情:', response.user);
    userDetails = response.user;
  });
  
  await wait(1000);
  
  // 验证用户详情
  assert(userDetails, '应该获取到用户详情');
  assert.strictEqual(userDetails.id, users.user1.id, '用户ID应该匹配');
  assert.strictEqual(userDetails.username, users.user1.username, '用户名应该匹配');
  console.log('测试5通过: 用户详情获取正常工作');
  
  // 测试6: 离开大厅
  console.log('\n测试6: 离开大厅');
  for (const [key, socket] of Object.entries(sockets)) {
    socket.emit('leaveLobby');
  }
  await wait(1000);
  
  // 清理连接
  for (const socket of Object.values(sockets)) {
    socket.disconnect();
  }
  
  console.log('\n大厅聊天测试全部通过');
}

// 运行测试
runTests().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
}); 