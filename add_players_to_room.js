/**
 * 直接将测试玩家添加到房间的脚本
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

// 导入模型
const User = require('./models/User');
const Room = require('./models/Room');

// 目标房间ID
const ROOM_ID = '67f8c22a15e647e47c404592';

// 主函数
async function addPlayersToRoom() {
  try {
    // 获取房间
    const room = await Room.findById(ROOM_ID);
    if (!room) {
      console.error(`房间 ${ROOM_ID} 不存在`);
      return;
    }

    console.log(`找到房间: ${room.name}`);

    // 获取所有测试玩家
    const testPlayers = await User.find({ username: /^测试玩家/ });
    console.log(`找到 ${testPlayers.length} 个测试玩家`);

    if (testPlayers.length === 0) {
      console.log('没有找到测试玩家，请先运行创建测试玩家的脚本');
      return;
    }

    // 将测试玩家添加到房间
    let addedCount = 0;
    for (const player of testPlayers) {
      // 检查玩家是否已在房间中
      const existingPlayer = room.players.find(p => p.userId.toString() === player._id.toString());
      const existingSpectator = room.spectators.find(s => s.userId.toString() === player._id.toString());

      if (existingPlayer) {
        console.log(`玩家 ${player.username} 已在房间的玩家列表中`);
        continue;
      }

      if (existingSpectator) {
        console.log(`玩家 ${player.username} 已在房间的观众席中`);
        continue;
      }

      // 添加玩家到房间
      room.players.push({
        userId: player._id,
        joinTime: new Date(),
        teamId: null,
        isCreator: false
      });

      addedCount++;
      console.log(`已将玩家 ${player.username} 添加到房间`);
    }

    // 保存房间
    await room.save();
    console.log(`成功将 ${addedCount} 个测试玩家添加到房间 ${room.name}`);

    // 显示房间中的玩家
    const updatedRoom = await Room.findById(ROOM_ID).populate('players.userId', 'username');
    console.log('房间中的玩家:');
    updatedRoom.players.forEach((player, index) => {
      console.log(`${index + 1}. ${player.userId.username}`);
    });
  } catch (error) {
    console.error('添加玩家到房间失败:', error);
  } finally {
    // 断开数据库连接
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

// 执行主函数
addPlayersToRoom();
