# Phase 1 · 模型技术审计

**2026-11-01 运行补充：** 下文初次审计时的连接限制现已解除。Rhino 8.23.25251.13001、Grasshopper同版本、Kangaroo2Component 2.5.3.0，Rhino单位确认Meters。独立文档11点实际求解与数值一致性检查通过，见 `data/runtime-verification.json`。默认 u=0.3104562345943198 m。材料/力单位校准、强度、索松弛、稳定性和屈曲仍未验证；下文初始静态报告保留以记录审计过程。

审计日期：2026-11-01。主证据为本目录原始 `tensegritydemo 3prism_2026.ghx`，未修改源模型。完整哈希、725 个对象、40 个 slider 见 [inventory](inventory.md) 与 [sliders](sliders.md)。解析 434 条普通连线，源端全部解析成功；输出端 GUID 已映射回所属组件，未把端口 GUID 错当组件 GUID。保留参数树、Mapping、表达式、持久值与优化器专用序列化数据于 `data/model-graph.json`。

## 验证边界

**static-confirmed**：XML 中的组件、参数、连线、保存设置。**runtime-unverified**：当前实际求解、单位、插件加载、几何逐点对齐、收敛和材料真实性。

Rhino 进程存在，但本轮 MCP `gh_get_document_info` 无法连接 `127.0.0.1:1999`。因此没有重新打开、求解或改变当前 GH 文档；没有新实测样本。GHX 不保存普通组件的完整求解缓存。历史会话的实测不能替代此版本验证。原任务书提及 `(1).gh`，当前目录实际提供的是无 `(1)` 的 `.gh`，未将其视为与 GHX 等价。

文件声明库版本：Grasshopper 8.23.25251.13001；Karamba3D 3.1.60921（assembly 3.1.60921.0）；Opossum Proto_A 3.2.0.0、Proto_B 3.0.1.0；Bifocals 0.5.0.0、GhPython 8.23。这是序列化依赖，不是当前已安装/加载版本。Kangaroo 与 Rhino 的精确运行版本待读取。

## 设计变量与原始几何

完整对应表：[parameter_mapping.md](parameter_mapping.md)。文件当前值：下/上半径均 0.5，上层标高 1.2，下层 0，旋转角 187.193°，静长缩短率 0.861，单个上节点载荷 P=0.571。只有角度、P 注册到两个优化器。

底层 Polygon `7fa4babb…` 和顶层 Polygon `76fd7e83…` 各三边，分别以两个 XY Plane 为基准；上层 Rotate `836ac221…` 的 Angle 明确 `UseDegrees=true`。高度来自 Unit Z → XY Plane Origin。两组三等分节点经 List Item 输出 i、i+1、i+2 连接。

以底节点 B0..B2、顶节点 T0..T2 编号：杆连接 Bi–Ti；侧索 B1–T0、B2–T1、B0–T2；上下各三条三角形边，共 3 杆 + 9 索。索经 Sub Curve/Divide Domain 每条分成 10 段，进入 Kangaroo 的是 90 个索段。网页复用这一连接拓扑和生成参数，初始 polygon 接缝朝向及 Rhino 顺序需逐点比对，页面标注未求解几何，不声称已恢复平衡态。

## 结构计算与位移

两条独立 ZombieSolver：Unloaded `822f7ba1…`，Loaded `b0b555e1…`。分别具有自己的 Length/Anchor/Show 实例，Loaded 另有 Load；共享原始几何与静长参数，而不是共享可变 Goal 实例。Merge 输入逐项 Flatten，Show upper 3 nodes 放最后；List Item 的 -3,-2,-1 追踪上节点。

```
原始 3 杆 / 90 索段 / 底部 3 锚点
 ├─ 无外载 Goal + Show → Zombie Unloaded → 上节点 xU[i]
 └─ 同几何/静长 Goal + 三点 Load + Show → Zombie Loaded → 上节点 xL[i]
Distance → Bounds → Domain.End → u = max_i ||xL[i] - xU[i]||₂
```

这是 **三个上节点的三维位移模最大值**，不是全部节点最大位移，也不是单独 Z 位移；参考态是无外载找形结果，不是原始绘制几何。Unit Z 输入保存 `InternalExpression=-x`，所以三个上节点分别加载 (0,0,−P)，总量3P；导出脚本也直接读取力矢量，不能把 P 擅自标 N。

两 solver 的实际连入上限来自 panel 10000（覆盖内部持久值 50000），threshold=1e-16（覆盖默认 1e-10），合并容差=1e-6。当前判断 `I_unloaded < 10000 AND I_loaded < 10000` 仅是迭代上限检查，未证明静力平衡、自应力稳定、刚度正定或数值误差足够小。

索静长链 `bf11403c…`：L0=(1-p)Linitial；p=0.861 意味 L0=0.139 Linitial。它不是 0.861 N 预拉力。Loaded 和 Unloaded 的索、杆 Length Strength 都存为 10，Anchor Strength=10000，Load Weighting=1。没有证据表明这组 Strength 已由 3mm 多股钢丝绳有效 EA/L 校准。Length(Line) 不自动证明索只受拉，缺少松弛检查。密度、绳构造、有效面积/模量、杆截面与屈曲判据尚未形成可追溯的共同材料模型，质量与强度输出保留 null。

## Fitness 与约束（按实际端口，而非标签）

位移门 `0431ab32…` 输出 **Smaller than** 接到 `015bfb06…`，因此当前为严格小于：

`C = (u < 0.431399) ∧ (IU < 10000) ∧ (IL < 10000)`。

Opossum `2f4e1a80…` 的 OpossumData 注册了 angle、P，两个模拟器 IU/IL 和两个目标：

- `81ce7a47…`：C 成立时 f1=-P，否则 1,000,000。
- `c14f7be4…`：C 成立时 f2=u，否则 1,000,000。

预期两项最小化，对应最大荷载、最小位移。保存的 `OptimizationType=0` 的枚举含义须运行时确认；连线及负号表达式可静态核对。旧单目标位移和最大载荷 Number 仍存在，但不是此次注册的两个目标。

Galapagos `da7078fa…` 注册相同两个基因，Fitness 指向 `bd014091…`：

`F = 0.5*(1-P/1.0) + 0.5*(u/0.431399)`，C 不成立时 F=1e6。

其 Base64 XML 已解码至 `galapagos-settings.xml`，Target=-Infinity（最小化），Solver 数字值=1；不在未核实枚举时据此断言 GA/SA。权重是设计偏好，不是物理常数。零载荷的近零位移可能是有效边界解，与“未求解误当零”必须区分。

## Opossum 历史、算法与 Karamba

文件包含 200 条 ParameterList/ObjectiveList；后者可解码为两个 little-endian float64。导出到 `data/runs/opossum-archive.*`，标记 archived-unverified。记录有双 1e6 惩罚；提案参数有六位小数，而 slider 三位，部分 f1 对应量化后的 P，不能直接拿提案坐标当精确实测输入。缺少每点几何、迭代数、当时材料/其他 slider 配置和版本证明，因此不灌入 validated 样本库，也不由它们生成物理 Pareto 认证。

停止条件 200/20/3600 是任务书提供的截图信息，未在当前运行窗口验证；保存目标数据不能推出当前算法选项。不能将 Opossum 等同 GA。精确算法、种子与运行设置待 Rhino 连接后读取。

文件还有独立第三个 Zombie `d5be2ddb…`（Tolerance=1e-4、内部 MaxIterations=50000）和 Bouncy/旧 Karamba 流程。Karamba 导入/截面优化/分析不在两个注册目标的上游；其质量、轴力、屈曲输出不能被默认为当前 Kangaroo 目标的验证。当前 GHX 与早先会话已不同，需单独统一参考态、荷载、预应力、支座和几何来源。

## 仍需运行验证的验收项

1. 打开本 GHX，核对所有加载插件、Rhino 米制与材料/力单位；不要将旧缓存当新结果。
2. 零载荷、默认载荷、极限角度、p=0/接近1、上下层重合等边界逐点求解；退化、缺失、非有限、迭代上限必须判无效。
3. 改变量后检查数据树/节点顺序是否仍稳定；三节点匹配与索杆端点不因排序改变。
4. 检查索松弛、杆屈曲、材料强度、支座漂移和自应力可行性；全部仍 unverified。slider 范围不等于可行域。
5. 至少 10 条新导出记录、其中至少 5 条在网页逐项比对。此轮新实测数=0。
