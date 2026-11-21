# T05/a1 · W-front

状态：ready_for_review  
基线：T04 `3e9b584c383c0270386ca8fade6735e357dd0dc6`，已核对 origin/main。T05 的代码、测试和构建产物保存在本地工作树。

最终浏览器验证于 2026-11-21 18:57:34 +08:00 完成。采用 Node 24.18.0、Vite 7.3.8、Chrome 157。交付为 `src/analytics/`、`src/ui/` 中的 Dashboard 接入和历史组件、`tests/analytics/`、`tests/integration/history-check.mjs`、`README.md` 与 `dist/`。文件身份见 [SHA-256](evidence/a1/source-sha256.txt)。

## B1 · 手算样例

**PASS。** 运行 `node --test tests/analytics/aggregate.test.mjs`，5 项通过，退出码 0。手算分钟合计光 2700 Gbit、电 1800 Gbit，整窗光 60%、电 40%，两段光占比 80%、20%。最后一秒手算样例为光 8、电 6 Gbit/s，ToR0 发 10 收 4、ToR1 发 4 收 10，其他机架为零。矩阵 30 GB 与 10 GB 对应 75% 与 25%。零分母返回空态，无切换窗口只有一个 60 秒段。见 [聚合日志](evidence/a1/aggregation.txt)。

## B2 · 分钟窗口与播放

**PASS。** 默认显示上海时间 2026-11-21 `[09:59:30, 10:00:30)`，两线各 60 个点，策略刻线位于 10:00:00，4 ToR 整窗显示光 67.7%、电 32.3%。实时播放两步，窗口起点依次为 09:59:30、09:59:31、09:59:32，两次推进间隔约 1,001 毫秒。B/C 持续秒数为 30/30、29/31、28/32，图表、占比和 ToR 末秒收发同步。暂停后保留画面。另用测试时钟验证播放至末尾 `[10:00:30, 10:01:30)` 自动停止，重播回到初始视窗。

截图：[桌面初始](evidence/a1/desktop-minute.png) · [播放两步后暂停](evidence/a1/desktop-minute-paused.png) · [窄屏分钟卡](evidence/a1/narrow-minute.png) · [8 ToR 收发](evidence/a1/expanded-minute.png)。

## B3 · 区段矩阵

**PASS。** 时间线 08:00、09:00、10:00、11:00，默认选 B。逐个点击 A/B/C，验证标题、有效范围及热点同步。4 ToR 热点依次为 ToR0→ToR1、ToR2→ToR0、ToR0→ToR3，反向数据不同。每段的未取整占比和为 100%，相同占比按同一规则着色，4 ToR 三段共用 0～54.3% 的色标，8 ToR 三段共用 0～25.5% 的色标。手算注入 900 GB 边缘样本，仍为 75%/25%。09:05 计入、09:55 排除。键盘聚焦和触点可更新有向 GB 与占比详情。

截图：[策略 B](evidence/a1/desktop-matrix-b.png) · [策略 C](evidence/a1/desktop-matrix-c.png) · [窄屏矩阵](evidence/a1/narrow-matrix.png) · [8 ToR 矩阵](evidence/a1/expanded-matrix.png)。

## B4 · 生产与响应式

**客观项 PASS。** `npm.cmd run build` 和 `node tests/integration/history-check.mjs` 均退出 0。生产文件共 63,294 字节，复制到独立目录，经 `http://127.0.0.1:51519/history/` 打开，三个本地文件均返回 HTTP 200，无外网请求与运行错误。桌面按 1440×900 测试，390×844 窄屏中折线在收发区上方，4 ToR 矩阵四列可同屏看全，8 ToR 矩阵局部横滑可到达最后一列。8 ToR 有 8 条收发行、8×8 矩阵，实时榜仍有 32 条路径。浏览器实测历史暂停时实时区继续推进。采样、实时拓扑和动画源文件经 diff 核实与 T04 推送版本一致，复用 A1/A2 的动画与时序证据。

证据：[生产构建](evidence/a1/build.txt) · [浏览器日志](evidence/a1/browser-checks.txt) · [实际观察与数据](evidence/a1/browser.json) · [桌面全页](evidence/a1/desktop-full.png) · [窄屏全页](evidence/a1/narrow-full.png)。

启动见 [README.md](../../../README.md)。必需客观项全部运行并通过，最终截图留 planner 审阅。
