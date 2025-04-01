/**
 * 用户控制器
 * 处理用户资料更新、查询等功能
 */

const User = require('../models/User');
const Friend = require('../models/Friend');
const Room = require('../models/Room');
const Match = require('../models/Match');
const asyncHandler = require('../utils/asyncHandler');

// 获取用户资料
exports.getUserProfile = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: '用户不存在',
      code: 2001
    });
  }
  
  // 格式化统计数据
  const stats = {
    ...user.stats,
    winRate: user.getWinRate()
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gameId: user.gameId,
        level: user.level,
        points: user.points,
        avatar: user.avatar,
        createTime: user.createTime,
        lastLoginTime: user.lastLoginTime,
        stats
      }
    }
  });
});

// 更新用户资料
exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  
  // 确保用户只能更新自己的资料
  if (userId !== req.user.id) {
    return res.status(403).json({
      status: 'error',
      message: '无权更新其他用户的资料',
      code: 1003
    });
  }
  
  const { username, gameId, avatar, settings } = req.body;
  
  // 创建更新对象
  const updateData = {};
  
  if (username) updateData.username = username;
  if (gameId) updateData.gameId = gameId;
  if (avatar) updateData.avatar = avatar;
  if (settings) updateData.settings = settings;
  
  // 更新用户资料
  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true
  });
  
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: '用户不存在',
      code: 2001
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        username: user.username,
        gameId: user.gameId,
        avatar: user.avatar,
        settings: user.settings
      }
    },
    message: '用户资料已更新'
  });
});

// 获取用户战绩总览
exports.getUserStats = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: '用户不存在',
      code: 2001
    });
  }
  
  // 查询用户最常用的英雄
  const matches = await Match.aggregate([
    // 展开teams数组
    { $unwind: '$teams' },
    // 展开players数组
    { $unwind: '$teams.players' },
    // 匹配指定用户
    { $match: { 'teams.players.userId': user._id } },
    // 按英雄分组
    { $group: {
      _id: { championId: '$teams.players.championId', championName: '$teams.players.championName' },
      games: { $sum: 1 },
      wins: { $sum: { $cond: [{ $eq: ['$teams.result', 'win'] }, 1, 0] } },
      kills: { $avg: '$teams.players.kills' },
      deaths: { $avg: '$teams.players.deaths' },
      assists: { $avg: '$teams.players.assists' }
    }},
    // 计算胜率和KDA
    { $project: {
      championId: '$_id.championId',
      name: '$_id.championName',
      games: 1,
      wins: 1,
      losses: { $subtract: ['$games', '$wins'] },
      winRate: { $multiply: [{ $divide: ['$wins', '$games'] }, 100] },
      avgKDA: { 
        $concat: [
          { $toString: { $round: ['$kills', 1] } },
          '/',
          { $toString: { $round: ['$deaths', 1] } },
          '/',
          { $toString: { $round: ['$assists', 1] } }
        ]
      }
    }},
    // 排序
    { $sort: { games: -1 } },
    // 限制结果数量
    { $limit: 5 }
  ]);
  
  // 计算平均KDA
  const matchStats = await Match.aggregate([
    { $unwind: '$teams' },
    { $unwind: '$teams.players' },
    { $match: { 'teams.players.userId': user._id } },
    { $group: {
      _id: null,
      totalKills: { $sum: '$teams.players.kills' },
      totalDeaths: { $sum: '$teams.players.deaths' },
      totalAssists: { $sum: '$teams.players.assists' },
      totalDamage: { $avg: '$teams.players.damage' },
      totalGold: { $avg: '$teams.players.gold' },
      count: { $sum: 1 }
    }},
    { $project: {
      _id: 0,
      avgKDA: { 
        $concat: [
          { $toString: { $round: [{ $divide: ['$totalKills', '$count'] }, 1] } },
          '/',
          { $toString: { $round: [{ $divide: ['$totalDeaths', '$count'] }, 1] } },
          '/',
          { $toString: { $round: [{ $divide: ['$totalAssists', '$count'] }, 1] } }
        ]
      },
      kdaRatio: { 
        $round: [
          { $cond: [
            { $eq: ['$totalDeaths', 0] },
            { $add: ['$totalKills', '$totalAssists'] },
            { $divide: [{ $add: ['$totalKills', '$totalAssists'] }, '$totalDeaths'] }
          ]},
          2
        ]
      },
      avgDamage: { $round: ['$totalDamage', 0] },
      avgGold: { $round: ['$totalGold', 0] }
    }}
  ]);
  
  // 组装战绩统计数据
  const stats = {
    totalGames: user.stats.totalGames,
    wins: user.stats.wins,
    losses: user.stats.losses,
    winRate: user.getWinRate(),
    likes: user.stats.likes,
    dislikes: user.stats.dislikes,
    avgKDA: matchStats.length > 0 ? matchStats[0].avgKDA : '0/0/0',
    kdaRatio: matchStats.length > 0 ? matchStats[0].kdaRatio : 0,
    avgDamage: matchStats.length > 0 ? matchStats[0].avgDamage : 0,
    avgGold: matchStats.length > 0 ? matchStats[0].avgGold : 0,
    mostPlayedChampions: matches
  };
  
  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

// 获取用户对局列表
exports.getUserMatches = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { page = 1, limit = 20, champion, result } = req.query;
  
  // 构建查询条件
  const matchQuery = {
    $and: [
      { 'teams.players.userId': userId }
    ]
  };
  
  if (champion) {
    matchQuery.$and.push({ 'teams.players.championId': parseInt(champion) });
  }
  
  if (result) {
    matchQuery.$and.push({ 
      $or: [
        { 
          $and: [
            { 'teams.players.userId': userId },
            { 'teams.result': result }
          ]
        }
      ]
    });
  }
  
  // 查询总数
  const total = await Match.countDocuments(matchQuery);
  
  // 查询对局数据
  const matches = await Match.aggregate([
    // 展开teams数组
    { $unwind: '$teams' },
    // 展开players数组
    { $unwind: '$teams.players' },
    // 匹配指定用户
    { $match: matchQuery },
    // 添加房间信息
    { $lookup: {
      from: 'rooms',
      localField: 'roomId',
      foreignField: '_id',
      as: 'room'
    }},
    // 格式化结果
    { $project: {
      id: '$_id',
      roomId: 1,
      roomName: { $arrayElemAt: ['$room.name', 0] },
      gameId: 1,
      startTime: 1,
      duration: 1,
      result: '$teams.result',
      championId: '$teams.players.championId',
      championName: '$teams.players.championName',
      kills: '$teams.players.kills',
      deaths: '$teams.players.deaths',
      assists: '$teams.players.assists',
      kda: { 
        $cond: [
          { $eq: ['$teams.players.deaths', 0] },
          { $add: ['$teams.players.kills', '$teams.players.assists'] },
          { $divide: [{ $add: ['$teams.players.kills', '$teams.players.assists'] }, '$teams.players.deaths'] }
        ]
      },
      damage: '$teams.players.damage',
      gold: '$teams.players.gold',
      cs: '$teams.players.cs',
      rating: '$teams.players.rating',
      isMVP: '$teams.players.isMVP'
    }},
    // 排序
    { $sort: { startTime: -1 } },
    // 分页
    { $skip: (page - 1) * limit },
    { $limit: parseInt(limit) }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: { matches },
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }
  });
});

// 获取好友列表
exports.getFriends = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 查询好友关系
  const friends = await Friend.find({
    userId,
    status: 'accepted'
  }).populate('friendId', 'username avatar lastLoginTime');
  
  // 格式化好友列表
  const formattedFriends = await Promise.all(friends.map(async (friendship) => {
    const friend = friendship.friendId;
    
    // 查询用户是否在游戏中
    const inGame = await Room.exists({
      'players.userId': friend._id,
      status: { $in: ['picking', 'gaming'] }
    });
    
    return {
      id: friendship._id,
      userId: friend._id,
      username: friend.username,
      avatar: friend.avatar,
      status: inGame ? 'gaming' : friend.lastLoginTime > Date.now() - 10 * 60 * 1000 ? 'online' : 'offline',
      gameStatus: inGame ? '游戏中' : '',
      groupName: friendship.groupName,
      createTime: friendship.createTime,
      stats: friendship.stats
    };
  }));
  
  res.status(200).json({
    status: 'success',
    data: { friends: formattedFriends }
  });
});

// 添加好友
exports.addFriend = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { userId: friendId, username } = req.body;
  
  let friendUser;
  
  // 通过ID或用户名查找好友
  if (friendId) {
    friendUser = await User.findById(friendId);
  } else if (username) {
    friendUser = await User.findOne({ username });
  } else {
    return res.status(400).json({
      status: 'error',
      message: '请提供用户ID或用户名',
      code: 1001
    });
  }
  
  if (!friendUser) {
    return res.status(404).json({
      status: 'error',
      message: '用户不存在',
      code: 2001
    });
  }
  
  // 不能添加自己为好友
  if (friendUser.id === userId) {
    return res.status(400).json({
      status: 'error',
      message: '不能添加自己为好友',
      code: 5001
    });
  }
  
  // 检查是否已经是好友
  const existingFriendship = await Friend.findOne({
    userId,
    friendId: friendUser.id
  });
  
  if (existingFriendship) {
    if (existingFriendship.status === 'accepted') {
      return res.status(400).json({
        status: 'error',
        message: '该用户已经是您的好友',
        code: 5001
      });
    } else if (existingFriendship.status === 'pending') {
      return res.status(400).json({
        status: 'error',
        message: '已发送好友请求，等待对方接受',
        code: 5001
      });
    } else if (existingFriendship.status === 'blocked') {
      return res.status(400).json({
        status: 'error',
        message: '您已屏蔽该用户',
        code: 5001
      });
    }
  }
  
  // 检查是否已经收到好友请求
  const incomingRequest = await Friend.findOne({
    userId: friendUser.id,
    friendId: userId
  });
  
  if (incomingRequest && incomingRequest.status === 'pending') {
    // 接受已有的好友请求
    await incomingRequest.accept();
    
    const friend = {
      id: incomingRequest._id,
      userId: friendUser.id,
      username: friendUser.username,
      avatar: friendUser.avatar,
      status: 'online',
      groupName: '默认分组',
      createTime: new Date()
    };
    
    return res.status(200).json({
      status: 'success',
      data: { friend },
      message: '已接受好友请求'
    });
  }
  
  // 创建新的好友请求
  const friendship = await Friend.create({
    userId,
    friendId: friendUser.id,
    status: 'pending',
    groupName: '默认分组'
  });
  
  const friend = {
    id: friendship._id,
    userId: friendUser.id,
    username: friendUser.username,
    avatar: friendUser.avatar,
    status: 'pending',
    groupName: '默认分组',
    createTime: friendship.createTime
  };
  
  res.status(200).json({
    status: 'success',
    data: { friend },
    message: '好友请求已发送'
  });
});

// 删除好友
exports.removeFriend = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const friendshipId = req.params.friendId;
  
  // 查找好友关系
  const friendship = await Friend.findOne({
    _id: friendshipId,
    userId
  });
  
  if (!friendship) {
    return res.status(404).json({
      status: 'error',
      message: '好友关系不存在',
      code: 5001
    });
  }
  
  // 删除双向好友关系
  await Friend.deleteOne({ _id: friendshipId });
  await Friend.deleteOne({ userId: friendship.friendId, friendId: userId });
  
  res.status(200).json({
    status: 'success',
    message: '好友删除成功'
  });
});

// 修改好友分组
exports.updateFriendGroup = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const friendshipId = req.params.friendId;
  const { groupName } = req.body;
  
  if (!groupName) {
    return res.status(400).json({
      status: 'error',
      message: '请提供分组名称',
      code: 1001
    });
  }
  
  // 查找并更新好友分组
  const friendship = await Friend.findOneAndUpdate(
    { _id: friendshipId, userId },
    { groupName },
    { new: true }
  );
  
  if (!friendship) {
    return res.status(404).json({
      status: 'error',
      message: '好友关系不存在',
      code: 5001
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      friend: {
        id: friendship._id,
        groupName: friendship.groupName
      }
    },
    message: '好友分组已更新'
  });
});

// 获取用户参与的房间列表
exports.getUserRooms = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status = 'all', page = 1, limit = 20 } = req.query;
  
  // 构建查询条件
  const query = { 'players.userId': userId };
  
  if (status !== 'all') {
    query.status = status;
  }
  
  // 查询总数
  const total = await Room.countDocuments(query);
  
  // 查询房间列表
  const rooms = await Room.find(query)
    .sort({ createTime: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('creatorId', 'username avatar');
  
  // 格式化房间列表
  const formattedRooms = rooms.map(room => ({
    id: room._id,
    name: room.name,
    creatorId: room.creatorId._id,
    creatorName: room.creatorId.username,
    creatorAvatar: room.creatorId.avatar,
    gameType: room.gameType,
    playerCount: room.playerCount,
    currentPlayers: room.players.length,
    status: room.status,
    hasPassword: room.hasPassword,
    createTime: room.createTime
  }));
  
  res.status(200).json({
    status: 'success',
    data: { rooms: formattedRooms },
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }
  });
});

// 绑定游戏账号
exports.bindGameAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { gameId, platform = 'LOL' } = req.body;
  
  if (!gameId) {
    return res.status(400).json({
      status: 'error',
      message: '请提供游戏ID',
      code: 1001
    });
  }
  
  const user = await User.findById(userId);
  
  // 检查是否已有相同平台的绑定
  const existingBinding = user.gameBindings.find(binding => binding.platform === platform);
  
  if (existingBinding) {
    // 更新现有绑定
    existingBinding.gameId = gameId;
    existingBinding.status = 'pending';
    existingBinding.createTime = Date.now();
  } else {
    // 添加新绑定
    user.gameBindings.push({
      platform,
      gameId,
      status: 'pending'
    });
  }
  
  // 同时更新主游戏ID
  user.gameId = gameId;
  
  await user.save();
  
  const binding = user.gameBindings.find(binding => binding.platform === platform);
  
  res.status(200).json({
    status: 'success',
    data: { binding },
    message: '游戏账号绑定待验证'
  });
}); 