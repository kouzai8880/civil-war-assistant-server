/**
 * 异步错误处理工具
 * 用于包装异步控制器函数，统一处理异步错误
 */

// 将异步函数包装在一个错误处理器中
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler; 