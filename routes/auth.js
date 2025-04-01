/**
 * 认证路由
 * 处理用户注册、登录等认证相关路由
 */

const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// 注册新用户
router.post('/register', register);

// 用户登录
router.post('/login', login);

// 获取当前用户信息 (需要认证)
router.get('/me', protect, getMe);

// 修改密码 (需要认证)
router.put('/me/password', protect, changePassword);

module.exports = router; 