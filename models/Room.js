/**
 * 房间模型
 * 负责存储房间信息、玩家状态、队伍分配等数据
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请提供房间名称'],
    trim: true,
    minlength: [3, '房间名称不能少于3个字符'],
    maxlength: [30, '房间名称不能超过30个字符']
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameType: {
    type: String,
    enum: ['LOL'],
    default: 'LOL'
  },
  playerCount: {
    type: Number,
    required: [true, '请提供玩家数量'],
    min: [2, '玩家数量不能少于2'],
    max: [10, '玩家数量不能超过10']
  },
  teamCount: {
    type: Number,
    default: 2,
    min: [2, '队伍数量不能少于2'],
    max: [2, '队伍数量不能超过2'] // 目前只支持两队
  },
  pickMode: {
    type: String,
    enum: ['random', '12211', '12221'], // 随机或者轮流选人（12211或12221）
    default: 'random'
  },
  password: {
    type: String,
    select: false // 查询时默认不返回密码
  },
  hasPassword: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, '描述不能超过200个字符']
  },
  status: {
    type: String,
    enum: ['waiting', 'picking', 'gaming', 'ended'],
    default: 'waiting'
  },
  players: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      teamId: {
        type: Number,
        default: null
      },
      isCaptain: {
        type: Boolean,
        default: false
      },
      isCreator: {
        type: Boolean,
        default: false
      },
      status: {
        type: String,
        enum: ['online', 'offline', 'ready', 'gaming'],
        default: 'online'
      },
      joinTime: {
        type: Date,
        default: Date.now
      }
    }
  ],
  teams: [
    {
      id: {
        type: Number,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      side: {
        type: String,
        enum: ['blue', 'red', ''],
        default: ''
      },
      captainId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    }
  ],
  nextTeamPick: {
    type: Number,
    default: null // 下一个选人的队伍ID
  },
  createTime: {
    type: Date,
    default: Date.now
  },
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  }
});

// 玩家加入时的钩子
RoomSchema.methods.addPlayer = function (userId, isCreator = false) {
  // 检查玩家是否已经在房间中
  const existingPlayer = this.players.find(p => p.userId.toString() === userId.toString());
  if (existingPlayer) {
    return existingPlayer;
  }

  // 检查房间是否已满
  if (this.players.length >= this.playerCount) {
    throw new Error('房间已满');
  }

  // 添加玩家
  const newPlayer = {
    userId,
    isCreator,
    status: 'online',
    joinTime: Date.now()
  };

  this.players.push(newPlayer);
  return newPlayer;
};

// 玩家离开的方法
RoomSchema.methods.removePlayer = function (userId) {
  const initialLength = this.players.length;
  this.players = this.players.filter(p => p.userId.toString() !== userId.toString());
  
  return initialLength !== this.players.length;
};

// 设置密码
RoomSchema.methods.setPassword = async function (password) {
  if (!password || password.trim() === '') {
    this.password = undefined;
    this.hasPassword = false;
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(password, salt);
  this.hasPassword = true;
};

// 验证密码
RoomSchema.methods.verifyPassword = async function (password) {
  if (!this.hasPassword) return true;
  
  // 需要重新获取带密码的房间
  const roomWithPassword = await mongoose.model('Room').findById(this._id).select('+password');
  if (!roomWithPassword.password) return true;
  
  return await bcrypt.compare(password, roomWithPassword.password);
};

// 分配队伍
RoomSchema.methods.assignTeams = function () {
  // 检查玩家人数是否足够
  if (this.players.length < this.playerCount) {
    throw new Error(`需要 ${this.playerCount} 名玩家才能开始游戏，当前只有 ${this.players.length} 名`);
  }
  
  // 检查是否已经有队伍
  if (this.teams.length > 0) {
    // 清空现有队伍的队员
    this.players.forEach(player => {
      player.teamId = null;
      player.isCaptain = false;
    });
  } else {
    // 创建两个队伍
    this.teams = [
      { id: 1, name: '蓝队', side: '', captainId: null },
      { id: 2, name: '红队', side: '', captainId: null }
    ];
  }
  
  if (this.pickMode === 'random') {
    // 随机分配队伍
    const shuffledPlayers = [...this.players].sort(() => 0.5 - Math.random());
    const teamSize = Math.floor(this.playerCount / this.teamCount);
    
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const teamId = i < teamSize ? 1 : 2;
      shuffledPlayers[i].teamId = teamId;
    }
    
    // 随机选择队长
    for (let i = 1; i <= this.teamCount; i++) {
      const teamPlayers = this.players.filter(p => p.teamId === i);
      if (teamPlayers.length > 0) {
        const randomCaptain = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
        randomCaptain.isCaptain = true;
        this.teams[i-1].captainId = randomCaptain.userId;
      }
    }
  } else if (this.pickMode === '12211') {
    // BP模式，只初始化队长
    const captains = this.players.slice(0, 2);
    captains[0].teamId = 1;
    captains[0].isCaptain = true;
    captains[1].teamId = 2;
    captains[1].isCaptain = true;
    
    this.teams[0].captainId = captains[0].userId;
    this.teams[1].captainId = captains[1].userId;
    
    // 设置下一个选人的队伍为蓝队（队伍1），由蓝队队长先选
    this.nextTeamPick = 1;
  } else if (this.pickMode === '12221') {
    // 12221 BP模式，与12211类似，也是初始化队长
    const captains = this.players.slice(0, 2);
    captains[0].teamId = 1;
    captains[0].isCaptain = true;
    captains[1].teamId = 2;
    captains[1].isCaptain = true;
    
    this.teams[0].captainId = captains[0].userId;
    this.teams[1].captainId = captains[1].userId;
    
    // 设置下一个选人的队伍为蓝队（队伍1），由蓝队队长先选
    this.nextTeamPick = 1;
  }
  
  this.status = this.pickMode === 'random' ? 'gaming' : 'picking';
  this.startTime = Date.now();
  
  return this.teams;
};

// 队长选择队员
RoomSchema.methods.captainSelectPlayer = function (teamId, userId) {
  // 验证是否是BP模式
  if (this.status !== 'picking') {
    throw new Error('房间不在选人阶段');
  }
  
  // 查找队员
  const player = this.players.find(p => p.userId.toString() === userId.toString());
  if (!player) {
    throw new Error('玩家不存在');
  }
  
  if (player.teamId !== null) {
    throw new Error('该玩家已经被选择');
  }
  
  // 获取当前两队人数
  const team1Count = this.players.filter(p => p.teamId === 1).length;
  const team2Count = this.players.filter(p => p.teamId === 2).length;
  const unassignedCount = this.players.filter(p => p.teamId === null).length;
  
  // 如果只剩下最后一名队员，自动分配给红队（队伍2）
  if (unassignedCount === 1) {
    // 根据模式决定最后一名玩家分配给哪个队伍
    if (this.pickMode === '12211') {
      // 12211模式最后一人分配给红队（队伍2）
      player.teamId = 2;
    } else if (this.pickMode === '12221') {
      // 12221模式最后一人分配给蓝队（队伍1）
      player.teamId = 1;
    } else {
      // 默认分配给红队
      player.teamId = 2;
    }
    
    // 所有玩家都已分配，进入游戏阶段
    this.status = 'gaming';
    this.nextTeamPick = null;
    
    return {
      player,
      nextTeam: null,
      remainingPlayers: []
    };
  }
  
  // 验证是否轮到该队伍选人（只在非最后一人时检查）
  if (this.nextTeamPick !== teamId) {
    throw new Error('不是该队伍的选人回合');
  }
  
  // 正常分配队员
  player.teamId = teamId;
  
  const totalPlayers = this.players.length;
  const remainingAfterPick = unassignedCount - 1; // 这次选择后剩余的未分配玩家数
  
  if (this.pickMode === '12211') {
    // 12211模式: 1队选1个，2队选2个，1队选2个，2队选1个，1队选1个，最后1人自动分配给2队
    if (remainingAfterPick === totalPlayers - 3) {
      // 第一轮，1队选完1个后轮到2队
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 4) {
      // 2队选完第一个后继续选第二个
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 5) {
      // 2队选完第二个后轮到1队
      this.nextTeamPick = 1;
    } else if (remainingAfterPick === totalPlayers - 6) {
      // 1队选完第一个后继续选第二个
      this.nextTeamPick = 1;
    } else if (remainingAfterPick === totalPlayers - 7) {
      // 1队选完第二个后轮到2队
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 8) {
      // 2队选完后轮到1队
      this.nextTeamPick = 1;
    }
  } else if (this.pickMode === '12221') {
    // 12221模式: 1队选1个，2队选2个，2队选2个，1队选2个，最后1人自动分配给1队
    if (remainingAfterPick === totalPlayers - 3) {
      // 第一轮，1队选完1个后轮到2队
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 4) {
      // 2队选完第一个后继续选第二个
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 5) {
      // 2队选完第二个后继续选第三个
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 6) {
      // 2队选完第三个后仍然是2队选第四个
      this.nextTeamPick = 2;
    } else if (remainingAfterPick === totalPlayers - 7) {
      // 2队选完第四个后轮到1队
      this.nextTeamPick = 1;
    } else if (remainingAfterPick === totalPlayers - 8) {
      // 1队选完第一个后继续选第二个
      this.nextTeamPick = 1;
    }
    // 如果剩下一个未分配玩家，将在下一次选择时自动分配给1队
  }
  
  return {
    player,
    nextTeam: this.nextTeamPick,
    remainingPlayers: this.players.filter(p => p.teamId === null)
  };
};

// 选择红蓝方
RoomSchema.methods.selectSide = function (teamId, side) {
  if (this.status !== 'gaming') {
    throw new Error('房间不在游戏阶段');
  }
  
  // 验证队伍ID
  if (teamId !== 1 && teamId !== 2) {
    throw new Error('无效的队伍ID');
  }
  
  // 验证阵营
  if (side !== 'blue' && side !== 'red') {
    throw new Error('无效的阵营，只能选择blue或red');
  }
  
  // 分配阵营
  const otherSide = side === 'blue' ? 'red' : 'blue';
  const otherTeamId = teamId === 1 ? 2 : 1;
  
  this.teams[teamId - 1].side = side;
  this.teams[otherTeamId - 1].side = otherSide;
  
  return this.teams;
};

// 结束游戏
RoomSchema.methods.endGame = function () {
  this.status = 'ended';
  this.endTime = Date.now();
};

// 转换为JSON时的配置
RoomSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('Room', RoomSchema); 