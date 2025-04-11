/**
 * 用户模型
 * 定义用户数据结构及方法
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '请提供用户名'],
    trim: true,
    unique: true,
    minlength: [3, '用户名不能少于3个字符'],
    maxlength: [20, '用户名不能超过20个字符']
  },
  email: {
    type: String,
    required: [true, '请提供邮箱'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      '请提供有效的邮箱地址'
    ]
  },
  password: {
    type: String,
    required: [true, '请提供密码'],
    minlength: [6, '密码不能少于6个字符'],
    select: false // 查询时默认不返回密码
  },
  gameId: {
    type: String,
    trim: true
  },
  level: {
    type: Number,
    default: 1
  },
  points: {
    type: Number,
    default: 0
  },
  avatar: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  settings: {
    allowInvite: {
      type: Boolean,
      default: true
    },
    allowFriendRequest: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalGames: {
      type: Number,
      default: 0
    },
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    }
  },
  gameBindings: [{
    platform: {
      type: String,
      enum: ['LOL'],
      default: 'LOL'
    },
    gameId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'verified'],
      default: 'pending'
    },
    createTime: {
      type: Date,
      default: Date.now
    }
  }],
  lastLoginTime: {
    type: Date,
    default: Date.now
  },
  createTime: {
    type: Date,
    default: Date.now
  },
  passwordChangedAt: Date
});

// 保存前加密密码
UserSchema.pre('save', async function (next) {
  // 只有密码被修改时才重新加密
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 检查密码是否匹配
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 检查密码是否在指定时间后更改
UserSchema.methods.passwordChangedAfter = function(timestamp) {
  // 如果没有passwordChangedAt字段，表示密码未更改
  if (!this.passwordChangedAt) {
    return false;
  }
  
  const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
  return timestamp < changedTimestamp;
};

// 生成JWT令牌
UserSchema.methods.getSignedJwtToken = function () {
  const config = require('../config');
  return jwt.sign({ id: this._id }, config.server.jwtSecret, {
    expiresIn: config.server.jwtExpiresIn
  });
};

// 计算胜率
UserSchema.methods.getWinRate = function () {
  if (this.stats.totalGames === 0) return 0;
  return parseFloat(((this.stats.wins / this.stats.totalGames) * 100).toFixed(1));
};

// 虚拟属性，计算胜率
UserSchema.virtual('winRate').get(function () {
  return this.getWinRate();
});

// 转换为JSON时的配置
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    // 转换_id为id
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    // 添加计算的胜率
    if (ret.stats) {
      ret.stats.winRate = ret.winRate || 0;
    }
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema); 