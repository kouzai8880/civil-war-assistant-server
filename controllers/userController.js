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
  const { timeRange = 'all', gameType = 'all' } = req.query;
  
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: '用户不存在',
      code: 2001
    });
  }
  
  // 构建时间范围过滤
  const timeFilter = {};
  if (timeRange !== 'all') {
    const now = new Date();
    let startDate;
    
    if (timeRange === '7d') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeRange === '30d') {
      startDate = new Date(now.setDate(now.getDate() - 30));
    } else if (timeRange === '90d') {
      startDate = new Date(now.setDate(now.getDate() - 90));
    }
    
    if (startDate) {
      timeFilter.startTime = { $gte: startDate };
    }
  }
  
  // 构建游戏类型过滤
  const gameTypeFilter = {};
  if (gameType !== 'all') {
    gameTypeFilter.gameType = gameType;
  }
  
  // 查询用户最常用的英雄
  const matches = await Match.aggregate([
    // 匹配时间和游戏类型过滤条件
    { $match: { ...timeFilter, ...gameTypeFilter } },
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
  
  // 获取最近5场比赛结果
  const recentMatches = await Match.aggregate([
    // 匹配时间和游戏类型过滤条件
    { $match: { ...timeFilter, ...gameTypeFilter } },
    { $unwind: '$teams' },
    { $unwind: '$teams.players' },
    { $match: { 'teams.players.userId': user._id } },
    { $sort: { startTime: -1 } },
    { $limit: 5 },
    { $project: {
      result: '$teams.result'
    }}
  ]);
  
  // 获取位置分布
  const roleDistribution = await Match.aggregate([
    // 匹配时间和游戏类型过滤条件
    { $match: { ...timeFilter, ...gameTypeFilter } },
    { $unwind: '$teams' },
    { $unwind: '$teams.players' },
    { $match: { 'teams.players.userId': user._id } },
    { $group: {
      _id: '$teams.players.role',
      count: { $sum: 1 }
    }}
  ]);
  
  // 计算平均KDA和其他统计数据
  const matchStats = await Match.aggregate([
    // 匹配时间和游戏类型过滤条件
    { $match: { ...timeFilter, ...gameTypeFilter } },
    { $unwind: '$teams' },
    { $unwind: '$teams.players' },
    { $match: { 'teams.players.userId': user._id } },
    { $group: {
      _id: null,
      totalGames: { $sum: 1 },
      wins: { $sum: { $cond: [{ $eq: ['$teams.result', 'win'] }, 1, 0] } },
      totalKills: { $sum: '$teams.players.kills' },
      totalDeaths: { $sum: '$teams.players.deaths' },
      totalAssists: { $sum: '$teams.players.assists' },
      totalDamage: { $avg: '$teams.players.damage' },
      totalGold: { $avg: '$teams.players.gold' },
      avgScore: { $avg: '$teams.players.rating' }
    }},
    { $project: {
      _id: 0,
      totalGames: 1,
      wins: 1,
      losses: { $subtract: ['$totalGames', '$wins'] },
      winRate: {
        $multiply: [
          { $divide: [{ $cond: [{ $eq: ['$totalGames', 0] }, 0, '$wins'] }, { $cond: [{ $eq: ['$totalGames', 0] }, 1, '$totalGames'] }] },
          100
        ]
      },
      avgKDA: { 
        $concat: [
          { $toString: { $round: [{ $divide: ['$totalKills', '$totalGames'] }, 1] } },
          '/',
          { $toString: { $round: [{ $divide: ['$totalDeaths', '$totalGames'] }, 1] } },
          '/',
          { $toString: { $round: [{ $divide: ['$totalAssists', '$totalGames'] }, 1] } }
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
      avgGold: { $round: ['$totalGold', 0] },
      avgScore: { $round: ['$avgScore', 1] }
    }}
  ]);
  
  // 格式化位置分布数据
  const roles = {};
  roleDistribution.forEach(role => {
    roles[role._id || 'other'] = role.count;
  });
  
  // 格式化最近战绩
  const recentForm = recentMatches.map(match => match.result === 'win' ? 'W' : 'L');
  
  // 组装战绩统计数据
  const stats = {
    totalGames: matchStats.length > 0 ? matchStats[0].totalGames : user.stats.totalGames,
    wins: matchStats.length > 0 ? matchStats[0].wins : user.stats.wins,
    losses: matchStats.length > 0 ? matchStats[0].losses : user.stats.losses,
    winRate: matchStats.length > 0 ? matchStats[0].winRate.toFixed(1) : user.getWinRate(),
    likes: user.stats.likes,
    dislikes: user.stats.dislikes,
    avgKDA: matchStats.length > 0 ? matchStats[0].avgKDA : '0/0/0',
    kdaRatio: matchStats.length > 0 ? matchStats[0].kdaRatio : 0,
    avgDamage: matchStats.length > 0 ? matchStats[0].avgDamage : 0,
    avgGold: matchStats.length > 0 ? matchStats[0].avgGold : 0,
    avgScore: matchStats.length > 0 ? matchStats[0].avgScore : 0,
    mostPlayedChampions: matches,
    recentForm: recentForm,
    roleDistribution: roles
  };
  
  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

// 获取用户对局列表
exports.getUserMatches = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { 
    page = 1, 
    limit = 20, 
    champion, 
    result, 
    gameType, 
    timeRange 
  } = req.query;
  
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
  
  if (gameType) {
    matchQuery.$and.push({ 'gameType': gameType });
  }
  
  // 添加时间范围过滤
  if (timeRange) {
    const now = new Date();
    let startDate;
    
    if (timeRange === '7d') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeRange === '30d') {
      startDate = new Date(now.setDate(now.getDate() - 30));
    } else if (timeRange === '90d') {
      startDate = new Date(now.setDate(now.getDate() - 90));
    }
    
    if (startDate) {
      matchQuery.$and.push({ 'startTime': { $gte: startDate } });
    }
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
      duration: { 
        $concat: [
          { $toString: { $floor: { $divide: ['$duration', 60] } } },
          '分钟'
        ]
      },
      rawDuration: '$duration',
      result: '$teams.result',
      championId: '$teams.players.championId',
      championName: '$teams.players.championName',
      kills: '$teams.players.kills',
      deaths: '$teams.players.deaths',
      assists: '$teams.players.assists',
      kda: { 
        $concat: [
          { $toString: '$teams.players.kills' },
          '/',
          { $toString: '$teams.players.deaths' },
          '/',
          { $toString: '$teams.players.assists' }
        ]
      },
      kdaRatio: { 
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
      isMVP: '$teams.players.isMVP',
      items: '$teams.players.items',
      team: {
        side: '$teams.side',
        result: '$teams.result'
      },
      teamId: '$teams.id'
    }},
    // 排序
    { $sort: { startTime: -1 } },
    // 分页
    { $skip: (page - 1) * limit },
    { $limit: parseInt(limit) }
  ]);
  
  // 查询每场比赛的所有玩家简要信息
  const matchIds = matches.map(match => match.id);
  const allPlayers = await Match.aggregate([
    { $match: { _id: { $in: matchIds } } },
    { $unwind: '$teams' },
    { $unwind: '$teams.players' },
    { $lookup: {
      from: 'users',
      localField: 'teams.players.userId',
      foreignField: '_id',
      as: 'playerInfo'
    }},
    { $project: {
      matchId: '$_id',
      userId: '$teams.players.userId',
      username: { $arrayElemAt: ['$playerInfo.username', 0] },
      championId: '$teams.players.championId',
      side: '$teams.side',
      teamId: '$teams.id'
    }}
  ]);
  
  // 整理每场比赛的玩家信息
  const playersByMatch = {};
  allPlayers.forEach(player => {
    if (!playersByMatch[player.matchId]) {
      playersByMatch[player.matchId] = [];
    }
    playersByMatch[player.matchId].push({
      userId: player.userId,
      username: player.username,
      championId: player.championId,
      side: player.side,
      teamId: player.teamId
    });
  });
  
  // 将玩家信息添加到每场比赛
  const formattedMatches = matches.map(match => {
    match.allPlayers = playersByMatch[match.id] || [];
    return match;
  });
  
  res.status(200).json({
    status: 'success',
    data: { matches: formattedMatches },
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
  const { status = 'all', type = 'all', page = 1, limit = 20 } = req.query;
  
  // 构建查询条件
  const query = { 'players.userId': userId };
  
  // 根据类型过滤
  if (type === 'current') {
    query.status = { $in: ['waiting', 'picking', 'gaming'] };
  } else if (type === 'history') {
    query.status = 'ended';
  } else if (status !== 'all') {
    // 如果指定了具体状态，则优先使用状态过滤
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
  
  // 查询用户最近参与的比赛结果
  const matchData = {};
  if (type === 'history' || status === 'ended') {
    const matchIds = rooms.map(room => room._id);
    const matches = await Match.find({ roomId: { $in: matchIds } })
      .select('roomId teams players');
    
    // 整理比赛数据，方便查询
    matches.forEach(match => {
      // 查找用户的队伍和结果
      const playerData = match.players.find(p => p.userId.toString() === userId);
      if (playerData) {
        const team = match.teams.find(t => t.id === playerData.teamId);
        matchData[match.roomId] = {
          result: team?.result || 'unknown',
          teamId: playerData.teamId,
          teamName: team?.side === 'blue' ? '蓝队' : '红队',
          duration: match.duration ? `${Math.floor(match.duration / 60)}分钟` : '未知',
          kdaRatio: playerData.deaths === 0 ? 
            playerData.kills + playerData.assists : 
            ((playerData.kills + playerData.assists) / playerData.deaths).toFixed(2)
        };
      }
    });
  }
  
  // 格式化房间列表
  const formattedRooms = rooms.map(room => {
    // 基本房间信息
    const formattedRoom = {
      id: room._id,
      name: room.name,
      creatorId: room.creatorId._id,
      creatorName: room.creatorId.username,
      creatorAvatar: room.creatorId.avatar,
      gameType: room.gameType,
      playerCount: room.playerCount,
      currentPlayers: room.players.length,
      viewerCount: room.viewerCount || 0,
      status: room.status,
      hasPassword: room.hasPassword,
      pickMode: room.pickMode,
      createTime: room.createTime
    };
    
    // 对于历史房间，添加比赛结果信息
    if (room.status === 'ended' && matchData[room._id]) {
      formattedRoom.result = matchData[room._id].result;
      formattedRoom.myTeam = matchData[room._id].teamName;
      formattedRoom.duration = matchData[room._id].duration;
      formattedRoom.kdaRatio = matchData[room._id].kdaRatio;
    }
    
    return formattedRoom;
  });
  
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