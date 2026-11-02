import fs from 'node:fs';
import * as vega from 'vega';
import {csv} from '../web/src/model.js';
const root=new URL('../data/stability/',import.meta.url),read=file=>JSON.parse(fs.readFileSync(new URL(file,root)));
const result=read('critical-result.json'),continuation=read('continuation.json'),perturb=read('native-perturbations.json');
const sampled=['coarse.json','fine.json','verification.json'].flatMap(file=>read(file).samples).filter(r=>r.converged).sort((a,b)=>a.P-b.P);
const unique=[...new Map(sampled.map(s=>[s.P,s])).values()].sort((a,b)=>a.P-b.P);
const differences=unique.map((r,i)=>({P:r.P,totalLoad:3*r.P,u:r.u,verticalDisplacement:r.meanVerticalDisplacement,meanZ:r.meanZ,Iloaded:r.Iloaded,residualMax:r.residualMax,deltaP:i?r.P-unique[i-1].P:null,deltaU:i?r.u-unique[i-1].u:null,secantDuDP:i?(r.u-unique[i-1].u)/(r.P-unique[i-1].P):null,branchJump:i?Math.abs(r.u-unique[i-1].u)>1:false}));
fs.writeFileSync(new URL('load-displacement.csv',root),csv(differences));
fs.writeFileSync(new URL('equilibrium-path.csv',root),csv(continuation.points.map(p=>({P:p.P,u:p.u,verticalDisplacement:p.verticalDisplacement,lambdaMin:p.lambdaMin,minCableForce:p.minCableForce,residual:p.residual}))));
const snapPair=differences.findIndex(p=>p.branchJump);result.jumpBracketFromGH={before:differences[snapPair-1],after:differences[snapPair]};
result.nativePerturbationChecks=perturb.map(p=>({P:p.P,sign:p.sign,initialAmplitude:p.initialAmplitude,finalDeviation:p.maxCornerDeviation,residualMax:p.residualMax,iterations:p.iterations}));
fs.writeFileSync(new URL('critical-result.json',root),JSON.stringify(result,null,2));
async function plot(file,title,rows,xfield,yfield,xlabel,ylabel,criticalPoint,zeroLine=false){
 const spec={$schema:'https://vega.github.io/schema/vega/v6.json',width:760,height:255,padding:{left:85,right:30,top:45,bottom:55},background:'white',title:{text:title,font:'Segoe UI',fontSize:17,anchor:'start'},
 data:[{name:'rows',values:rows},{name:'critical',values:[criticalPoint]}],
 scales:[{name:'x',type:'linear',domain:{data:'rows',field:xfield},range:'width',zero:false,nice:true},{name:'y',type:'linear',domain:{data:'rows',field:yfield},range:'height',zero:true,nice:true}],
 axes:[{orient:'bottom',scale:'x',title:xlabel,grid:false,labelFont:'Segoe UI',titleFont:'Segoe UI',labelFontSize:12,titleFontSize:13},{orient:'left',scale:'y',title:ylabel,grid:true,gridColor:'#e3e9e1',labelFont:'Segoe UI',titleFont:'Segoe UI',labelFontSize:12,titleFontSize:13}],
 marks:[{type:'line',from:{data:'rows'},encode:{update:{x:{scale:'x',field:xfield},y:{scale:'y',field:yfield},stroke:{value:'#537c66'},strokeWidth:{value:2}}}},
 {type:'rule',from:{data:'critical'},encode:{update:{x:{scale:'x',field:xfield},y:{value:0},y2:{signal:'height'},stroke:{value:'#b15e39'},strokeDash:{value:[6,4]}}}},
 {type:'symbol',from:{data:'critical'},encode:{update:{x:{scale:'x',field:xfield},y:{scale:'y',field:yfield},size:{value:95},fill:{value:'#b15e39'}}}},
 ...(zeroLine?[{type:'rule',encode:{update:{y:{scale:'y',value:0},x:{value:0},x2:{signal:'width'},stroke:{value:'#9c5140'},strokeDash:{value:[3,3]}}}}]:[])]};
 const view=new vega.View(vega.parse(spec),{renderer:'none'});const svg=await view.toSVG();view.finalize();fs.writeFileSync(new URL(file,root),svg);return svg;
}
const critical=result.critical;
const response=await plot('gh-response.svg','1. Fresh-start GH solves: visible jump occurs later',differences,'P','u','Load per upper node P (uncalibrated model units)','Maximum upper-node displacement u (m)',{P:critical.P,u:critical.u});
const stiffness=await plot('tangent-stability.svg','2. First loss of stability: minimum tangent eigenvalue crosses zero',continuation.points,'P','lambdaMin','Load per upper node P (uncalibrated model units)','Minimum tangent eigenvalue (model stiffness units)',{P:critical.P,lambdaMin:0},true);
const path=await plot('equilibrium-path.svg','3. Symmetric equilibrium path continues beyond its first instability',continuation.points,'u','P','Maximum upper-node displacement u (m)','Load per upper node P (uncalibrated model units)',{u:critical.u,P:critical.P});
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>张拉整体失稳诊断</title><style>body{font:16px/1.8 'Segoe UI','Microsoft YaHei',sans-serif;background:#f3f5ee;color:#253f35;max-width:1050px;margin:40px auto;padding:0 20px}section{background:white;border:1px solid #d4dfcf;padding:25px;margin:22px 0;border-radius:10px}svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;border-bottom:1px solid #d4dfcf;text-align:left}strong{color:#924a2c}code{font-size:13px}a{color:#34745b}</style>
<h1>当前 GH 模型的第一次失稳诊断</h1><p>角度185.748°，上下半径0.5 m，上层标高1.2 m，静长缩短率p=0.861。索段及杆件Strength=10，Anchor Strength=10000，三个上节点各承受−P方向荷载。数据来自当前打开模型的独立快照，原画布输入未修改。</p>
<section><h2>两个不同的事件</h2><table><tr><th>事件</th><th>单点荷载 P</th><th>最大上节点位移 u</th></tr><tr><td>对称平衡支路首先失去侧向稳定</td><td><strong>约${critical.P.toFixed(4)}</strong></td><td><strong>约${critical.u.toFixed(4)} m</strong></td></tr><tr><td>从原始几何重新求解时出现明显翻转</td><td>${differences[snapPair-1].P}–${differences[snapPair].P}</td><td>约${differences[snapPair-1].u.toFixed(4)} → ${differences[snapPair].u.toFixed(4)} m</td></tr></table><p>首次失稳处总荷载3P≈${critical.totalLoad.toFixed(4)}（模型相对单位）；平均竖向位移约${critical.verticalDisplacement.toFixed(4)} m。u 是三维位移模，不能与平均竖向位移混用。</p><p><strong>这些是当前弹簧模型的数值结果，不是3 mm钢丝绳实物的破坏承载力。</strong>尚未校准材料EA、强度、杆件弯曲屈曲、接触或破断；此处研究整体几何失稳。</p></section>
<section>${response}<p>曲线突变准确指出了可见跳跃区间，但没有显示更早的侧向失稳。跨跳变段的Δu/ΔP是采样割线，不是普通光滑导数；其大小会随采样步长改变。</p></section>
<section>${stiffness}<p>从无载平衡态沿平均上层标高进行位移控制，保持等值三点荷载模式并求解未知P；对6个端节点的18自由度切线刚度求特征值。最小两个特征值在P≈0.5635先后接近零，之后为负，表现为侧向/倾斜失稳。完美对称的原始输入可能仍停留在不稳定的对称平衡态。</p></section>
<section>${path}<p>对称支路的荷载峰值约P=${continuation.peak.P.toFixed(4)}，发生在首次侧向失稳之后。因此仅寻找荷载峰值或位移突变，不能代替全自由度稳定性判据。</p></section>
<section><h2>交叉验证</h2><ul><li>所有原始GH采样同时检查迭代数和力平衡残差，未把0.431399 m当作终止条件。</li><li>90个索段全部受拉，链内近似共线，按串联刚度精确静力凝聚；三根杆和有限刚度锚点保留。完整87节点刚度矩阵的Schur补与18自由度模型给出一致的特征值正负号。</li><li>解析切线刚度与中心有限差分最大条目误差约${result.verification.maxHessianFiniteDifferenceError.toExponential(2)}；特征对残差约${result.verification.eigenResidual.toExponential(2)}。</li><li>原生Kangaroo从同一平衡态施加±0.1 mm模态扰动：P=0.55时扰动衰减至约0.0011 mm；P=0.58时偏离原支路约2.298 m。末态力残差约1e−13。每次使用同一93个弹簧、3锚点与3个荷载，不改变静长。</li><li>冷启动可见跳跃阈值依赖初始化与动态松弛过程，不能直接称为数学极限点。首次失稳约0.3026 m也不是规范允许位移。</li></ul></section>
<section><h2>机器学习可以怎样用</h2><p>先以多组旋转角、预张力、刚度比和几何参数生成这样的稳定性标签，再学习预测Pcrit与ucrit，并用独立工况验证误差。应分别标注“首次失稳”和“可见翻转”，不可将两者混为一个训练目标。单个角度的跳变数据不需要先用机器学习才能定位。</p><h3>文件与复现</h3><p><code>coarse/fine/verification.json</code>：GH采样；<code>continuation.json</code>：位移控制支路；<code>critical-result.json</code>：关键数值；<code>full-system-check.json</code>：完整刚度核对；<code>native-perturbations.json</code>：原生扰动试验；两份CSV用于绘图和验收。源脚本位于grasshopper和tools目录。</p><h3>原始目标公式</h3><p>按作者公开实现复核：<a href="https://github.com/Dan-Piker/K2Goals/blob/master/Spring.cs">Spring</a>、<a href="https://github.com/Dan-Piker/K2Goals/blob/master/Anchor.cs">Anchor</a>、<a href="https://github.com/Dan-Piker/K2Goals/blob/master/Unary.cs">Unary</a>。总势能为各弹簧的½k(l−L₀)²、锚点二次能量与死荷载势能之和。</p></section></html>`;
fs.writeFileSync(new URL('report.html',root),html);console.log('Wrote report.html, three Vega SVG figures, and two CSV tables.');
