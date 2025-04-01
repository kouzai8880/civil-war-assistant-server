/**
 * 游戏数据路由
 * 处理游戏静态数据和API调用
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyGame } = require('../controllers/matchController');

// 验证游戏对局
router.post('/verify', protect, verifyGame);

// 这里会实现游戏数据相关的路由
// 例如：获取英雄列表、获取物品列表等

// 获取英雄列表
router.get('/champions', (req, res) => {
  // 这里可以返回一个静态的英雄列表或者调用外部API
  // 暂时返回一个空数组，后续实现
  res.status(200).json({
    status: 'success',
    data: { champions: [] }
  });
});

// 获取英雄详情
router.get('/champions/:championId', (req, res) => {
  // 获取英雄详情
  // 暂时返回一个空对象，后续实现
  res.status(200).json({
    status: 'success',
    data: { champion: {} }
  });
});

module.exports = router; 