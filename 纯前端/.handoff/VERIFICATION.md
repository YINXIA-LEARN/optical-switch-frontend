# 验证索引 · 已验收版本

2026-11-21 · E-win-optical · Windows，Node 24.18.0，Chrome 157。下列行为检查由各 executor 完成，W-plan 核对了 19 项项目文件、3 个产物的 SHA-256，并审阅逐帧记录及最终截图。

| 检查 | 原运行与适用条件 | 验收 | 复用失效条件 |
|---|---|---|---|
| M1～M4 | [W-sim 模型记录](tasks/T01/evidence/a1/model-checks.txt)，固定随机源、4/8 ToR | [通过](tasks/T01/review-a1.md) | 拓扑配置、模型、时序、测试输入变化 |
| U1～U3 | [W-ui 固定快照](tasks/T02/evidence/a1/ui-checks.txt)，4 ToR、桌面与窄屏 | [通过，含视觉](tasks/T02/review-a1.md) | 组件、样式、布局、夹具或渲染条件变化 |
| I1 | [W-app 迁移产物](tasks/T03/evidence/a1/I1-deployment.json)，静态子路径 | [通过](tasks/T03/review-a1.md) | 构建产物或资源加载条件变化 |
| I2 | [W-app 生产版前台时钟](tasks/T03/evidence/a1/I2-foreground.json)，21.110 秒 | [通过](tasks/T03/review-a1.md) | 入口、模型、展示逻辑或浏览器计时条件变化 |
| I3 | [W-app 尺寸与扩容](tasks/T03/evidence/a1/I3-responsive-expansion.json)，1440×900、390×844、8 ToR | [通过，含视觉](tasks/T03/review-a1.md) | 布局、视口、扩容配置或构建产物变化 |

## 动画修复与历史分析

| 检查 | 版本和证据 | 验收 | 复用失效条件 |
|---|---|---|---|
| A1～A3 | 修复提交 3e9b584，[光点量测](tasks/T04/evidence/a1/motion-checks.txt)、[远端 SHA 回读](tasks/T04/evidence/a1/remote-sha.txt) | [通过](tasks/T04/review-a1.md) | 动画、时序、渲染条件或发布对象变化 |
| B1～B4 | T05 本地构建，[文件清单](tasks/T05/evidence/a1/source-sha256.txt)、[浏览器记录](tasks/T05/evidence/a1/browser.json) | [通过，含视觉](tasks/T05/review-a1.md) | 样例、聚合、图表、构建或浏览器条件变化 |
