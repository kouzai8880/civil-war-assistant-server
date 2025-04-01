/**
 * 错误处理中间件
 * 统一处理应用中的各种错误
 */

// 错误处理中间件
exports.errorHandler = (err, req, res, next) => {
  // 打印错误信息到控制台（生产环境可以改为写入日志文件）
  console.error('错误:', err);
  
  // 获取错误状态码
  const statusCode = err.statusCode || 500;
  
  // 获取错误消息
  const message = err.message || '服务器内部错误';
  
  // 获取错误代码
  const code = err.code || 9001;
  
  // 构造错误响应
  const errorResponse = {
    status: 'error',
    message,
    code
  };
  
  // 如果有详细错误，添加到响应中
  if (err.errors) {
    errorResponse.errors = err.errors;
  }
  
  // 发送响应
  res.status(statusCode).json(errorResponse);
};

// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode, code, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 异步处理包装器
exports.asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

exports.AppError = AppError; 