/**
 * JWT配置模块
 * 负责JWT令牌的生成和验证
 */

const jwt = require('jsonwebtoken');

// 生成JWT令牌
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// 验证JWT令牌
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('无效的令牌');
  }
};

module.exports = {
  generateToken,
  verifyToken
}; 