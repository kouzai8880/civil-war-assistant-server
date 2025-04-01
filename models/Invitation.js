/**
 * 邀请模型
 * 用于管理房间邀请
 */

const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  inviterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  expireTime: {
    type: Date,
    default: function() {
      // 默认30分钟后过期
      return new Date(Date.now() + 30 * 60 * 1000);
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

// 创建复合索引
InvitationSchema.index({ roomId: 1, userId: 1, status: 1 });
InvitationSchema.index({ expireTime: 1 }, { expireAfterSeconds: 0 }); // TTL索引，过期后自动删除

// 接受邀请
InvitationSchema.methods.accept = function () {
  if (this.status !== 'pending') {
    throw new Error('该邀请不是待处理状态');
  }
  
  if (new Date() > this.expireTime) {
    this.status = 'expired';
    throw new Error('该邀请已过期');
  }
  
  this.status = 'accepted';
  this.updateTime = Date.now();
  return this;
};

// 拒绝邀请
InvitationSchema.methods.reject = function () {
  if (this.status !== 'pending') {
    throw new Error('该邀请不是待处理状态');
  }
  
  if (new Date() > this.expireTime) {
    this.status = 'expired';
    throw new Error('该邀请已过期');
  }
  
  this.status = 'rejected';
  this.updateTime = Date.now();
  return this;
};

// 转换为JSON时的配置
InvitationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Invitation', InvitationSchema); 