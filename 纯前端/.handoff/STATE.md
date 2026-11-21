# 光电网络总屏 · 任务板

protocol: 3  
project_root: D:\ANT实验室实践项目\光交换\纯前端  
planner: W-plan（本规划窗口，唯一任务板 writer）  
revision: 4  
updated_at: 2026-11-21T19:00:34+08:00

T01～T05 均已验收。T04 的修复已推送，T05 的新功能在本地交付。见[验证索引](VERIFICATION.md)。

| ID / attempt | 目标 | 窗口 | 状态 | 独占范围 | 依赖与检查点 | 任务 |
|---|---|---|---|---|---|---|
| T01/a1 | 每秒采样与每十秒换路 | W-sim | accepted | src/sim、tests/sim | M1～M4 通过，含 8 ToR 配置 | [任务卡](tasks/T01/task-a1.md) · [验收](tasks/T01/review-a1.md) |
| T02/a1 | 拓扑、速率和事件总屏 | W-ui | accepted | src/ui、tests/ui、独立预览端口 | U1～U3 通过，含桌面与窄屏目检 | [任务卡](tasks/T02/task-a1.md) · [验收](tasks/T02/review-a1.md) |
| T03/a1 | 工具链、入口、合并与静态部署验证 | W-app | accepted | 根工程配置、src/main.jsx、tests/integration、dist、集成服务 | I1～I3 通过，生产组合已验收 | [任务卡](tasks/T03/task-a1.md) · [验收](tasks/T03/review-a1.md) |
| T04/a1 | 修复长短亮线并推送 | W-front | accepted | 拓扑动画、回归、修复提交 | A1～A3 通过，已推送 3e9b584 | [验收](tasks/T04/review-a1.md) |
| T05/a1 | 分钟吞吐、ToR 收发与小时矩阵 | W-front | accepted | 分析数据、图表、Dashboard、集成构建 | B1～B4 通过，含视觉审阅 | [验收](tasks/T05/review-a1.md) |

F04 已关闭。T05 的新增页面、测试与构建产物保存在本地工作树。
