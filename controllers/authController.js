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
  const { username, email, password } = req.body;

  // 检查是否提供了用户凭证和密码
  if ((!username && !email) || !password) {
    return res.status(400).json({
      status: 'error',
      message: '请提供用户名或邮箱，以及密码',
      code: 1002
    });
  }

  // 查找用户（可以用用户名或邮箱）
  let user;
  if (email) {
    user = await User.findOne({ email }).select('+password');
  } else {
    user = await User.findOne({ username }).select('+password');
  }

  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: '用户名/邮箱或密码错误',
      code: 1003
    });
  }

  // 验证密码
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({
      status: 'error',
      message: '用户名/邮箱或密码错误',
      code: 1003
    });
  }

  // 更新最后登录时间
  user.lastLoginTime = Date.now();
  await user.save();

  // 格式化统计数据
  const stats = {
    ...user.stats,
    winRate: user.getWinRate()
  };

  // 生成 JWT token
  const token = user.getSignedJwtToken();
  res.status(200).json({
    status: 'success',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gameId: user.gameId,
        level: user.level,
        points: user.points,
        avatar: user.avatar,
        settings: user.settings,
        createTime: user.createTime,
        lastLoginTime: user.lastLoginTime,
        stats
      }
    }
  });
});

// 获取当前用户信息
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  // 格式化统计数据
  const stats = {
    ...user.stats,
    winRate: user.getWinRate()
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gameId: user.gameId,
        level: user.level,
        points: user.points,
        avatar: user.avatar,
        settings: user.settings,
        createTime: user.createTime,
        lastLoginTime: user.lastLoginTime,
        stats
      }
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