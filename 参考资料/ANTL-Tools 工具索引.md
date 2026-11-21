# ANTL-Tools 工具索引

依据公开仓库 `master` 的提交 [58fa6cb](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2) 整理。以下功能来自源码与仓库文档，本次未在实验硬件上运行。

| 类别 | 工具 | 用途 | 来源 |
|---|---|---|---|
| 机架顶交换机 | `ovs.sh` | 安装并启动 DPDK 和 Open vSwitch，绑定网卡，管理网桥、端口、流表、接口 IP 和静态路由。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/tor-ovs/ovs.sh) |
| 机架顶交换机 | `flow.sh` | 清空指定网桥的现有流表，再按实验室四个机架顶交换机的拓扑写入 OpenFlow 1.3 转发规则。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/tor-ovs/flow.sh) |
| 主机网卡 | `setup-4nic-netns.sh` | 把四个物理网口分别放进四个 Linux 网络命名空间，各配一个 IP，使同一台主机上的网口相互隔离。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/nic-control/setup-4nic-netns.sh) |
| 主机网卡 | `setup-4nic-static-arp.sh` | 在每个命名空间写入另外三个网口的固定 IP–MAC 映射，供实验通信使用。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/nic-control/setup-4nic-static-arp.sh) |
| 光交换机 | `Polatis 网口与串口控制` | 两个入口分别通过 TCP 或串口发送 SCPI 指令，查询端口与光路状态，建立或断开连接。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2/ocs-sokect-control/polatis) |
| 光交换机 | `国产 16×16 OXC` | 通过 TCP 使用 OSW 协议查询或切换光路，支持批量调整端口连接。group.txt 给出三组端口映射示例。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2/ocs-sokect-control/chinese-1616-oxc) |
| 光交换机 | `Calient S-Series` | 此目录提供设备入门手册，当前版本仅含 PDF。 | [手册目录](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2/ocs-sokect-control/calient-s/docs) |
| 实验流量 | `APP.cc` | OMNeT++ 仿真应用模块，按均匀、机架内优先、洗牌三种模式生成流量，记录吞吐、时延和流完成时间。源码引用配套仿真工程中的报文定义。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/app/APP.cc) |
| 实验流量 | `APP.sh` | 在 Linux 实验主机上用 hping3 生成对应的测试流量，可选逐包或按流发送，以及长短流比例。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/app/APP.sh) |
| 模型部署 | `vllm-qwen3_6` | 启动和停止 Qwen3.6-35B-A3B 的 vLLM 服务，启动配置使用双卡，最大上下文为 200,000 token。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2/inference/Model-Config/vllm-qwen3_6) |
| 模型部署 | `vllm-qwen3_8` | 提供 Qwen3.8-27B 的启动脚本，覆盖双卡及四卡 FP8、单卡 NVFP4 和单卡 3Bit-GSQ。附双卡 FP8 吞吐测试报告。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2/inference/Model-Config/vllm-qwen3_8) |
| 终端对话 | `chat_terminal_stream.py` | 连接已有模型服务，自动读取模型名，在终端多轮流式对话，支持多行输入、历史管理和思考模式切换。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/inference/Streaming-conversation-script/chat_terminal_stream.py) |
| 对话测速 | `LLM-Speed-Chat` | 通过浏览器与 OpenAI 兼容接口多轮对话，查看提示词处理速度、解码速度、生成 token 数与该轮耗时。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/inference/LLM-Speed-Chat/README.md) |
| 服务监测 | `Inference-Performance-Display` | 采集运行中推理服务的 Prometheus 指标，查看请求并发、排队、吞吐、KV 缓存和延迟。支持多服务汇总、SQLite 历史查询、token 用量和费用估算。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/blob/58fa6cb65f00307f44804624527e98e504484dc2/inference/Inference-Performance-Display/README.md) |
| 应用服务 | `start_dify.sh / stop_dify.sh` | 通过 Docker Compose 启停已有 Dify 部署。启动时检查 API 容器和网页入口，停止时保留持久化数据卷。 | [仓库入口](https://github.com/Mango03111/ANTL-Tools/tree/58fa6cb65f00307f44804624527e98e504484dc2/agent/dify) |

