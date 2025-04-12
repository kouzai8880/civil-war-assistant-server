/**
 * 启动游戏，将玩家分配到队伍
 */
const { MongoClient, ObjectId } = require('mongodb');

// 连接URL
const url = 'mongodb://localhost:27017';
// 数据库名称
const dbName = 'civil-war';
// 目标房间ID
const ROOM_ID = '67f8c22a15e647e47c404592';

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
    
    // 检查房间是否存在
    const room = await roomsCollection.findOne({ _id: new ObjectId(ROOM_ID) });
    if (!room) {
      console.log(`房间 ${ROOM_ID} 不存在`);
      return;
    }
    
    console.log(`找到房间: ${room.name || '未命名'}, 状态: ${room.status || '未知'}`);
    console.log(`房间有 ${room.players?.length || 0} 个玩家和 ${room.spectators?.length || 0} 个观众`);
    
    if (room.status === 'gaming') {
      console.log('游戏已经开始，无需再次启动');
      return;
    }
    
    if ((room.players?.length || 0) < 2) {
      console.log('玩家数量不足，无法开始游戏');
      return;
    }
    
    // 随机分配队伍
    const players = [...(room.players || [])];
    const teamCount = room.teamCount || 2;
    const teams = Array.from({ length: teamCount }, (_, i) => ({
      id: i + 1,
      name: i === 0 ? '蓝队' : '红队',
      captainId: null,
      side: i === 0 ? 'blue' : 'red'
    }));
    
    // 随机打乱玩家顺序
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    
    // 为每个队伍选择队长
    for (let i = 0; i < teams.length; i++) {
      if (players.length > 0) {
        const captain = players.shift();
        teams[i].captainId = captain.userId;
      }
    }
    
    // 分配剩余玩家到队伍
    let teamIndex = 0;
    while (players.length > 0) {
      const player = players.shift();
      const teamId = teams[teamIndex % teams.length].id;
      
      // 更新玩家的队伍ID
      await roomsCollection.updateOne(
        { 
          _id: new ObjectId(ROOM_ID),
          "players.userId": player.userId
        },
        { 
          $set: { 
            "players.$.teamId": teamId
          }
        }
      );
      
      teamIndex++;
    }
    
    // 更新房间状态和队伍信息
    await roomsCollection.updateOne(
      { _id: new ObjectId(ROOM_ID) },
      { 
        $set: { 
          status: 'gaming',
          teams: teams,
          nextTeamPick: null
        }
      }
    );
    
    console.log('游戏已成功启动，玩家已分配到队伍');
    
    // 获取更新后的房间信息
    const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(ROOM_ID) });
    console.log(`房间状态: ${updatedRoom.status}`);
    console.log('队伍信息:');
    updatedRoom.teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}, 队长ID: ${team.captainId}`);
    });
    
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
