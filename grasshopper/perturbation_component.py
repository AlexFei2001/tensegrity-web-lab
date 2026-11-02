# -*- coding: utf-8 -*-
# Installer embeds perturbation_core.py immediately above this wrapper.
# Inputs: V,Cables,Struts,Anchors,Loads,I,Run,Amplitude_mm,Steps
# Outputs: Report,LambdaMin,GainMinus,GainPlus,Reference,Initial,Minus,Plus,Chart,Trace
import scriptcontext as sc
from Rhino.Geometry import Point3d,Line,Polyline
from Grasshopper.Kernel import GH_RuntimeMessageLevel
Report='Set Run=True to compute. Run=False pauses testing; change inputs then enable Run again.'
LambdaMin=[];GainMinus=[];GainPlus=[]
Reference=[];Initial=[];Minus=[];Plus=[];Chart=[];Trace=[]
try:
    system=snapshot(V,Cables,Struts,Anchors,Loads)
    if int(I)>=10000:raise ValueError('Original Zombie reached its iteration limit')
    amplitude=float(Amplitude_mm)*.001
    key=('tensegrity-perturbation-v1',str(ghenv.Component.InstanceGuid))
    signature=repr((system,amplitude,int(Steps)))
    cached=sc.sticky.get(key)
    if bool(Run) and (cached is None or cached[0]!=signature):
        cached=(signature,run_experiment(system,amplitude,int(Steps)))
        sc.sticky[key]=cached
    if cached is not None and cached[0]==signature:
        result=cached[1];LambdaMin=result['lambdaMin'];GainMinus,GainPlus=result['ratios']
        def members(positions):
            return [Line(Point3d(*positions[g['nodes'][0]]),Point3d(*positions[g['nodes'][1]])) for g in system['springs']]
        Reference=members(system['positions'])
        Initial=members([[p[j]+amplitude*v[j] for j in range(3)] for p,v in zip(system['positions'],result['mode'])])
        Minus=members(result['positions'][1]);Plus=members(result['positions'][2])
        Trace=['control_iterations,minus_iterations,plus_iterations,control_gain,minus_gain,plus_gain,relative_minus,relative_plus']+['%d,%d,%d,%.9g,%.9g,%.9g,%.9g,%.9g'%(t['iterationCounts'][0],t['iterationCounts'][1],t['iterationCounts'][2],t['control'],t['minus'],t['plus'],t['relativeMinus'],t['relativePlus']) for t in result['trace']]
        last=max(1,max(result['iterations']))
        # Separate XY plot beside the model: width=2 m, y=log10(amplification).
        for index,name in enumerate(['control','minus','plus']):
            Chart.append(Polyline([Point3d(2.+2.*t['iterationCounts'][index]/last,math.log10(max(1e-8,t[name])),0.) for t in result['trace']]).ToNurbsCurve())
        Chart.append(Line(Point3d(2,0,0),Point3d(4,0,0)).ToNurbsCurve())
        Report=('小扰动试验 / Perturbation test\n%s\n%s\nlambda_min = %.9g\nAmplitude = %.6g mm (each sign)\nGain (- / +) = %.6g / %.6g\nIterations = %s\nInitial residual = %.3g\nFinal residuals (control / - / +) = %s\nControl drift = %.6g m\nElapsed = %.2f s\n\nGain = maximum corner distance from ORIGINAL equilibrium / initial amplitude.\nChart: x=iteration fraction; y=log10(gain); horizontal line=gain 1.\nThe unperturbed control can also leave an unstable equilibrium due to numerical noise.\nTrace includes distance from control; coincident final states do not imply stability.\nFinite perturbation response is not a proof of global stability.\nThis check assumes this model\'s straight taut cables, axial springs and finite anchors.\nThe plotted evolution is solver iteration, not physical time.')%(result['response'],result['tangent'],LambdaMin,float(Amplitude_mm),GainMinus,GainPlus,result['iterations'],result['initialResidual'],', '.join('%.3g'%r for r in result['residuals']),result['controlDrift'],result['seconds'])
        ghenv.Component.Message=result['response'].split(' / ')[0]
    else:
        Report='尚未计算当前输入。Set Run=True to compute the CURRENT model; previous geometry/results are hidden.'
        ghenv.Component.Message='READY / 待运行'
except Exception as error:
    Report='试验未运行 / Check failed: '+str(error)
    ghenv.Component.AddRuntimeMessage(GH_RuntimeMessageLevel.Warning,Report)
    ghenv.Component.Message='CHECK INPUT'
