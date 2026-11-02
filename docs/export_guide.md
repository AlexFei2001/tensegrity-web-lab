# Phase 2 · 导出与验证

导出器 `grasshopper/export_samples.py` 可从 Rhino 8 Python 3 或 RhinoMCP IronPython 运行。2026-11-01 已通过 RhinoMCP 对11个点完成实机求解，结果在 `data/samples.json`。不要从正在求解的 GH Python 电池中调用 `NewSolution`。历史 Opossum 记录仍单独保存。

本次实机修复：GH_DocumentIO 载入的私有文档默认为 Enabled=false，必须显式启用才能求解；消除了 io 模块与局部 GH_DocumentIO 变量同名，以及 IronPython 的编码/时间/目录接口兼容问题。

1. 安装/加载原模型插件，在 Rhino 中打开相应 3dm，确认实际长度单位为米，并核对模型几何尺寸。打开 GHX，检查缺插件、红色错误。需要实时协助时运行 `mcpstart`。
2. 先备份工作文档。运行 `npm run audit` 更新哈希和静态映射；检查 `docs/model_audit.md` 的物理待办。
3. 编辑 `data/export-plan.json`：完整变量数组、实验 ID、种子和显式设计点。默认 10 个角度，170° 至197°，每3°一步。第一次可仅保留一个点。maxSamples≤100、单点软时间预算≤120s。
4. 在 Rhino `ScriptEditor` 选择 Python 3 打开脚本并运行。脚本逐点载入私有 GH 文档，仅启用目标所需祖先组件；不切换当前画布、不保存源文档。每个样本后 Dispose，下一点重新载入，以隔离 Goal 状态。
5. 查看 `data/exports/时间戳/samples.json`、CSV、错误 run.log。迭代上限、有限值、三上节点距离和原始 gate 交叉检查；完整记录参数实际量化值、93 个构件段、节点、外力矢量、版本和耗时。没有获得的质量、轴力、屈曲、预拉力保留 null。
6. 校对至少五个点的原始/变形坐标和位移后，运行 `node tools/import-samples.mjs data/exports/时间戳/samples.json`。导入会验证 schema、源哈希、端点索引、有限数值和样本冲突；失败记录可以保留但不能成为有效 Fitness。重新构建网页。

本轮11条记录（默认187.193°及170°–197°每3°）全部通过上节点坐标重算位移、节点/构件索引、外力方向、迭代数、schema与完整参数精确匹配检查。默认 u=0.3104562345943198 m。`data/runtime-plan.json` 保存实际采样计划；`data/runtime-verification.json` 保存版本和检查范围。运行 `node tools/record-verification.mjs` 更新数值验证元数据。

`validated=true` 仅表示**此版本 GH 数值输出通过导出检查**，不表示材料、稳定性或结构安全验证。力单位尚未校准，保持 uncalibrated。`feasible` 是原模型的位移与迭代约束，不包括强度/屈曲/松弛。缺少这些检查必须在课堂展示中保留说明。

限制：10000 次迭代 cap 防止 Zombie 无限制运行；wall-clock 是同步 NewSolution 返回后检查的软预算，不能中断卡死的第三方 native 插件。真正硬超时需要专用 Rhino worker 进程及外部 watchdog，尚未实施。不能以线程强杀方式终止当前用户 Rhino。若插件挂起，应在副本/独立 Rhino 会话中手动终止，已有逐点 JSON 不丢失。

参考：[GH_Document.NewSolution](https://developer.rhino3d.com/api/grasshopper/html/M_Grasshopper_Kernel_GH_Document_NewSolution_1.htm)、[GH_DocumentIO.Open](https://developer.rhino3d.com/api/grasshopper/html/Methods_T_Grasshopper_Kernel_GH_DocumentIO.htm)。已查官方 API，但尚未替代实机验证。
