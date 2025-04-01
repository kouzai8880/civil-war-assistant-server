/**
 * 比赛模型
 * 负责存储游戏对局的详细数据，包括玩家数据、结果等
 */

const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // 以秒为单位
    required: true
  },
  isValid: {
    type: Boolean,
    default: true
  },
  winner: {
    type: Number, // 胜利队伍的ID
    required: true
  },
  teams: [
    {
      id: {
        type: Number,
        required: true
      },
      side: {
        type: String,
        enum: ['blue', 'red'],
        required: true
      },
      result: {
        type: String,
        enum: ['win', 'lose'],
        required: true
      },
      players: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
          },
          championId: {
            type: Number,
            required: true
          },
          championName: {
            type: String,
            required: true
          },
          kills: {
            type: Number,
            default: 0
          },
          deaths: {
            type: Number,
            default: 0
          },
          assists: {
            type: Number,
            default: 0
          },
          damage: {
            type: Number,
            default: 0
          },
          gold: {
            type: Number,
            default: 0
          },
          cs: {
            type: Number,
            default: 0
          },
          vision: {
            type: Number,
            default: 0
          },
          rating: {
            type: Number,
            default: 0
          },
          isMVP: {
            type: Boolean,
            default: false
          }
        }
      ]
    }
  ],
  bannedChampions: [
    {
      championId: {
        type: Number,
        required: true
      },
      championName: {
        type: String,
        required: true
      }
    }
  ],
  ratings: [
    {
      fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      type: {
        type: String,
        enum: ['like', 'dislike'],
        required: true
      },
      createTime: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createTime: {
    type: Date,
    default: Date.now
  }
});

// 计算玩家的KDA
MatchSchema.methods.calculateKDA = function (player) {
  if (player.deaths === 0) return (player.kills + player.assists);
  return parseFloat(((player.kills + player.assists) / player.deaths).toFixed(2));
};

// 计算所有玩家的数据和更新MVP
MatchSchema.methods.processPlayerStats = function () {
  let maxRating = -1;
  let mvpPlayer = null;

  // 计算每个队伍的玩家数据
  this.teams.forEach(team => {
    team.players.forEach(player => {
      // 计算KDA
      player.kda = this.calculateKDA(player);
      
      // 简单的评分算法 (可以根据需要调整)
      const kdaWeight = 0.4;
      const damageWeight = 0.3;
      const goldWeight = 0.15;
      const csWeight = 0.1;
      const visionWeight = 0.05;
      
      // 假设的最高基准值，用于归一化
      const maxKDA = 10;
      const maxDamage = 30000;
      const maxGold = 15000;
      const maxCS = 250;
      const maxVision = 50;
      
      // 计算归一化评分 (0-10分)
      const kdaScore = Math.min(player.kda / maxKDA, 1) * 10;
      const damageScore = Math.min(player.damage / maxDamage, 1) * 10;
      const goldScore = Math.min(player.gold / maxGold, 1) * 10;
      const csScore = Math.min(player.cs / maxCS, 1) * 10;
      const visionScore = Math.min(player.vision / maxVision, 1) * 10;
      
      // 加权总分
      player.rating = parseFloat((
        kdaScore * kdaWeight +
        damageScore * damageWeight +
        goldScore * goldWeight +
        csScore * csWeight +
        visionScore * visionWeight
      ).toFixed(1));
      
      // 检查是否是MVP
      if (player.rating > maxRating) {
        maxRating = player.rating;
        mvpPlayer = player;
      }
    });
  });
  
  // 设置MVP
  if (mvpPlayer) {
    mvpPlayer.isMVP = true;
  }
  
  return this;
};

// 更新用户统计数据
MatchSchema.methods.updateUserStats = async function () {
  const User = mongoose.model('User');
  
  for (const team of this.teams) {
    const result = team.result;
    const isWin = result === 'win';
    
    for (const player of team.players) {
      const user = await User.findById(player.userId);
      if (!user) continue;
      
      // 更新胜场或负场
      user.stats.totalGames += 1;
      if (isWin) {
        user.stats.wins += 1;
      } else {
        user.stats.losses += 1;
      }
      
      await user.save();
    }
  }
};

// 添加评价
MatchSchema.methods.addRating = async function (fromUserId, toUserId, type) {
  // 检查是否已经评价过
  const existingRating = this.ratings.find(
    r => r.fromUserId.toString() === fromUserId.toString() && r.toUserId.toString() === toUserId.toString()
  );
  
  if (existingRating) {
    // 如果已评价，更新类型
    existingRating.type = type;
    existingRating.createTime = Date.now();
  } else {
    // 添加新评价
    this.ratings.push({
      fromUserId,
      toUserId,
      type,
      createTime: Date.now()
    });
  }
  
  // 更新被评价用户的统计数据
  const User = mongoose.model('User');
  const user = await User.findById(toUserId);
  
  if (user) {
    // 如果之前已经评价过，需要先减去之前的评价
    if (existingRating) {
      if (existingRating.type !== type) {
        if (type === 'like') {
          user.stats.likes += 1;
          user.stats.dislikes = Math.max(0, user.stats.dislikes - 1);
        } else {
          user.stats.dislikes += 1;
          user.stats.likes = Math.max(0, user.stats.likes - 1);
        }
      }
    } else {
      // 新评价
      if (type === 'like') {
        user.stats.likes += 1;
      } else {
        user.stats.dislikes += 1;
      }
    }
    
    await user.save();
  }
  
  return existingRating || this.ratings[this.ratings.length - 1];
};

// 转换为JSON时的配置
MatchSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Match', MatchSchema); 