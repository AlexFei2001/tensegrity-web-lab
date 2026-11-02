# 当前Grasshopper的首次失稳分析

条件：当前打开的GHX独立快照，角度185.748°，半径0.5/0.5 m，上层标高1.2 m，下层0，静长缩短率0.861。90索段、3杆、3有限刚度锚点、3个相同竖向荷载。索段及杆Spring.Stiffness=10，Anchor.Strength=10000。P是单点相对模型荷载，合力3P。

## 结果

- 对称支路首次出现两个侧向零刚度模态：P≈0.563476，现有三上节点三维最大位移u≈0.302587 m，平均竖向位移≈0.239986 m。
- 原始几何冷启动下，可见翻转在P=0.6720–0.67205；u从0.509466跳至2.552186 m。
- 对称平衡路径的荷载极限点约P=0.67399，晚于首次侧向失稳。完美对称输入能暂时停留在不稳定对称支路，说明“收敛”不是“稳定”。

精度解释：临界值报告至约4位小数。内部二分更精细不等于实物预测精度；有限差分、原生求解容差、模型理想化与未标定材料均限制结论。此处不是材料破坏、杆件弯曲屈曲或安全使用位移。

## 方法

1. `grasshopper/scan_instability.py`：在每个私有GH文档中设置P，读取原始位移与完整Goals，不通过0.431399筛选；每点重新计算，保留“冷启动”标签。
2. 对作者Spring/Anchor/Unary公式重建势能及残差。GH结果的力残差约1e−7；被翻转形态也是平衡态，不直接标成不收敛。
3. 所有90索段均处于受拉状态，9条链内共线。每链的等效静长为各段静长之和，等效刚度为1/Σ(1/k_i)。保持原参数，静力凝聚至6端节点18自由度；杆与锚点保留。
4. 以三个上节点平均标高为单一位移控制量，保持三个等值荷载模式，并把P作为未知求解。没有把三个节点的竖向位移强行锁成相等。
5. 沿支路按高度0.002 m推进，计算18自由度全切线刚度特征值，随后在首次符号变化处二分。切线包含材料项和几何项，允许原Length目标受压；三个有限锚点进入能量，未悄悄改为绝对支座。
6. 用完整87节点261自由度切线矩阵的内部节点Schur补核对，最小特征值符号一致。内部索节点刚度正定，因此该凝聚保留稳定性惯性信息。
7. 用原生Kangaroo.PhysicalSystem、同一93个弹簧/锚点/死荷载，分别施加±0.1 mm模态扰动。P=0.55时衰减到约1.1e−6 m；P=0.58时离开原形态约2.298 m，末态残差约3e−13。迭代次数不是物理时间。

验证：解析刚度对中心有限差分的最大条目误差2.69e−7（最大对角量级1e4），特征对残差1.26e−11；原生GH与凝聚模型在同载荷的端节点位置一致至微米量级。5项新增数值测试通过；全项目34项测试通过。

## 复现

原生GH执行需要先连接Rhino并调用脚本入口：`scan_instability.execute_batch(loads, tag)`；当前快照位置由 `data/stability/latest_snapshot.json` 指定。分析脚本：

```powershell
node tools/analyze-instability.mjs
node tools/refine-instability.mjs
node tools/validate-stability.mjs
# 在Rhino执行grasshopper/check_perturbations.py的execute(300000)
node tools/report-instability.mjs
node --test tests/stability.test.mjs
```

图文报告 `data/stability/report.html` 可离线打开，包含3张Vega生成SVG。CSV记录荷载—位移、割线Δu/ΔP和支路刚度。跨跳跃段的割线不是光滑导数，不能直接拿其峰值当首次失稳判据。

机器学习后续应分开标注“首次失稳”和“冷启动可见翻转”，在多角度/预张力/几何/刚度比样本上训练与独立验证；这次未训练代理模型。

公开目标公式：[Spring](https://github.com/Dan-Piker/K2Goals/blob/master/Spring.cs)、[Anchor](https://github.com/Dan-Piker/K2Goals/blob/master/Anchor.cs)、[Unary](https://github.com/Dan-Piker/K2Goals/blob/master/Unary.cs)。分析沿用当前Goal实例读取的参数，没有重建无关的示意结构。
