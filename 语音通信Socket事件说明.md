# 语音通信Socket事件说明

本文档详细说明了语音通信相关的Socket事件，包括加入/离开语音房间、发送语音数据、静音控制等功能。

## 语音房间类型

系统提供三种不同的语音房间：

1. **公共语音房间（public）**：所有用户都可以加入，无论是玩家还是观众。
2. **一队语音房间（team1）**：主要供一队队员使用，但其他用户也可以加入。
3. **二队语音房间（team2）**：主要供二队队员使用，但其他用户也可以加入。

## 客户端发送的事件

### `joinVoiceChannel`

加入指定的语音房间。

```javascript
socket.emit('joinVoiceChannel', {
  roomId: '房间ID',
  channel: 'public' // 可选值: 'public', 'team1', 'team2'
});
```

参数说明：
- `roomId`：房间ID
- `channel`：要加入的语音房间类型，可选值为 'public'（公共语音房间）、'team1'（一队语音房间）或 'team2'（二队语音房间）

### `leaveVoiceChannel`

离开当前加入的语音房间。

```javascript
socket.emit('leaveVoiceChannel', {
  roomId: '房间ID'
});
```

参数说明：
- `roomId`：房间ID

### `voiceData`

发送语音数据到当前加入的语音房间。

```javascript
socket.emit('voiceData', {
  roomId: '房间ID',
  data: voiceDataArrayBuffer // 语音数据，通常是ArrayBuffer
});
```

参数说明：
- `roomId`：房间ID
- `data`：语音数据，通常是从麦克风捕获的音频数据

### `voiceMute`

更新用户的静音状态。

```javascript
socket.emit('voiceMute', {
  roomId: '房间ID',
  isMuted: true // 是否静音
});
```

参数说明：
- `roomId`：房间ID
- `isMuted`：是否静音，`true` 表示静音，`false` 表示取消静音

## 服务器发送的事件

### `roomJoined` 和 `getRoomDetail` 中的语音房间数据

当用户加入房间或获取房间详情时，服务器会返回各语音房间的用户列表。这些数据包含在房间结构内部。

```javascript
socket.on('roomJoined', (response) => {
  // response.data.room.voiceChannels: {
  //   public: [
  //     { userId: '用户ID1', username: '用户名1', teamId: 1, role: 'player' },
  //     { userId: '用户ID2', username: '用户名2', teamId: 2, role: 'player' }
  //   ],
  //   team1: [
  //     { userId: '用户ID3', username: '用户名3', teamId: 1, role: 'player' }
  //   ],
  //   team2: [
  //     { userId: '用户ID4', username: '用户名4', teamId: 2, role: 'player' }
  //   ]
  // }

  // 初始化语音房间UI，显示各语音房间的用户
  initVoiceChannelsUI(response.data.room.voiceChannels);
});

// 获取房间详情时也会返回相同的数据结构
socket.emit('getRoomDetail', { roomId }, (response) => {
  if (response.status === 'success') {
    initVoiceChannelsUI(response.data.room.voiceChannels);
  }
});
```

### `voiceChannelJoined`

当用户成功加入语音房间时，服务器会发送此事件。

```javascript
socket.on('voiceChannelJoined', (response) => {
  // response: {
  //   status: 'success',
  //   data: { channel: 'public' },
  //   message: '加入公共语音房间成功'
  // }

  // 更新UI，显示当前加入的语音房间
  updateVoiceChannelUI(response.data.channel);
});
```

### `voiceChannelLeft`

当用户成功离开语音房间时，服务器会发送此事件。

```javascript
socket.on('voiceChannelLeft', (response) => {
  // response: {
  //   status: 'success',
  //   message: '离开公共语音房间成功'
  // }

  // 更新UI，显示已离开语音房间
  updateVoiceChannelUI('none');
});
```

### `voiceChannelUsers`

当用户加入语音房间时，服务器会发送当前语音房间的其他用户列表。

```javascript
socket.on('voiceChannelUsers', (data) => {
  // data: {
  //   channel: 'public',
  //   users: [
  //     { userId: '用户ID1', username: '用户名1', teamId: 1, role: 'player' },
  //     { userId: '用户ID2', username: '用户名2', teamId: 2, role: 'player' },
  //     { userId: '用户ID3', username: '用户名3', teamId: null, role: 'spectator' }
  //   ]
  // }

  // 更新UI，显示当前语音房间的其他用户
  updateVoiceChannelUsersUI(data.channel, data.users);
});
```

### `userJoinedVoiceChannel`

当其他用户加入当前语音房间时，服务器会发送此事件。

```javascript
socket.on('userJoinedVoiceChannel', (data) => {
  // data: {
  //   userId: '用户ID',
  //   username: '用户名',
  //   channel: 'public',
  //   updateTime: '2023-05-01T12:00:00Z'
  // }

  // 更新UI，显示新用户加入了语音房间
  addUserToVoiceChannelUI(data);
});
```

### `userLeftVoiceChannel`

当其他用户离开当前语音房间时，服务器会发送此事件。

```javascript
socket.on('userLeftVoiceChannel', (data) => {
  // data: {
  //   userId: '用户ID',
  //   username: '用户名',
  //   previousChannel: 'public',
  //   newChannel: 'team1', // 如果用户是切换到另一个语音房间，则会有此字段
  //   updateTime: '2023-05-01T12:00:00Z'
  // }

  // 更新UI，显示用户离开了语音房间
  removeUserFromVoiceChannelUI(data);
});
```

### `voiceData`

当其他用户在当前语音房间发送语音数据时，服务器会转发此事件。

```javascript
socket.on('voiceData', (data) => {
  // data: {
  //   from: '用户ID',
  //   username: '用户名',
  //   channel: 'public',
  //   data: voiceDataArrayBuffer
  // }

  // 播放语音数据
  playVoiceData(data.from, data.data);
});
```

### `voiceMuteUpdate`

当其他用户更新静音状态时，服务器会发送此事件。

```javascript
socket.on('voiceMuteUpdate', (data) => {
  // data: {
  //   userId: '用户ID',
  //   username: '用户名',
  //   channel: 'public',
  //   isMuted: true,
  //   updateTime: '2023-05-01T12:00:00Z'
  // }

  // 更新UI，显示用户的静音状态
  updateUserMuteStatusUI(data.userId, data.isMuted);
});
```

### `new_message` (系统消息)

当用户加入/离开语音房间时，服务器会发送系统消息。

```javascript
socket.on('new_message', (message) => {
  // 如果是系统消息
  if (message.type === 'system') {
    // message: {
    //   id: '消息ID',
    //   type: 'system',
    //   content: '用户名 加入了公共语音房间',
    //   createTime: '2023-05-01T12:00:00Z'
    // }

    // 将系统消息添加到聊天列表
    addSystemMessageToChat(message);
  }
});
```

语音相关的系统消息包括：

1. **用户加入语音房间**：`用户名 加入了公共语音房间/一队语音房间/二队语音房间`
2. **用户离开语音房间**：`用户名 离开了公共语音房间/一队语音房间/二队语音房间`

## 语音通信实现建议

### 1. 初始化语音通信

在用户加入房间后，初始化语音通信功能：

```javascript
// 初始化语音通信
function initVoiceCommunication() {
  // 检查浏览器是否支持getUserMedia
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('浏览器不支持getUserMedia');
    return;
  }

  // 初始化语音UI
  initVoiceUI();

  // 监听语音相关事件
  listenToVoiceEvents();
}

// 监听语音相关事件
function listenToVoiceEvents() {
  socket.on('voiceChannelJoined', handleVoiceChannelJoined);
  socket.on('voiceChannelLeft', handleVoiceChannelLeft);
  socket.on('voiceChannelUsers', handleVoiceChannelUsers);
  socket.on('userJoinedVoiceChannel', handleUserJoinedVoiceChannel);
  socket.on('userLeftVoiceChannel', handleUserLeftVoiceChannel);
  socket.on('voiceData', handleVoiceData);
  socket.on('voiceMuteUpdate', handleVoiceMuteUpdate);
}
```

### 2. 加入语音房间

提供UI让用户选择要加入的语音房间：

```javascript
// 加入语音房间
function joinVoiceChannel(channel) {
  socket.emit('joinVoiceChannel', {
    roomId: currentRoomId,
    channel
  });
}

// 离开语音房间
function leaveVoiceChannel() {
  socket.emit('leaveVoiceChannel', {
    roomId: currentRoomId
  });
}
```

### 3. 捕获和发送语音数据

使用WebRTC的getUserMedia API捕获麦克风音频，并通过Socket.IO发送：

```javascript
let mediaStream = null;
let audioContext = null;
let scriptProcessor = null;
let currentVoiceChannel = 'none';

// 开始捕获麦克风音频
async function startCapturingAudio() {
  try {
    // 获取麦克风权限
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 创建音频上下文
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 创建音频源
    const source = audioContext.createMediaStreamSource(mediaStream);

    // 创建脚本处理器
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    // 处理音频数据
    scriptProcessor.onaudioprocess = function(e) {
      // 只有在语音房间中且未静音时才发送语音数据
      if (currentVoiceChannel !== 'none' && !isMuted) {
        const inputBuffer = e.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // 发送语音数据
        socket.emit('voiceData', {
          roomId: currentRoomId,
          data: inputData.buffer
        });
      }
    };

    // 连接节点
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    console.log('开始捕获麦克风音频');
  } catch (error) {
    console.error('获取麦克风权限失败:', error);
  }
}

// 停止捕获麦克风音频
function stopCapturingAudio() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  console.log('停止捕获麦克风音频');
}
```

### 4. 播放接收到的语音数据

使用WebAudio API播放接收到的语音数据：

```javascript
const audioPlayers = new Map(); // 用户ID -> 音频播放器

// 处理接收到的语音数据
function handleVoiceData(data) {
  // 创建或获取音频播放器
  let audioPlayer = audioPlayers.get(data.from);
  if (!audioPlayer) {
    audioPlayer = new AudioPlayer();
    audioPlayers.set(data.from, audioPlayer);
  }

  // 播放语音数据
  audioPlayer.play(data.data);
}

// 音频播放器类
class AudioPlayer {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  play(arrayBuffer) {
    // 将ArrayBuffer转换为AudioBuffer
    this.audioContext.decodeAudioData(arrayBuffer, (buffer) => {
      // 创建音频源
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // 连接到输出设备
      source.connect(this.audioContext.destination);

      // 开始播放
      source.start(0);
    });
  }
}
```

### 5. 静音控制

提供UI让用户控制静音状态：

```javascript
let isMuted = false;

// 切换静音状态
function toggleMute() {
  isMuted = !isMuted;

  // 更新UI
  updateMuteButtonUI(isMuted);

  // 通知服务器
  socket.emit('voiceMute', {
    roomId: currentRoomId,
    isMuted
  });
}
```

## 注意事项

1. **浏览器兼容性**：WebRTC API在不同浏览器中的实现可能有所不同，需要进行兼容性处理。
2. **用户体验**：提供清晰的UI指示当前语音状态，包括当前加入的语音房间、静音状态等。
3. **性能优化**：语音数据可能会占用较大的带宽，可以考虑使用音频压缩算法或降低采样率。
4. **安全性**：确保用户在加入语音房间前已经通过身份验证。
5. **错误处理**：妥善处理各种错误情况，如麦克风权限被拒绝、网络连接中断等。
