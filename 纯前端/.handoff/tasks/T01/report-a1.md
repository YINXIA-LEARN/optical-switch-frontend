# T01/a1 · W-sim

状态：ready_for_review  
基线：模型与共享快照 v1，Windows 环境 E-win-optical。  
交付：`src/sim/index.mjs` 提供 `createSimulation/current/step`，`src/sim/cluster8.mjs` 默认导出两组各四机架的配置。源文件和测试 SHA-256 见运行证据。W-sim 已停止写入。

2026-11-21 17:09:05 +08:00，工作区根目录运行 `node --test tests/sim/simulation.test.mjs`，Node 24.18.0，退出码 0。以下均为本次新跑，见 [model-checks.txt](evidence/a1/model-checks.txt)。

| 检查 | 结果 |
|---|---|
| M1 | PASS。四台各四个端口，六条电边、每台三个对端，三种实际光配对，每轮 12 电 + 4 光。非法重复电端口和重复光配对会报错。 |
| M2 | PASS。固定随机序列覆盖全零、全活跃、1/100 两端点、光电同向并发及反向不对称。 |
| M3 | PASS。第 10/20/30 秒逐次切换并新增事件，旧光方向消失、电方向不变，早期事件仍保留原配对。 |
| M4 | PASS。8 台、12 电边、4 光对、32 个有向速率，B/C 光路跨组且与配置一致。 |

遗留：生产入口和 Dashboard 的组合行为由 W-app 的 I2/I3 检查。
