/**
 * 比赛控制器
 * 处理比赛数据的提交和查询
 */

const Match = require('../models/Match');
const Room = require('../models/Room');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
// socketHelper现在通过req.socketHelper获取
const mongoose = require('mongoose');

// 提交比赛数据
exports.submitMatchData = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const {
    gameId,
    startTime,
    endTime,
    duration,
    teams,
    bannedChampions
  } = req.body;

  // 验证必要字段
  if (!gameId || !startTime || !endTime || !duration || !teams) {
    return res.status(400).json({
      status: 'error',
      message: '缺少必要的比赛数据',
      code: 1001
    });
  }

  // 验证teams格式
  if (!Array.isArray(teams) || teams.length === 0 ||
      !teams.every(team => team.id && team.side && team.result && Array.isArray(team.players))) {
    return res.status(400).json({
      status: 'error',
      message: '队伍数据格式错误',
      code: 1001
    });
  }

  // 查找房间并验证
  const room = await Room.findById(roomId);

  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: '房间不存在',
      code: 3001
    });
  }

  // 检查用户是否在房间中
  const playerInRoom = room.players.find(p => p.userId.toString() === userId);

  if (!playerInRoom) {
    return res.status(403).json({
      status: 'error',
      message: '您不在该房间中',
      code: 1003
    });
  }

  // 检查是否已经提交过比赛数据
  const existingMatch = await Match.findOne({ roomId, gameId });

  if (existingMatch) {
    return res.status(400).json({
      status: 'error',
      message: '该对局的数据已经提交过',
      code: 4002
    });
  }

  // 验证队伍数据
  const winningTeam = teams.find(team => team.result === 'win');

  if (!winningTeam) {
    return res.status(400).json({
      status: 'error',
      message: '必须指定获胜的队伍',
      code: 1001
    });
  }

  // 开始事务
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 创建比赛记录
    const match = new Match({
      roomId,
      gameId,
      startTime,
      endTime,
      duration,
      isValid: true,
      winner: winningTeam.id,
      teams: teams,
      bannedChampions: bannedChampions || []
    });

    await match.save({ session });

    // 更新玩家的战绩统计
    for (const team of teams) {
      const isWinner = team.result === 'win';

      for (const player of team.players) {
        await User.findByIdAndUpdate(
          player.userId,
          {
            $inc: {
              'stats.totalGames': 1,
              'stats.wins': isWinner ? 1 : 0,
              'stats.losses': !isWinner ? 1 : 0,
              [`stats.champions.${player.championId}.games`]: 1,
              [`stats.champions.${player.championId}.wins`]: isWinner ? 1 : 0,
              [`stats.champions.${player.championId}.losses`]: !isWinner ? 1 : 0,
              [`stats.champions.${player.championId}.kills`]: player.kills,
              [`stats.champions.${player.championId}.deaths`]: player.deaths,
              [`stats.champions.${player.championId}.assists`]: player.assists
            }
          },
          { session, new: true, upsert: true }
        );
      }
    }

    // 更新房间状态
    room.status = 'ended';
    room.endTime = Date.now();
    await room.save({ session });

    // 提交事务
    await session.commitTransaction();

    // 通知房间内所有用户
    if (req.socketHelper) {
      req.socketHelper.safeNotifyRoom(roomId, 'match.submitted', {
        matchId: match._id,
        winner: winningTeam.id,
        teams: match.teams
      });
    }

    res.status(201).json({
      status: 'success',
      data: {
        matchId: match._id,
        roomId: match.roomId,
        gameId: match.gameId,
        startTime: match.startTime,
        endTime: match.endTime,
        winner: match.winner
      },
      message: '比赛数据提交成功'
    });
  } catch (error) {
    // 回滚事务
    await session.abortTransaction();

    console.error('提交比赛数据失败:', error);

    return res.status(500).json({
      status: 'error',
      message: '提交比赛数据失败',
      code: 9001
    });
  } finally {
    // 结束会话
    session.endSession();
  }
});

// 获取比赛详情
exports.getMatch = asyncHandler(async (req, res) => {
  const matchId = req.params.matchId;

  const match = await Match.findById(matchId)
    .populate('roomId', 'name playerCount')
    .populate('teams.players.userId', 'username avatar gameId');

  if (!match) {
    return res.status(404).json({
      status: 'error',
      message: '比赛不存在',
      code: 4001
    });
  }

  // 计算MVP（评分最高的玩家）
  let mvpPlayer = null;
  let highestRating = -1;

  for (const team of match.teams) {
    for (const player of team.players) {
      const playerRating = player.rating ||
        ((player.kills * 3 + player.assists * 1.5) / (player.deaths || 1)) +
        (player.damage / 1000) * 0.5;

      if (playerRating > highestRating) {
        highestRating = playerRating;
        mvpPlayer = player;
      }
    }
  }

  // 设置MVP
  if (mvpPlayer) {
    mvpPlayer.isMVP = true;
  }

  // 格式化响应数据
  const formattedMatch = {
    id: match._id,
    roomId: match.roomId,
    gameId: match.gameId,
    startTime: match.startTime,
    endTime: match.endTime,
    duration: match.duration,
    winner: match.winner,
    teams: match.teams.map(team => ({
      id: team.id,
      side: team.side,
      result: team.result,
      players: team.players.map(player => ({
        userId: player.userId._id,
        username: player.userId.username,
        avatar: player.userId.avatar,
        gameId: player.userId.gameId,
        championId: player.championId,
        championName: player.championName,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        damage: player.damage,
        gold: player.gold,
        cs: player.cs,
        vision: player.vision,
        rating: player.rating ||
          ((player.kills * 3 + player.assists * 1.5) / (player.deaths || 1)) +
          (player.damage / 1000) * 0.5,
        isMVP: player.isMVP || false,
        kda: player.deaths === 0 ?
          (player.kills + player.assists) :
          parseFloat(((player.kills + player.assists) / player.deaths).toFixed(2))
      }))
    })),
    bannedChampions: match.bannedChampions,
    createTime: match.createTime
  };

  res.status(200).json({
    status: 'success',
    data: { match: formattedMatch }
  });
});

// 评价队友
exports.ratePlayer = asyncHandler(async (req, res) => {
  const matchId = req.params.matchId;
  const userId = req.user.id;
  const { targetUserId, type } = req.body;

  // 验证必要字段
  if (!targetUserId || !type) {
    return res.status(400).json({
      status: 'error',
      message: '缺少必要的评价数据',
      code: 1001
    });
  }

  // 验证评价类型
  if (type !== 'like' && type !== 'dislike') {
    return res.status(400).json({
      status: 'error',
      message: '评价类型必须是 like 或 dislike',
      code: 1001
    });
  }

  // 不能评价自己
  if (userId === targetUserId) {
    return res.status(400).json({
      status: 'error',
      message: '不能评价自己',
      code: 1001
    });
  }

  // 查找比赛
  const match = await Match.findById(matchId);

  if (!match) {
    return res.status(404).json({
      status: 'error',
      message: '比赛不存在',
      code: 4001
    });
  }

  // 检查评价者和被评价者是否参与了比赛
  let raterFound = false;
  let ratedFound = false;

  for (const team of match.teams) {
    for (const player of team.players) {
      if (player.userId.toString() === userId) {
        raterFound = true;
      }
      if (player.userId.toString() === targetUserId) {
        ratedFound = true;
      }
    }
  }

  if (!raterFound) {
    return res.status(403).json({
      status: 'error',
      message: '您没有参与这场比赛',
      code: 1003
    });
  }

  if (!ratedFound) {
    return res.status(400).json({
      status: 'error',
      message: '目标用户没有参与这场比赛',
      code: 1001
    });
  }

  try {
    // 添加评价
    const rating = await match.addRating(userId, targetUserId, type);
    await match.save();

    // 获取被评价用户信息
    const ratedUser = await User.findById(targetUserId, 'username avatar');

    // 通知被评价的用户
    if (req.socketHelper) {
      req.socketHelper.safeNotifyUser(targetUserId, 'rating.received', {
        matchId,
        type,
        from: {
          userId,
          username: req.user.username,
          avatar: req.user.avatar
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        matchId,
        from: {
          userId,
          username: req.user.username
        },
        to: {
          userId: targetUserId,
          username: ratedUser.username
        },
        type,
        createTime: rating.createTime
      },
      message: '评价成功'
    });
  } catch (error) {
    console.error('添加评价失败:', error);

    return res.status(500).json({
      status: 'error',
      message: '添加评价失败',
      code: 9001
    });
  }
});

// 验证游戏对局
exports.verifyGame = asyncHandler(async (req, res) => {
  const { gameId, participants, gameType, gameMode } = req.body;

  // 验证必要字段
  if (!gameId || !participants || !gameType || !gameMode) {
    return res.status(400).json({
      status: 'error',
      message: '缺少必要的游戏数据',
      code: 1001
    });
  }

  // 验证游戏类型（必须是经典自定义模式）
  if (gameType !== 'CUSTOM_GAME' || gameMode !== 'CLASSIC') {
    return res.status(400).json({
      status: 'error',
      message: '仅支持经典自定义对局',
      code: 4001
    });
  }

  // 提取参与者的游戏ID
  const summonerIds = participants.map(p => p.summonerId);

  // 查找这些游戏ID对应的用户
  const users = await User.find({ gameId: { $in: summonerIds } }, '_id username gameId');

  // 创建游戏ID到用户的映射
  const gameIdToUser = {};
  users.forEach(user => {
    gameIdToUser[user.gameId] = user;
  });

  // 找到匹配的用户ID
  const matchedPlayers = [];
  for (const participant of participants) {
    const user = gameIdToUser[participant.summonerId];
    if (user) {
      matchedPlayers.push({
        userId: user._id,
        username: user.username,
        gameId: user.gameId,
        summonerName: participant.summonerName
      });
    }
  }

  // 如果匹配的用户少于2个，表示不是有效的内战
  if (matchedPlayers.length < 2) {
    return res.status(200).json({
      status: 'success',
      data: {
        isValid: false,
        matchedPlayers
      }
    });
  }

  // 查找包含这些用户的活跃房间
  const matchedUserIds = matchedPlayers.map(p => p.userId);

  const room = await Room.findOne({
    'players.userId': { $all: matchedUserIds },
    status: 'gaming'
  });

  res.status(200).json({
    status: 'success',
    data: {
      isValid: !!room,
      roomId: room ? room._id : null,
      matchedPlayers
    }
  });
});