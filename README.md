# Dont Trust That Card

在线多人唬牌游戏项目初始化仓库。

当前仓库包含两部分内容：

1. 已有的扑克牌素材，保留在 `Assets/`
2. 新建立的项目骨架、规则文档、设计规格和实现计划

## 当前状态

本次初始化没有提前安装框架依赖，而是先建立一个适合继续开发的 monorepo 骨架：

- `frontend/`：后续放前端客户端
- `backend/`：后续放服务端与实时房间逻辑
- `shared/`：后续放前后端共享的类型、规则和状态机
- `docs/rules/`：正式游戏规则
- `docs/superpowers/specs/`：设计规格
- `docs/superpowers/plans/`：实现计划

## 关键文档

- 正式规则：[docs/rules/game-rules-v0.7.md](docs/rules/game-rules-v0.7.md)
- 设计规格：[docs/superpowers/specs/2026-05-14-dont-trust-that-card-design.md](docs/superpowers/specs/2026-05-14-dont-trust-that-card-design.md)
- 实现计划：[docs/superpowers/plans/2026-05-14-multiplayer-mvp.md](docs/superpowers/plans/2026-05-14-multiplayer-mvp.md)

## 推荐实现方向

为了适配在线多人、严格顺序回合和可测试的规则状态机，推荐后续采用：

- 前端：React + Vite + TypeScript
- 后端：Node.js + TypeScript + Fastify + Socket.IO
- 共享层：TypeScript 纯逻辑模块，承载卡牌模型、回合状态机和共享事件类型

本次初始化先不锁死依赖版本，避免在规则和产品边界还会调整时过早绑定技术细节。

