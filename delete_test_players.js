/**
 * 删除测试玩家的脚本
 */
const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/civil-war', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB 连接成功');
}).catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});

// 导入用户模型
const User = require('./models/User');

// 删除测试玩家
async function deleteTestPlayers() {
  try {
    // 删除所有用户名以"测试玩家"开头的用户
    const result = await User.deleteMany({ username: /^测试玩家/ });
    console.log(`已删除 ${result.deletedCount} 个测试玩家`);
  } catch (error) {
    console.error('删除测试玩家失败:', error);
  } finally {
    // 断开数据库连接
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

// 执行删除操作
deleteTestPlayers();
