# 游戏内战助手 API 规范

## 1. API 概述

游戏内战助手 API 提供了一套完整的接口，用于支持英雄联盟内战组织平台的各项功能，包括用户管理、房间管理、队伍编排、游戏数据集成、战绩统计和社交互动等核心功能。

### 1.1 基础信息

- **基础URL**: `https://dvmxujshaduv.sealoshzh.site/api/v1`
- **WebSocket URL**: `https://dvmxujshaduv.sealoshzh.site`
- **格式**: JSON
- **认证方式**: JWT (JSON Web Token)
- **API版本**: v1

### 1.2 认证

除了登录注册等少数公开接口外，所有API请求都需要通过Authorization头部传递JWT令牌进行认证。

```
Authorization: Bearer {token}
```

WebSocket 连接需要在连接时通过 auth 参数传递 JWT 令牌：

```javascript
const socket = io('https://dvmxujshaduv.sealoshzh.site', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### 1.3 WebSocket 连接参数

WebSocket 连接支持以下参数：

```javascript
{
  auth: {
    token: 'string'  // JWT 认证令牌
  },
  query: {
    avatar: 'string'  // 用户头像 URL（可选）
  }
}
```

### 1.4 WebSocket 事件

#### 1.4.1 大厅聊天事件

- **joinLobby**: 加入大厅
  ```javascript
  socket.emit('joinLobby');
  ```

- **leaveLobby**: 离开大厅
  ```javascript
  socket.emit('leaveLobby');
  ```

- **lobbyMessage**: 发送大厅消息
  ```javascript
  socket.emit('lobbyMessage', {
    content: 'string',  // 消息内容
    type: 'text'        // 消息类型：text, image, system
  });
  ```

- **getLobbyHistory**: 获取聊天历史
  ```javascript
  socket.emit('getLobbyHistory', {
    before: number,  // 时间戳，获取该时间之前的消息
    limit: number    // 每页消息数量
  }, callback);
  ```

#### 1.4.2 房间聊天事件

- **joinRoom**: 加入房间
  ```javascript
  socket.emit('joinRoom', {
    roomId: 'string'
  });
  ```

- **leaveRoom**: 离开房间
  ```javascript
  socket.emit('leaveRoom', {
    roomId: 'string'
  });
  ```

- **roomMessage**: 发送房间消息
  ```javascript
  socket.emit('roomMessage', {
    roomId: 'string',
    content: 'string',
    type: 'text'
  });
  ```

#### 1.4.3 房间语音事件

- **voiceStart**: 开始语音通话
  ```javascript
  socket.emit('voiceStart', {
    roomId: 'string'
  });
  ```

- **voiceEnd**: 结束语音通话
  ```javascript
  socket.emit('voiceEnd', {
    roomId: 'string'
  });
  ```

- **voiceStateUpdate**: 语音状态更新
  ```javascript
  socket.on('voiceStateUpdate', (data) => {
    // data: { userId: string, username: string, state: 'started' | 'ended' }
  });
  ```

<!-- 需要优化: 增加语音控制事件 -->
#### 1.4.4 语音控制事件（待添加）

- **voiceMute**: 静音控制
  ```javascript
  socket.emit('voiceMute', {
    roomId: 'string',
    isMuted: true
  });
  ```

- **voiceMuteUpdate**: 静音状态更新
  ```javascript
  socket.on('voiceMuteUpdate', (data) => {
    // data: { userId: string, username: string, isMuted: boolean }
  });
  ```

<!-- 需要优化: 增加房间状态更新事件 -->
#### 1.4.5 房间状态更新事件（待添加）

- **roomStatusUpdate**: 房间状态变更
  ```javascript
  socket.on('roomStatusUpdate', (data) => {
    // data: { roomId: string, status: string, updateTime: string }
  });
  ```

- **playerStatusUpdate**: 玩家状态更新
  ```javascript
  socket.on('playerStatusUpdate', (data) => {
    // data: { roomId: string, userId: string, status: string, teamId: number }
  });
  ```

- **teamUpdate**: 队伍状态更新
  ```javascript
  socket.on('teamUpdate', (data) => {
    // data: { roomId: string, teamId: number, captainId: string, players: [], side: string }
  });
  ```

### 1.5 返回格式

所有API返回的格式都遵循以下标准结构：

```json
{
  "status": "success",  // 或 "error"
  "data": {},  // 成功时的返回数据
  "message": "",  // 成功或错误消息
  "errors": [],  // 错误详情（如表单验证错误）
  "meta": {  // 分页或其他元数据信息
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### 1.6 HTTP状态码

- `200 OK`: 请求成功
- `201 Created`: 资源创建成功
- `400 Bad Request`: 请求参数有误
- `401 Unauthorized`: 未认证或认证已过期
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

## 2. 用户管理 API

### 2.1 用户注册

创建新用户账号。

**请求**:

```
POST /auth/register
```

**参数**:

```json
{
  "username": "玩家昵称",
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "gameId": "游戏ID" 
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "u123456",
      "username": "玩家昵称",
      "email": "user@example.com",
      "level": 1,
      "points": 0,
      "createTime": "2023-03-29T08:00:00.000Z"
    },
    "token": "jwt.token.here"
  },
  "message": "注册成功"
}
```

### 2.2 用户登录

**请求**:

```
POST /auth/login
```

**参数**:

```json
{
  "username": "testuser_updated",  // 用户名和邮箱至少提供其中一个
  "password": "password123"
}
```

或

```json
{
  "email": "test@example.com",  // 用户名和邮箱至少提供其中一个
  "password": "password123"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "67e93fa4b71ccae1597dca13",
      "username": "testuser_updated",
      "email": "test@example.com",
      "gameId": "LoL游戏账号ID001",
      "level": 1,
      "points": 0,
      "avatar": "https://via.placeholder.com/150",
      "settings": {
        "allowInvite": true,
        "allowFriendRequest": true
      },
      "createTime": "2023-03-29T08:00:00.000Z",
      "lastLoginTime": "2023-03-29T10:15:30.000Z",
      "stats": {
        "totalGames": 0,
        "wins": 0,
        "losses": 0,
        "likes": 0,
        "dislikes": 0,
        "winRate": 0
      }
    }
  }
}
```

### 2.3 获取用户资料

获取特定用户的详细资料。

**请求**:

```
GET /users/{userId}/profile
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "67e93fa4b71ccae1597dca13",
      "username": "testuser",
      "email": "test@example.com",
      "gameId": "游戏ID123",
      "level": 1,
      "points": 0,
      "avatar": "https://via.placeholder.com/150",
      "createTime": "2025-03-30T12:57:08.872Z",
      "lastLoginTime": "2025-03-30T12:57:08.871Z",
      "stats": {
        "totalGames": 0,
        "wins": 0,
        "losses": 0
      }
    }
  }
}
```

### 2.4 获取当前用户信息

获取当前登录用户的详细信息。

**请求**:

```
GET /auth/me
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "67e93fa4b71ccae1597dca13",
      "username": "testuser",
      "email": "test@example.com",
      "gameId": "游戏ID123",
      "level": 1,
      "points": 0,
      "avatar": "https://via.placeholder.com/150",
      "settings": {
        "allowInvite": true,
        "allowFriendRequest": true
      },
      "createTime": "2023-03-29T08:00:00.000Z",
      "lastLoginTime": "2023-03-29T10:15:30.000Z",
      "stats": {
        "totalGames": 0,
        "wins": 0,
        "losses": 0,
        "likes": 0,
        "dislikes": 0,
        "winRate": 0
      }
    }
  }
}
```

### 2.5 更新用户资料

**请求**:

```
PUT /users/{userId}
```

**参数**:

```json
{
  "username": "testuser_updated", 
  "avatar": "https://via.placeholder.com/200"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "67e93fa4b71ccae1597dca13",
      "username": "testuser_updated",
      "gameId": "LoL游戏账号ID001",
      "avatar": "https://via.placeholder.com/200",
      "settings": {
        "allowInvite": true,
        "allowFriendRequest": true
      }
    }
  }
}
```

### 2.5 修改密码

**请求**:

```
PUT /users/{userId}/password
```

**参数**:

```json
{
  "currentPassword": "当前密码",
  "newPassword": "新密码",
  "confirmPassword": "确认新密码"
}
```

**响应**:

```json
{
  "status": "success",
  "message": "密码已修改"
}
```

### 2.7 获取用户战绩统计

获取特定用户的战绩统计数据。

**请求**:

```
GET /users/{userId}/stats
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "stats": {
      "totalGames": 0,
      "wins": 0,
      "losses": 0,
      "winRate": 0,
      "likes": 0,
      "dislikes": 0,
      "avgKDA": "0/0/0",
      "kdaRatio": 0,
      "avgDamage": 0,
      "avgGold": 0,
      "avgScore": 0,
      "mostPlayedChampions": [],
      "recentForm": []
    }
  }
}
```

### 2.8 获取用户对局列表

获取特定用户参与的所有对局。

**请求**:

```
GET /users/{userId}/matches
```

**参数**:

```
page?: number (默认1)
limit?: number (默认20)
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "matches": []
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

### 2.9 添加好友

向指定用户发送好友请求。

**请求**:

```
POST /users/friends
```

**参数**:

```json
{
  "userId": "67e940387df2d4360a53fb78"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "friend": {
      "id": "67f0da3148f6d48101a844be",
      "userId": "67e940387df2d4360a53fb78",
      "username": "testuser456",
      "avatar": "https://via.placeholder.com/150",
      "status": "pending",
      "groupName": "默认分组",
      "createTime": "2025-04-05T07:22:25.810Z"
    }
  },
  "message": "好友请求已发送"
}
```

## 3. 房间管理 API

### 3.1 创建游戏房间

创建一个新的游戏房间。

**请求**:

```
POST /rooms
```

**参数**:

```json
{
  "name": "测试新房间", 
  "gameType": "LOL", 
  "playerCount": 10, 
  "pickMode": "random", 
  "description": "API测试创建的房间"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "room": {
      "id": "67f0d97448f6d48101a844ae",
      "name": "测试新房间",
      "creatorId": "67e93fa4b71ccae1597dca13",
      "gameType": "LOL",
      "playerCount": 10,
      "teamCount": 2,
      "pickMode": "random",
      "hasPassword": false,
      "isPublic": true,
      "description": "API测试创建的房间",
      "status": "waiting",
      "players": [
        {
          "userId": "67e93fa4b71ccae1597dca13",
          "isCreator": true,
          "status": "online",
          "joinTime": "2025-04-05T07:19:16.019Z"
        }
      ],
      "createTime": "2025-04-05T07:19:16.019Z"
    }
  }
}
```

### 3.2 获取房间列表

获取所有可用的游戏房间。

**请求**:

```
GET /rooms
```

**参数**:

```
page?: number (默认1)
limit?: number (默认20)
status?: string (waiting, picking, gaming, finished)
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "rooms": [
      {
        "id": "67e95c6119732f3f913ce8d7",
        "name": "游戏验证完整测试",
        "creatorId": "67e940387df2d4360a53fb78",
        "creatorName": "testuser456",
        "creatorAvatar": "https://via.placeholder.com/150",
        "gameType": "LOL",
        "playerCount": 10,
        "currentPlayers": 9,
        "viewerCount": 0,
        "status": "waiting",
        "hasPassword": false,
        "isPublic": true,
        "pickMode": "12211",
        "description": "测试游戏验证功能",
        "createTime": "2025-03-30T14:59:45.289Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

### 3.3 获取房间详情

获取特定房间的详细信息。

**请求**:

```
GET /rooms/{roomId}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "room": {
      "id": "67e95c6119732f3f913ce8d7",
      "name": "游戏验证完整测试",
      "creatorId": "67e940387df2d4360a53fb78",
      "creatorName": "testuser456",
      "creatorAvatar": "https://via.placeholder.com/150",
      "gameType": "LOL",
      "playerCount": 10,
      "teamCount": 2,
      "pickMode": "12211",
      "hasPassword": false,
      "description": "测试游戏验证功能",
      "status": "waiting",
      "players": [
        {
          "userId": "67e940387df2d4360a53fb78",
          "username": "testuser456",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "新游戏ID",
          "totalGames": 1,
          "wins": 1,
          "teamId": null,
          "isCaptain": false,
          "isCreator": true,
          "status": "offline",
          "joinTime": "2025-03-30T14:59:45.289Z"
        }
      ],
      "spectators": [
        {
          "userId": "67e93fa4b71ccae1597dca13",
          "username": "testuser",
          "avatar": "https://via.placeholder.com/150",
          "isCreator": false,
          "status": "online",
          "joinTime": "2025-03-30T15:00:05.123Z"
        }
      ],
      "teams": [],
      "nextTeamPick": null,
      "createTime": "2025-03-30T14:59:45.289Z"
    }
  }
}
```

### 3.4 加入房间

加入指定的游戏房间，用户默认加入观众席。

**请求**:

```
POST /rooms/{roomId}/join
```

**参数**:

```json
{
  "password": "123456" // 如果房间有密码
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "room": {
      "id": "67e95c6119732f3f913ce8d7",
      "name": "游戏验证完整测试",
      "creatorId": "67e940387df2d4360a53fb78",
      "creatorName": "testuser456",
      "creatorAvatar": "https://via.placeholder.com/150",
      "gameType": "LOL",
      "playerCount": 10,
      "teamCount": 2,
      "pickMode": "12211",
      "hasPassword": false,
      "description": "测试游戏验证功能",
      "status": "waiting",
      "players": [
        {
          "userId": "67e940387df2d4360a53fb78",
          "username": "testuser456",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "新游戏ID",
          "totalGames": 1,
          "wins": 1,
          "teamId": null,
          "isCaptain": false,
          "isCreator": true,
          "status": "offline",
          "joinTime": "2025-03-30T14:59:45.289Z"
        }
      ],
      "spectators": [
        {
          "userId": "67e93fa4b71ccae1597dca13",
          "username": "testuser",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "游戏ID123",
          "totalGames": 0,
          "wins": 0,
          "isCreator": false,
          "status": "online",
          "joinTime": "2025-03-30T15:00:05.123Z"
        }
      ],
      "teams": [],
      "nextTeamPick": null,
      "createTime": "2025-03-30T14:59:45.289Z"
    }
  },
  "message": "加入房间成功，已进入观众席"
}
```

### 3.5 从观众席加入玩家列表

将用户从观众席移动到玩家列表。

**请求**:

```
POST /rooms/{roomId}/join-as-player
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "room": {
      "id": "67e95c6119732f3f913ce8d7",
      "name": "游戏验证完整测试",
      "creatorId": "67e940387df2d4360a53fb78",
      "creatorName": "testuser456",
      "creatorAvatar": "https://via.placeholder.com/150",
      "gameType": "LOL",
      "playerCount": 10,
      "teamCount": 2,
      "pickMode": "12211",
      "hasPassword": false,
      "description": "测试游戏验证功能",
      "status": "waiting",
      "players": [
        {
          "userId": "67e940387df2d4360a53fb78",
          "username": "testuser456",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "新游戏ID",
          "totalGames": 1,
          "wins": 1,
          "teamId": null,
          "isCaptain": false,
          "isCreator": true,
          "status": "offline",
          "joinTime": "2025-03-30T14:59:45.289Z"
        },
        {
          "userId": "67e93fa4b71ccae1597dca13",
          "username": "testuser",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "游戏ID123",
          "totalGames": 0,
          "wins": 0,
          "teamId": null,
          "isCaptain": false,
          "isCreator": false,
          "status": "online",
          "joinTime": "2025-03-30T15:00:05.123Z"
        }
      ],
      "spectators": [],
      "teams": [],
      "nextTeamPick": null,
      "createTime": "2025-03-30T14:59:45.289Z"
    }
  },
  "message": "已从观众席加入玩家列表"
}
```

### 3.6 从玩家列表进入观众席

将用户从玩家列表移动到观众席。

**请求**:

```
POST /rooms/{roomId}/join-as-spectator
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "room": {
      "id": "67e95c6119732f3f913ce8d7",
      "name": "游戏验证完整测试",
      "creatorId": "67e940387df2d4360a53fb78",
      "creatorName": "testuser456",
      "creatorAvatar": "https://via.placeholder.com/150",
      "gameType": "LOL",
      "playerCount": 10,
      "teamCount": 2,
      "pickMode": "12211",
      "hasPassword": false,
      "description": "测试游戏验证功能",
      "status": "waiting",
      "players": [
        {
          "userId": "67e940387df2d4360a53fb78",
          "username": "testuser456",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "新游戏ID",
          "totalGames": 1,
          "wins": 1,
          "teamId": null,
          "isCaptain": false,
          "isCreator": true,
          "status": "offline",
          "joinTime": "2025-03-30T14:59:45.289Z"
        }
      ],
      "spectators": [
        {
          "userId": "67e93fa4b71ccae1597dca13",
          "username": "testuser",
          "avatar": "https://via.placeholder.com/150",
          "gameId": "游戏ID123",
          "totalGames": 0,
          "wins": 0,
          "isCreator": false,
          "status": "online",
          "joinTime": "2025-03-30T15:00:05.123Z"
        }
      ],
      "teams": [],
      "nextTeamPick": null,
      "createTime": "2025-03-30T14:59:45.289Z"
    }
  },
  "message": "已从玩家列表进入观众席"
}
```

### 3.7 离开房间

离开当前房间，无论用户是在玩家列表还是观众席。

**请求**:

```
POST /rooms/{roomId}/leave
```

**响应**:

```json
{
  "status": "success",
  "message": "已离开房间"
}
```

### 3.8 踢出玩家

房主可以将其他玩家或观众踢出房间。

**请求**:

```
POST /rooms/{roomId}/kick
```

**参数**:

```json
{
  "targetUserId": "67e93fa4b71ccae1597dca13"  // 要踢出的用户ID
}
```

**响应**:

```json
{
  "status": "success",
  "message": "已踢出用户"
}
```

**WebSocket事件**:

当用户被踢出房间时，会触发以下WebSocket事件：

1. 被踢出的用户会收到以下事件之一：
   - `player.kicked`：当玩家被踢出时
   - `spectator.kicked`：当观众被踢出时

   事件数据格式：
   ```json
   {
     "roomId": "67e95c6119732f3f913ce8d7",  // 房间ID
     "kickedBy": "67e940387df2d4360a53fb78"  // 踢出该用户的房主ID
   }
   ```

2. 房间内其他用户会收到以下事件之一：
   - `player.kicked`：当玩家被踢出时
   - `spectator.kicked`：当观众被踢出时

   事件数据格式：
   ```json
   {
     "userId": "67e93fa4b71ccae1597dca13",  // 被踢出的用户ID
     "kickedBy": "67e940387df2d4360a53fb78",  // 踢出该用户的房主ID
     "updateTime": "2025-03-30T15:30:45.123Z"  // 更新时间
   }
   ```

**客户端处理**:

1. 当收到 `player.kicked` 或 `spectator.kicked` 事件时：
   - 如果当前用户是被踢出的用户（通过比较 `userId` 或 `roomId`）：
     - 显示被踢出提示
     - 退出房间界面
     - 更新用户状态
   - 如果当前用户是房间内的其他用户：
     - 从玩家列表或观众列表中移除被踢出的用户
     - 更新房间状态
     - 可选：显示用户被踢出的提示

### 3.9 开始游戏

只有创建者可以操作，会执行随机分队、选择队长等操作。

**请求**:

```
POST /rooms/{roomId}/start
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "teams": [
      {
        "id": 1,
        "name": "蓝队",
        "side": "blue",
        "captainId": "u123456",
        "players": [
          {
            "userId": "u123456",
            "username": "新昵称",
            "avatar": "https://example.com/avatar.jpg",
            "isCaptain": true
          },
          // 更多队友...
        ]
      },
      {
        "id": 2,
        "name": "红队",
        "side": "red",
        "captainId": "u654321",
        "players": [
          {
            "userId": "u654321",
            "username": "另一玩家",
            "avatar": "https://example.com/avatar2.jpg",
            "isCaptain": true
          },
          // 更多队友...
        ]
      }
    ]
  },
  "message": "游戏已开始，队伍已分配"
}
```

### 3.10 获取我的房间列表

获取当前用户参与的房间列表。

**请求**:

```
GET /users/rooms
```

**查询参数**:
- `status`: 房间状态筛选 (all/waiting/picking/gaming/ended)，默认all
- `page`: 页码，默认1
- `limit`: 每页数量，默认20

**响应**:

```json
{
  "status": "success",
  "data": {
    "rooms": [
      {
        "id": "67f0d97448f6d48101a844ae",
        "name": "测试新房间",
        "creatorId": "67e93fa4b71ccae1597dca13",
        "creatorName": "testuser",
        "creatorAvatar": "https://via.placeholder.com/150",
        "gameType": "LOL",
        "playerCount": 10,
        "currentPlayers": 1,
        "viewerCount": 0,
        "status": "waiting",
        "hasPassword": false,
        "pickMode": "random",
        "createTime": "2025-04-05T07:19:16.019Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

## 4. 队伍管理 API

### 4.1 队长选择队员

在BP选人阶段，队长选择队员加入自己队伍。

**请求**:

```
POST /rooms/{roomId}/teams/{teamId}/select
```

**参数**:

```json
{
  "userId": "u654321"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "player": {
      "userId": "u654321",
      "username": "另一玩家",
      "avatar": "https://example.com/avatar2.jpg",
      "teamId": 1
    },
    "nextTeam": 2, // 下一个选人的队伍ID
    "remainingPlayers": [
      // 剩余未选择的玩家列表
    ]
  },
  "message": "队员选择成功"
}
```

### 4.2 选择红蓝方

当分队完成后，一队队长选择红蓝方。

**请求**:

```
POST /rooms/{roomId}/teams/select-side
```

**参数**:

```json
{
  "teamId": 1,
  "side": "blue" // 或 "red"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
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
  },
  "message": "阵营选择成功"
}
```

## 5. 游戏集成 API

### 5.1 绑定游戏账号

**请求**:

```
POST /users/bind-game
```

**参数**:

```json
{
  "gameId": "LoL游戏账号ID001",
  "platform": "LOL" // 默认为LOL
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "binding": {
      "platform": "LOL",
      "gameId": "LoL游戏账号ID001",
      "status": "pending",
      "_id": "67f0e0d348f6d48101a84503",
      "createTime": "2025-04-05T07:50:43.305Z"
    }
  },
  "message": "游戏账号绑定待验证"
}
```

### 5.2 提交游戏数据

当游戏结束后，客户端通过LCU API获取数据并提交。

**请求**:

```
POST /rooms/{roomId}/matches
```

**参数**:

```json
{
  "gameId": "LOL游戏ID",
  "startTime": "2023-03-29T16:00:00.000Z",
  "endTime": "2023-03-29T16:30:00.000Z",
  "duration": 1800,
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
  ],
  "players": [
    {
      "userId": "u123456",
      "teamId": 1,
      "championId": 1,
      "kills": 5,
      "deaths": 2,
      "assists": 10,
      "damage": 20500,
      "gold": 12000,
      "cs": 180,
      "vision": 25
    },
    // 更多玩家数据...
  ],
  "bannedChampions": [12, 14, 32, 45, 67]
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "match": {
      "id": "m567890",
      "roomId": "r789012",
      "gameId": "LOL游戏ID",
      "startTime": "2023-03-29T16:00:00.000Z",
      "endTime": "2023-03-29T16:30:00.000Z",
      "duration": 1800,
      "isValid": true,
      "winner": 1,
      // 其他比赛数据...
    }
  },
  "message": "对局数据提交成功"
}
```

### 5.3 验证游戏自定义对局

验证当前进行的游戏是否为内战自定义对局。

**请求**:

```
POST /games/verify
```

**参数**:

```json
{
  "gameId": "LOL游戏ID",
  "participants": [
    {
      "summonerId": "游戏ID1",
      "summonerName": "玩家1"
    },
    // 更多玩家...
  ],
  "gameType": "CUSTOM_GAME",
  "gameMode": "CLASSIC"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "isValid": true,
    "roomId": "r789012",
    "matchedPlayers": [
      {
        "userId": "u123456",
        "gameId": "游戏ID1"
      },
      // 更多匹配的玩家...
    ]
  }
}
```

## 6. 战绩统计 API

### 6.1 获取用户战绩总览

**请求**:

```
GET /users/{userId}/stats
```

<!-- 需要优化: 战绩统计查询参数扩展 -->
**建议查询参数扩展**:
```
GET /users/{userId}/stats?timeRange=30d&gameType=LOL
```

**建议查询参数**:
- `timeRange`: 时间范围 (7d/30d/90d/all)，可选，默认all
- `gameType`: 游戏类型筛选 (LOL/PUBG/CSGO/all)，可选，默认all

**响应**:

```json
{
  "status": "success",
  "data": {
    "stats": {
      "totalGames": 42,
      "wins": 26,
      "losses": 16,
      "winRate": 61.9,
      "likes": 87,
      "dislikes": 4,
      "avgKDA": "4.2/3.1/8.7",
      "kdaRatio": 4.16,
      "avgDamage": 18500,
      "avgGold": 12500,
      "mostPlayedChampions": [
        {
          "championId": 1,
          "name": "安妮",
          "games": 12,
          "wins": 8,
          "losses": 4,
          "winRate": 66.7,
          "avgKDA": "5.2/2.1/9.7"
        },
        // 更多英雄...
      ]
    }
  }
}
```

<!-- 需要优化: 战绩统计返回数据扩展 -->
**建议响应数据扩展**:
```json
{
  "status": "success",
  "data": {
    "stats": {
      "totalGames": 42,
      "wins": 26,
      "losses": 16,
      "winRate": 61.9,
      "likes": 87,
      "dislikes": 4,
      "avgKDA": "4.2/3.1/8.7",
      "kdaRatio": 4.16,
      "avgDamage": 18500,
      "avgGold": 12500,
      "mostPlayedChampions": [...],
      "recentForm": ["W", "W", "L", "W", "L"],  // 新增：最近5场战绩走势
      "roleDistribution": {  // 新增：位置分布
        "top": 10,
        "jungle": 15,
        "mid": 8,
        "adc": 5,
        "support": 4
      },
      "avgScore": 8.5  // 新增：平均评分
    }
  }
}
```

### 6.2 获取用户对局列表

**请求**:

```
GET /users/{userId}/matches?page=1&limit=20
```

**查询参数**:
- `page`: 页码，默认1
- `limit`: 每页数量，默认20
- `champion`: 英雄ID筛选，可选
- `result`: 胜负筛选 (win/lose)，可选

<!-- 需要优化: 用户对局列表查询参数扩展 -->
**建议查询参数扩展**:
- `page`: 页码，默认1
- `limit`: 每页数量，默认20
- `gameType`: 游戏类型 (LOL/PUBG/CSGO)，可选
- `timeRange`: 时间范围 (7d/30d/90d)，可选，表示最近7天、30天、90天
- `result`: 胜负筛选 (win/lose)，可选
- `champion`: 英雄ID筛选，可选

**响应**:

```json
{
  "status": "success",
  "data": {
    "matches": [
      {
        "id": "m567890",
        "roomId": "r789012",
        "roomName": "周末内战5V5",
        "gameId": "LOL游戏ID",
        "startTime": "2023-03-29T16:00:00.000Z",
        "duration": 1800,
        "result": "win",
        "championId": 1,
        "championName": "安妮",
        "kills": 5,
        "deaths": 2,
        "assists": 10,
        "kda": 7.5,
        "damage": 20500,
        "gold": 12000,
        "cs": 180,
        "rating": 9.2,
        "isMVP": true
      },
      // 更多对局...
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

<!-- 需要优化: 用户对局列表返回数据扩展 -->
**建议响应数据扩展**:
```json
{
  "status": "success",
  "data": {
    "matches": [
      {
        "id": "m567890",
        "roomId": "r789012",
        "roomName": "周末内战5V5",
        "gameId": "LOL游戏ID",
        "startTime": "2023-03-29T16:00:00.000Z",
        "duration": "30分钟",
        "result": "win",
        "championId": 1,
        "championName": "安妮",
        "kills": 5,
        "deaths": 2,
        "assists": 10,
        "kda": "5/2/10",
        "kdaRatio": 7.5,
        "damage": 20500,
        "gold": 12000,
        "cs": 180,
        "items": [3006, 3031, 3036, 3094, 3072, 3340],  // 新增：装备ID列表
        "rating": 9.2,  // 新增：评分
        "isMVP": true,  // 新增：是否MVP
        "team": {  // 新增：队伍信息
          "side": "blue",
          "result": "win"
        },
        "allPlayers": [  // 新增：所有玩家简要信息
          {
            "userId": "u123456",
            "username": "玩家1",
            "championId": 1,
            "side": "blue"
          },
          // 更多玩家...
        ]
      },
      // 更多对局...
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

### 6.3 获取对局详情

**请求**:

```
GET /matches/{matchId}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "match": {
      "id": "m567890",
      "roomId": "r789012",
      "roomName": "周末内战5V5",
      "gameId": "LOL游戏ID",
      "startTime": "2023-03-29T16:00:00.000Z",
      "endTime": "2023-03-29T16:30:00.000Z",
      "duration": 1800,
      "isValid": true,
      "winner": 1,
      "teams": [
        {
          "id": 1,
          "side": "blue",
          "result": "win",
          "players": [
            {
              "userId": "u123456",
              "username": "新昵称",
              "avatar": "https://example.com/avatar.jpg",
              "championId": 1,
              "championName": "安妮",
              "kills": 5,
              "deaths": 2,
              "assists": 10,
              "kda": 7.5,
              "damage": 20500,
              "gold": 12000,
              "cs": 180,
              "vision": 25,
              "rating": 9.2,
              "isMVP": true
            },
            // 更多队友...
          ]
        },
        {
          "id": 2,
          "side": "red",
          "result": "lose",
          "players": [
            // 对方队伍玩家...
          ]
        }
      ],
      "bannedChampions": [
        {
          "championId": 12,
          "championName": "阿利斯塔"
        },
        // 更多禁用英雄...
      ]
    }
  }
}
```

### 6.4 评价队友

对局结束后对队友进行点赞或红温。

**请求**:

```
POST /matches/{matchId}/rate
```

**参数**:

```json
{
  "targetUserId": "u654321",
  "type": "like" // 或 "dislike"
}
```

**响应**:

```json
{
  "status": "success",
  "message": "评价成功"
}
```

## 7. 社交功能 API

### 7.1 好友列表

**请求**:

```
GET /users/me/friends
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "friends": [
      {
        "id": "f123456",
        "userId": "u654321",
        "username": "另一玩家",
        "avatar": "https://example.com/avatar2.jpg",
        "status": "online", // online/offline/gaming
        "gameStatus": "游戏中",
        "groupName": "默认分组",
        "createTime": "2023-03-20T10:00:00.000Z",
        "stats": {
          "gamesWithFriend": 15,
          "winsWithFriend": 8,
          "winsAgainstFriend": 3
        }
      },
      // 更多好友...
    ]
  }
}
```

### 7.2 添加好友

**请求**:

```
POST /users/friends
```

**参数**:

```json
{
  "userId": "67e940387df2d4360a53fb78"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "friend": {
      "id": "67f0da3148f6d48101a844be",
      "userId": "67e940387df2d4360a53fb78",
      "username": "testuser456",
      "avatar": "https://via.placeholder.com/150",
      "status": "pending",
      "groupName": "默认分组",
      "createTime": "2025-04-05T07:22:25.810Z"
    }
  },
  "message": "好友请求已发送"
}
```

### 7.3 删除好友

**请求**:

```
DELETE /users/me/friends/{friendId}
```

**响应**:

```json
{
  "status": "success",
  "message": "好友删除成功"
}
```

### 7.4 修改好友分组

**请求**:

```
PUT /users/me/friends/{friendId}
```

**参数**:

```json
{
  "groupName": "新分组名称"
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "friend": {
      "id": "f123456",
      "groupName": "新分组名称"
    }
  },
  "message": "好友分组已更新"
}
```

### 7.5 邀请好友加入房间

**请求**:

```
POST /rooms/{roomId}/invite
```

**参数**:

```json
{
  "userIds": ["u654321", "u987654"]
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "invitations": [
      {
        "id": "i123456",
        "userId": "u654321",
        "roomId": "r789012",
        "status": "pending", // pending/accepted/rejected
        "createTime": "2023-03-29T17:30:00.000Z"
      },
      // 更多邀请...
    ]
  },
  "message": "邀请已发送"
}
```

## 8. 聊天室 API

### 8.1 获取房间聊天消息

**请求**:

```
GET /rooms/{roomId}/messages?channel=public&before=timestamp&limit=50
```

**查询参数**:
- `channel`: 频道类型 (public/team)
- `teamId`: 如果是队伍频道，需要指定队伍ID
- `before`: 获取此时间戳之前的消息，可选
- `limit`: 消息数量限制，默认50

**响应**:

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "msg123456",
        "roomId": "r789012",
        "userId": "u123456",
        "username": "新昵称",
        "avatar": "https://example.com/avatar.jpg",
        "content": "大家准备好了吗？",
        "type": "text", // text/voice/system
        "channel": "public",
        "teamId": null,
        "createTime": "2023-03-29T14:35:00.000Z"
      },
      // 更多消息...
    ]
  }
}
```

### 8.2 发送聊天消息

**请求**:

```
POST /rooms/{roomId}/messages
```

**参数**:

```json
{
  "content": "我准备好了！",
  "type": "text",
  "channel": "public", // 或 "team"
  "teamId": 1 // 如果是队伍频道
}
```

**响应**:

```json
{
  "status": "success",
  "data": {
    "message": {
      "id": "msg654321",
      "roomId": "r789012",
      "userId": "u123456",
      "username": "新昵称",
      "avatar": "https://example.com/avatar.jpg",
      "content": "我准备好了！",
      "type": "text",
      "channel": "public",
      "teamId": null,
      "createTime": "2023-03-29T14:36:00.000Z"
    }
  }
}
```

## 9. 实时通信

除了RESTful API外，系统还提供基于WebSocket的实时通信功能，用于房间状态更新、聊天消息、队伍变更等即时通知。

### 9.1 WebSocket连接

```
WebSocket: https://dvmxujshaduv.sealoshzh.site/ws?token={jwt_token}
```

### 9.2 消息类型

1. **房间更新**:
```json
{
  "type": "room.update",
  "data": {
    "roomId": "r789012",
    "status": "picking",
    "players": [
      // 玩家列表更新
    ],
    "spectators": [
      // 观众列表更新
    ]
  }
}
```

2. **玩家加入**:
```json
{
  "type": "player.joined",
  "data": {
    "roomId": "r789012",
    "userId": "u123456",
    "username": "玩家昵称",
    "avatar": "https://example.com/avatar.jpg",
    "totalGames": 42,
    "wins": 26,
    "isCreator": false
  }
}
```

3. **玩家离开**:
```json
{
  "type": "player.left",
  "data": {
    "roomId": "r789012",
    "userId": "u123456",
    "username": "玩家昵称",
    "newCreatorId": null // 如果转移了创建者权限，则返回新创建者ID
  }
}
```

4. **观众加入**:
```json
{
  "type": "spectator.joined",
  "data": {
    "roomId": "r789012",
    "userId": "u123456",
    "username": "玩家昵称",
    "avatar": "https://example.com/avatar.jpg",
    "totalGames": 42,
    "wins": 26,
    "isCreator": false
  }
}
```

5. **观众离开**:
```json
{
  "type": "spectator.left",
  "data": {
    "roomId": "r789012",
    "userId": "u123456",
    "username": "玩家昵称",
    "newCreatorId": null // 如果转移了创建者权限，则返回新创建者ID
  }
}
```

6. **玩家被踢出**:
```json
{
  "type": "player.kicked",
  "data": {
    "roomId": "r789012",
    "userId": "u123456",
    "username": "玩家昵称",
    "kickedBy": "u654321" // 踢出该玩家的用户ID
  }
}
```

7. **观众被踢出**:
```json
{
  "type": "spectator.kicked",
  "data": {
    "roomId": "r789012",
    "userId": "u123456",
    "username": "玩家昵称",
    "kickedBy": "u654321" // 踢出该观众的用户ID
  }
}
```

8. **聊天消息**:
```json
{
  "type": "chat.message",
  "data": {
    "message": {
      // 消息内容，格式同8.2响应
    }
  }
}
```

9. **队伍变更**:
```json
{
  "type": "team.update",
  "data": {
    "roomId": "r789012",
    "teams": [
      // 队伍信息更新
    ]
  }
}
```

10. **邀请通知**:
```json
{
  "type": "invite.received",
  "data": {
    "invitation": {
      "id": "i123456",
      "roomId": "r789012",
      "roomName": "周末内战5V5",
      "inviterId": "u123456",
      "inviterName": "新昵称",
      "createTime": "2023-03-29T17:30:00.000Z"
    }
  }
}
```

11. **游戏开始通知**:
```json
{
  "type": "game.start",
  "data": {
    "roomId": "r789012",
    "gameId": "LOL游戏ID"
  }
}
```

### 9.3 语音通信

语音通信通过WebSocket传输，支持队伍隔离的语音聊天和观众模式。

#### 9.3.1 开始语音传输

**客户端发送**:
```json
{
  "event": "voice_start",
  "data": {
    "roomId": "r789012"
  }
}
```

**服务器响应**:
```json
{
  "event": "voice_started",
  "data": {
    "roomId": "r789012",
    "teamId": 1
  }
}
```

#### 9.3.2 语音数据传输

**客户端发送**:
```json
{
  "event": "voice_data",
  "data": {
    "roomId": "r789012",
    "data": "base64编码的语音数据"
  }
}
```

**接收方接收**:
```json
{
  "event": "voice_data",
  "data": {
    "userId": "u123456",
    "username": "玩家昵称",
    "data": "base64编码的语音数据",
    "teamId": 1
  }
}
```

#### 9.3.3 结束语音传输

**客户端发送**:
```json
{
  "event": "voice_end",
  "data": {
    "roomId": "r789012"
  }
}
```

**服务器广播**:
```json
{
  "event": "voice_state_changed",
  "data": {
    "userId": "u123456",
    "roomId": "r789012",
    "active": false,
    "teamId": 1
  }
}
```

#### 9.3.4 语音状态变更通知

当用户开始或结束语音通话时，服务器会发送状态变更通知：

```json
{
  "event": "voice_state_changed",
  "data": {
    "userId": "u123456",
    "username": "玩家昵称",
    "roomId": "r789012",
    "active": true, // 或 false
    "teamId": 1
  }
}
```

#### 9.3.5 语音通信规则

- 队伍成员只能听到自己队伍的语音
- 队伍成员听不到观众的语音，不会受到观众干扰
- 观众可以听到所有队伍的语音
- 观众之间可以互相通信，形成独立的观众语音频道
- 语音状态变更只会通知相关用户（同队队员或其他观众）
- 队伍语音隔离在所有游戏阶段均有效（房间状态为"waiting"、"picking"或"gaming"）

## 10. 错误码

| 错误码 | 描述 |
|-------|------|
| 1001 | 参数错误 |
| 1002 | 未认证 |
| 1003 | 权限不足 |
| 2001 | 用户不存在 |
| 2002 | 密码错误 |
| 3001 | 房间不存在 |
| 3002 | 房间已满 |
| 3003 | 房间密码错误 |
| 4001 | 游戏验证失败 |
| 4002 | 游戏数据提交失败 |
| 5001 | 好友操作失败 |
| 9001 | 服务器内部错误 |

## 大厅聊天

### 获取聊天记录

- 请求: `GET /lobby/chat`
- 描述: 获取大厅聊天记录
- 查询参数:
  - `before`: 可选，时间戳，获取该时间之前的消息
  - `limit`: 可选，每页消息数量，默认50条
- 响应:
```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "1743839287326-70adbe4b-0251-462f-8df6-91086e30f7f0",
        "userId": "67e93fa4b71ccae1597dca13",
        "content": "大家好！这是一条测试消息",
        "type": "text",
        "timestamp": 1743839287326
      }
    ],
    "hasMore": false,
    "nextBefore": null
  }
}
```

### 发送聊天消息

- 请求: `POST /lobby/chat`
- 描述: 发送大厅聊天消息
- 请求体:
```json
{
  "content": "大家好！这是一条测试消息",
  "type": "text" // text, emoji
}
```
- 响应:
```json
{
  "status": "success",
  "message": "消息发送成功",
  "data": {
    "message": {
      "id": "1743839287326-70adbe4b-0251-462f-8df6-91086e30f7f0",
      "userId": "67e93fa4b71ccae1597dca13",
      "content": "大家好！这是一条测试消息",
      "type": "text",
      "timestamp": 1743839287326
    }
  }
}
```

### 获取用户详情

- 请求: `GET /lobby/users/{userId}`
- 描述: 获取大厅中用户的详细信息
- 响应:
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "60d21b4667d0d8992e610c85",
      "username": "testuser",
      "email": "test@example.com",
      "avatar": "https://example.com/avatar.jpg",
      "level": 10,
      "points": 1500,
      "statistics": {
        "totalGames": 50,
        "wins": 30,
        "losses": 20
      },
      "status": "online", // online, offline, in-game
      "currentRoom": null // 如果用户在游戏中，返回房间ID
    }
  }
}
```

### WebSocket事件

#### 加入大厅

- 事件: `joinLobby`
- 描述: 用户进入大厅时触发
- 数据: 无

#### 离开大厅

- 事件: `leaveLobby`
- 描述: 用户离开大厅时触发
- 数据: 无

#### 新消息

- 事件: `lobbyMessage`
- 描述: 收到新的大厅消息
- 数据:
```json
{
  "id": "msg001",
  "userId": "60d21b4667d0d8992e610c85",
  "username": "testuser",
  "avatar": "https://example.com/avatar.jpg",
  "content": "大家好！",
  "type": "text",
  "timestamp": "2023-06-22T10:00:00Z"
}
```

#### 用户状态更新

- 事件: `lobbyUserStatus`
- 描述: 大厅用户状态更新
- 数据:
```json
{
  "userId": "60d21b4667d0d8992e610c85",
  "username": "testuser",
  "status": "online", // online, offline, in-game
  "currentRoom": null // 如果用户在游戏中，返回房间ID
}
```

### 聊天记录管理策略

1. 服务器端存储：
   - 使用内存数组存储最近1小时的聊天记录
   - 按时间戳排序
   - 超过1小时的记录自动清理
   - 消息ID使用时间戳+随机数生成

2. 客户端缓存：
   - 本地存储最近加载的聊天记录
   - 按时间戳分页加载
   - 向上滚动时请求更早的记录
   - 新消息实时追加到本地记录

3. 性能优化：
   - 消息分页加载，默认每页50条
   - 使用WebSocket推送新消息，减少轮询
   - 图片和表情使用CDN加速
   - 消息内容限制长度（最大500字符）

4. 内存优化：
   - 定期清理过期消息（每小时清理一次）
   - 消息内容限制长度
   - 使用消息ID而不是完整消息内容进行引用
   - 图片和表情使用缩略图 