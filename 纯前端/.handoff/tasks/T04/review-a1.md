# T04/a1 · 验收通过

decision: accept · W-plan · 2026-11-21

**A1** 对照[用户原图](../../briefs/flow-motion-before.png)和[帧 1](evidence/a1/flow-frame-1.png)、[帧 3](evidence/a1/flow-frame-3.png)，原先的长亮带已消失，正反方向光点沿各自方向移动。同一缩放下，1391.94 单位的电路和 208 单位的光路上，光点直径均为 8.45 屏幕像素。[量测记录](evidence/a1/motion-checks.txt)

**A2** 11→91 Gbit/s 的刷新跨帧时保留光点，3/6 秒重新判活跃，10 秒换路。当前模拟及动画源文件与修复提交一致，复用[生产运行记录](evidence/a1/integration-checks.txt)。

**A3** [远端核对记录](evidence/a1/remote-sha.txt)与当前本地 HEAD、origin/main 跟踪引用一致，SHA 为 3e9b584c383c0270386ca8fade6735e357dd0dc6。F04 关闭。
