# 游戏内战助手 - 后端API

本项目是游戏内战助手的后端API部分，提供用户管理、房间管理、队伍组织、游戏数据集成等功能。

## 技术栈

- Node.js
- Express.js
- MongoDB (Mongoose)
- Socket.IO (实时通信)
- JWT (认证)

## 项目结构

```
server/
├── config/          # 配置文件
├── controllers/     # 控制器
├── middleware/      # 中间件
├── models/          # 数据模型
├── routes/          # 路由
├── utils/           # 工具函数
├── .env             # 环境变量
├── .env.example     # 环境变量示例
├── package.json     # 项目依赖
├── server.js        # 入口文件
└── README.md        # 文档
```

## 主要功能模块

- 用户管理: 注册、登录、资料管理
- 房间管理: 创建、加入、查询房间
- 队伍组织: 分队、队长选人、阵营选择
- 游戏集成: 与League of Legends客户端集成
- 战绩统计: 对局数据记录和分析
- 社交功能: 好友系统、评价机制
- 实时通信: 房间聊天、状态更新

## 安装和运行

1. 克隆项目

```bash
git clone https://github.com/your-username/civil-war-assistant-server.git
cd civil-war-assistant-server
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

复制`.env.example`为`.env`并根据需要修改配置

```bash
cp .env.example .env
```

4. 启动服务器

开发模式:
```bash
npm run dev
```

生产模式:
```bash
npm start
```

## API文档

API遵循RESTful风格设计，主要端点如下:

- 认证相关: `/api/v1/auth/*`
- 用户相关: `/api/v1/users/*`
- 房间相关: `/api/v1/rooms/*`
- 比赛相关: `/api/v1/matches/*`
- 游戏数据: `/api/v1/games/*`

详细API文档请参考API规范文档。

## 实时通信

系统使用Socket.IO实现实时通信，主要事件包括:

- 房间状态更新
- 聊天消息
- 队伍变更
- 游戏开始通知
- 邀请通知

## 环境要求

- Node.js 16+
- MongoDB 6.0+

## 许可证

[ISC](LICENSE) 