---
name: gpt-dsh-handoff
description: 通过共享项目文件协调多窗口开发、任务接管和规划/执行分工；支持 DSH、其他 GPT 或兼容 Agent，复用环境与验证证据，批量处理小修，减少重复上下文和往返。
---

# 多窗口开发与交接

目标：新窗口快速接手、多执行窗口安全并行、减少重复阅读和验证。沿用调用名，协议 v3；默认共享目录、人工转发启动卡。本 skill 不自行启动模型、后台监控或提供文件锁。

## 角色与指向
- **planner**：决策、分配边界/依赖、审阅证据；一个项目只有一个任务板写入者。
- **executor**：按批次实现、自检、自修与回报；可由 DSH、其他 GPT 或兼容 Agent 担任，不按模型品牌推断角色。
- 用户指定角色最高优先。提示有 task ID/attempt 时精确定位，不改取“最新任务”。“执行当前任务”仅在唯一可执行指派无歧义时兼容。
- **启动卡应含**：项目/路径、角色或窗口标签、ID/attempt、一句目标、task 与 report 路径。既方便开发者识别回溯，又不重复规格和操作手册。见 [protocol.md](references/protocol.md#启动卡)。

## 按需恢复
从项目 AGENTS.md 路由到 skill；按启动卡读 STATE 对应行、task 的输入索引/checkpoint 与短 CONTEXT。新窗口只加载相关指南与文件；同窗口继续只读变化，不默认重读整库、历史报告、全部 brief 或日志。
- planner：[planner.md](references/planner.md)。
- executor：[executor.md](references/executor.md)。
- 初始化、并行协调、迁移、字段不清：[protocol.md](references/protocol.md)。
- 需要运行检查/判断证据有效性：[verification.md](references/verification.md)。
- UI/美化：[visual-design.md](references/visual-design.md)；制图：[image-work.md](references/image-work.md)。
- 批次/启动卡写法：[examples.md](references/examples.md)。

## 核心机制
1. task 指定验证 owner；executor 跑必要检查，planner 默认审阅已有证据。有效 PASS 复用，补跑写出失效/缺证原因。
2. 局部问题在执行当轮修正；planner 可将非阻塞小修与下一阶段独立工作合成批次。延期项有 ID、owner、关闭门槛，不假报通过。
3. 多窗口按文件和运行资源分工；同一文件/共享配置/输出或服务只有一个写入负责人。冲突步骤串行，独立工作可并行。
4. 接管前确认旧 writer 停止，新 attempt 继承成果、差异、有效证据与待办；不因超时猜测旧窗口已退出。
5. 短摘要加路径、报告写增量、检查按 ID 引用；不省略关键规格，也不编造 token 节省率。

planner 管 CONTEXT、STATE、task/review、共享环境/验证索引；executor 只写自己范围内代码、素材、report/evidence。派出后的 task 不悄悄改写。任务板不是原子锁；角色不扩大用户授权或宿主权限。
