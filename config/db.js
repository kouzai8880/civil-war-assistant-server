/**
 * 数据库配置模块
 * 提供MongoDB连接配置和选项
 */

const mongoose = require('mongoose');

// MongoDB连接选项
const connectOptions = {
  // useNewUrlParser和useUnifiedTopology在新版本的mongoose中已成为默认值
};

// 连接数据库的函数
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, connectOptions);
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB 连接错误: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 