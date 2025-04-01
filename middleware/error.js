/**
 * 错误处理中间件
 * 处理应用程序中发生的各种错误，并返回统一的错误响应
 */

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;
  
  console.error('错误详情:', error);
  
  // Mongoose 错误处理
  // 处理 CastError (无效ID格式)
  if (err.name === 'CastError') {
    const message = `无效的 ${err.path} 格式: ${err.value}`;
    error = new Error(message);
    error.statusCode = 400;
  }
  
  // 处理 ValidationError (验证错误)
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    const message = `输入验证失败`;
    error = new Error(message);
    error.statusCode = 400;
    error.errors = errors;
  }
  
  // 处理 Mongoose 重复键错误 (唯一字段)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' 已被使用`;
    error = new Error(message);
    error.statusCode = 400;
  }
  
  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    const message = '无效的令牌';
    error = new Error(message);
    error.statusCode = 401;
  }
  
  // 处理 JWT 过期错误
  if (err.name === 'TokenExpiredError') {
    const message = '令牌已过期';
    error = new Error(message);
    error.statusCode = 401;
  }
  
  // 发送响应
  res.status(error.statusCode || 500).json({
    status: 'error',
    message: error.message || '服务器内部错误',
    errors: error.errors || [],
    code: error.code || 9001
  });
};

module.exports = errorHandler; 