# 光电网络总览

默认展示 4 台 ToR。页面打开即采样第 0 秒，此后每秒重采样所有可用方向。每 10 秒按 A → B → C → A 切换 MEMS 光路，拓扑、实时流量和策略事件同步更新。所有模拟数据由浏览器生成。

## 启动

在本目录用 PowerShell 执行。开发和构建需要 Node.js 20.19+ 或 22.12+。

```powershell
npm.cmd ci
npm.cmd run dev
```

打开 [本地开发页](http://127.0.0.1:5173/)。

## 构建并打开生产页面

```powershell
npm.cmd run build
npm.cmd run preview
```

打开 [本地生产预览](http://127.0.0.1:4173/)。`dist/` 可整目录复制到任意静态 HTTP 服务的根路径或子路径。若只运行已构建的文件，在项目根目录执行 `node tests/integration/static-server.mjs dist 4173` 即可，静态服务脚本使用 Node 自带模块。

## 演示参数

- URL 加 `?tors=8` 可打开 8 ToR 扩容样例。样例位于 `src/sim/cluster8.mjs`，每组内两两走电，B/C 策略走跨组光路。
- 默认接线在 `src/sim/config.mjs`。采样间隔由 `src/main.jsx` 管理。活跃概率 0.5、活跃速率 1–100 Gbit/s、换路周期 10 秒定义在 `src/sim/index.mjs`。

## 复验

```powershell
node --test tests/sim/simulation.test.mjs
node tests/ui/check.mjs
npm.cmd run build
node tests/integration/check.mjs
```

两个浏览器检查使用本机安装的 Google Chrome，并独立启动和关闭各自的 HTTP 服务。生产检查以真实前台时钟观察至少 21 秒，随后使用测试时钟检查窄屏和 8 ToR。
