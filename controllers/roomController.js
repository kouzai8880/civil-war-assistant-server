/**
 * 房间控制器
 * 处理房间的创建、查询、加入和管理功能
 */

const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const Invitation = require('../models/Invitation');
const asyncHandler = require('../utils/asyncHandler');
const socketHelper = require('../utils/socketHelper');

// 创建房间
exports.createRoom = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, playerCount, gameType, teamCount, pickMode, password, description, isPublic } = req.body;
  
  // 检查必要字段
  if (!name || !playerCount) {
    return res.status(400).json({
      status: 'error',
      message: '请提供房间名称和玩家数量',
      code: 1001
    });
  }
  
  // 创建房间
  const room = new Room({
    name,
    creatorId: userId,
    playerCount,
    gameType: gameType || 'LOL',
    teamCount: teamCount || 2,
    pickMode: pickMode || 'random',
    description,
    isPublic: isPublic !== undefined ? isPublic : true
  });
  
  // 设置密码（如果有）
  if (password) {
    await room.setPassword(password);
  }
  
  // 创建者加入房间
  room.addPlayer(userId, true);
  
  // 保存房间
  await room.save();
  
  // 格式化响应数据
  const formattedRoom = {
    id: room._id,
    name: room.name,
    creatorId: room.creatorId,
    gameType: room.gameType,
    playerCount: room.playerCount,
    teamCount: room.teamCount,
    pickMode: room.pickMode,
    hasPassword: room.hasPassword,
    isPublic: room.isPublic,
    description: room.description,
    status: room.status,
    players: room.players.map(player => ({
      userId: player.userId,
      isCreator: player.isCreator,
      status: player.status,
      joinTime: player.joinTime
    })),
    spectators: [],
    teams: [],
    createTime: room.createTime
  };
  
  res.status(201).json({
    status: 'success',
    data: { room: formattedRoom },
    message: '房间创建成功'
  });
});

// 获取房间列表
exports.getRooms = asyncHandler(async (req, res) => {
  const { 
    status, 
    gameType, 
    playerCount, 
    keyword, 
    page = 1, 
    limit = 20 
  } = req.query;
  
  // 构建查询条件
  const query = {};
  
  if (status && status !== 'all') {
    query.status = status;
  } else {
    // 默认不显示已结束的房间
    query.status = { $ne: 'ended' };
  }
  
  if (gameType) {
    query.gameType = gameType;
  }
  
  if (playerCount) {
    query.playerCount = parseInt(playerCount);
  }
  
  if (keyword) {
    // 同时搜索房间名和创建者名
    query.$or = [
      { name: { $regex: keyword, $options: 'i' } }
    ];
  }
  
  // 计算总数
  const total = await Room.countDocuments(query);
  
  // 查询房间列表，增加对玩家和观众信息的填充
  const rooms = await Room.find(query)
    .sort({ createTime: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit))
    .populate('creatorId', 'username avatar')
    .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
    .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId');
  
  // 格式化响应数据
  const formattedRooms = rooms.map(room => {
    // 获取在线状态
    const onlineStatus = {};
    
    if (socketHelper) {
      try {
        const onlineUsers = socketHelper.safeGetRoomOnlineUsers(room._id);
        room.players.forEach(player => {
          onlineStatus[player.userId._id] = onlineUsers.includes(player.userId._id.toString());
        });
        room.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = onlineUsers.includes(spectator.userId._id.toString());
        });
      } catch (error) {
        console.error('获取在线用户状态失败:', error);
        // 默认所有用户在线
        room.players.forEach(player => {
          onlineStatus[player.userId._id] = true;
        });
        room.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = true;
        });
      }
    } else {
      // socketHelper不可用，默认所有用户在线
      room.players.forEach(player => {
        onlineStatus[player.userId._id] = true;
      });
      room.spectators.forEach(spectator => {
        onlineStatus[spectator.userId._id] = true;
      });
    }
    
    // 格式化玩家数据
    const players = room.players.map(player => {
      const user = player.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        teamId: player.teamId,
        isCaptain: player.isCaptain,
        isCreator: player.isCreator,
        status: onlineStatus[user._id] ? player.status : 'offline',
        joinTime: player.joinTime
      };
    });
    
    // 格式化观众数据
    const spectators = room.spectators.map(spectator => {
      const user = spectator.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        isCreator: spectator.isCreator,
        status: onlineStatus[user._id] ? spectator.status : 'offline',
        joinTime: spectator.joinTime
      };
    });
    
    return {
      id: room._id,
      name: room.name,
      creatorId: room.creatorId._id,
      creatorName: room.creatorId.username,
      creatorAvatar: room.creatorId.avatar,
      gameType: room.gameType,
      playerCount: room.playerCount,
      currentPlayers: room.players.length,
      viewerCount: room.spectators.length,
      status: room.status,
      hasPassword: room.hasPassword,
      isPublic: room.isPublic,
      pickMode: room.pickMode,
      description: room.description,
      createTime: room.createTime,
      players: players,
      spectators: spectators,
      teams: room.teams
    };
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

// 获取房间详情
exports.getRoom = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  
  const room = await Room.findById(roomId)
    .populate('creatorId', 'username avatar')
    .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
    .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
    .populate('teams.captainId', 'username avatar');
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 获取在线状态
  const onlineStatus = {};
  
  if (socketHelper) {
    try {
      const onlineUsers = socketHelper.safeGetRoomOnlineUsers(roomId);
      room.players.forEach(player => {
        onlineStatus[player.userId._id] = onlineUsers.includes(player.userId._id.toString());
      });
      room.spectators.forEach(spectator => {
        onlineStatus[spectator.userId._id] = onlineUsers.includes(spectator.userId._id.toString());
      });
    } catch (error) {
      console.error('获取在线用户状态失败:', error);
      // 默认所有用户在线
      room.players.forEach(player => {
        onlineStatus[player.userId._id] = true;
      });
      room.spectators.forEach(spectator => {
        onlineStatus[spectator.userId._id] = true;
      });
    }
  } else {
    // socketHelper不可用，默认所有用户在线
    room.players.forEach(player => {
      onlineStatus[player.userId._id] = true;
    });
    room.spectators.forEach(spectator => {
      onlineStatus[spectator.userId._id] = true;
    });
  }
  
  // 格式化玩家数据
  const players = room.players.map(player => {
    const user = player.userId;
    return {
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      gameId: user.gameId,
      totalGames: user.stats ? user.stats.totalGames : 0,
      wins: user.stats ? user.stats.wins : 0,
      teamId: player.teamId,
      isCaptain: player.isCaptain,
      isCreator: player.isCreator,
      status: onlineStatus[user._id] ? player.status : 'offline',
      joinTime: player.joinTime
    };
  });
  
  // 格式化观众数据
  const spectators = room.spectators.map(spectator => {
    const user = spectator.userId;
    return {
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      gameId: user.gameId,
      totalGames: user.stats ? user.stats.totalGames : 0,
      wins: user.stats ? user.stats.wins : 0,
      isCreator: spectator.isCreator,
      status: onlineStatus[user._id] ? spectator.status : 'offline',
      joinTime: spectator.joinTime
    };
  });
  
  // 格式化响应数据
  const formattedRoom = {
    id: room._id,
    name: room.name,
    creatorId: room.creatorId._id,
    creatorName: room.creatorId.username,
    creatorAvatar: room.creatorId.avatar,
    gameType: room.gameType,
    playerCount: room.playerCount,
    teamCount: room.teamCount,
    pickMode: room.pickMode,
    hasPassword: room.hasPassword,
    description: room.description,
    status: room.status,
    players,
    spectators,
    teams: room.teams,
    nextTeamPick: room.nextTeamPick,
    createTime: room.createTime,
    startTime: room.startTime,
    endTime: room.endTime
  };
  
  res.status(200).json({
    status: 'success',
    data: { room: formattedRoom }
  });
});

// 加入房间
exports.joinRoom = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const { password } = req.body;
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 验证密码
  if (room.hasPassword) {
    const isValid = await room.verifyPassword(password);
    
    if (!isValid) {
      return res.status(401).json({
        status: 'error',
        message: '密码错误',
        code: 3004
      });
    }
  }
  
  // 添加用户到观众席
  try {
    // 检查用户是否已经在房间中（玩家列表或观众席）
    const existingPlayer = room.players.find(p => p.userId.toString() === userId);
    const existingSpectator = room.spectators.find(s => s.userId.toString() === userId);
    
    if (existingPlayer || existingSpectator) {
      return res.status(400).json({
        status: 'error',
        message: '您已经在房间中',
        code: 3005
      });
    }
    
    const isCreator = !room.players.length && !room.spectators.length;
    const spectator = room.addSpectator(userId, isCreator);
    
    // 如果是创建者，更新房间的creatorId
    if (isCreator) {
      room.creatorId = userId;
    }
    
    await room.save();
    
    // 获取用户信息
    const user = await User.findById(userId, 'username avatar stats.totalGames stats.wins gameId');
    
    // 通知房间内其他用户
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, 'spectator.joined', {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        totalGames: user.stats.totalGames,
        wins: user.stats.wins,
        isCreator: spectator.isCreator
      });
    }
    
    // 获取更新后的房间详情
    const updatedRoom = await Room.findById(roomId)
      .populate('creatorId', 'username avatar')
      .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
      .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
      .populate('teams.captainId', 'username avatar');
    
    // 获取在线状态
    const onlineStatus = {};
    
    if (socketHelper) {
      try {
        const onlineUsers = socketHelper.safeGetRoomOnlineUsers(roomId);
        updatedRoom.players.forEach(player => {
          onlineStatus[player.userId._id] = onlineUsers.includes(player.userId._id.toString());
        });
        updatedRoom.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = onlineUsers.includes(spectator.userId._id.toString());
        });
      } catch (error) {
        console.error('获取在线用户状态失败:', error);
        // 默认所有用户在线
        updatedRoom.players.forEach(player => {
          onlineStatus[player.userId._id] = true;
        });
        updatedRoom.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = true;
        });
      }
    } else {
      // socketHelper不可用，默认所有用户在线
      updatedRoom.players.forEach(player => {
        onlineStatus[player.userId._id] = true;
      });
      updatedRoom.spectators.forEach(spectator => {
        onlineStatus[spectator.userId._id] = true;
      });
    }
    
    // 格式化玩家数据
    const players = updatedRoom.players.map(player => {
      const user = player.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        teamId: player.teamId,
        isCaptain: player.isCaptain,
        isCreator: player.isCreator,
        status: onlineStatus[user._id] ? player.status : 'offline',
        joinTime: player.joinTime
      };
    });
    
    // 格式化观众数据
    const spectators = updatedRoom.spectators.map(spectator => {
      const user = spectator.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        isCreator: spectator.isCreator,
        status: onlineStatus[user._id] ? spectator.status : 'offline',
        joinTime: spectator.joinTime
      };
    });
    
    // 格式化响应数据
    const formattedRoom = {
      id: updatedRoom._id,
      name: updatedRoom.name,
      creatorId: updatedRoom.creatorId._id,
      creatorName: updatedRoom.creatorId.username,
      creatorAvatar: updatedRoom.creatorId.avatar,
      gameType: updatedRoom.gameType,
      playerCount: updatedRoom.playerCount,
      teamCount: updatedRoom.teamCount,
      pickMode: updatedRoom.pickMode,
      hasPassword: updatedRoom.hasPassword,
      description: updatedRoom.description,
      status: updatedRoom.status,
      players,
      spectators,
      teams: updatedRoom.teams,
      nextTeamPick: updatedRoom.nextTeamPick,
      createTime: updatedRoom.createTime,
      startTime: updatedRoom.startTime,
      endTime: updatedRoom.endTime
    };
    
    res.status(200).json({
      status: 'success',
      data: { room: formattedRoom },
      message: '加入房间成功，已进入观众席'
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
      code: 3002
    });
  }
});

// 离开房间
exports.leaveRoom = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查用户是否在房间中
  const playerIndex = room.players.findIndex(p => p.userId.toString() === userId);
  const spectatorIndex = room.spectators.findIndex(s => s.userId.toString() === userId);
  
  if (playerIndex === -1 && spectatorIndex === -1) {
    return res.status(400).json({
      status: 'error',
      message: '您不在该房间中',
      code: 3002
    });
  }
  
  // 检查房间状态和用户是否在玩家列表中
  if (room.status === 'gaming' && playerIndex !== -1) {
    return res.status(400).json({
      status: 'error',
      message: '游戏进行中，玩家无法离开',
      code: 3003
    });
  }
  
  let isCreator = false;
  
  // 处理离开的逻辑
  if (playerIndex !== -1) {
    // 玩家离开
    isCreator = room.players[playerIndex].isCreator;
    room.players.splice(playerIndex, 1);
    
    // 通知类型
    leaveType = 'player';
  } else {
    // 观众离开
    isCreator = room.spectators[spectatorIndex].isCreator;
    room.spectators.splice(spectatorIndex, 1);
    
    // 通知类型
    leaveType = 'spectator';
  }
  
  // 如果是房主且还有其他人，转移房主权限
  if (isCreator) {
    // 首先检查玩家列表
    if (room.players.length > 0) {
      // 找到加入时间最早的玩家
      const earliestPlayer = room.players.reduce((earliest, player) => {
        return player.joinTime < earliest.joinTime ? player : earliest;
      }, room.players[0]);
      
      // 转移房主权限
      earliestPlayer.isCreator = true;
      room.creatorId = earliestPlayer.userId;
    } 
    // 然后检查观众席
    else if (room.spectators.length > 0) {
      // 找到加入时间最早的观众
      const earliestSpectator = room.spectators.reduce((earliest, spectator) => {
        return spectator.joinTime < earliest.joinTime ? spectator : earliest;
      }, room.spectators[0]);
      
      // 转移房主权限
      earliestSpectator.isCreator = true;
      room.creatorId = earliestSpectator.userId;
    }
  }
  
  // 如果房间没有玩家和观众了，删除房间
  if (room.players.length === 0 && room.spectators.length === 0) {
    await Room.deleteOne({ _id: roomId });
    
    res.status(200).json({
      status: 'success',
      message: '已离开房间，房间已删除'
    });
  } else {
    // 保存房间
    await room.save();
    
    // 通知房间内其他人
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, `${leaveType}.left`, {
        userId,
        newCreatorId: isCreator ? room.creatorId : null
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: '已离开房间'
    });
  }
});

// 开始游戏
exports.startGame = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查是否是房主
  if (room.creatorId.toString() !== userId) {
    return res.status(403).json({
      status: 'error',
      message: '只有房主可以开始游戏',
      code: 1003
    });
  }
  
  // 检查房间状态
  if (room.status !== 'waiting') {
    return res.status(400).json({
      status: 'error',
      message: '房间已经开始游戏',
      code: 3003
    });
  }
  
  // 检查玩家人数
  if (room.players.length < room.playerCount) {
    return res.status(400).json({
      status: 'error',
      message: `需要 ${room.playerCount} 名玩家才能开始游戏，当前只有 ${room.players.length} 名`,
      code: 3004
    });
  }
  
  try {
    // 分配队伍
    const teams = room.assignTeams();
    await room.save();
    
    // 获取玩家详细信息
    const userIds = room.players.map(p => p.userId);
    const users = await User.find({ _id: { $in: userIds } }, 'username avatar');
    
    // 将用户信息与玩家信息组合
    const players = room.players.map(player => {
      const user = users.find(u => u._id.toString() === player.userId.toString());
      return {
        userId: player.userId,
        username: user ? user.username : 'Unknown',
        avatar: user ? user.avatar : null,
        teamId: player.teamId,
        isCaptain: player.isCaptain
      };
    });
    
    // 通知房间内所有玩家
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, 'game.started', {
        teams,
        players,
        pickMode: room.pickMode,
        status: room.status,
        nextTeamPick: room.nextTeamPick
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        teams,
        players,
        status: room.status,
        nextTeamPick: room.nextTeamPick
      },
      message: '游戏已开始'
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
      code: 3004
    });
  }
});

// 队长选择队员
exports.selectPlayer = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const { teamId, playerId } = req.body;
  
  // 检查必要字段
  if (!teamId || !playerId) {
    return res.status(400).json({
      status: 'error',
      message: '请提供队伍ID和玩家ID',
      code: 1001
    });
  }
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查房间状态
  if (room.status !== 'picking') {
    return res.status(400).json({
      status: 'error',
      message: '房间不在选人阶段',
      code: 3003
    });
  }
  
  // 检查是否是队长
  const captain = room.players.find(p => 
    p.userId.toString() === userId && 
    p.teamId === parseInt(teamId) && 
    p.isCaptain
  );
  
  if (!captain) {
    return res.status(403).json({
      status: 'error',
      message: '只有队长可以选择队员',
      code: 1003
    });
  }
  
  try {
    // 查看未分配的玩家数量
    const unassignedPlayers = room.players.filter(p => p.teamId === null);
    
    // 队长选择队员
    const result = room.captainSelectPlayer(parseInt(teamId), playerId);
    
    // 如果只剩最后一名队员，自动分配
    if (unassignedPlayers.length === 2) { // 选择当前玩家后，将只剩1名未分配的玩家
      const lastPlayer = room.players.find(p => p.teamId === null);
      if (lastPlayer) {
        // 根据pickMode决定分配给哪个队伍
        if (room.pickMode === '12221') {
          lastPlayer.teamId = 1; // 12221模式分配给蓝队
        } else {
          lastPlayer.teamId = 2; // 其他模式分配给红队
        }
        room.status = 'gaming';
        room.nextTeamPick = null;
      }
    }
    
    await room.save();
    
    // 获取被选择的玩家信息
    const player = await User.findById(playerId, 'username avatar');
    
    // 通知房间内所有玩家
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, 'player.selected', {
        userId: playerId,
        username: player.username,
        avatar: player.avatar,
        teamId: parseInt(teamId),
        nextTeamPick: result.nextTeam,
        remainingPlayers: result.remainingPlayers.length
      });
      
      // 如果自动分配了最后一名队员，也通知
      if (unassignedPlayers.length === 2 && room.status === 'gaming') {
        const lastPlayer = room.players.find(p => p.userId.toString() !== playerId);
        const lastPlayerInfo = await User.findById(lastPlayer.userId, 'username avatar');
        
        socketHelper.safeNotifyRoom(roomId, 'player.selected', {
          userId: lastPlayer.userId,
          username: lastPlayerInfo.username,
          avatar: lastPlayerInfo.avatar,
          teamId: lastPlayer.teamId, // 使用实际分配的队伍ID
          nextTeamPick: null,
          remainingPlayers: 0,
          isAutoAssigned: true
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        player: {
          userId: playerId,
          username: player.username,
          teamId: parseInt(teamId)
        },
        nextTeamPick: result.nextTeam,
        status: room.status
      },
      message: '队员选择成功'
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
      code: 3004
    });
  }
});

// 选择红蓝方
exports.selectSide = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const { teamId, side } = req.body;
  
  // 检查必要字段
  if (!teamId || !side) {
    return res.status(400).json({
      status: 'error',
      message: '请提供队伍ID和阵营',
      code: 1001
    });
  }
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查房间状态
  if (room.status !== 'gaming') {
    return res.status(400).json({
      status: 'error',
      message: '房间不在游戏阶段',
      code: 3003
    });
  }
  
  // 检查是否是队长
  const captain = room.players.find(p => 
    p.userId.toString() === userId && 
    p.teamId === parseInt(teamId) && 
    p.isCaptain
  );
  
  if (!captain) {
    return res.status(403).json({
      status: 'error',
      message: '只有队长可以选择阵营',
      code: 1003
    });
  }
  
  try {
    // 选择阵营
    const teams = room.selectSide(parseInt(teamId), side);
    await room.save();
    
    // 通知房间内所有玩家
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, 'team.selected_side', {
        teamId: parseInt(teamId),
        side,
        teams: room.teams
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { teams },
      message: '阵营选择成功'
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
      code: 3004
    });
  }
});

// 获取房间聊天记录
exports.getRoomMessages = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const { channel = 'all', teamId, page = 1, limit = 50 } = req.query;
  
  // 构建查询条件
  const query = { roomId };
  
  if (channel !== 'all') {
    query.channel = channel;
    
    if (channel === 'team' && teamId) {
      query.teamId = parseInt(teamId);
    }
  }
  
  // 查询消息总数
  const total = await Message.countDocuments(query);
  
  // 查询消息
  const messages = await Message.find(query)
    .sort({ createTime: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit))
    .populate('userId', 'username avatar');
  
  // 格式化消息
  const formattedMessages = messages.map(message => ({
    id: message._id,
    userId: message.userId._id,
    username: message.userId.username,
    avatar: message.userId.avatar,
    content: message.content,
    type: message.type,
    channel: message.channel,
    teamId: message.teamId,
    createTime: message.createTime
  }));
  
  res.status(200).json({
    status: 'success',
    data: { messages: formattedMessages },
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    }
  });
});

// 发送消息
exports.sendMessage = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const { content, type = 'text', channel = 'public', teamId } = req.body;
  
  // 检查消息内容
  if (!content) {
    return res.status(400).json({
      status: 'error',
      message: '消息内容不能为空',
      code: 1001
    });
  }
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查用户是否在房间中
  const player = room.players.find(p => p.userId.toString() === userId);
  const isSpectator = !player;
  
  if (!player && !isSpectator) {
    return res.status(403).json({
      status: 'error',
      message: '您不在该房间中',
      code: 1003
    });
  }
  
  // 检查频道权限
  if (channel === 'team') {
    if (!teamId) {
      return res.status(400).json({
        status: 'error',
        message: '队伍消息必须指定队伍ID',
        code: 1001
      });
    }
    
    if (isSpectator) {
      return res.status(403).json({
        status: 'error',
        message: '观众不能发送队伍消息',
        code: 1003
      });
    }
    
    if (player.teamId !== parseInt(teamId)) {
      return res.status(403).json({
        status: 'error',
        message: '您不在该队伍中',
        code: 1003
      });
    }
  }
  
  // 创建消息
  const message = new Message({
    roomId,
    userId,
    content,
    type,
    channel,
    teamId: channel === 'team' ? parseInt(teamId) : null,
    createTime: Date.now()
  });
  
  await message.save();
  
  // 获取用户信息
  const user = await User.findById(userId, 'username avatar');
  
  // 格式化消息
  const formattedMessage = {
    id: message._id,
    userId,
    username: user.username,
    avatar: user.avatar,
    content: message.content,
    type: message.type,
    channel: message.channel,
    teamId: message.teamId,
    createTime: message.createTime
  };
  
  // 通过Socket.IO广播消息
  if (socketHelper) {
    if (channel === 'team') {
      // 发送给队伍成员
      socketHelper.safeNotifyTeam(roomId, parseInt(teamId), 'new_message', formattedMessage);
      
      // 同时发送给观众，但标记为队伍消息
      formattedMessage.isTeamMessage = true;
      socketHelper.safeNotifySpectators(roomId, 'new_message', formattedMessage);
    } else {
      // 公共消息发送给所有人
      socketHelper.safeNotifyRoom(roomId, 'new_message', formattedMessage);
    }
  }
  
  res.status(201).json({
    status: 'success',
    data: { message: formattedMessage }
  });
});

// 邀请好友
exports.inviteFriends = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const inviterId = req.user.id;
  const { friendIds } = req.body;
  
  // 检查好友ID列表
  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: '请提供要邀请的好友ID列表',
      code: 1001
    });
  }
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查用户是否在房间中
  const playerInRoom = room.players.find(p => p.userId.toString() === inviterId);
  
  if (!playerInRoom) {
    return res.status(403).json({
      status: 'error',
      message: '您不在该房间中',
      code: 1003
    });
  }
  
  // 检查房间状态
  if (room.status !== 'waiting') {
    return res.status(400).json({
      status: 'error',
      message: '房间已经开始游戏，无法邀请',
      code: 3003
    });
  }
  
  // 检查房间是否已满
  if (room.players.length >= room.playerCount) {
    return res.status(400).json({
      status: 'error',
      message: '房间已满',
      code: 3002
    });
  }
  
  // 查找现有邀请
  const existingInvitations = await Invitation.find({
    roomId,
    userId: { $in: friendIds },
    status: 'pending'
  });
  
  // 已邀请的好友ID
  const existingFriendIds = existingInvitations.map(inv => inv.userId.toString());
  
  // 创建新邀请
  const newInvitations = [];
  const failedInvitations = [];
  
  for (const friendId of friendIds) {
    // 跳过已邀请的好友
    if (existingFriendIds.includes(friendId)) {
      failedInvitations.push({
        friendId,
        reason: '已经发送过邀请'
      });
      continue;
    }
    
    // 检查是否已在房间中
    const alreadyInRoom = room.players.some(p => p.userId.toString() === friendId);
    if (alreadyInRoom) {
      failedInvitations.push({
        friendId,
        reason: '已在房间中'
      });
      continue;
    }
    
    // 创建邀请
    try {
      const invitation = new Invitation({
        roomId,
        inviterId,
        userId: friendId,
        status: 'pending',
        expireTime: new Date(Date.now() + 30 * 60 * 1000) // 30分钟后过期
      });
      
      await invitation.save();
      newInvitations.push(invitation);
    } catch (error) {
      failedInvitations.push({
        friendId,
        reason: error.message
      });
    }
  }
  
  // 通知被邀请的好友
  if (socketHelper) {
    for (const invitation of newInvitations) {
      socketHelper.safeNotifyUser(invitation.userId, 'room.invited', {
        id: invitation._id,
        roomId,
        roomName: room.name,
        inviterId: userId,
        inviterName: req.user.username,
        createTime: invitation.createTime,
        expireTime: invitation.expireTime
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      invitations: newInvitations.map(inv => ({
        id: inv._id,
        friendId: inv.userId,
        status: inv.status,
        expireTime: inv.expireTime
      })),
      failed: failedInvitations
    },
    message: `成功邀请 ${newInvitations.length} 名好友，${failedInvitations.length} 名好友邀请失败`
  });
});

// 从观众席加入玩家列表
exports.joinAsPlayer = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查房间状态
  if (room.status !== 'waiting') {
    return res.status(400).json({
      status: 'error',
      message: '房间已经开始游戏，无法加入玩家列表',
      code: 3003
    });
  }
  
  // 检查玩家列表是否已满
  if (room.players.length >= room.playerCount) {
    return res.status(400).json({
      status: 'error',
      message: '玩家列表已满',
      code: 3002
    });
  }
  
  // 检查用户是否在观众席中
  const spectatorIndex = room.spectators.findIndex(s => s.userId.toString() === userId);
  if (spectatorIndex === -1) {
    return res.status(400).json({
      status: 'error',
      message: '您不在该房间的观众席中',
      code: 3006
    });
  }
  
  try {
    // 将用户从观众席移动到玩家列表
    const player = room.moveSpectatorToPlayer(userId);
    await room.save();
    
    // 获取用户信息
    const user = await User.findById(userId, 'username avatar stats.totalGames stats.wins gameId');
    
    // 通知房间内其他用户
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, 'player.joined', {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        totalGames: user.stats.totalGames,
        wins: user.stats.wins,
        isCreator: player.isCreator
      });
      
      socketHelper.safeNotifyRoom(roomId, 'spectator.left', {
        userId: user._id,
        username: user.username
      });
    }
    
    // 获取更新后的房间详情
    const updatedRoom = await Room.findById(roomId)
      .populate('creatorId', 'username avatar')
      .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
      .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
      .populate('teams.captainId', 'username avatar');
    
    // 获取在线状态
    const onlineStatus = {};
    
    if (socketHelper) {
      try {
        const onlineUsers = socketHelper.safeGetRoomOnlineUsers(roomId);
        updatedRoom.players.forEach(player => {
          onlineStatus[player.userId._id] = onlineUsers.includes(player.userId._id.toString());
        });
        updatedRoom.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = onlineUsers.includes(spectator.userId._id.toString());
        });
      } catch (error) {
        console.error('获取在线用户状态失败:', error);
        // 默认所有用户在线
        updatedRoom.players.forEach(player => {
          onlineStatus[player.userId._id] = true;
        });
        updatedRoom.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = true;
        });
      }
    } else {
      // socketHelper不可用，默认所有用户在线
      updatedRoom.players.forEach(player => {
        onlineStatus[player.userId._id] = true;
      });
      updatedRoom.spectators.forEach(spectator => {
        onlineStatus[spectator.userId._id] = true;
      });
    }
    
    // 格式化玩家数据
    const players = updatedRoom.players.map(player => {
      const user = player.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        teamId: player.teamId,
        isCaptain: player.isCaptain,
        isCreator: player.isCreator,
        status: onlineStatus[user._id] ? player.status : 'offline',
        joinTime: player.joinTime
      };
    });
    
    // 格式化观众数据
    const spectators = updatedRoom.spectators.map(spectator => {
      const user = spectator.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        isCreator: spectator.isCreator,
        status: onlineStatus[user._id] ? spectator.status : 'offline',
        joinTime: spectator.joinTime
      };
    });
    
    // 格式化响应数据
    const formattedRoom = {
      id: updatedRoom._id,
      name: updatedRoom.name,
      creatorId: updatedRoom.creatorId._id,
      creatorName: updatedRoom.creatorId.username,
      creatorAvatar: updatedRoom.creatorId.avatar,
      gameType: updatedRoom.gameType,
      playerCount: updatedRoom.playerCount,
      teamCount: updatedRoom.teamCount,
      pickMode: updatedRoom.pickMode,
      hasPassword: updatedRoom.hasPassword,
      description: updatedRoom.description,
      status: updatedRoom.status,
      players,
      spectators,
      teams: updatedRoom.teams,
      nextTeamPick: updatedRoom.nextTeamPick,
      createTime: updatedRoom.createTime,
      startTime: updatedRoom.startTime,
      endTime: updatedRoom.endTime
    };
    
    res.status(200).json({
      status: 'success',
      data: { room: formattedRoom },
      message: '已从观众席加入玩家列表'
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
      code: 3007
    });
  }
});

// 从玩家列表进入观众席
exports.joinAsSpectator = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查房间状态
  if (room.status === 'gaming') {
    return res.status(400).json({
      status: 'error',
      message: '游戏进行中，玩家无法离开',
      code: 3003
    });
  }
  
  // 检查用户是否在玩家列表中
  const playerIndex = room.players.findIndex(p => p.userId.toString() === userId);
  if (playerIndex === -1) {
    return res.status(400).json({
      status: 'error',
      message: '您不在该房间的玩家列表中',
      code: 3006
    });
  }
  
  try {
    // 将用户从玩家列表移动到观众席
    const spectator = room.movePlayerToSpectator(userId);
    await room.save();
    
    // 获取用户信息
    const user = await User.findById(userId, 'username avatar stats.totalGames stats.wins gameId');
    
    // 通知房间内其他用户
    if (socketHelper) {
      socketHelper.safeNotifyRoom(roomId, 'spectator.joined', {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        totalGames: user.stats.totalGames,
        wins: user.stats.wins,
        isCreator: spectator.isCreator
      });
      
      socketHelper.safeNotifyRoom(roomId, 'player.left', {
        userId: user._id,
        username: user.username
      });
    }
    
    // 获取更新后的房间详情
    const updatedRoom = await Room.findById(roomId)
      .populate('creatorId', 'username avatar')
      .populate('players.userId', 'username avatar stats.totalGames stats.wins gameId')
      .populate('spectators.userId', 'username avatar stats.totalGames stats.wins gameId')
      .populate('teams.captainId', 'username avatar');
    
    // 获取在线状态
    const onlineStatus = {};
    
    if (socketHelper) {
      try {
        const onlineUsers = socketHelper.safeGetRoomOnlineUsers(roomId);
        updatedRoom.players.forEach(player => {
          onlineStatus[player.userId._id] = onlineUsers.includes(player.userId._id.toString());
        });
        updatedRoom.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = onlineUsers.includes(spectator.userId._id.toString());
        });
      } catch (error) {
        console.error('获取在线用户状态失败:', error);
        // 默认所有用户在线
        updatedRoom.players.forEach(player => {
          onlineStatus[player.userId._id] = true;
        });
        updatedRoom.spectators.forEach(spectator => {
          onlineStatus[spectator.userId._id] = true;
        });
      }
    } else {
      // socketHelper不可用，默认所有用户在线
      updatedRoom.players.forEach(player => {
        onlineStatus[player.userId._id] = true;
      });
      updatedRoom.spectators.forEach(spectator => {
        onlineStatus[spectator.userId._id] = true;
      });
    }
    
    // 格式化玩家数据
    const players = updatedRoom.players.map(player => {
      const user = player.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        teamId: player.teamId,
        isCaptain: player.isCaptain,
        isCreator: player.isCreator,
        status: onlineStatus[user._id] ? player.status : 'offline',
        joinTime: player.joinTime
      };
    });
    
    // 格式化观众数据
    const spectators = updatedRoom.spectators.map(spectator => {
      const user = spectator.userId;
      return {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        gameId: user.gameId,
        totalGames: user.stats ? user.stats.totalGames : 0,
        wins: user.stats ? user.stats.wins : 0,
        isCreator: spectator.isCreator,
        status: onlineStatus[user._id] ? spectator.status : 'offline',
        joinTime: spectator.joinTime
      };
    });
    
    // 格式化响应数据
    const formattedRoom = {
      id: updatedRoom._id,
      name: updatedRoom.name,
      creatorId: updatedRoom.creatorId._id,
      creatorName: updatedRoom.creatorId.username,
      creatorAvatar: updatedRoom.creatorId.avatar,
      gameType: updatedRoom.gameType,
      playerCount: updatedRoom.playerCount,
      teamCount: updatedRoom.teamCount,
      pickMode: updatedRoom.pickMode,
      hasPassword: updatedRoom.hasPassword,
      description: updatedRoom.description,
      status: updatedRoom.status,
      players,
      spectators,
      teams: updatedRoom.teams,
      nextTeamPick: updatedRoom.nextTeamPick,
      createTime: updatedRoom.createTime,
      startTime: updatedRoom.startTime,
      endTime: updatedRoom.endTime
    };
    
    res.status(200).json({
      status: 'success',
      data: { room: formattedRoom },
      message: '已从玩家列表进入观众席'
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
      code: 3007
    });
  }
});

// 踢出玩家
exports.kickPlayer = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const { targetUserId } = req.body;
  
  // 检查必要字段
  if (!targetUserId) {
    return res.status(400).json({
      status: 'error',
      message: '请提供要踢出的用户ID',
      code: 1001
    });
  }
  
  // 查找房间
  const room = await Room.findById(roomId);
  
  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }
  
  // 检查是否是房主
  if (room.creatorId.toString() !== userId) {
    return res.status(403).json({
      status: 'error',
      message: '只有房主可以踢出玩家',
      code: 1003
    });
  }
  
  // 检查目标用户是否在房间中
  const playerIndex = room.players.findIndex(p => p.userId.toString() === targetUserId);
  const spectatorIndex = room.spectators.findIndex(s => s.userId.toString() === targetUserId);
  
  if (playerIndex === -1 && spectatorIndex === -1) {
    return res.status(400).json({
      status: 'error',
      message: '该用户不在房间中',
      code: 3002
    });
  }
  
  // 不能踢出自己
  if (targetUserId === userId) {
    return res.status(400).json({
      status: 'error',
      message: '不能踢出自己',
      code: 3002
    });
  }
  
  // 使用removeUser方法移除用户
  const result = room.removeUser(targetUserId);
  
  if (!result) {
    return res.status(400).json({
      status: 'error',
      message: '踢出用户失败',
      code: 3002
    });
  }
  
  const { type: leaveType } = result;
  
  // 保存房间
  await room.save();
  
  // 通知房间内其他人
  if (socketHelper) {
    if (leaveType === 'player') {
      // 直接通知被踢出的用户
      socketHelper.safeNotifyUser(targetUserId, 'player.kicked', {
        roomId,
        kickedBy: userId
      });
      // 通知房间内其他用户
      socketHelper.safeNotifyRoom(roomId, 'player.kicked', {
        userId: targetUserId,
        kickedBy: userId
      });
    } else {
      // 直接通知被踢出的用户
      socketHelper.safeNotifyUser(targetUserId, 'spectator.kicked', {
        roomId,
        kickedBy: userId
      });
      // 通知房间内其他用户
      socketHelper.safeNotifyRoom(roomId, 'spectator.kicked', {
        userId: targetUserId,
        kickedBy: userId
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    message: '已踢出用户'
  });
}); 