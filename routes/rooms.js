/**
 * 房间路由
 * 处理房间创建、加入等功能
 */

const express = require('express');
const router = express.Router();
const { 
  createRoom, 
  getRooms, 
  getRoom, 
  joinRoom, 
  leaveRoom, 
  startGame,
  selectPlayer,
  selectSide,
  getRoomMessages,
  sendMessage,
  inviteFriends,
  joinAsPlayer,
  joinAsSpectator,
  kickPlayer
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

// 创建房间 (需要认证)
router.post('/', protect, createRoom);

// 获取房间列表
router.get('/', getRooms);

// 获取房间详情
router.get('/:roomId', getRoom);

// 加入房间 (需要认证)
router.post('/:roomId/join', protect, joinRoom);

// 离开房间 (需要认证)
router.post('/:roomId/leave', protect, leaveRoom);

// 从观众席加入玩家列表 (需要认证)
router.post('/:roomId/join-as-player', protect, joinAsPlayer);

// 从玩家列表进入观众席 (需要认证)
router.post('/:roomId/join-as-spectator', protect, joinAsSpectator);

// 开始游戏 (需要认证)
router.post('/:roomId/start', protect, startGame);

// 队长选择队员 (需要认证)
router.post('/:roomId/select-player', protect, selectPlayer);

// 选择红蓝方 (需要认证)
router.post('/:roomId/select-side', protect, selectSide);

// 获取房间消息
router.get('/:roomId/messages', protect, getRoomMessages);

// 发送消息 (需要认证)
router.post('/:roomId/messages', protect, sendMessage);

// 邀请好友 (需要认证)
router.post('/:roomId/invite', protect, inviteFriends);

// 踢出玩家 (需要认证)
router.post('/:roomId/kick', protect, kickPlayer);

module.exports = router; 