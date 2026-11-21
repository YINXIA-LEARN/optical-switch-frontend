# T02/a1 · W-ui

状态：ready_for_review  
基线：设计 v1、共享快照 v1。复用 E-win-optical，UI 预览独立于集成入口。  
交付：`src/ui/Dashboard.jsx`、拓扑布局和样式，以及 `tests/ui/` 中的固定快照。W-ui 已停止写入。

2026-11-21 17:22:03 +08:00，在工作区根目录运行 `node tests/ui/check.mjs`，退出码 0。以有界面的 Chrome 157 打开 Vite 独立预览 `http://127.0.0.1:5191/tests/ui/`，由检查脚本关闭浏览器与服务。运行明细见 [ui-checks.txt](evidence/a1/ui-checks.txt)，交付身份见 [source-sha256.txt](evidence/a1/source-sha256.txt)。

首次集成截图发现 8 ToR 的加高 MEMS 遮住部分电线，且同侧跨组光线过近。扩容电线现绕 MEMS 上下外围，跨组光线采用分道走线。下表是修正后的四机架复验，扩容组合结果见 T03 的 I3。

| 检查 | 结果 |
|---|---|
| U1 | PASS。16 个端口、6 条电底线、4 条固定光接线、当前两对 MEMS 连接。已知快照覆盖光电并发、电单向与光双向；全零时保留底线和配对，箭头清空。 |
| U2 | PASS。16 行，100/20/9 数值降序、同值按路径 ID、零值置后。A 初始空态、A→B 事件、B 配对与各区秒序一致，更新保留速率表滚动位置。 |
| U3 | 客观项 PASS。桌面标注与箭头可辨，窄屏仅拓扑内部横向滚动，表与事件可访问，减少动态效果模式下七个正值方向仍显示箭头。桌面和窄屏截图取固定 B/第 10 秒快照。 |

截图：[桌面 1440×900](evidence/a1/desktop-1440x900.png) · [窄屏 390×844](evidence/a1/narrow-390x844.png) · [窄屏全页](evidence/a1/narrow-full.png)。

遗留：主观视觉风格 REVIEW_REQUIRED，由 planner 看截图确认。真实模拟的持续更新和 8 ToR 组合由 W-app 验证。
