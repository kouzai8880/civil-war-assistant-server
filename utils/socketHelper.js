/**
 * Socket辅助工具
 * 提供安全的socketIO调用方法
 */

// 安全调用通知房间方法
exports.safeNotifyRoom = (roomId, event, data) => {
  try {
    if (global.socketIO && typeof global.socketIO.notifyRoom === 'function') {
      global.socketIO.notifyRoom(roomId, event, data);
      return true;
    }
  } catch (error) {
    console.error(`通知房间${roomId}事件${event}失败:`, error);
  }
  return false;
};

// 安全调用通知用户方法
exports.safeNotifyUser = (userId, event, data) => {
  try {
    if (global.socketIO && typeof global.socketIO.notifyUser === 'function') {
      global.socketIO.notifyUser(userId, event, data);
      return true;
    }
  } catch (error) {
    console.error(`通知用户${userId}事件${event}失败:`, error);
  }
  return false;
};

// 安全调用通知队伍方法
exports.safeNotifyTeam = (roomId, teamId, event, data) => {
  try {
    if (global.socketIO && typeof global.socketIO.notifyTeam === 'function') {
      global.socketIO.notifyTeam(roomId, teamId, event, data);
      return true;
    }
  } catch (error) {
    console.error(`通知房间${roomId}队伍${teamId}事件${event}失败:`, error);
  }
  return false;
};

// 安全调用通知观众方法
exports.safeNotifySpectators = (roomId, event, data) => {
  try {
    if (global.socketIO && typeof global.socketIO.notifySpectators === 'function') {
      global.socketIO.notifySpectators(roomId, event, data);
      return true;
    }
  } catch (error) {
    console.error(`通知房间${roomId}观众事件${event}失败:`, error);
  }
  return false;
};

// 安全获取房间在线用户
exports.safeGetRoomOnlineUsers = (roomId) => {
  try {
    if (global.socketIO && typeof global.socketIO.getRoomOnlineUsers === 'function') {
      return global.socketIO.getRoomOnlineUsers(roomId);
    }
  } catch (error) {
    console.error(`获取房间${roomId}在线用户失败:`, error);
  }
  return [];
};

// 安全获取房间在线观众
exports.safeGetRoomSpectators = (roomId) => {
  try {
    if (global.socketIO && typeof global.socketIO.getRoomSpectators === 'function') {
      return global.socketIO.getRoomSpectators(roomId);
    }
  } catch (error) {
    console.error(`获取房间${roomId}在线观众失败:`, error);
  }
  return [];
}; 