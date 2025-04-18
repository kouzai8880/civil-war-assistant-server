/**
 * Socket共享功能模块
 * 用于解决socket.js和socketHelper.js之间的循环依赖问题
 */

// 存储活跃连接的用户
const activeUsers = new Map();
// 存储房间信息
const rooms = new Map();
// Socket.IO 实例
let io = null;

/**
 * 设置Socket.IO实例
 * @param {Object} ioInstance - Socket.IO实例
 */
function setIO(ioInstance) {
  io = ioInstance;
}

/**
 * 获取Socket.IO实例
 * @returns {Object} Socket.IO实例
 */
function getIO() {
  return io;
}

/**
 * 获取房间在线用户
 * @param {string} roomId - 房间ID
 * @returns {Array} 用户ID数组
 */
function getRoomOnlineUsers(roomId) {
  if (!roomId || !rooms.has(roomId)) return [];
  return Array.from(rooms.get(roomId).keys());
}

/**
 * 获取房间在线观众
 * @param {string} roomId - 房间ID
 * @returns {Array} 观众ID数组
 */
function getRoomSpectators(roomId) {
  if (!roomId || !rooms.has(roomId)) return [];

  return Array.from(rooms.get(roomId).entries())
    .filter(([_, user]) => user.role === 'spectator')
    .map(([userId, _]) => userId);
}

module.exports = {
  activeUsers,
  rooms,
  setIO,
  getIO,
  getRoomOnlineUsers,
  getRoomSpectators
};
