/**
 * 语音通讯功能测试
 * 测试基于Socket.IO的语音通讯功能
 * 测试内容：
 * 1. 团队语音隔离 - 确保队伍成员只能听到自己队伍的语音
 * 2. 观众语音传输 - 确保观众只能与其他观众通话，队伍成员不会受到干扰
 * 3. 观众可以听到所有队伍成员的语音
 */

const io = require('socket.io-client');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const config = require('../config');

// 配置
const SERVER_URL = config.test.socketUrl;
const JWT_SECRET = config.server.jwtSecret;
const TEST_ROOM_ID = config.test.testRoomId;

// 创建用户令牌
function createUserToken(userId, username, teamId, role = 'player') {
  return jwt.sign(
    { id: userId, username, teamId, role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// 测试用户
const users = {
  team1Player1: { id: 'team1-player1', username: 'Team1Player1', teamId: 'team1', role: 'player' },
  team1Player2: { id: 'team1-player2', username: 'Team1Player2', teamId: 'team1', role: 'player' },
  team2Player1: { id: 'team2-player1', username: 'Team2Player1', teamId: 'team2', role: 'player' },
  team2Player2: { id: 'team2-player2', username: 'Team2Player2', teamId: 'team2', role: 'player' },
  spectator1: { id: 'spectator1', username: 'Spectator1', teamId: null, role: 'spectator' },
  spectator2: { id: 'spectator2', username: 'Spectator2', teamId: null, role: 'spectator' }
};

// 创建Socket连接
function createSocketConnection(user) {
  const token = createUserToken(user.id, user.username, user.teamId, user.role);
  console.log(`创建连接 - 用户: ${user.username}, 队伍: ${user.teamId}, 角色: ${user.role}`);
  
  return io(SERVER_URL, {
    auth: { token },
    query: {
      teamId: user.teamId,
      role: user.role
    },
    transports: ['websocket'],
    reconnection: false
  });
}

// 示例语音数据 (base64编码)
const voiceData = 'SGVsbG8sIHRoaXMgaXMgYSB0ZXN0IHZvaWNlIGRhdGEu'; // "Hello, this is a test voice data."

// 辅助函数：等待特定事件
function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// 运行测试
async function runTests() {
  console.log('开始语音通讯测试...');
  console.log(`使用服务器URL: ${SERVER_URL}`);
  console.log(`使用JWT密钥: ${JWT_SECRET.substring(0, 3)}...`);
  
  // 连接所有用户
  const sockets = {};
  for (const [key, user] of Object.entries(users)) {
    sockets[key] = createSocketConnection(user);
    
    sockets[key].on('connect', () => {
      console.log(`${user.username} 已连接`);
    });
    
    sockets[key].on('connect_error', (error) => {
      console.error(`${user.username} 连接错误:`, error.message);
    });
    
    sockets[key].on('error', (error) => {
      console.error(`${user.username} Socket错误:`, error);
    });
  }
  
  // 等待所有用户连接
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 所有用户加入房间
  for (const [key, socket] of Object.entries(sockets)) {
    socket.emit('joinRoom', { roomId: TEST_ROOM_ID });
    console.log(`${users[key].username} 加入了房间 ${TEST_ROOM_ID}`);
  }
  
  // 等待加入房间完成
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let testsPassed = true;
  
  try {
    // 测试1: 队伍语音隔离
    console.log('\n测试1: 团队语音隔离 - Team1Player1 发送语音');
    
    // 设置计数器跟踪收到的语音数据
    const voiceDataReceivedCount = {
      team1Player1: 0,
      team1Player2: 0,
      team2Player1: 0,
      team2Player2: 0,
      spectator1: 0,
      spectator2: 0
    };
    
    // 设置语音数据监听器
    for (const [key, socket] of Object.entries(sockets)) {
      socket.on('voiceData', (data) => {
        if (data.from === users.team1Player1.id) {
          voiceDataReceivedCount[key]++;
        }
      });
    }
    
    // Team1Player1 发送语音数据
    sockets.team1Player1.emit('voiceStart', { roomId: TEST_ROOM_ID });
    sockets.team1Player1.emit('voiceData', { 
      roomId: TEST_ROOM_ID, 
      data: voiceData 
    });
    sockets.team1Player1.emit('voiceEnd', { roomId: TEST_ROOM_ID });
    
    // 等待数据传输完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 断言预期结果
    assert.equal(voiceDataReceivedCount.team1Player1, 0, 'Team1Player1不应收到自己的语音'); // 发送者不接收自己的语音
    assert.ok(voiceDataReceivedCount.team1Player2 > 0, 'Team1Player2应该收到Team1Player1的语音');
    assert.equal(voiceDataReceivedCount.team2Player1, 0, 'Team2Player1不应收到Team1的语音');
    assert.equal(voiceDataReceivedCount.team2Player2, 0, 'Team2Player2不应收到Team1的语音');
    assert.ok(voiceDataReceivedCount.spectator1 > 0, 'Spectator1应该收到所有队伍的语音');
    assert.ok(voiceDataReceivedCount.spectator2 > 0, 'Spectator2应该收到所有队伍的语音');
    
    console.log('测试1通过: 队伍语音隔离正常工作');
    
    // 测试2: 观众语音隔离
    console.log('\n测试2: 观众语音隔离 - Spectator1 发送语音');
    
    // 重置计数器
    for (const key in voiceDataReceivedCount) {
      voiceDataReceivedCount[key] = 0;
    }
    
    // 更新监听器，监听来自观众的语音
    for (const [key, socket] of Object.entries(sockets)) {
      socket.removeAllListeners('voiceData');
      socket.on('voiceData', (data) => {
        if (data.from === users.spectator1.id) {
          voiceDataReceivedCount[key]++;
        }
      });
    }
    
    // Spectator1 发送语音数据
    sockets.spectator1.emit('voiceStart', { roomId: TEST_ROOM_ID });
    sockets.spectator1.emit('voiceData', { 
      roomId: TEST_ROOM_ID, 
      data: voiceData 
    });
    sockets.spectator1.emit('voiceEnd', { roomId: TEST_ROOM_ID });
    
    // 等待数据传输完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 断言预期结果
    assert.equal(voiceDataReceivedCount.team1Player1, 0, 'Team1Player1不应收到观众的语音');
    assert.equal(voiceDataReceivedCount.team1Player2, 0, 'Team1Player2不应收到观众的语音');
    assert.equal(voiceDataReceivedCount.team2Player1, 0, 'Team2Player1不应收到观众的语音');
    assert.equal(voiceDataReceivedCount.team2Player2, 0, 'Team2Player2不应收到观众的语音');
    assert.equal(voiceDataReceivedCount.spectator1, 0, 'Spectator1不应收到自己的语音'); // 发送者不接收自己的语音
    assert.ok(voiceDataReceivedCount.spectator2 > 0, 'Spectator2应该收到Spectator1的语音');
    
    console.log('测试2通过: 观众语音隔离正常工作');
    
    // 测试3: 语音状态更新
    console.log('\n测试3: 语音状态更新 - Team1Player1 开始和结束语音');
    
    // 设置状态更新监听器
    let voiceStartReceived = false;
    let voiceEndReceived = false;
    
    sockets.team1Player2.on('voiceStateUpdate', (data) => {
      if (data.userId === users.team1Player1.id && data.state === 'started') {
        voiceStartReceived = true;
      } else if (data.userId === users.team1Player1.id && data.state === 'ended') {
        voiceEndReceived = true;
      }
    });
    
    // Team1Player1 开始和结束语音
    sockets.team1Player1.emit('voiceStart', { roomId: TEST_ROOM_ID });
    await new Promise(resolve => setTimeout(resolve, 500));
    sockets.team1Player1.emit('voiceEnd', { roomId: TEST_ROOM_ID });
    
    // 等待状态更新
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 断言预期结果
    assert.ok(voiceStartReceived, 'Team1Player2应该收到Team1Player1开始语音的状态更新');
    assert.ok(voiceEndReceived, 'Team1Player2应该收到Team1Player1结束语音的状态更新');
    
    console.log('测试3通过: 语音状态更新正常工作');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    testsPassed = false;
  } finally {
    // 断开所有连接
    for (const socket of Object.values(sockets)) {
      socket.disconnect();
    }
  }
  
  console.log(`\n语音通讯测试${testsPassed ? '全部通过' : '失败'}`);
  return testsPassed;
}

// 如果是主模块则运行测试
if (require.main === module) {
  runTests().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

module.exports = { runTests }; 