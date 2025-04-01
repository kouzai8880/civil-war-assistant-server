/**
 * 大厅聊天功能实现
 * 使用内存存储管理聊天记录和用户状态
 */

const { v4: uuidv4 } = require('uuid');

// 存储大厅中的用户
const lobbyUsers = new Map();
// 存储聊天记录
const chatMessages = [];
// 消息存储时间限制（1小时）
const MESSAGE_EXPIRY = 60 * 60 * 1000;
// 消息内容长度限制
const MAX_MESSAGE_LENGTH = 500;

/**
 * 生成消息ID
 * @returns {string} 消息ID
 */
function generateMessageId() {
  return `${Date.now()}-${uuidv4()}`;
}

/**
 * 清理过期消息
 */
function cleanupExpiredMessages() {
  const now = Date.now();
  const expiredIndex = chatMessages.findIndex(msg => now - msg.timestamp > MESSAGE_EXPIRY);
  if (expiredIndex !== -1) {
    chatMessages.splice(0, expiredIndex + 1);
  }
}

/**
 * 获取聊天记录
 * @param {Object} options 查询选项
 * @param {number} options.before 时间戳，获取该时间之前的消息
 * @param {number} options.limit 每页消息数量
 * @returns {Object} 聊天记录和分页信息
 */
function getChatHistory(options = {}) {
  const { before = Date.now(), limit = 50 } = options;
  
  // 清理过期消息
  cleanupExpiredMessages();
  
  // 过滤并排序消息
  const messages = chatMessages
    .filter(msg => msg.timestamp < before)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
  
  return {
    messages,
    hasMore: chatMessages.length > limit,
    nextBefore: messages.length > 0 ? messages[messages.length - 1].timestamp : null
  };
}

/**
 * 添加新消息
 * @param {Object} message 消息对象
 * @returns {Object} 添加后的消息对象
 */
function addMessage(message) {
  // 验证消息内容
  if (!message.content || typeof message.content !== 'string') {
    throw new Error('消息内容不能为空');
  }
  if (message.content.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`消息内容不能超过${MAX_MESSAGE_LENGTH}个字符`);
  }
  
  // 创建消息对象
  const newMessage = {
    id: generateMessageId(),
    userId: message.userId,
    username: message.username,
    avatar: message.avatar,
    content: message.content,
    type: message.type || 'text',
    timestamp: Date.now()
  };
  
  // 添加消息
  chatMessages.push(newMessage);
  
  // 清理过期消息
  cleanupExpiredMessages();
  
  return newMessage;
}

/**
 * 用户加入大厅
 * @param {Object} user 用户信息
 * @param {string} user.id 用户ID
 * @param {string} user.username 用户名
 * @param {string} user.avatar 用户头像
 * @param {Object} socket Socket连接
 */
function joinLobby(user, socket) {
  // 存储用户信息
  lobbyUsers.set(user.id, {
    ...user,
    socket,
    status: 'online',
    currentRoom: null,
    joinedAt: Date.now()
  });
  
  // 广播用户状态更新
  broadcastUserStatus(user.id, 'online');
}

/**
 * 用户离开大厅
 * @param {string} userId 用户ID
 */
function leaveLobby(userId) {
  const user = lobbyUsers.get(userId);
  if (user) {
    // 广播用户状态更新
    broadcastUserStatus(userId, 'offline');
    // 移除用户
    lobbyUsers.delete(userId);
  }
}

/**
 * 更新用户状态
 * @param {string} userId 用户ID
 * @param {string} status 新状态
 * @param {string} currentRoom 当前房间ID（可选）
 */
function updateUserStatus(userId, status, currentRoom = null) {
  const user = lobbyUsers.get(userId);
  if (user) {
    user.status = status;
    user.currentRoom = currentRoom;
    broadcastUserStatus(userId, status, currentRoom);
  }
}

/**
 * 广播用户状态更新
 * @param {string} userId 用户ID
 * @param {string} status 新状态
 * @param {string} currentRoom 当前房间ID（可选）
 */
function broadcastUserStatus(userId, status, currentRoom = null) {
  const user = lobbyUsers.get(userId);
  if (!user) return;
  
  const update = {
    userId,
    username: user.username,
    status,
    currentRoom
  };
  
  // 广播给所有大厅用户
  for (const [_, lobbyUser] of lobbyUsers) {
    lobbyUser.socket.emit('lobbyUserStatus', update);
  }
}

/**
 * 获取用户详情
 * @param {string} userId 用户ID
 * @returns {Object|null} 用户详情
 */
function getUserDetails(userId) {
  return lobbyUsers.get(userId) || null;
}

/**
 * 获取大厅中的所有用户
 * @returns {Array} 用户列表
 */
function getLobbyUsers() {
  return Array.from(lobbyUsers.values()).map(user => ({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    status: user.status,
    currentRoom: user.currentRoom
  }));
}

module.exports = {
  getChatHistory,
  addMessage,
  joinLobby,
  leaveLobby,
  updateUserStatus,
  getUserDetails,
  getLobbyUsers
}; 