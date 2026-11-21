# T05/a1 · 本地交付验收通过

decision: accept · W-plan · 2026-11-21

[清单](evidence/a1/source-sha256.txt)内 13 个文件的 SHA-256 与当前工作树一致，覆盖分析源码、组件、测试及三份生产文件。

- **B1** 按累计量计算的光/电占比为 60%/40%，两段的光占比分别为 80%、20%。最后一秒的收发拆分、零分母和裁剪边界均有对应断言。[聚合检查](evidence/a1/aggregation.txt)
- **B2** 两条折线、切换标记和 ToR 末秒读数同卡显示；每推进一秒，切换前后段长从 30/30 变为 29/31、28/32，始终合计 60 秒。[桌面实图](evidence/a1/desktop-minute.png) · [浏览器记录](evidence/a1/browser-checks.txt)
- **B3** 每小时采用段内 50 分钟，三段热点为 0→1、2→0、0→3，共用同一色标。策略 B 的 2→0 占 54.3%，反向为 0%，方向与标注可辨。[矩阵实图](evidence/a1/desktop-matrix-b.png)
- **B4** 已目检[窄屏分钟卡](evidence/a1/narrow-minute.png)、[窄屏矩阵](evidence/a1/narrow-matrix.png)及[8 ToR 矩阵](evidence/a1/expanded-matrix.png)。窄屏可读，8 列可局部横滑。子路径构建加载与实时区独立更新见[生产记录](evidence/a1/browser.json)。

本轮复用 executor 的浏览器运行结果。T05 为本地交付。
