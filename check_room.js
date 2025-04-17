/**
 * 检查房间状态
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
const Room = require('./models/Room');
const User = require('./models/User');

// 目标房间ID
const ROOM_ID = '67f8c22a15e647e47c404592';

// 主函数
async function checkRoom() {
  try {
    // 获取房间
    const room = await Room.findById(ROOM_ID)
      .populate('players.userId', 'username')
      .populate('teams.captainId', 'username');

    if (!room) {
      console.error(`房间 ${ROOM_ID} 不存在`);
      return;
    }

    console.log(`房间信息:`);
    console.log(`- 名称: ${room.name}`);
    console.log(`- 状态: ${room.status}`);
    console.log(`- 玩家数: ${room.players.length}`);
    console.log(`- 观众数: ${room.spectators.length}`);
    console.log(`- 队伍数: ${room.teams.length}`);
    console.log(`- 下一个选人的队伍: ${room.nextTeamPick || '无'}`);

    console.log(`\n队伍信息:`);
    room.teams.forEach(team => {
      const captainName = team.captainId ? team.captainId.username : '无';
      console.log(`- 队伍${team.id}: 名称=${team.name}, 阵营=${team.side || '未选择'}, 队长=${captainName}`);
    });

    console.log(`\n玩家信息:`);
    room.players.forEach((player, index) => {
      const teamName = player.teamId ? (player.teamId === 1 ? '蓝队' : '红队') : '未分配';
      console.log(`- 玩家${index + 1}: ${player.userId.username}, 队伍=${teamName}, 是否队长=${player.isCaptain}`);
    });

    // 检查是否有问题
    const team1Players = room.players.filter(p => p.teamId === 1);
    const team2Players = room.players.filter(p => p.teamId === 2);
    const unassignedPlayers = room.players.filter(p => p.teamId === null);

    console.log(`\n队伍统计:`);
    console.log(`- 队伍1(蓝队)玩家数: ${team1Players.length}`);
    console.log(`- 队伍2(红队)玩家数: ${team2Players.length}`);
    console.log(`- 未分配玩家数: ${unassignedPlayers.length}`);

    // 检查队长
    const team1Captain = team1Players.find(p => p.isCaptain);
    const team2Captain = team2Players.find(p => p.isCaptain);

    if (!team1Captain && team1Players.length > 0) {
      console.log(`警告: 队伍1有玩家但没有队长`);
    }

    if (!team2Captain && team2Players.length > 0) {
      console.log(`警告: 队伍2有玩家但没有队长`);
    }

    // 检查teams数组中的队长是否与players中的一致
    if (team1Captain && room.teams[0].captainId) {
      const player1CaptainId = team1Captain.userId._id ? team1Captain.userId._id.toString() : team1Captain.userId.toString();
      const team1CaptainId = room.teams[0].captainId._id ? room.teams[0].captainId._id.toString() : room.teams[0].captainId.toString();

      if (player1CaptainId !== team1CaptainId) {
        console.log(`警告: 队伍1的队长不一致`);
        console.log(`- players中的队长: ${player1CaptainId}`);
        console.log(`- teams中的队长: ${team1CaptainId}`);
      } else {
        console.log(`队伍1的队长一致: ${team1Captain.userId.username}`);
      }
    }

    if (team2Captain && room.teams[1].captainId) {
      const player2CaptainId = team2Captain.userId._id ? team2Captain.userId._id.toString() : team2Captain.userId.toString();
      const team2CaptainId = room.teams[1].captainId._id ? room.teams[1].captainId._id.toString() : room.teams[1].captainId.toString();

      if (player2CaptainId !== team2CaptainId) {
        console.log(`警告: 队伍2的队长不一致`);
        console.log(`- players中的队长: ${player2CaptainId}`);
        console.log(`- teams中的队长: ${team2CaptainId}`);
      } else {
        console.log(`队伍2的队长一致: ${team2Captain.userId.username}`);
      }
    }

  } catch (error) {
    console.error('检查房间失败:', error);
  } finally {
    // 断开数据库连接
    await mongoose.disconnect();
    console.log('\n数据库连接已关闭');
  }
}

// 执行主函数
checkRoom();
