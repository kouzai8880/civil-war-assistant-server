# 房间Socket事件说明文档

本文档详细说明了房间相关的Socket.IO事件，包括客户端可以发送的事件和需要监听的事件。通过正确处理这些事件，客户端可以与服务器保持实时同步，并提供流畅的用户体验。

## 重要说明

**当通过API创建房间成功后，必须使用Socket.IO连接到房间，才能正常使用实时功能。**

```javascript
// 当通过API创建房间成功后，需要立即调用joinRoom事件连接到房间
axios.post('/api/v1/rooms', roomData).then(response => {
  if (response.data.status === 'success') {
    const roomId = response.data.data.room.id;

    // 使用Socket.IO连接到房间
    socket.emit('joinRoom', { roomId });
  }
});
```

创建房间API的响应中包含了`needSocketConnection: true`标志，提示前端需要连接Socket.IO。

## 目录

- [客户端发送的事件](#客户端发送的事件)
- [客户端监听的事件](#客户端监听的事件)
- [数据结构](#数据结构)
- [典型使用场景](#典型使用场景)
- [错误处理](#错误处理)

## 客户端发送的事件

### 房间基础操作

#### `joinRoom`

加入房间，用户将被添加到观众席。

```javascript
socket.emit('joinRoom', {
  roomId: '房间ID',
  password: '房间密码' // 可选，如果房间设置了密码
});
```

#### `leaveRoom`

离开房间。注意：只有在房间状态为`waiting`时，玩家才能离开房间。观众可以在任何状态下离开房间。

```javascript
socket.emit('leaveRoom', {
  roomId: '房间ID'
});
```

#### `kickPlayer`

踢出玩家，只有房主可以踢出玩家。

```javascript
socket.emit('kickPlayer', {
  roomId: '房间ID',
  targetUserId: '要踢出的用户ID'
});
```

#### `getRoomDetail`

获取房间详情，用于刷新房间数据或重新连接后获取最新状态。

```javascript
socket.emit('getRoomDetail', { roomId: '房间ID' }, (response) => {
  // 回调函数接收房间详情
  if (response.status === 'success') {
    const roomData = response.data.room;
    // 更新UI或状态管理
  } else {
    // 处理错误
    console.error(response.message);
  }
});
```

### 角色切换

#### `joinAsPlayer`

从观众席加入玩家列表。注意：只有在房间状态为`waiting`时，才能从观众席加入玩家列表。

```javascript
socket.emit('joinAsPlayer', {
  roomId: '房间ID',
  teamId: 1 // 可选，指定加入的队伍ID
});
```

#### `joinAsSpectator`

从玩家列表加入观众席。注意：只有在房间状态为`waiting`时，才能从玩家列表加入观众席。

```javascript
socket.emit('joinAsSpectator', {
  roomId: '房间ID'
});
```

### 语音通信

#### `joinVoiceChannel`

加入语音房间。

```javascript
socket.emit('joinVoiceChannel', {
  roomId: '房间ID',
  channel: 'public' // 语音房间类型，可选值: 'public', 'team1', 'team2'
});
```

#### `leaveVoiceChannel`

离开语音房间。

```javascript
socket.emit('leaveVoiceChannel', {
  roomId: '房间ID'
});
```

#### `voiceData`

发送语音数据。

```javascript
socket.emit('voiceData', {
  roomId: '房间ID',
  data: voiceDataBuffer // 语音数据
});
```

#### `voiceMute`

设置静音状态。

```javascript
socket.emit('voiceMute', {
  roomId: '房间ID',
  isMuted: true // 是否静音
});
```

### 聊天消息

#### `sendMessage`

发送聊天消息。这个事件使用回调函数返回结果，可以直接通过Socket发送消息而不需要使用HTTP API。

```javascript
socket.emit('sendMessage', {
  roomId: '房间ID',
  content: '消息内容',
  type: 'text', // 可选，默认为'text'
  channel: 'public', // 可选，默认为'public'，可选值: 'public' 或 'team'
  teamId: 1 // 如果channel为'team'，需要指定队伍ID
}, (response) => {
  // 回调函数接收发送结果
  if (response.status === 'success') {
    // 消息发送成功
    const message = response.data.message;
    // 可以在本地显示消息，也可以等待new_message事件
  } else {
    // 处理错误
    console.error(response.message);
  }
});
```

**参数说明：**

- `roomId`：必选，房间ID
- `content`：必选，消息内容
- `type`：可选，消息类型，默认为'text'
- `channel`：可选，消息频道，默认为'public'，可选值: 'public'(公共频道) 或 'team'(队伍频道)
- `teamId`：当channel为'team'时必选，指定发送消息的队伍ID

**权限要求：**

- 用户必须在房间中（玩家或观众）
- 当channel为'team'时，用户必须是该队伍的玩家，观众不能发送队伍消息

**响应格式：**

```javascript
// 成功响应
{
  status: 'success',
  data: {
    message: {
      id: '消息ID',
      userId: '发送者ID',
      username: '发送者用户名',
      avatar: '发送者头像',
      content: '消息内容',
      type: 'text',
      channel: 'public',
      teamId: null,
      createTime: '2023-05-01T12:00:00Z'
    }
  },
  message: '消息发送成功'
}

// 错误响应
{
  status: 'error',
  message: '错误信息',
  code: 3002
}
```

## 客户端监听的事件

### 房间状态事件

#### `roomJoined`

成功加入房间后触发，包含完整的房间数据、历史聊天记录和语音房间用户列表。

```javascript
socket.on('roomJoined', (response) => {
  // response: {
  //   status: 'success',
  //   data: {
  //     room: {
  //       ...  // 房间基本信息
  //       messages: [...],  // 历史聊天记录，最多50条，按时间正序排列
  //       voiceChannels: {  // 语音房间用户列表
  //         public: [...],  // 公共语音房间用户
  //         team1: [...],   // 一队语音房间用户
  //         team2: [...]    // 二队语音房间用户
  //       }
  //     }
  //   },
  //   message: '加入房间成功，已进入观众席'
  // }
  if (response.status === 'success') {
    const roomData = response.data.room;
    const chatHistory = roomData.messages;
    const voiceChannels = roomData.voiceChannels;
    // 更新UI或状态管理
    // 显示历史聊天记录
    // 显示语音房间用户
  }
});
```

#### `roomDetail`

响应`getRoomDetail`请求，返回房间详细数据。这个事件通过回调函数接收，而不是监听器。

```javascript
// 通过回调函数接收响应
socket.emit('getRoomDetail', { roomId: '123456' }, (response) => {
  // response: {
  //   status: 'success',
  //   data: {
  //     room: {
  //       ...  // 房间基本信息
  //       messages: [...],  // 历史聊天记录，最多50条，按时间正序排列
  //       voiceChannels: {  // 语音房间用户列表
  //         public: [...],  // 公共语音房间用户
  //         team1: [...],   // 一队语音房间用户
  //         team2: [...]    // 二队语音房间用户
  //       }
  //     }
  //   },
  //   message: '获取房间详情成功'
  // }
  if (response.status === 'success') {
    const roomData = response.data.room;
    const chatHistory = roomData.messages;
    const voiceChannels = roomData.voiceChannels;
    // 更新UI或状态管理
    // 显示历史聊天记录
    // 显示语音房间用户
  }
});
```

#### `roomLeft`

成功离开房间后触发。

```javascript
socket.on('roomLeft', (response) => {
  // response: { status: 'success', data: { roomId: '...' }, message: '离开房间成功' }
});
```

#### `roleChanged`

用户角色变更后触发（从观众席到玩家列表，或从玩家列表到观众席）。

```javascript
socket.on('roleChanged', (response) => {
  // response: { status: 'success', data: { room: {...}, role: 'player'|'spectator', teamId?: number }, message: '已加入玩家列表'|'已加入观众席' }
  if (response.status === 'success') {
    const { room, role, teamId } = response.data;
    // 更新UI或状态管理
  }
});
```

#### `roomStatusUpdate`

房间状态更新时触发。

```javascript
socket.on('roomStatusUpdate', (data) => {
  // data: { roomId: '...', status: 'waiting'|'gaming'|'ended', updateTime: '...' }
  // 更新房间状态
});
```

### 用户加入/离开事件

#### `spectator.joined`

新观众加入房间时触发。

```javascript
socket.on('spectator.joined', (data) => {
  // data: { userId: '...', username: '...', avatar: '...', totalGames: number, wins: number, isCreator: boolean }
  // 更新观众列表
});
```

#### `player.joined`

新玩家加入房间时触发。

```javascript
socket.on('player.joined', (data) => {
  // data: { userId: '...', username: '...', avatar: '...', totalGames: number, wins: number, teamId: number, isCreator: boolean }
  // 更新玩家列表
});
```

#### `spectator.left`

观众离开房间时触发。

```javascript
socket.on('spectator.left', (data) => {
  // data: { userId: '...', username: '...', roomId: '...' }
  // 从观众列表中移除该用户
});
```

#### `player.left`

玩家离开房间时触发。

```javascript
socket.on('player.left', (data) => {
  // data: { userId: '...', username: '...', roomId: '...' }
  // 从玩家列表中移除该用户
});
```

#### `player.kicked`

玩家被踢出房间时触发。

```javascript
// 被踢出的玩家会收到以下事件
socket.on('player.kicked', (data) => {
  // data: { roomId: '房间ID', kickedBy: '踢出者ID' }
  // 更新UI，显示被踢出
});

// 房间内其他用户会收到以下事件
socket.on('player.kicked', (data) => {
  // data: { userId: '被踢出的用户ID', kickedBy: '踢出者ID' }
  // 更新UI，移除被踢出的玩家
});
```

#### `spectator.kicked`

观众被踢出房间时触发。

```javascript
// 被踢出的观众会收到以下事件
socket.on('spectator.kicked', (data) => {
  // data: { roomId: '房间ID', kickedBy: '踢出者ID' }
  // 更新UI，显示被踢出
});

// 房间内其他用户会收到以下事件
socket.on('spectator.kicked', (data) => {
  // data: { userId: '被踢出的用户ID', kickedBy: '踢出者ID' }
  // 更新UI，移除被踢出的观众
});
```

#### `kickPlayer.success`

踢出玩家成功时触发。

```javascript
socket.on('kickPlayer.success', (data) => {
  // data: { targetUserId: '被踢出的用户ID', message: '已踢出用户' }
  // 更新UI，显示踢出成功
});
```

### 角色变更事件

#### `spectator.moveToPlayer`

用户从观众席加入玩家列表时触发。

```javascript
socket.on('spectator.moveToPlayer', (data) => {
  // data: { userId: '...', username: '...', avatar: '...', totalGames: number, wins: number, teamId: number, isCreator: boolean, roomId: '...' }
  // 从观众列表移除该用户，并添加到玩家列表
});
```

#### `player.moveToSpectator`

用户从玩家列表加入观众席时触发。

```javascript
socket.on('player.moveToSpectator', (data) => {
  // data: { userId: '...', username: '...', avatar: '...', totalGames: number, wins: number, isCreator: boolean, roomId: '...' }
  // 从玩家列表移除该用户，并添加到观众列表
});
```

#### `roleChanged`

当用户角色发生变化时触发，包括房主身份变更、玩家和观众切换等。

```javascript
socket.on('roleChanged', (response) => {
  // response: {
  //   status: 'success',
  //   data: {
  //     room: {...},  // 房间完整数据，包含玩家、观众、语音房间等信息
  //     role: 'player' | 'spectator',  // 新角色
  //     userId: '用户ID',  // 角色变化的用户ID
  //     isCreator: true  // 是否是房主
  //   },
  //   message: '用户A离开房间，用户B成为新房主'  // 变化描述
  // }

  if (response.status === 'success') {
    // 更新房间数据
    updateRoomData(response.data.room);

    // 更新用户角色
    if (response.data.userId === currentUserId) {
      // 如果是当前用户的角色变化
      updateMyRole(response.data.role);
    }

    // 如果是房主变更，更新房主标识
    if (response.data.isCreator) {
      updateRoomCreator(response.data.userId);
    }

    // 显示变化消息
    showNotification(response.message);
  }
});
```

### 语音相关事件

#### `voiceChannelJoined`

用户加入语音房间时触发。这个事件会发送给房间内的所有用户，包括加入语音房间的用户自己。

```javascript
// 当自己加入语音房间时收到的响应
// 这个响应只发送给自己
socket.on('voiceChannelJoined', (response) => {
  // response: {
  //   status: 'success',
  //   data: { channel: 'public' },  // 加入的语音房间
  //   message: '加入公共语音房间成功'
  // }

  if (response.status === 'success') {
    // 更新UI，显示已加入语音房间
    updateVoiceChannelUI(response.data.channel);
  }
});

// 当房间内任何用户加入语音房间时收到的广播
// 这个广播发送给房间内的所有用户
socket.on('voiceChannelJoined', (response) => {
  // response: {
  //   status: 'success',
  //   data: {
  //     userId: '用户ID',
  //     username: '用户名',
  //     channel: 'public',  // 加入的语音房间
  //     teamId: 1,  // 用户所在的队伍，如果有
  //     role: 'player' | 'spectator'  // 用户角色
  //   },
  //   message: '用户A 加入了公共语音房间'
  // }

  if (response.status === 'success') {
    // 更新UI，显示用户加入了语音房间
    updateVoiceChannelUsers(response.data.channel, response.data.userId, true);
    // 显示通知
    showNotification(response.message);
  }
});
```

#### `voiceChannelLeft`

用户离开语音房间时触发。这个事件会发送给房间内的所有用户，包括离开语音房间的用户自己。

```javascript
// 当自己离开语音房间时收到的响应
// 这个响应只发送给自己
socket.on('voiceChannelLeft', (response) => {
  // response: {
  //   status: 'success',
  //   message: '离开公共语音房间成功'
  // }

  if (response.status === 'success') {
    // 更新UI，显示已离开语音房间
    updateVoiceChannelUI('none');
  }
});

// 当房间内任何用户离开语音房间时收到的广播
// 这个广播发送给房间内的所有用户
socket.on('voiceChannelLeft', (response) => {
  // response: {
  //   status: 'success',
  //   data: {
  //     userId: '用户ID',
  //     username: '用户名',
  //     previousChannel: 'public',  // 离开的语音房间
  //     teamId: 1,  // 用户所在的队伍，如果有
  //     role: 'player' | 'spectator'  // 用户角色
  //   },
  //   message: '用户A 离开了公共语音房间'
  // }

  if (response.status === 'success') {
    // 更新UI，显示用户离开了语音房间
    updateVoiceChannelUsers(response.data.previousChannel, response.data.userId, false);
    // 显示通知
    showNotification(response.message);
  }
});
```

#### `voiceChannelUsers`

当用户加入语音房间时，服务器会发送该语音房间的其他用户列表。

```javascript
socket.on('voiceChannelUsers', (data) => {
  // data: {
  //   channel: 'public',  // 语音房间
  //   users: [  // 该语音房间的其他用户列表
  //     {
  //       userId: '用户ID',
  //       username: '用户名',
  //       teamId: 1,  // 用户所在的队伍，如果有
  //       role: 'player' | 'spectator'  // 用户角色
  //     }
  //   ]
  // }

  // 更新UI，显示语音房间的其他用户
  updateVoiceChannelUsersList(data.channel, data.users);
});
```

#### `userJoinedVoiceChannel`

当其他用户加入同一语音房间时触发。

```javascript
socket.on('userJoinedVoiceChannel', (data) => {
  // data: {
  //   userId: '用户ID',
  //   username: '用户名',
  //   channel: 'public',  // 语音房间
  //   updateTime: '2023-05-01T12:00:00Z'  // 更新时间
  // }

  // 更新UI，显示新用户加入了语音房间
  addVoiceChannelUser(data.channel, data);
});
```

#### `userLeftVoiceChannel`

当其他用户离开同一语音房间时触发。

```javascript
socket.on('userLeftVoiceChannel', (data) => {
  // data: {
  //   userId: '用户ID',
  //   username: '用户名',
  //   previousChannel: 'public',  // 离开的语音房间
  //   newChannel: 'team1',  // 新加入的语音房间，如果有
  //   updateTime: '2023-05-01T12:00:00Z'  // 更新时间
  // }

  // 更新UI，移除离开的用户
  removeVoiceChannelUser(data.previousChannel, data.userId);
});
```

#### `voiceData`

接收其他用户发送的语音数据。

```javascript
socket.on('voiceData', (data) => {
  // data: {
  //   from: '发送者ID',
  //   username: '发送者用户名',
  //   channel: 'public',  // 语音房间
  //   data: voiceDataBuffer  // 语音数据
  // }

  // 播放语音数据
  playVoiceData(data.from, data.data);
});
```

#### `voiceMuteUpdate`

当其他用户更新静音状态时触发。

```javascript
socket.on('voiceMuteUpdate', (data) => {
  // data: {
  //   userId: '用户ID',
  //   username: '用户名',
  //   channel: 'public',  // 语音房间
  //   isMuted: true,  // 是否静音
  //   updateTime: '2023-05-01T12:00:00Z'  // 更新时间
  // }

  // 更新UI，显示用户的静音状态
  updateUserMuteStatus(data.userId, data.isMuted);
});
```

### 游戏相关事件

#### `game.started`

游戏开始时触发。

```javascript
socket.on('game.started', (data) => {
  // data: { teams: [...], players: [...], pickMode: '...', status: 'gaming', nextTeamPick: number }
  // 更新游戏状态
});
```

#### `player.selected`

队长选择队员时触发。

```javascript
socket.on('player.selected', (data) => {
  // data: {
  //   userId: '被选择的玩家ID',
  //   username: '被选择的玩家用户名',
  //   avatar: '被选择的玩家头像',
  //   teamId: 1, // 被选择加入的队伍ID
  //   nextTeamPick: 2, // 下一个选人的队伍ID，如果为null则表示选人阶段结束
  //   remainingPlayers: 3, // 剩余未选择的玩家数量
  //   isAutoAssigned: false // 是否是自动分配的（最后一名玩家）
  // }

  // 更新UI，显示玩家已被选择
  updatePlayerTeam(data.userId, data.teamId);

  // 如果是当前用户是下一个选人的队伍的队长，显示选人界面
  if (data.nextTeamPick === myTeamId && isCaptain) {
    showPlayerSelectionUI();
  }

  // 如果选人阶段结束，更新UI
  if (data.nextTeamPick === null) {
    updateGameStatus('gaming');
  }
});
```

#### `team.selected_side`

队长选择红蓝方时触发。

```javascript
socket.on('team.selected_side', (data) => {
  // data: {
  //   teamId: 1, // 选择阵营的队伍ID
  //   side: "blue", // 选择的阵营
  //   teams: [ // 更新后的所有队伍信息
  //     {
  //       id: 1,
  //       name: "蓝队",
  //       side: "blue",
  //       captainId: "u123456"
  //     },
  //     {
  //       id: 2,
  //       name: "红队",
  //       side: "red",
  //       captainId: "u789012"
  //     }
  //   ]
  // }

  // 更新UI，显示队伍阵营
  updateTeamSides(data.teams);
});
```

#### `playerStatusUpdate`

玩家状态更新时触发。

```javascript
socket.on('playerStatusUpdate', (data) => {
  // data: { roomId: '...', userId: '...', status: 'ready'|'playing'|'offline', teamId: number, updateTime: '...' }
  // 更新玩家状态
});
```

#### `teamUpdate`

队伍状态更新时触发。

```javascript
socket.on('teamUpdate', (data) => {
  // data: { roomId: '...', teamId: number, captainId: '...', players: [...], side: 'blue'|'red', updateTime: '...' }
  // 更新队伍状态
});
```

### 聊天相关事件

#### `new_message`

收到新消息时触发，包括用户消息和系统消息。注意：消息发送者不会收到自己发送的消息。

```javascript
socket.on('new_message', (message) => {
  // 用户消息
  // message: {
  //   id: '消息ID',
  //   userId: '发送者ID',
  //   username: '发送者用户名',
  //   avatar: '发送者头像',
  //   content: '消息内容',
  //   type: 'text',
  //   channel: 'public'|'team',
  //   teamId: null,
  //   createTime: '2023-05-01T12:00:00Z',
  //   isTeamMessage?: boolean  // 当队伍消息发送给观众时，此字段为true
  // }
  //
  // 系统消息
  // message: {
  //   id: '消息ID', // 数据库中的消息ID
  //   type: 'system', // 消息类型为'system'
  //   content: '用户名 加入了房间', // 系统消息内容
  //   createTime: '2023-05-01T12:00:00Z', // 消息创建时间
  //   updateTime: '2023-05-01T12:00:00Z' // 消息发送时间
  // }

  // 根据消息类型显示不同的消息样式
  if (message.type === 'system') {
    // 显示系统消息，通常使用不同的样式
    displaySystemMessage(message);
  } else {
    // 显示用户消息
    displayUserMessage(message);
  }
});
```

系统消息类型包括：

1. **用户加入房间**：`用户名 加入了房间`
2. **用户离开房间**：`用户名 离开了房间`
3. **用户断开连接**：`用户名 断开了连接`
4. **用户加入玩家列表**：`用户名 从观众席加入了玩家列表`
5. **用户加入观众席**：`用户名 从玩家列表加入了观众席`
6. **用户被选入队伍**：`用户名 被选入蓝队/红队`
7. **队伍选择阵营**：`蓝队/红队选择了蓝方/红方，游戏即将开始`
8. **用户加入语音房间**：`用户名 加入了公共语音房间/一队语音房间/二队语音房间`
9. **用户离开语音房间**：`用户名 离开了公共语音房间/一队语音房间/二队语音房间`
10. **用户被踢出房间**：`用户名 被房主踢出了房间`

### 语音相关事件

#### `voiceStateUpdate`

语音状态更新时触发。

```javascript
socket.on('voiceStateUpdate', (data) => {
  // data: { userId: '...', username: '...', state: 'started'|'ended' }
  // 更新语音状态
});
```

#### `voiceData`

收到语音数据时触发。

```javascript
socket.on('voiceData', (data) => {
  // data: { from: '...', username: '...', data: voiceDataBuffer }
  // 播放语音数据
});
```

### 错误事件

#### `error`

发生错误时触发。

```javascript
socket.on('error', (error) => {
  // error: { message: '错误信息', code?: number }
  // 显示错误信息
});
```

## 数据结构

### 房间数据

```javascript
{
  id: '房间ID',
  name: '房间名称',
  creatorId: '创建者ID',
  creatorName: '创建者用户名',
  creatorAvatar: '创建者头像',
  gameType: '游戏类型',
  playerCount: 10, // 玩家数量
  teamCount: 2, // 队伍数量
  pickMode: 'captain', // 选择模式：'captain'（队长选人）, 'random'（随机分配）
  hasPassword: false, // 是否有密码
  description: '房间描述',
  status: 'waiting', // 房间状态：'waiting'（等待中）, 'gaming'（游戏中）, 'ended'（已结束）
  players: [ // 玩家列表
    {
      userId: '用户ID',
      username: '用户名',
      avatar: '头像',
      gameId: '游戏ID',
      totalGames: 10, // 总场次
      wins: 5, // 胜场
      teamId: 1, // 队伍ID，null表示未分配
      isCaptain: false, // 是否为队长
      isCreator: false, // 是否为创建者
      status: 'online', // 状态：'online'（在线）, 'ready'（准备）, 'playing'（游戏中）, 'offline'（离线）
      joinTime: '2023-05-01T12:00:00Z' // 加入时间
    }
  ],
  spectators: [ // 观众列表
    {
      userId: '用户ID',
      username: '用户名',
      avatar: '头像',
      gameId: '游戏ID',
      totalGames: 10, // 总场次
      wins: 5, // 胜场
      isCreator: false, // 是否为创建者
      status: 'online', // 状态：'online'（在线）, 'offline'（离线）
      joinTime: '2023-05-01T12:00:00Z' // 加入时间
    }
  ],
  teams: [ // 队伍列表
    {
      id: 1,
      name: '队伍1',
      captainId: '队长ID',
      side: 'blue', // 阵营：'blue'（蓝方）, 'red'（红方）, null（未选择）
      players: ['玩家ID1', '玩家ID2'] // 队伍成员ID列表
    }
  ],
  nextTeamPick: 1, // 下一个选人的队伍ID
  createTime: '2023-05-01T12:00:00Z', // 创建时间
  startTime: null, // 开始时间
  endTime: null // 结束时间
}
```

### 消息数据

```javascript
{
  id: '消息ID',
  userId: '发送者ID',
  username: '发送者用户名',
  avatar: '发送者头像',
  content: '消息内容',
  type: 'text', // 消息类型：'text'（文本）, 'system'（系统消息）
  channel: 'public', // 频道：'public'（公共）, 'team'（队伍）
  teamId: null, // 队伍ID，仅当channel为'team'时有效
  createTime: '2023-05-01T12:00:00Z', // 创建时间
  isTeamMessage: false // 是否为队伍消息，仅当观众收到队伍消息时为true
}
```

## 典型使用场景

### 场景1：用户加入房间

1. 客户端发送`joinRoom`事件
2. 服务器将用户添加到观众席
3. 客户端接收`roomJoined`事件，获取完整房间数据
4. 房间内其他用户接收`spectator.joined`事件，更新观众列表

```javascript
// 客户端代码
// 发送加入房间请求
socket.emit('joinRoom', { roomId: '123456' });

// 监听加入房间响应
socket.on('roomJoined', (response) => {
  if (response.status === 'success') {
    // 更新UI，显示房间信息
    updateRoomUI(response.data.room);
  } else {
    // 显示错误信息
    showError(response.message);
  }
});

// 监听新观众加入
socket.on('spectator.joined', (data) => {
  // 添加新观众到列表
  addSpectator(data);
});
```

### 场景2：从观众席加入玩家列表

1. 客户端发送`joinAsPlayer`事件
2. 服务器将用户从观众席移动到玩家列表
3. 客户端接收`roleChanged`事件，更新自己的角色和房间数据
4. 房间内其他用户接收`spectator.moveToPlayer`事件，更新观众列表和玩家列表

```javascript
// 客户端代码
// 发送加入玩家列表请求
socket.emit('joinAsPlayer', { roomId: '123456', teamId: 1 });

// 监听角色变更响应
socket.on('roleChanged', (response) => {
  if (response.status === 'success') {
    // 更新UI，显示新角色和房间信息
    updateRoleUI(response.data.role, response.data.teamId);
    updateRoomUI(response.data.room);
  } else {
    // 显示错误信息
    showError(response.message);
  }
});

// 监听观众加入玩家列表
socket.on('spectator.moveToPlayer', (data) => {
  // 从观众列表移除该用户
  removeSpectator(data.userId);
  // 添加到玩家列表
  addPlayer(data);
});
```

### 场景3：获取房间详情

1. 客户端发送`getRoomDetail`事件
2. 服务器返回房间详细数据
3. 客户端更新UI

```javascript
// 客户端代码
// 发送获取房间详情请求
socket.emit('getRoomDetail', { roomId: '123456' }, (response) => {
  if (response.status === 'success') {
    // 更新UI，显示房间信息
    updateRoomUI(response.data.room);

    // 显示历史聊天记录
    if (response.data.messages && response.data.messages.length > 0) {
      displayChatHistory(response.data.messages);
    }

    // 根据当前用户角色更新UI
    const isPlayer = response.data.room.players.some(p => p.userId === currentUserId);
    const isSpectator = response.data.room.spectators.some(s => s.userId === currentUserId);

    if (isPlayer) {
      updateRoleUI('player');
    } else if (isSpectator) {
      updateRoleUI('spectator');
    }
  } else {
    // 显示错误信息
    showError(response.message);
  }
});
```

### 场景4：房间状态更新

1. 服务器发送`roomStatusUpdate`事件
2. 客户端接收事件，更新房间状态

```javascript
// 客户端代码
// 监听房间状态更新
socket.on('roomStatusUpdate', (data) => {
  // 更新房间状态
  updateRoomStatus(data.status);

  // 如果状态变为gaming，显示游戏界面
  if (data.status === 'gaming') {
    showGameUI();
  }
  // 如果状态变为ended，显示结果界面
  else if (data.status === 'ended') {
    showResultUI();
  }
});
```

## 错误处理

客户端应该监听`error`事件，处理可能发生的错误：

```javascript
socket.on('error', (error) => {
  // 显示错误信息
  showError(error.message);

  // 根据错误代码执行不同操作
  switch (error.code) {
    case 3001: // 房间不存在
      navigateToLobby();
      break;
    case 3003: // 用户不在房间中
      refreshRoomData();
      break;
    case 3004: // 密码错误
      promptForPassword();
      break;
    case 3005: // 玩家列表已满
      showFullPlayerListMessage();
      break;
    default:
      // 通用错误处理
      console.error('Socket错误:', error);
  }
});
```

### 错误代码列表

| 代码 | 描述 |
|------|------|
| 3001 | 房间不存在 |
| 3002 | 操作失败（通用错误） |
| 3003 | 用户不在房间中 |
| 3004 | 密码错误 |
| 3005 | 玩家列表已满 |

## 最佳实践

1. **始终监听错误事件**：确保监听`error`事件，以便处理可能发生的错误。

2. **保持状态同步**：监听所有相关事件，确保客户端状态与服务器保持同步。

3. **优雅降级**：当Socket连接断开时，提供适当的UI反馈，并尝试重新连接。

4. **防抖动处理**：对于频繁触发的事件（如`voiceData`），考虑使用防抖动技术。

5. **状态管理**：使用状态管理库（如Redux、Vuex）来管理房间状态，使状态更新更加可预测。

6. **断线重连**：实现断线重连逻辑，当连接断开时自动重新连接并重新加入房间。

```javascript
// 断线重连示例
socket.on('disconnect', () => {
  showDisconnectedMessage();

  // 尝试重新连接
  setTimeout(() => {
    if (socket.disconnected) {
      socket.connect();
    }
  }, 3000);
});

socket.on('connect', () => {
  hideDisconnectedMessage();

  // 如果之前在房间中，重新加入房间
  if (currentRoomId) {
    socket.emit('joinRoom', { roomId: currentRoomId });
  }
});
```

通过正确处理这些Socket事件，客户端可以提供流畅的实时交互体验，确保用户能够看到房间状态的实时变化。
