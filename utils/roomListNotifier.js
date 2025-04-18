/**
 * 房间列表更新通知工具
 * 用于通知所有客户端房间列表已更新
 */

let io = null;

/**
 * 初始化房间列表通知器
 * @param {Object} socketIO - Socket.IO实例
 */
function init(socketIO) {
  io = socketIO;
  console.log('房间列表通知器已初始化');
}

/**
 * 通知所有客户端房间列表已更新
 * @param {string} action - 更新动作，可选值: 'create', 'update', 'delete'
 * @param {string} roomId - 房间ID
 * @returns {boolean} 是否成功发送通知
 */
function notifyRoomListUpdated(action = 'update', roomId = null) {
  if (!io) {
    console.error('房间列表通知器未初始化，无法发送通知');
    return false;
  }
  
  // 发送房间列表更新通知
  io.emit('roomListUpdated', {
    action, // 'create', 'update', 'delete'
    roomId,
    timestamp: new Date().toISOString()
  });
  
  console.log(`已通知所有客户端房间列表已更新，动作: ${action}, 房间ID: ${roomId || 'N/A'}`);
  return true;
}

module.exports = {
  init,
  notifyRoomListUpdated
};
