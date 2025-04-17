/**
 * 消息模型
 * 用于管理房间内的聊天消息
 */

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type !== 'system'; // 只有非系统消息才需要userId
    }
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, '消息内容不能超过500个字符']
  },
  type: {
    type: String,
    enum: ['text', 'voice', 'system'],
    default: 'text'
  },
  channel: {
    type: String,
    enum: ['public', 'team'],
    default: 'public'
  },
  teamId: {
    type: Number,
    default: null
  },
  createTime: {
    type: Date,
    default: Date.now
  }
});

// 创建索引优化查询
MessageSchema.index({ roomId: 1, createTime: -1 });
MessageSchema.index({ roomId: 1, channel: 1, teamId: 1, createTime: -1 });

// 设置虚拟属性
MessageSchema.virtual('isTeamMessage').get(function () {
  return this.channel === 'team' && this.teamId !== null;
});

// 转换为JSON时的配置
MessageSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Message', MessageSchema);