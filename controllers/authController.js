/**
 * 认证控制器
 * 处理用户注册、登录和身份验证相关功能
 */

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// 注册新用户
exports.register = asyncHandler(async (req, res) => {
  const { username, email, password, confirmPassword, gameId } = req.body;
  
  // 检查所有必需字段
  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: '请提供所有必需字段',
      code: 1001
    });
  }
  
  // 确认密码匹配
  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: '密码不匹配',
      code: 1001
    });
  }
  
  // 创建用户
  const user = await User.create({
    username,
    email,
    password,
    gameId
  });
  
  // 生成JWT令牌
  const token = user.getSignedJwtToken();
  
  // 返回用户信息和令牌
  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        points: user.points,
        createTime: user.createTime
      },
      token
    },
    message: '注册成功'
  });
});

// 用户登录
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 检查是否提供了邮箱和密码
  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: '请提供邮箱和密码',
      code: 1002
    });
  }

  // 查找用户
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: '邮箱或密码错误',
      code: 1003
    });
  }

  // 验证密码
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({
      status: 'error',
      message: '邮箱或密码错误',
      code: 1003
    });
  }

  // 生成 JWT token
  const token = user.getSignedJwtToken();
  res.status(200).json({
    status: 'success',
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      gameId: user.gameId
    }
  });
});

// 获取当前用户信息
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    status: 'success',
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      gameId: user.gameId
    }
  });
});

// 修改密码
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  // 验证当前密码
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({
      status: 'error',
      message: '当前密码错误',
      code: 1004
    });
  }

  // 更新密码
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: '密码修改成功'
  });
}); 