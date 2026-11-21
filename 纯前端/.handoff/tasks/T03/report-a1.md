# T03/a1 · W-app

状态：ready_for_review  
基线：2026-11-21 纯前端空工程  
执行次序：先验证开发与构建工具链，待 T01 与 T02 交付后接入生产入口。

## 工具链检查点 · 2026-11-21 17:06:29 +08:00

Windows 本机配置 E-win-optical。Node 24.18.0、npm 11.16.0、Preact 10.29.8、Vite 7.3.8、Playwright 1.65.1 和已安装的 Google Chrome 157.0.8103.79。Playwright 可打开有界面的 Chrome。

- 开发 PASS，`npm.cmd run dev -- --port 5173 --strictPort`。根页面和 JSX 模块均返回 HTTP 200，确认 Preact JSX 转换。服务由 W-app 关闭。证据见 [toolchain-dev.txt](evidence/a1/toolchain-dev.txt)。
- 构建 PASS，`npm.cmd run build` 退出码 0。检查点产物的资源路径为相对路径。证据见 [toolchain-build.txt](evidence/a1/toolchain-build.txt)。
- W-ui 可复用锁文件与 Vite，使用独立预览端口。最终构建将在接入真实模块后更新。

## 最终集成 · 2026-11-21 17:23:16 +08:00

`src/main.jsx` 创建一个模拟实例和一个 1 秒定时器，卸载时清理定时器。每次推进只发布一份快照给 Dashboard。首页默认 4 ToR，`?tors=8` 选择 T01 的扩容样例。产物在 `dist/`，启动方式见 [README.md](../../../README.md)。W-app 已结束写入，验收浏览器和临时静态服务已关闭。

工作区根目录执行 `npm.cmd ci --no-audit --fetch-retries=0`、`npm.cmd run build`、`node tests/integration/check.mjs`，退出码均为 0。安装时 npm 提示 esbuild postinstall 未列入允许脚本，平台二进制正常安装并完成两次生产构建。见 [干净安装](evidence/a1/clean-install.txt)、[最终构建](evidence/a1/production-build.txt)、[集成退出日志](evidence/a1/integration-checks.txt) 和 [入口与测试 SHA-256](evidence/a1/source-sha256.txt)。

### I1 · 可迁移静态部署

**PASS。** `dist/` 共 35,647 字节，`index.html` 443 字节、`assets/index-BwzbYOdk.js` 27,500 字节、`assets/index-ipCfbS2o.css` 7,704 字节。复制到独立临时目录后，Chrome 从 `http://127.0.0.1:61183/exhibit/relocated/network/` 加载。浏览器拦截外部来源，观察到三个本地资源均为 HTTP 200，拓扑与流量表正常出现，浏览器运行错误为零。端口由系统分配，复验命令见 README。资源哈希和实际请求见 [I1-deployment.json](evidence/a1/I1-deployment.json)。

### I2 · 两次真实换路

**PASS。** 有界面的 Chrome 前台持续 21.110 秒，记录第 0～21 秒共 22 次发布，实测发布间隔 995～1,060 毫秒。每次发布的四区秒序一致，16 行速率均与拓扑方向的速率、箭头和高亮状态匹配，零值排后。第 10 秒 A→B、第 20 秒 B→C，分别移除上一批四个光方向并加入新方向，六条电底线与 12 个电方向恒定，事件时间与切换快照相同。测试时钟仅用于 I3。完整逐秒数据见 [I2-foreground.json](evidence/a1/I2-foreground.json)。

切换证据：[第 9 秒 A](evidence/a1/desktop-tick-9.png) · [第 10 秒 B](evidence/a1/desktop-tick-10.png) · [第 19 秒 B](evidence/a1/desktop-tick-19.png) · [第 20 秒 C](evidence/a1/desktop-tick-20.png)。

### I3 · 桌面、窄屏与扩容

**客观项 PASS。** 1440×900 桌面和 390×844 窄屏在生产入口渲染，窄屏无整页横向溢出，SVG 可局部横向浏览，速率区能滚至末行且表头固定，事件可读。相同 Dashboard 在 8 ToR 样例中显示 32 行，两组各保留六条电边，B/C 的四对光路跨组。首次扩容目检发现部分电线被 MEMS 遮住，已由 W-ui 修正并复跑 U1～U3；最终按 SVG 路径验证电线避开 MEMS，光线留在 MEMS 内。见 [I3-responsive-expansion.json](evidence/a1/I3-responsive-expansion.json)。

最终截图：[桌面 1440×900](evidence/a1/desktop-1440x900.png) · [窄屏 390×844](evidence/a1/narrow-390x844.png) · [窄屏全页](evidence/a1/narrow-full.png) · [8 ToR 策略 B](evidence/a1/expanded-8-tor.png) · [8 ToR 策略 C](evidence/a1/expanded-8-tor-strategy-c.png)。

## Planner 审阅

- M1～M4 复用 [T01/a1](../T01/report-a1.md) 的独立结果，模拟文件身份与报告一致。
- U1～U3 复用 [T02/a1](../T02/report-a1.md) 的最终复验，UI 文件身份与报告一致。
- 全部必需客观项已运行并通过。U3/I3 的主观视觉判断和三张卡的审阅关闭由 planner 处理。
