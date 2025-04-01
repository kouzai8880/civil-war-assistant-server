/**
 * 比赛路由
 * 处理比赛数据提交和查询
 */

const express = require('express');
const router = express.Router();
const { 
  submitMatchData, 
  getMatch, 
  ratePlayer, 
  verifyGame 
} = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

// 提交比赛数据 (需要认证)
router.post('/rooms/:roomId/submit', protect, submitMatchData);

// 获取比赛详情
router.get('/:matchId', getMatch);

// 评价队友 (需要认证)
router.post('/:matchId/rate', protect, ratePlayer);

// 验证游戏对局
router.post('/verify', verifyGame);

module.exports = router; 