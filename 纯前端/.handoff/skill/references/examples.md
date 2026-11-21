# 批次与窗口交接示例

以下是写法，不是实际派单；路径、ID、工具和颜色须按真实项目替换。

## 小修与下一阶段合批

T020 的功能已通过，但窄屏按钮遮挡标题。planner 将 F003 记 OPEN，影响局部布局、不阻塞制图；review=continue_with_followups。
下一批 T021 同时安排“修复遮挡、接入已接受插画、完成手机布局”。原存储/筛选逻辑没变，复用相应 run；新跑窄屏操作与图片加载检查，一次回报，F003 关闭前不得最终 accept。

若问题实际是保存丢数据，先阻塞依赖保存功能的集成；独立制图仍可继续。不能因用户说“边界问题”就忽略数据风险。

启动卡：
```text
项目：阅读工作台；角色：executor / W-ui
工作区：D:\阅读工作台
任务：T021/a1｜修复窄屏遮挡，并整合已验收插画
任务文件：.handoff/tasks/T021/task-a1.md
回报文件：.handoff/tasks/T021/report-a1.md
按项目 AGENTS.md 加载规则，完成本批次后回报。
```

## 两个窗口并行

W-ui / T021 写 src/Reader.tsx、src/reader.css；W-art / T022 写 public/assets/reading-v1.png。两者 report/evidence 分开，planner 单写 STATE。
W-ui 可先做布局与 F003，接图步骤依赖 T022 的指定成品及审美验收。W-art 交真 PNG、尺寸/哈希/来源及自检；有 tool 不等于已交付。待素材就绪，planner 转发同任务继续卡，W-ui 接入，不新建一份重复任务。

```text
项目：阅读工作台；角色：executor / W-ui
工作区：D:\阅读工作台
继续：T021/a1｜图片依赖已就绪，完成接入和受影响检查
任务：.handoff/tasks/T021/task-a1.md
检查点/回报：.handoff/tasks/T021/report-a1.md
已验收素材：见 T022/a1 的 review；其余规则按项目入口。
```

若两窗口都需改 shared.css，先调整归属：由 W-ui 写文件，另一个任务交约定参数/独立素材；不能声称任务标题不同就无冲突。

## 换窗口不重做

W-ui 已保存 checkpoint 并确认停止，W-ui2 接管 T021/a2；沿用 E-local 的工具命令和原检查 run，只有相关变更才重跑。task-a2 明确剩余图片整合，不让新窗口重新设计页面。

```text
项目：阅读工作台；角色：executor / W-ui2（接管）
工作区：D:\阅读工作台
任务：T021/a2｜继续插画整合；布局和窄屏修复已完成
任务：.handoff/tasks/T021/task-a2.md
接管输入：.handoff/tasks/T021/report-a1.md 的 checkpoint；旧窗口已停止
回报：.handoff/tasks/T021/report-a2.md
```

## 复用与补证

executor 的刷新测试已经比较 ID/内容且相关源码未变：planner 看结果与变更范围，引用原 run，不再开浏览器。
若仅打印 ID，没有前后比较：只补此断言。若换了 Chrome 版本：先判断是否影响该检查，必要时跑对应浏览器检查；无需重查 Node、图像生成等无关工具。
无实际 token/费用数据时记录 unknown；可记“本批次复用 3 项、重跑 1 项（布局变化）”，但这不是 token 节省比例。

## 视觉与图片规格仍要准确

“浅色阅读页清爽，深色不变”应落为保留主题作用域、字体/图标、目标视口、色板/留白方向、实际截图及主观判断者；局部间距留 executor 自主决定。
“温暖手绘插画”应给 asset_id、用途/构图、主体与禁止项、格式/尺寸/背景、候选额度、稳定输出路径。图片检查和页面集成分别有负责人，但可按上述依赖并行推进；不复制一大段规格到每张启动卡。
