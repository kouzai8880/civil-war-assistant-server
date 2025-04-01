/**
 * 大厅聊天路由
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const lobby = require('../utils/lobby');

// 获取聊天记录
router.get('/chat', verifyToken, (req, res) => {
  try {
    const { before, limit } = req.query;
    const history = lobby.getChatHistory({
      before: before ? parseInt(before) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
    
    res.json({
      status: 'success',
      data: history
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 9001
    });
  }
});

// 发送聊天消息
router.post('/chat', verifyToken, (req, res) => {
  try {
    const { content, type } = req.body;
    const message = lobby.addMessage({
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar,
      content,
      type
    });
    
    res.json({
      status: 'success',
      message: '消息发送成功',
      data: { message }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
      code: 1001
    });
  }
});

// 获取用户详情
router.get('/users/:userId', verifyToken, (req, res) => {
  try {
    const userDetails = lobby.getUserDetails(req.params.userId);
    if (!userDetails) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在',
        code: 1004
      });
    }
    
    res.json({
      status: 'success',
      data: { user: userDetails }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 9001
    });
  }
});

module.exports = router; 