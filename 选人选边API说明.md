# 选人选边API说明

本文档详细说明了在游戏中队长选择队员和选择红蓝方的API使用方法，以及相关的Socket事件。

## 1. 队长选择队员

在BP选人阶段，队长可以选择队员加入自己的队伍。

### HTTP API

**请求**:

```
POST /api/v1/rooms/{roomId}/teams/{teamId}/select/{playerId}
```

**参数**:
- `roomId`: 房间ID
- `teamId`: 队伍ID（1或2）
- `playerId`: 被选择的玩家ID

**响应**:

```json
{
  "status": "success",
  "data": {
    "player": {
      "userId": "u654321",
      "username": "另一玩家",
      "teamId": 1
    },
    "nextTeamPick": 2, // 下一个选人的队伍ID
    "status": "picking" // 房间状态，如果所有玩家都已选择，则变为"gaming"
  },
  "message": "队员选择成功"
}
```

### Socket事件

当队长选择队员时，服务器会向房间内所有玩家和观众广播`player.selected`事件：

```javascript
socket.on('player.selected', (data) => {
  // data: {
  //   userId: "u654321", // 被选择的玩家ID
  //   username: "另一玩家", // 被选择的玩家用户名
  //   avatar: "https://example.com/avatar2.jpg", // 被选择的玩家头像
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

**注意**：
- 所有客户端（包括操作的发起者）都会收到此事件
- 当只剩最后一名玩家时，系统会自动将其分配到相应队伍，并发送另一个`player.selected`事件，其中`isAutoAssigned`为`true`

## 2. 选择红蓝方

当分队完成后，一队队长可以选择红蓝方。

### HTTP API

**请求**:

```
POST /api/v1/rooms/{roomId}/teams/select-side
```

**请求体**:

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
        "name": "蓝队",
        "side": "blue",
        "captainId": "u123456"
      },
      {
        "id": 2,
        "name": "红队",
        "side": "red",
        "captainId": "u789012"
      }
    ]
  },
  "message": "阵营选择成功"
}
```

### Socket事件

当队长选择红蓝方时，服务器会向房间内所有玩家和观众广播`team.selected_side`事件：

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

**注意**：
- 所有客户端（包括操作的发起者）都会收到此事件
- 一旦一个队伍选择了阵营，另一个队伍的阵营会自动设置为相反的阵营

## 客户端实现建议

### 选人阶段

1. **显示未分配玩家列表**：
   ```javascript
   function showUnassignedPlayers(players) {
     const unassignedPlayers = players.filter(p => p.teamId === null);
     // 渲染未分配玩家列表
   }
   ```

2. **队长选择玩家**：
   ```javascript
   function selectPlayer(playerId) {
     // 只有队长才能调用此函数
     axios.post(`/api/v1/rooms/${roomId}/teams/${myTeamId}/select/${playerId}`)
       .then(response => {
         // 可以不处理响应，因为会收到Socket事件
       })
       .catch(error => {
         showError(error.response.data.message);
       });
   }
   ```

3. **处理玩家被选择事件**：
   ```javascript
   socket.on('player.selected', (data) => {
     // 将玩家从未分配列表移动到相应队伍
     movePlayerToTeam(data.userId, data.teamId);
     
     // 更新下一个选人的提示
     updateNextPickPrompt(data.nextTeamPick);
     
     // 如果选人阶段结束，显示选择红蓝方界面
     if (data.remainingPlayers === 0) {
       showSelectSideUI();
     }
   });
   ```

### 选择红蓝方阶段

1. **队长选择阵营**：
   ```javascript
   function selectSide(side) {
     // 只有队长才能调用此函数
     axios.post(`/api/v1/rooms/${roomId}/teams/select-side`, {
       teamId: myTeamId,
       side: side // "red" 或 "blue"
     })
     .then(response => {
       // 可以不处理响应，因为会收到Socket事件
     })
     .catch(error => {
       showError(error.response.data.message);
     });
   }
   ```

2. **处理阵营选择事件**：
   ```javascript
   socket.on('team.selected_side', (data) => {
     // 更新队伍阵营显示
     data.teams.forEach(team => {
       updateTeamSideUI(team.id, team.side);
     });
     
     // 显示游戏准备开始的提示
     showGameStartingPrompt();
   });
   ```

## 状态流转

1. 房间创建后，状态为`waiting`
2. 房主点击"开始游戏"后：
   - 如果选择随机分队，直接进入`gaming`状态
   - 如果选择队长选人，进入`picking`状态
3. 队长选人完成后，状态变为`gaming`
4. 队长选择红蓝方（状态保持为`gaming`）
5. 游戏开始

## 权限控制

- 只有队长可以选择队员
- 只有队长可以选择红蓝方
- 只有轮到选人的队伍队长可以选择队员
- 只有一队队长可以选择红蓝方
