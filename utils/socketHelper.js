/**
 * Socket辅助工具
 * 提供安全的socketIO调用方法
 */

const socketModule = require('./socket');

// 初始化全局socketIO对象
let socketIO = null;

// 初始化方法
exports.init = (io) => {
  socketIO = io;
  global.socketIO = socketModule;
};

// 安全调用通知房间方法
exports.safeNotifyRoom = (roomId, event, data) => {
  try {
    if (socketModule && typeof socketModule.notifyRoom === 'function') {
      return socketModule.notifyRoom(roomId, event, data);
    }
  } catch (error) {
    console.error(`通知房间${roomId}事件${event}失败:`, error);
  }
  return false;
};

// 安全调用通知用户方法
exports.safeNotifyUser = (userId, event, data) => {
  try {
    if (socketModule && typeof socketModule.notifyUser === 'function') {
      return socketModule.notifyUser(userId, event, data);
    }
  } catch (error) {
    console.error(`通知用户${userId}事件${event}失败:`, error);
  }
  return false;
};

// 安全调用通知队伍方法
exports.safeNotifyTeam = (roomId, teamId, event, data) => {
  try {
    if (socketModule && typeof socketModule.notifyTeam === 'function') {
      return socketModule.notifyTeam(roomId, teamId, event, data);
    }
  } catch (error) {
    console.error(`通知房间${roomId}队伍${teamId}事件${event}失败:`, error);
  }
  return false;
};

// 安全调用通知观众方法
exports.safeNotifySpectators = (roomId, event, data) => {
  try {
    if (socketModule && typeof socketModule.notifySpectators === 'function') {
      return socketModule.notifySpectators(roomId, event, data);
    }
  } catch (error) {
    console.error(`通知房间${roomId}观众事件${event}失败:`, error);
  }
  return false;
};

// 安全获取房间在线用户
exports.safeGetRoomOnlineUsers = (roomId) => {
  try {
    if (socketModule && typeof socketModule.getRoomOnlineUsers === 'function') {
      return socketModule.getRoomOnlineUsers(roomId);
    }
  } catch (error) {
    console.error(`获取房间${roomId}在线用户失败:`, error);
  }
  return [];
};

// 安全获取房间在线观众
exports.safeGetRoomSpectators = (roomId) => {
  try {
    if (socketModule && typeof socketModule.getRoomSpectators === 'function') {
      return socketModule.getRoomSpectators(roomId);
    }
  } catch (error) {
    console.error(`获取房间${roomId}在线观众失败:`, error);
  }
  return [];
};

// 安全房间状态更新
exports.safeEmitRoomStatusUpdate = (roomId, statusData) => {
  try {
    if (socketModule && typeof socketModule.emitRoomStatusUpdate === 'function') {
      socketModule.emitRoomStatusUpdate(roomId, statusData);
      return true;
    }
  } catch (error) {
    console.error(`更新房间${roomId}状态失败:`, error);
  }
  return false;
};

// 安全玩家状态更新
exports.safeEmitPlayerStatusUpdate = (roomId, userId, statusData) => {
  try {
    if (socketModule && typeof socketModule.emitPlayerStatusUpdate === 'function') {
      socketModule.emitPlayerStatusUpdate(roomId, userId, statusData);
      return true;
    }
  } catch (error) {
    console.error(`更新房间${roomId}玩家${userId}状态失败:`, error);
  }
  return false;
};

// 安全队伍状态更新
exports.safeEmitTeamUpdate = (roomId, teamId, teamData) => {
  try {
    if (socketModule && typeof socketModule.emitTeamUpdate === 'function') {
      socketModule.emitTeamUpdate(roomId, teamId, teamData);
      return true;
    }
  } catch (error) {
    console.error(`更新房间${roomId}队伍${teamId}状态失败:`, error);
  }
  return false;
};

// 安全通知用户从观众席加入玩家列表
exports.safeNotifySpectatorToPlayer = (roomId, userData) => {
  try {
    if (socketModule && typeof socketModule.notifySpectatorToPlayer === 'function') {
      return socketModule.notifySpectatorToPlayer(roomId, userData);
    }
  } catch (error) {
    console.error(`通知用户${userData.userId}从观众席加入玩家列表失败:`, error);
  }
  return false;
};

// 安全通知用户从玩家列表加入观众席
exports.safeNotifyPlayerToSpectator = (roomId, userData) => {
  try {
    if (socketModule && typeof socketModule.notifyPlayerToSpectator === 'function') {
      return socketModule.notifyPlayerToSpectator(roomId, userData);
    }
  } catch (error) {
    console.error(`通知用户${userData.userId}从玩家列表加入观众席失败:`, error);
  }
  return false;
};