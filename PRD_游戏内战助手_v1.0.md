# 游戏内战助手 - 产品需求规格说明书

## 1. 文档信息
- **文档版本**：v1.0
- **创建日期**：2023-03-29
- **状态**：初稿

## 2. 产品概述
游戏内战助手是一个为英雄联盟玩家设计的内战组织平台，帮助玩家创建、管理和参与内战房间，提供全方位的内战数据统计和社交互动功能，提升内战体验。

## 3. 用户画像与使用场景

### 用户画像
1. **核心用户**：英雄联盟游戏玩家
   - 年龄：16-35岁
   - 游戏经验：有一定英雄联盟游戏经验
   - 需求：希望能与朋友组织内战，并保存战绩记录

2. **内战组织者**
   - 特点：主动性强，社交圈广
   - 需求：需要简化内战组织流程，自动化队伍分配，记录内战数据

3. **竞技型玩家**
   - 特点：重视游戏数据，关注个人表现
   - 需求：详细的战绩统计，个人表现分析

### 使用场景
1. **朋友内战**：一群朋友希望组织5v5内战，需要平台帮助分配队伍和追踪战绩
2. **社区赛事**：游戏社区组织定期内战活动，需要系统化管理多场内战
3. **训练赛**：半专业战队组织训练赛，需要记录对局数据分析提升

## 4. 功能模块拆解 (MECE原则)

### 4.1 用户账户系统
- 注册/登录功能
- 个人信息管理
- 账户设置
- 积分与等级系统

### 4.2 大厅聊天室
- 进入大厅聊天室可以和所有人聊天
- 大厅聊天室点击玩家头像可以查看玩家信息

### 4.3 房间管理系统
- 房间创建，房间创建好后，聊天室和语音功能一直存在且一直显示，直到房间销毁
- 房间查询与筛选
- 房间状态管理(进行中/已结束)
- 房间内玩家管理

### 4.4 队伍编排系统
- 随机分队功能
- 队长选择模式(选人)
- 红蓝方选择
- 队伍聊天(文字聊天和实时语音)分组

### 4.5 游戏集成系统
- LCU API集成：https://developer.riotgames.com/apis，需要开发一个windwos本地服务器，让玩家用客户端去连接，然后获取玩家客户端信息，在获取API，这部分现在是不管，最后单独开发
- 对局信息获取
- 对局结果验证
- 英雄选择记录

### 4.5 战绩统计系统
- 个人战绩记录
- 队友配合数据
- 对手对抗数据
- 英雄使用统计

### 4.6 社交互动系统
- 好友管理，使用侧边栏，可以随时弹出弹回
- 点赞/红温机制
- 聊天室功能
- 房间邀请功能

### 4.7 信息展示系统
- 个人主页
- 数据可视化
- 排行榜

## 5. 功能流程图

### 5.1 用户注册登录流程
```
@startuml
start
:用户访问网站;
if (是否有账号?) then (是)
  :登录;
  if (验证成功?) then (是)
    :进入主页;
  else (否)
    :显示错误;
    :返回登录;
  endif
else (否)
  :注册新账号;
  :填写基本信息;
  :验证账号;
  :创建账号;
  :进入主页;
endif
stop
@enduml
```

### 5.2 创建内战房间流程
```
@startuml
start
:用户点击"创建房间";
:填写房间信息;
note right
  - 游戏类型(默认英雄联盟)
  - 人数(默认10人)
  - 队伍数(默认2队)
  - 选人模式(队长BP制)
  - 可选密码
end note
:创建房间;
:生成房间ID;
:创建聊天室;
:等待玩家加入;
if (人数已满?) then (是)
  :开始游戏;
  :随机分配队伍;
  :随机选择队长;
  :队长开始BP选人;
  :红蓝方选择;
  :进入游戏客户端;
else (否)
  :继续等待;
endif
stop
@enduml
```

### 5.3 战绩记录流程
```
@startuml
start
:监听游戏状态;
if (检测到游戏开始?) then (是)
  :记录对局开始时间;
  :记录参与玩家;
  :监控游戏进行;
  if (游戏时长>5分钟?) then (是)
    :等待游戏结束;
    :通过LCU API获取对局结果;
    :记录对局数据;
    :更新玩家战绩;
    :更新玩家积分;
  else (否)
    :标记为无效对局;
  endif
endif
stop
@enduml
```

## 6. 交互逻辑说明

### 6.1 内战房间管理
- **创建房间**：用户点击"创建房间"按钮，填写房间信息后创建房间，同时自动创建聊天室
- **加入房间**：用户可通过房间ID或从房间列表加入，若设有密码则需输入密码
- **房间状态**：包括"等待中"、"选人中"、"游戏中"、"已结束"四种状态
- **异常处理**：
  - 玩家中途退出：标记玩家状态为"离线"，保留其位置3分钟
  - 游戏崩溃：自动检测重连，允许房主重置当前对局

### 6.2 队伍编排
- **随机分队**：开始游戏后系统随机将玩家分为两队，随机选择队长
- **队长选人**：按照12211模式或12221模式(房主选择)进行选人
- **阵营选择**：完成选人后，一队队长选择红/蓝方
- **聊天分组**：自动将玩家加入对应队伍聊天室，玩家可自由切换至公共聊天室

### 6.3 数据记录
- **对局绑定**：通过LCU API检测玩家当前对局，仅记录自定义对局且与房间内玩家匹配的游戏
- **数据抓取**：对局结束后获取详细数据，包括KDA、伤害、经济等
- **胜率计算**：更新玩家与特定队友的配合胜率，对抗特定对手的胜率

### 6.4 社交互动
- **点赞/红温**：对局结束后可对队友进行评价，累计记录次数
- **好友管理**：可添加好友，分组管理，查看好友数据
- **邀请机制**：可直接邀请好友进入现有房间，或创建新房间后邀请

## 7. 数据字段定义

### 7.1 用户(User)
```json
{
  "id": "String",
  "username": "String",
  "password": "String (加密存储)",
  "email": "String",
  "avatar": "String (URL)",
  "level": "Number",
  "points": "Number",
  "gameId": "String (游戏ID)",
  "createTime": "Date",
  "lastLoginTime": "Date",
  "settings": {
    "allowInvite": "Boolean",
    "allowFriendRequest": "Boolean"
  },
  "stats": {
    "totalGames": "Number",
    "wins": "Number",
    "likes": "Number",
    "dislikes": "Number"
  }
}
```

### 7.2 房间(Room)
```json
{
  "id": "String",
  "name": "String",
  "creatorId": "String (用户ID)",
  "password": "String (可为空)",
  "gameType": "String (默认'LOL')",
  "playerCount": "Number (默认10)",
  "teamCount": "Number (默认2)",
  "pickMode": "String ('12211'或'12221')",
  "status": "String (waiting/picking/gaming/ended)",
  "createTime": "Date",
  "endTime": "Date (可为空)",
  "players": [
    {
      "userId": "String",
      "teamId": "Number",
      "isCaptain": "Boolean",
      "status": "String (online/offline/ready)"
    }
  ],
  "teams": [
    {
      "id": "Number",
      "name": "String",
      "side": "String (red/blue/none)",
      "captainId": "String (用户ID)"
    }
  ],
  "matches": ["String (比赛ID数组)"]
}
```

### 7.3 比赛(Match)
```json
{
  "id": "String",
  "roomId": "String",
  "gameId": "String (LCU API返回的游戏ID)",
  "startTime": "Date",
  "endTime": "Date",
  "duration": "Number (秒)",
  "isValid": "Boolean",
  "winner": "Number (队伍ID)",
  "teams": [
    {
      "id": "Number",
      "side": "String (red/blue)",
      "result": "String (win/lose)"
    }
  ],
  "players": [
    {
      "userId": "String",
      "teamId": "Number",
      "championId": "Number",
      "kills": "Number",
      "deaths": "Number",
      "assists": "Number",
      "damage": "Number",
      "gold": "Number",
      "cs": "Number",
      "vision": "Number",
      "kda": "Number (计算值)",
      "rating": "Number (评分)",
      "isMVP": "Boolean"
    }
  ],
  "bannedChampions": ["Number (英雄ID数组)"]
}
```

### 7.4 好友关系(Friendship)
```json
{
  "id": "String",
  "userId": "String",
  "friendId": "String",
  "groupName": "String (分组名称)",
  "createTime": "Date",
  "stats": {
    "gamesWithFriend": "Number",
    "winsWithFriend": "Number",
    "gamesAgainstFriend": "Number",
    "winsAgainstFriend": "Number"
  }
}
```

### 7.5 聊天室(ChatRoom)
```json
{
  "id": "String",
  "roomId": "String (关联房间ID)",
  "type": "String (public/team)",
  "teamId": "Number (若为team类型)",
  "messages": [
    {
      "userId": "String",
      "content": "String",
      "time": "Date",
      "type": "String (text/voice/system)"
    }
  ]
}
```

## 8. 版本更新日志

### v1.0 (初始版本)
- 基础用户系统
- 内战房间创建和管理
- 队伍随机分配和队长BP选人
- LCU API集成实现游戏数据获取
- 基础战绩统计
- 好友系统
- 聊天室功能 