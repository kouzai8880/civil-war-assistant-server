/**
 * 应用配置文件
 */

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-for-development',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d'
  },
  
  // 数据库配置
  database: {
    mongoURI: process.env.MONGO_URI
  },
  
  // 测试配置
  test: {
    socketUrl: 'http://localhost:3000',
    testRoomId: 'test-room-123',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-for-development'
  }
}; 