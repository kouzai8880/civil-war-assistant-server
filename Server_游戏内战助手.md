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
## API文档

API详细文档请参考 `APISpec_游戏内战助手_v1.0.md`

## 主要功能模块

- 用户管理: 注册、登录、资料管理
- 房间管理: 创建、加入、查询房间
- 队伍组织: 分队、队长选人、阵营选择
- 游戏集成: 与League of Legends客户端集成
- 战绩统计: 对局数据记录和分析
- 社交功能: 好友系统、评价机制
- 实时通信: 房间聊天、状态更新

## 开发说明

- 使用ESLint和Prettier来保持代码风格一致
- 使用Mongoose来与MongoDB交互
- 使用Socket.IO实现实时通信功能
- 所有API端点均采用RESTful设计风格
- 使用JWT进行身份验证和授权

## 环境要求

- Node.js-22
- MongoDB-6.0

## 数据库连接方式
mongodb://root:r7s7dhr7@civil-war-assistant-db-mongodb.ns-pdcg8wzg.svc:27017


## 注意
直接以当前目录作为项目根目录。注意，次目录已经初始化完成了nodejs项目 直接修改即可
为这个项目的所有代码写上详细注释