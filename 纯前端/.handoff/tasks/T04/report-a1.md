# T04/a1 · W-front

状态：ready_for_review  
基线：main 的 `27be691` 与工作树中的采样、动画和对应测试改动。A1～A3 均已通过，T05 可直接开始。

2026-11-21（UTC+08:00）完成验证，修复提交时间为 18:46:58。

## A1 · 光点尺寸与方向

**PASS。** 1440×900 Chrome 生产页的同一 SVG 内，最长电路 ToR0↔ToR3 长 1,391.94 SVG 单位，短 MEMS 光路 ToR0↔ToR1 长 208 单位。两种光点外径均为 8.45 屏幕像素，沿路径的速度均为 122 SVG 单位/秒。双向光点沿底线两侧相反运动，单向仅绘一个，空闲仅有底线。光点图层放在过线留缝上方，交叉时保持完整。目检和帧采集均使用实际生产构建。

证据：[帧 1](evidence/a1/flow-frame-1.png) · [帧 2](evidence/a1/flow-frame-2.png) · [帧 3](evidence/a1/flow-frame-3.png) · [逐帧数据](evidence/a1/motion.json)。

## A2 · 时序回归

**PASS。** 第 4 秒速率由 11 更新到 91 Gbit/s，四个观测方向的光点继续移动且保留原 SVG 节点。第 3/6 秒验证重新判活跃，第 10 秒旧的四个光方向消失，新的四个方向立即采样，A→B 事件同步。减少动态效果时仍可读静态源端箭头。

Node 24.18.0、Vite 7.3.8、Chrome 157。工作区内 `node --test tests/sim/simulation.test.mjs`（5 项）、`npm.cmd run build`、`node tests/integration/flow-motion.mjs` 和 `node tests/integration/check.mjs` 均退出 0。生产集成回归在前台运行 21.113 秒，I1～I3 通过，独立保存本轮证据。

证据：[模拟测试](evidence/a1/model-checks.txt) · [构建](evidence/a1/build.txt) · [动画检查](evidence/a1/motion-checks.txt) · [减弱动态效果](evidence/a1/reduced-motion.png) · [生产回归](evidence/a1/integration-checks.txt)。

## A3 · 提交与远端确认

**PASS。** 核对 12 个暂存路径，`git diff --cached --check` 通过。一次提交包含动画修复、已有采样改动、关联测试、README 和生产产物。使用与仓库上一提交一致的提交身份。`git push origin HEAD:refs/heads/main` 成功，再以 `git ls-remote --exit-code origin refs/heads/main` 确认本地和远端均为 `3e9b584c383c0270386ca8fade6735e357dd0dc6`。

证据：[暂存清单](evidence/a1/staged.txt) · [推送输出](evidence/a1/push.txt) · [远端 SHA](evidence/a1/remote-sha.txt) · [GitHub 提交](https://github.com/YINXIA-LEARN/optical-switch-frontend/commit/3e9b584c383c0270386ca8fade6735e357dd0dc6)。
