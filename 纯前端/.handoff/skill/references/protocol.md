# 共享文件协议 v3

一个 planner 管任务板，多名 executor 可在互不冲突的范围内并行。角色不绑定模型。协议负责可追溯的人工交接，不提供自动调度、原子锁或后台通知。

## 启动卡

planner 输出可直接复制的短卡，而非只有“执行当前任务”，也不重复整份规格。路径以指定工作区为基准，涉及不同 checkout 时给该窗口实际根目录。

```text
项目：阅读工作台；角色：executor / 窗口 W-ui
工作区：D:\项目目录
任务：T021/a1｜修复窄屏工具栏，并接入已接受插画
任务文件：.handoff/tasks/T021/task-a1.md
回报文件：.handoff/tasks/T021/report-a1.md
按项目 AGENTS.md 加载交接规则，执行到本批次检查点。
```

接管卡另加一句 `接管：从 report-aN.md 的 checkpoint 继续；旧窗口已停止`，必须事实成立。planner 接管卡给“角色 planner、工作区、STATE、未决 review/下一决策”，不冒用 executor 任务。

回传示例：`阅读工作台 · T021/a1 · 窄屏修复+插画接入；ready_for_review；报告：……；未决：风格判断。`

任务/attempt/指派应与 STATE 一致；过期提示不能指向新工作。如果旧 attempt 已完成，返回已有报告；如果被新 attempt 取代，说明新指针但不以旧卡擅自开工。旧的一句话入口只在唯一指派时解析，多任务歧义时问 ID。

## 项目入口与文件

planner 一次性复制完整 skill 到 `.handoff/skill/` 并在 AGENTS.md 加路由；保留已有项目规则，不将全部流程复制到入口。宿主不读 AGENTS 时一次性配置加载入口，不声称所有宿主都能自动发现。

```markdown
## Agent 文件交接
规则入口：.handoff/skill/SKILL.md。
按启动卡的角色、任务 ID/attempt 和窗口定位 .handoff/STATE.md 对应行。
executor 只执行自己的 task 并写自己的 report/evidence；planner 维护任务板。
唯一当前任务时可用旧短提示；多任务时必须明确 ID。任务已完成不重复执行。
按 task 的范围/依赖与检查点工作；换窗口须先确认旧 writer 停止。
```

```text
.handoff/
  CONTEXT.md                 planner：短项目事实/决策/索引
  STATE.md                   planner：任务板、资源归属、待办
  ENV.md                     planner：宿主工具 profile；首次需要时建立
  VERIFICATION.md            planner：有效检查索引；首次需要时建立
  skill/                     已绑定版本；历史任务不覆盖
  briefs/                    按需的固定版本设计/图片规格
  tasks/T021/
    task-a1.md               planner：派出后不可变
    report-a1.md             executor：本窗口增量报告/checkpoint
    review-a1.md             planner：判断/待办/证据复用
    evidence/a1/             executor：该 attempt 的 run 与图片
```

小项目不用建空目录/空模板；ENV/验证索引仅在有实际内容时创建。成品留在业务/素材路径。CONTEXT 保持一屏左右，事实一次存放、引用而不重复；历史在 tasks 中按需读。UTF-8，时间含时区，相对路径以工作区为基准。快照与 brief 执行中不悄悄覆盖。

## STATE：多任务而非单指针

```markdown
protocol: 3
project_root: 实际路径
planner: 唯一任务板窗口标签/会话 ID
revision: 1
updated_at: 带时区时间

| task/attempt | 目标 | executor | status | writes/resources | depends_on/gate | task/report/review |
|---|---|---|---|---|---|---|
| T021/a1 | 窄屏修复+图片接入 | W-ui | dispatched | src/reader.*；E-local-ui | 接图步骤等 T022/a1 accept | 对应路径 |
| T022/a1 | 阅读插画 | W-art | dispatched | assets/reader-v1.png | none | 对应路径 |

## 未决项
| issue_id | 来源/未过条件 | 影响/严重性 | owner/task | 关闭证据/门槛 | status |
|---|---|---|---|---|---|
| F003 | T020/A2 窄屏按钮遮挡 | 局部；不阻塞制图 | W-ui/T021/a1 | 窄屏截图+操作检查，集成前 | OPEN |
```

实际文件/资源边界写 task，表里写简短范围。planner_status 不再是全局唯一当前状态；每行状态：dispatched / reviewing / accepted / continued / blocked / paused。running 等执行状态只在 report，避免多窗口写同一表。pending_change 可按任务追加；executor 在自然检查点核对自己的行，其他行更新不使本任务失效。

planner 分配写入权，不允许 executor 抢占。表不是锁：并行前须确认范围/资源无冲突；读依赖也要绑定稳定版本。旧窗口停止有确认后才复用它的写入范围，不能仅凭 mtime/等待时间释放。

## task：一个批次

```markdown
# T021 / attempt 1 · 目标短句
protocol: 3
kind: implementation / visual / image / mixed / discovery（选一）
project_root: 实际路径
executor: W-ui（优先真实会话 ID，否则唯一人工标签）
baseline: 相关版本/改动/哈希；不要全库重复清单
inputs: 最小文件索引、brief 版本、已接受素材/上轮 checkpoint
env_profile: E-local-ui 或 unknown
writes: 文件/目录 + 输出/服务归属
depends_on: 具体任务版本/条件；哪些步骤依赖
resume: 已完成、未完成、下一步；新任务可省略

## 目标与约束
结果；must/prefer/free；来源与不包含的工作。

## 批次步骤
1. 修复 F003；关闭标准引用原验收 ID。
2. 完成与素材无关的布局；可立即进行。
3. T022/a1 接受后接入固定版本；否则保存 checkpoint，不轮询。

## 验证计划
verification_owner: W-ui
new_or_affected: check ID、行为/断言、输入/环境、证据输出
reuse: check ID、原 run/基线与适用依据
integration_gate: 本批次检查点或最终集成检查；需要独立复核时预先注明
local_fix_budget: 有必要时给迭代/费用界限；默认正常局部自修
carry_in: F003；当轮关闭
defer_policy: 可建议延期的非阻塞项；不能自行变更 must
report: .handoff/tasks/T021/report-a1.md
evidence: .handoff/tasks/T021/evidence/a1/
```

已派 task 不改；新边界用新 attempt 或新 task。仅修复同目标/接管是新 attempt；混入下一阶段目标是新 task，引用原 issue。同一问题只绑定一个活跃接收任务，防止重复修复。

## report / review 与状态

report 用增量而非全模板重述：ID/attempt/执行者/时间、状态、改动与最终身份、检查 ID 与结果/run 引用、问题、checkpoint。结果状态 PASS / FAIL / UNKNOWN / NOT_RUN / REVIEW_REQUIRED（仅主观最终判断）。

| report status | 意义 |
|---|---|
| running | 当前执行中 |
| ready_for_review | 本批次客观必需项过；主观项可待判断 |
| completed_with_issues | 已有独立成果，存在明确未过项，建议合批；不是通过 |
| blocked / paused | 关键依赖/能力阻塞，或明确暂停 |

review 写实际审阅依据、每项结论、问题/转入任务、复用/新跑及原因，不复制报告。

| decision | STATE 与后续 |
|---|---|
| accept | accepted；本任务必需项关闭 |
| continue_with_followups | continued；保留未过项，指向接收批次；允许不依赖该问题的工作继续 |
| rework | 同任务新 attempt；仅受影响范围 |
| replan | 新目标/约束重新派单；旧结果保留 |

continue_with_followups 不等于最终 accept，未过的条件保持未过；待办不能因更换任务丢失。最终集成前核对所有相关必需 issue 已有关闭证据。用户要求选款时待判断，不推断用户已认可。

## 接管与迁移

窗口接管：原窗口保存 checkpoint → 确认停止写入 → planner 新 attempt 指定 owner/写入权 → 新窗口加载最小恢复集。不自动重跑有效检查，不重复环境探测。

v1/v2 正在执行则沿用旧任务/旧快照到检查点；没有执行者运行时，新派单使用 v3。旧单任务 STATE 转为表里一行，已确认的工具/证据从历史报告提炼引用，不重新探测。缺信息标 unknown，在实际用到时补。

升级项目入口只修改本协作路由，保留其他 AGENTS 规则；旧快照先归档，新 task 绑定新版本。历史 task/report/review 不改写。已结束的试验项目保留原样，不因升级全局 skill 自动迁移。
