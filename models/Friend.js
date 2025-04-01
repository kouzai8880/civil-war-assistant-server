/**
 * 好友关系模型
 * 负责存储用户间的好友关系
 */

const mongoose = require('mongoose');

const FriendSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  groupName: {
    type: String,
    default: '默认分组',
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending'
  },
  stats: {
    gamesWithFriend: {
      type: Number,
      default: 0
    },
    winsWithFriend: {
      type: Number,
      default: 0
    },
    winsAgainstFriend: {
      type: Number,
      default: 0
    }
  },
  createTime: {
    type: Date,
    default: Date.now
  },
  updateTime: {
    type: Date,
    default: Date.now
  }
});

// 创建复合索引确保唯一好友关系
FriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

// 接受好友请求
FriendSchema.methods.accept = async function () {
  // 只有待处理状态才能接受
  if (this.status !== 'pending') {
    throw new Error('该好友请求不是待处理状态');
  }
  
  this.status = 'accepted';
  this.updateTime = Date.now();
  
  // 创建对方的好友记录
  const Friend = mongoose.model('Friend');
  const existingFriendship = await Friend.findOne({
    userId: this.friendId,
    friendId: this.userId
  });
  
  if (!existingFriendship) {
    await Friend.create({
      userId: this.friendId,
      friendId: this.userId,
      status: 'accepted',
      groupName: '默认分组'
    });
  } else if (existingFriendship.status !== 'accepted') {
    existingFriendship.status = 'accepted';
    existingFriendship.updateTime = Date.now();
    await existingFriendship.save();
  }
  
  return this;
};

// 拒绝好友请求
FriendSchema.methods.decline = function () {
  if (this.status !== 'pending') {
    throw new Error('该好友请求不是待处理状态');
  }
  
  this.status = 'declined';
  this.updateTime = Date.now();
  return this;
};

// 阻止用户
FriendSchema.methods.block = function () {
  this.status = 'blocked';
  this.updateTime = Date.now();
  return this;
};

// 更新同场游戏统计
FriendSchema.methods.updateGameStats = async function (sameTeam, win) {
  this.stats.gamesWithFriend += 1;
  
  if (sameTeam && win) {
    this.stats.winsWithFriend += 1;
  } else if (!sameTeam && win) {
    this.stats.winsAgainstFriend += 1;
  }
  
  this.updateTime = Date.now();
  return this;
};

// 转换为JSON时的配置
FriendSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Friend', FriendSchema); 