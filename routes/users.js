/**
 * 用户路由
 * 处理用户资料查询、更新等功能
 */

const express = require('express');
const router = express.Router();
const { 
  getUserProfile, 
  updateProfile, 
  getUserStats, 
  getUserMatches, 
  getFriends, 
  addFriend, 
  removeFriend,
  updateFriendGroup,
  getUserRooms,
  bindGameAccount
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// 获取用户资料
router.get('/:userId/profile', getUserProfile);

// 更新用户资料 (需要认证)
router.put('/:userId', protect, updateProfile);

// 获取用户战绩统计
router.get('/:userId/stats', getUserStats);

// 获取用户对局列表
router.get('/:userId/matches', getUserMatches);

// 获取好友列表 (需要认证)
router.get('/friends', protect, getFriends);

// 添加好友 (需要认证)
router.post('/friends', protect, addFriend);

// 删除好友 (需要认证)
router.delete('/friends/:friendId', protect, removeFriend);

// 修改好友分组 (需要认证)
router.put('/friends/:friendId/group', protect, updateFriendGroup);

// 获取用户参与的房间列表 (需要认证)
router.get('/rooms', protect, getUserRooms);

// 绑定游戏账号 (需要认证)
router.post('/bind-game', protect, bindGameAccount);

module.exports = router; 