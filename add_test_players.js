/**
 * 为指定房间添加测试玩家的脚本
 */
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/civil-war', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB 连接成功');
}).catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});

// 导入用户模型
const User = require('./models/User');

// 目标房间ID
const ROOM_ID = '67f8c22a15e647e47c404592';
// API基础URL
const API_BASE_URL = 'http://localhost:3000/api/v1';
// 测试玩家数量
const NUM_PLAYERS = 8;

// 测试玩家信息
const testPlayers = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
  username: `测试玩家${i + 1}`,
  email: `test${i + 1}@example.com`,
  password: 'password123',
  gameId: `TEST${1000 + i}`,
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + Math.random()
}));

// 创建测试玩家
async function createTestPlayers() {
  console.log('开始创建测试玩家...');

  for (let i = 0; i < testPlayers.length; i++) {
    const player = testPlayers[i];

    try {
      // 检查用户是否已存在
      const existingUser = await User.findOne({ email: player.email });

      if (existingUser) {
        console.log(`玩家 ${player.username} (${player.email}) 已存在，跳过创建`);
        testPlayers[i].id = existingUser._id;
        continue;
      }

      // 创建新用户
      // 使用固定的密码哈希值，对应密码 'password123'
      const hashedPassword = '$2a$10$3YGMjHLyavhKqnFRzjvPZuJzG5ND1/MZm/PewP.gpsJQCcVNPcUHO';
      const newUser = new User({
        username: player.username,
        email: player.email,
        password: hashedPassword,
        gameId: player.gameId,
        avatar: player.avatar,
        stats: {
          totalGames: Math.floor(Math.random() * 100),
          wins: Math.floor(Math.random() * 50)
        }
      });

      const savedUser = await newUser.save();
      testPlayers[i].id = savedUser._id;
      console.log(`创建玩家 ${player.username} 成功，ID: ${savedUser._id}`);
    } catch (error) {
      console.error(`创建玩家 ${player.username} 失败:`, error);
    }
  }

  console.log('所有测试玩家创建完成');
}

// 登录测试玩家并获取token
async function loginTestPlayers() {
  console.log('开始登录测试玩家...');

  for (let i = 0; i < testPlayers.length; i++) {
    const player = testPlayers[i];

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: player.email,
        password: player.password
      });

      if (response.data.status === 'success') {
        testPlayers[i].token = response.data.token;
        console.log(`玩家 ${player.username} 登录成功，获取token`);
      } else {
        console.error(`玩家 ${player.username} 登录失败:`, response.data.message);
      }
    } catch (error) {
      console.error(`玩家 ${player.username} 登录请求失败:`, error.response?.data || error.message);
    }
  }

  console.log('所有测试玩家登录完成');
}

// 让测试玩家加入房间
async function joinRoom() {
  console.log(`开始让测试玩家加入房间 ${ROOM_ID}...`);

  for (let i = 0; i < testPlayers.length; i++) {
    const player = testPlayers[i];

    if (!player.token) {
      console.log(`玩家 ${player.username} 没有token，跳过加入房间`);
      continue;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/rooms/${ROOM_ID}/join`, {}, {
        headers: {
          'Authorization': `Bearer ${player.token}`
        }
      });

      if (response.data.status === 'success') {
        console.log(`玩家 ${player.username} 成功加入房间`);
      } else {
        console.error(`玩家 ${player.username} 加入房间失败:`, response.data.message);
      }
    } catch (error) {
      console.error(`玩家 ${player.username} 加入房间请求失败:`, error.response?.data || error.message);
    }

    // 添加延迟，避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('所有测试玩家加入房间完成');
}

// 主函数
async function main() {
  try {
    await createTestPlayers();
    await loginTestPlayers();
    await joinRoom();

    console.log('所有操作完成，测试玩家信息:');
    testPlayers.forEach(player => {
      console.log(`- ${player.username} (ID: ${player.id})`);
    });

    // 断开数据库连接
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('执行过程中出错:', error);
  }
}

// 执行主函数
main();
