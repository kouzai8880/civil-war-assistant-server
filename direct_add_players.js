/**
 * 直接使用MongoDB驱动添加测试玩家到房间
 */
const { MongoClient, ObjectId } = require('mongodb');

// 连接URL
const url = 'mongodb://localhost:27017';
// 数据库名称
const dbName = 'civil-war';
// 目标房间ID
const ROOM_ID = '67f8c22a15e647e47c404592';
// 测试玩家数量
const NUM_PLAYERS = 8;

// 主函数
async function main() {
  // 创建MongoDB客户端
  const client = new MongoClient(url);
  
  try {
    // 连接到MongoDB
    await client.connect();
    console.log('已连接到MongoDB');
    
    // 获取数据库
    const db = client.db(dbName);
    
    // 获取集合
    const roomsCollection = db.collection('rooms');
    const usersCollection = db.collection('users');
    
    // 检查房间是否存在
    const room = await roomsCollection.findOne({ _id: new ObjectId(ROOM_ID) });
    if (!room) {
      console.log(`房间 ${ROOM_ID} 不存在，列出所有房间:`);
      const allRooms = await roomsCollection.find({}).toArray();
      allRooms.forEach((r, i) => {
        console.log(`${i + 1}. ID: ${r._id}, 名称: ${r.name || '未命名'}`);
      });
      return;
    }
    
    console.log(`找到房间: ${room.name || '未命名'}`);
    
    // 创建测试玩家
    const testPlayers = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const username = `测试玩家${i + 1}`;
      
      // 检查用户是否已存在
      let user = await usersCollection.findOne({ username });
      
      if (!user) {
        // 创建新用户
        const newUser = {
          username,
          email: `test${i + 1}@example.com`,
          password: '$2a$10$3YGMjHLyavhKqnFRzjvPZuJzG5ND1/MZm/PewP.gpsJQCcVNPcUHO', // 'password123'
          gameId: `TEST${1000 + i}`,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random()}`,
          stats: {
            totalGames: Math.floor(Math.random() * 100),
            wins: Math.floor(Math.random() * 50)
          },
          createTime: new Date()
        };
        
        const result = await usersCollection.insertOne(newUser);
        user = { ...newUser, _id: result.insertedId };
        console.log(`创建玩家 ${username} 成功，ID: ${result.insertedId}`);
      } else {
        console.log(`玩家 ${username} 已存在，ID: ${user._id}`);
      }
      
      testPlayers.push(user);
    }
    
    // 将测试玩家添加到房间
    let addedCount = 0;
    for (const player of testPlayers) {
      // 检查玩家是否已在房间中
      const existingPlayer = room.players?.find(p => p.userId.toString() === player._id.toString());
      const existingSpectator = room.spectators?.find(s => s.userId.toString() === player._id.toString());
      
      if (existingPlayer) {
        console.log(`玩家 ${player.username} 已在房间的玩家列表中`);
        continue;
      }
      
      if (existingSpectator) {
        console.log(`玩家 ${player.username} 已在房间的观众席中`);
        continue;
      }
      
      // 添加玩家到房间
      const updateResult = await roomsCollection.updateOne(
        { _id: new ObjectId(ROOM_ID) },
        { 
          $push: { 
            players: {
              userId: player._id,
              joinTime: new Date(),
              teamId: null,
              isCreator: false
            }
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        addedCount++;
        console.log(`已将玩家 ${player.username} 添加到房间`);
      } else {
        console.log(`添加玩家 ${player.username} 到房间失败`);
      }
    }
    
    console.log(`成功将 ${addedCount} 个测试玩家添加到房间`);
    
    // 获取更新后的房间信息
    const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(ROOM_ID) });
    console.log(`房间现在有 ${updatedRoom.players?.length || 0} 个玩家和 ${updatedRoom.spectators?.length || 0} 个观众`);
    
  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    // 关闭连接
    await client.close();
    console.log('MongoDB连接已关闭');
  }
}

// 执行主函数
main();
