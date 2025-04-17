/**
 * 修复房间中的teams数组，确保所有已分配队伍的玩家都正确地添加到相应的队伍中
 */
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

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

// 目标房间ID
const ROOM_ID = '67f8c22a15e647e47c404592';

// 主函数
async function fixTeams() {
  try {
    // 获取房间
    const room = await Room.findById(ROOM_ID);
    if (!room) {
      console.error(`房间 ${ROOM_ID} 不存在`);
      return;
    }

    console.log(`找到房间: ${room.name}`);
    console.log(`当前状态: ${room.status}`);
    console.log(`当前玩家数: ${room.players.length}`);
    console.log(`当前队伍数: ${room.teams.length}`);

    // 检查teams数组是否存在
    if (!room.teams || room.teams.length === 0) {
      console.log('房间没有teams数组，创建默认队伍');
      room.teams = [
        { id: 1, name: '蓝队', side: '', captainId: null },
        { id: 2, name: '红队', side: '', captainId: null }
      ];
    }

    // 获取已分配队伍的玩家
    const team1Players = room.players.filter(p => p.teamId === 1);
    const team2Players = room.players.filter(p => p.teamId === 2);

    console.log(`队伍1玩家数: ${team1Players.length}`);
    console.log(`队伍2玩家数: ${team2Players.length}`);

    // 检查队长
    const team1Captain = team1Players.find(p => p.isCaptain);
    const team2Captain = team2Players.find(p => p.isCaptain);

    // 更新队伍1的队长
    if (team1Captain) {
      console.log(`队伍1队长: ${team1Captain.userId}`);
      room.teams[0].captainId = team1Captain.userId;
    } else if (team1Players.length > 0) {
      // 如果没有队长但有玩家，选择第一个玩家作为队长
      console.log(`队伍1没有队长，选择第一个玩家作为队长: ${team1Players[0].userId}`);
      room.teams[0].captainId = team1Players[0].userId;
      team1Players[0].isCaptain = true;
    }

    // 更新队伍2的队长
    if (team2Captain) {
      console.log(`队伍2队长: ${team2Captain.userId}`);
      room.teams[1].captainId = team2Captain.userId;
    } else if (team2Players.length > 0) {
      // 如果没有队长但有玩家，选择第一个玩家作为队长
      console.log(`队伍2没有队长，选择第一个玩家作为队长: ${team2Players[0].userId}`);
      room.teams[1].captainId = team2Players[0].userId;
      team2Players[0].isCaptain = true;
    }

    // 如果房间状态是picking但没有设置nextTeamPick，设置为队伍1
    if (room.status === 'picking' && room.nextTeamPick === undefined) {
      console.log('设置下一个选人的队伍为队伍1');
      room.nextTeamPick = 1;
    }

    // 标记修改
    room.markModified('teams');
    room.markModified('players');
    
    // 保存房间
    await room.save();
    console.log('房间teams数组已修复');

    // 显示更新后的房间信息
    console.log('更新后的队伍信息:');
    room.teams.forEach((team, index) => {
      console.log(`队伍${team.id}: 名称=${team.name}, 阵营=${team.side || '未选择'}, 队长ID=${team.captainId || '无'}`);
    });

    // 显示更新后的玩家信息
    console.log('更新后的玩家信息:');
    for (const player of room.players) {
      if (player.teamId) {
        console.log(`玩家ID=${player.userId}, 队伍=${player.teamId}, 是否队长=${player.isCaptain}`);
      }
    }

  } catch (error) {
    console.error('修复teams数组失败:', error);
  } finally {
    // 断开数据库连接
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

// 执行主函数
fixTeams();
