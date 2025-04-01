# WebSocket 实时通信测试

服务器基础URL: https://dvmxujshaduv.sealoshzh.site

## WebSocket连接

```
WebSocket: wss://dvmxujshaduv.sealoshzh.site/socket.io/?token={jwt_token}
```

## 连接事件

### 1. 成功连接

用户提供有效的JWT令牌后，WebSocket连接会成功建立，用户的在线状态会被更新。

### 2. 连接失败

如果提供的令牌无效或未提供令牌，连接会被拒绝。

## 房间相关事件

### 1. 加入房间

**客户端发送**:

```json
socket.emit('join_room', '60d21b4667d0d8992e610c87');
```

**服务器广播给房间其他用户**:

```json
{
  "event": "user_joined",
  "data": {
    "userId": "60d21b4667d0d8992e610c85",
    "username": "testuser"
  }
}
```

### 2. 离开房间

**客户端发送**:

```json
socket.emit('leave_room', '60d21b4667d0d8992e610c87');
```

**服务器广播给房间其他用户**:

```json
{
  "event": "user_left",
  "data": {
    "userId": "60d21b4667d0d8992e610c85",
    "username": "testuser"
  }
}
```

### 3. 断开连接

当用户断开WebSocket连接时，用户会自动从所有房间中移除，并广播给房间内其他用户。

## 房间状态更新事件

### 1. 玩家加入房间

**服务器广播**:

```json
{
  "event": "player.joined",
  "data": {
    "userId": "60d21b4667d0d8992e610c89",
    "username": "frienduser",
    "avatar": "https://example.com/avatar2.jpg",
    "totalGames": 25,
    "wins": 15
  }
}
```

### 2. 玩家离开房间

**服务器广播**:

```json
{
  "event": "player.left",
  "data": {
    "userId": "60d21b4667d0d8992e610c89",
    "newCreatorId": "60d21b4667d0d8992e610c85"
  }
}
```

### 3. 游戏开始

**服务器广播**:

```json
{
  "event": "game.started",
  "data": {
    "teams": [
      {
        "id": 1,
        "name": "蓝队",
        "side": "blue",
        "captainId": "60d21b4667d0d8992e610c85"
      },
      {
        "id": 2,
        "name": "红队",
        "side": "red",
        "captainId": "60d21b4667d0d8992e610c89"
      }
    ],
    "players": [
      {
        "userId": "60d21b4667d0d8992e610c85",
        "username": "testuser",
        "avatar": "https://example.com/avatar.jpg",
        "teamId": 1,
        "isCaptain": true
      },
      {
        "userId": "60d21b4667d0d8992e610c89",
        "username": "frienduser",
        "avatar": "https://example.com/avatar2.jpg",
        "teamId": 2,
        "isCaptain": true
      }
    ],
    "pickMode": "12211",
    "status": "picking",
    "nextTeamPick": 1
  }
}
```

### 4. 选择队员

**服务器广播**:

```json
{
  "event": "player.selected",
  "data": {
    "userId": "60d21b4667d0d8992e610c90",
    "username": "selectedplayer",
    "avatar": "https://example.com/avatar3.jpg",
    "teamId": 1,
    "nextTeamPick": 2,
    "remainingPlayers": 7
  }
}
```

### 5. 选择阵营

**服务器广播**:

```json
{
  "event": "team.selected_side",
  "data": {
    "teamId": 1,
    "side": "blue",
    "teams": [
      {
        "id": 1,
        "side": "blue"
      },
      {
        "id": 2,
        "side": "red"
      }
    ]
  }
}
```

### 6. 提交比赛数据

**服务器广播**:

```json
{
  "event": "match.submitted",
  "data": {
    "matchId": "60d21b4667d0d8992e610c96",
    "winner": 1,
    "teams": [
      {
        "id": 1,
        "side": "blue",
        "result": "win"
      },
      {
        "id": 2,
        "side": "red",
        "result": "lose"
      }
    ]
  }
}
```

## 聊天消息事件

### 1. 新消息

**服务器广播到公共频道**:

```json
{
  "event": "new_message",
  "data": {
    "id": "60d21b4667d0d8992e610c91",
    "userId": "60d21b4667d0d8992e610c85",
    "username": "testuser",
    "avatar": "https://example.com/avatar.jpg",
    "content": "大家准备好了吗？",
    "type": "text",
    "channel": "public",
    "teamId": null,
    "createTime": "2023-03-29T14:35:00.000Z"
  }
}
```

**服务器广播到队伍频道**:

```json
{
  "event": "new_message",
  "data": {
    "id": "60d21b4667d0d8992e610c92",
    "userId": "60d21b4667d0d8992e610c85",
    "username": "testuser",
    "avatar": "https://example.com/avatar.jpg",
    "content": "团队策略讨论",
    "type": "text",
    "channel": "team",
    "teamId": 1,
    "createTime": "2023-03-29T14:36:00.000Z"
  }
}
```

## 邀请和评价事件

### 1. 收到房间邀请

**服务器通知指定用户**:

```json
{
  "event": "room.invited",
  "data": {
    "id": "60d21b4667d0d8992e610c95",
    "roomId": "60d21b4667d0d8992e610c87",
    "roomName": "周末内战5V5",
    "inviterId": "60d21b4667d0d8992e610c85",
    "inviterName": "testuser",
    "createTime": "2023-03-29T17:30:00.000Z",
    "expireTime": "2023-03-29T18:00:00.000Z"
  }
}
```

### 2. 收到玩家评价

**服务器通知被评价用户**:

```json
{
  "event": "player.rated",
  "data": {
    "matchId": "60d21b4667d0d8992e610c96",
    "raterUserId": "60d21b4667d0d8992e610c85",
    "raterUsername": "testuser",
    "type": "like"
  }
}
```

## 错误处理

WebSocket连接可能会因为各种原因断开，客户端应该实现自动重连逻辑。常见的断开原因包括：

1. 网络连接问题
2. 服务器重启
3. 令牌过期
4. 服务器主动踢出用户（例如，当同一用户在其他设备登录时）

当令牌过期时，客户端应该重新获取新的JWT令牌，然后重新建立WebSocket连接。 