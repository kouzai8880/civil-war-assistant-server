/**
 * 应用配置文件
 * 集中管理所有配置参数
 */

const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 默认配置
const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // 数据库配置
  db: {
    uri: process.env.MONGO_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'civil-war-assistant-super-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  },
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  
  // Socket.IO配置
  socketIO: {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  },
  
  // 游戏配置
  game: {
    platforms: ['LOL'],
    defaultPlatform: 'LOL'
  }
};

module.exports = config; 