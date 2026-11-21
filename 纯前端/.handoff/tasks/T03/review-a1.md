# T03/a1 · 验收通过

decision: accept · W-plan · 2026-11-21

- I1 通过。对照[迁移记录](evidence/a1/I1-deployment.json)，当前 dist 三个文件的哈希一致，总计 35,647 字节。静态子路径加载三次 HTTP 200，无外部请求和运行错误。
- I2 通过。直接核对[前台记录](evidence/a1/I2-foreground.json)第 0～21 秒的 22 个快照，每帧 16 行与图上对应方向的速率、箭头一致，排序正确。采样间隔 995～1,060 毫秒。第 10、20 秒各替换四个光方向，电路集合恒定，事件与新策略同时出现。
- I3 通过。目检[桌面 C 策略](evidence/a1/desktop-tick-20.png)、[窄屏全页](evidence/a1/narrow-full.png)、[8 ToR 跨组 C 策略](evidence/a1/expanded-8-tor-strategy-c.png)，并参考[响应式与扩容记录](evidence/a1/I3-responsive-expansion.json)。窄屏保留可达的图表与事件。扩容页含两组机架、32 个方向，电线绕开 MEMS，跨组光线可追踪。

验收复用了 executor 的浏览器和构建结果，另对 8 项入口、配置、说明和集成测试文件核对 SHA-256。必需项均已关闭。
