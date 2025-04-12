/**
 * 列出所有房间的脚本
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

// 导入房间模型
const Room = require('./models/Room');

// 列出所有房间
async function listRooms() {
  try {
    console.log('开始查询房间...');

    // 先检查数据库中的集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('数据库中的集合:', collections.map(c => c.name).join(', '));

    // 检查Room模型
    console.log('Room模型的集合名称:', Room.collection.name);

    // 直接使用原生查询
    const roomsCollection = mongoose.connection.db.collection('rooms');
    const roomsCount = await roomsCollection.countDocuments();
    console.log(`使用原生查询找到 ${roomsCount} 个房间`);

    const roomsList = await roomsCollection.find({}).toArray();
    console.log('房间列表:');
    roomsList.forEach((room, index) => {
      console.log(`${index + 1}. ID: ${room._id}, 名称: ${room.name || '未命名'}, 玩家数: ${room.players?.length || 0}, 观众数: ${room.spectators?.length || 0}`);
    });

    // 使用Mongoose查询
    console.log('开始使用Mongoose查询房间...');
    const rooms = await Room.find().lean();

    console.log(`使用Mongoose找到 ${rooms.length} 个房间:`);

    rooms.forEach((room, index) => {
      console.log(`${index + 1}. ID: ${room._id}, 名称: ${room.name || '未命名'}, 玩家数: ${room.players?.length || 0}, 观众数: ${room.spectators?.length || 0}`);
    });
  } catch (error) {
    console.error('列出房间失败:', error);
  } finally {
    // 断开数据库连接
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

// 执行函数
listRooms();
