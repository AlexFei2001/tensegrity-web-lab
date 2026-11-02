# -*- coding: utf-8 -*-
"""Run in Rhino 8 ScriptEditor (Python 3) or RhinoMCP (IronPython 2.7).
Fresh private GH document per point; never edits the active canvas or source file.
Runtime-tested via RhinoMCP on 2026-11-01. See docs/export_guide.md.
"""
from __future__ import unicode_literals
import os, json, time, math, hashlib, traceback, io
import clr
clr.AddReference('Grasshopper')
import Grasshopper as GH
import Rhino
from System import Guid, Decimal
clock = getattr(time, 'monotonic', time.time)
finite = lambda x: not (math.isnan(x) or math.isinf(x))
def mkdir(path):
    if not os.path.isdir(path): os.makedirs(path)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'tensegritydemo 3prism_2026.ghx')
PLAN = os.path.join(ROOT, 'data', 'export-plan.json')
OUT = os.path.join(ROOT, 'data', 'exports')
IDS = dict(unloaded='822f7ba1-3043-4de9-accb-389d0c5276b9', loaded='b0b555e1-939e-4393-9097-2a343da045dc',
    upperU='50d583c5-ae08-44f9-8136-2789dfc728b6', upperL='1582b2fb-1dd2-4c73-a737-009fff8416dd',
    displacement='914f89aa-ac78-4795-947e-60319ae514f5', cable='64d77812-4e4d-4784-b8f0-c59da0569f5f',
    strut='c691ae80-1463-4109-b07e-69269adfb2c2', load='82b2f35d-975a-47c2-ad1f-f09dcaa828cc',
    gate='015bfb06-58db-487d-9384-fc265e9f11bc', limit='a9b2f664-1dbf-439e-a8e7-ee4fc9563f30',
    maxIter='8c382031-8b30-42af-b30e-52c5d7a86dfe')

def obj(doc, id):
    o = doc.FindObject(Guid(id), False)
    if o is None: raise ValueError('Missing component ' + id)
    return o

def values(o, port=0):
    p = o.Params.Output[port] if hasattr(o, 'Params') else o
    return [v.ScriptVariable() if v is not None else None for v in p.VolatileData.AllData(False)]

def scalar(o, port=0):
    v = values(o, port)
    if len(v) != 1 or v[0] is None: raise ValueError('Expected one result: ' + str(o.NickName))
    return v[0]

def point(p):
    r = [float(p.X), float(p.Y), float(p.Z)]
    if not all(finite(x) for x in r): raise ValueError('Nonfinite coordinate')
    return r

def endpoints(g):
    if isinstance(g, Rhino.Geometry.Line): return [point(g.From), point(g.To)]
    if isinstance(g, Rhino.Geometry.Curve) and g.IsLinear(1e-8): return [point(g.PointAtStart), point(g.PointAtEnd)]
    raise ValueError('Expected straight member geometry')

def dist(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))

def geometry(initial, deformed, nc):
    if len(initial) != len(deformed): raise ValueError('Changed member count')
    nodes, members = [], []
    for k,(a,b) in enumerate(zip(initial,deformed)):
        if dist(*endpoints(a)) < 1e-7 or dist(*endpoints(b)) < 1e-7:
            raise ValueError('Degenerate member length')
        ends=[]
        for p,q in zip(endpoints(a), endpoints(b)):
            found=next((n for n in nodes if dist(n['position'],p)<1e-7),None)
            if found is None:
                found=dict(id=len(nodes),position=p,deformedPosition=q); nodes.append(found)
            elif dist(found['deformedPosition'],q)>1e-5: raise ValueError('Inconsistent solved shared node')
            ends.append(found['id'])
        members.append(dict(id=('C' if k<nc else 'S')+str(k),kind='cable' if k<nc else 'strut',nodes=ends,
            area_m2=None,density_kg_m3=None,axialForce_N=None))
    return dict(nodes=nodes,members=members)

def ancestors(roots):
    seen={}
    def visit(o):
        key=str(o.InstanceGuid)
        if key in seen: return
        seen[key]=o
        params=list(o.Params.Input) if hasattr(o,'Params') else [o] if hasattr(o,'Sources') else []
        for p in params:
            for s in p.Sources: visit(s.Attributes.GetTopLevel.DocObject)
    for o in roots: visit(o)
    return seen

def run():
    if Rhino.RhinoDoc.ActiveDoc is None or str(Rhino.RhinoDoc.ActiveDoc.ModelUnitSystem) != 'Meters':
        raise ValueError('Set/check Rhino units as Meters before export; no implicit conversion.')
    with io.open(PLAN,encoding='utf-8-sig') as f: plan=json.load(f)
    with open(SOURCE,'rb') as f: source_hash=hashlib.sha256(f.read()).hexdigest()
    if source_hash != plan['modelHash']: raise ValueError('GHX changed: rerun audit and review mappings')
    if not 1 <= len(plan['points']) <= min(plan['maxSamples'],100): raise ValueError('Sample budget exceeded')
    if not 0 < plan['maxSecondsPerSample'] <= 120: raise ValueError('Invalid wall-clock budget')
    mkdir(OUT)
    stamp=time.strftime('%Y%m%d-%H%M%S'); run_dir=os.path.join(OUT,stamp); mkdir(run_dir)
    records=[]
    for index,params in enumerate(plan['points']):
        started=clock(); doc=None
        rec=dict(id=plan['experimentId']+'-'+str(index),parameters=params.copy(),
            modelHash=source_hash,experimentId=plan['experimentId'],seed=plan['seed'],
            solver=dict(source='grasshopper',validated=False,converged=False,version={},status='failed'),
            results=dict(maxDisplacement_m=None,mass_kg=None,axialForces_N=None,buckling=None,feasible=False,failureReasons=[]),
            geometry=dict(nodes=[],members=[]),units=dict(length='m',displacement='m',force='uncalibrated'),
            limitations=['Material EA not calibrated','Tension-only/slack not checked','Strength/buckling not checked','Feasibility means model displacement/iteration checks only'])
        try:
            if set(params)!=set(p['key'] for p in plan['parameters']): raise ValueError('Incomplete parameter vector')
            if params['pretension_parameter'] >= 1: raise ValueError('Zero rest length is outside export validity domain')
            if abs(params['topZ']-params['bottomZ']) < 1e-6: raise ValueError('Coincident layer elevations')
            archive=GH.Kernel.GH_DocumentIO()
            if not archive.Open(SOURCE): raise ValueError('Cannot open source / missing plugin')
            doc=archive.Document
            needed=ancestors([obj(doc,v) for v in IDS.values()])
            for o in doc.Objects:
                if hasattr(o,'Locked'): o.Locked = str(o.InstanceGuid) not in needed
            for p in plan['parameters']:
                v=params[p['key']]
                if not isinstance(v,(int,float)) or not finite(v) or not p['min']<=v<=p['max']: raise ValueError('Parameter out of bounds: '+p['key'])
                s=obj(doc,p['id']); s.SetSliderValue(Decimal(v))
                rec['parameters'][p['key']]=float(s.CurrentValue)
            # All unrelated solvers/optimizers are locked in this private disposable document.
            if float(obj(doc,IDS['maxIter']).UserText)>10000: raise ValueError('Iteration safety cap exceeded')
            doc.Enabled=True
            doc.NewSolution(True,GH.Kernel.GH_SolutionMode.Silent)
            elapsed=clock()-started
            if elapsed>plan['maxSecondsPerSample']: raise RuntimeError('Sample exceeded soft wall-clock budget; stopping batch')
            errors=[]
            for o in needed.values():
                if hasattr(o,'RuntimeMessages'):
                    errors.extend(str(x) for x in o.RuntimeMessages(GH.Kernel.GH_RuntimeMessageLevel.Error))
            if errors: raise ValueError('; '.join(errors))
            u=float(scalar(obj(doc,IDS['displacement'])))
            pu=[point(p) for p in values(obj(doc,IDS['upperU']))]; pl=[point(p) for p in values(obj(doc,IDS['upperL']))]
            if len(pu)!=3 or len(pl)!=3: raise ValueError('Upper node count is not 3')
            if not finite(u) or u<0 or abs(u-max(dist(a,b) for a,b in zip(pu,pl)))>1e-8: raise ValueError('Displacement verification failed')
            iu=int(scalar(obj(doc,IDS['unloaded']))); il=int(scalar(obj(doc,IDS['loaded'])))
            cap=int(obj(doc,IDS['maxIter']).UserText)
            if not (0<=iu<cap and 0<=il<cap): raise ValueError('Iteration limit / invalid iteration output')
            initial=values(obj(doc,IDS['cable']))+values(obj(doc,IDS['strut']))
            solved=[g for g in values(obj(doc,IDS['loaded']),2) if isinstance(g,(Rhino.Geometry.Line,Rhino.Geometry.Curve))]
            nc=len(values(obj(doc,IDS['cable'])))
            if nc!=90 or len(initial)!=93: raise ValueError('Unsupported changed topology (expected 90 cable segments, 3 struts)')
            rec['geometry']=geometry(initial,solved,nc)
            rec['geometry']['upperUnloaded']=pu;rec['geometry']['upperLoaded']=pl
            limit=float(obj(doc,IDS['limit']).UserText)
            feasible=u<limit
            if bool(scalar(obj(doc,IDS['gate'])))!=feasible: raise ValueError('Feasibility differs from audited gate')
            rec['solver'].update(validated=True,converged=True,status='precomputed',iterations=[iu,il],
                convergenceCriterion='iteration cap + finite outputs, not physical stability',
                version={str(o.Name):str(o.GetType().Assembly.FullName) for o in needed.values() if str(o.Name) in ['ZombieSolver','Load','Length(Line)']})
            rec['solver']['version']['Rhino']=str(Rhino.RhinoApp.Version)
            rec['solver']['version']['Grasshopper']=str(doc.GetType().Assembly.FullName)
            rec['results'].update(maxDisplacement_m=u,feasible=feasible,failureReasons=[] if feasible else ['displacement_limit'])
            force=[v.ScriptVariable() for v in obj(doc,IDS['load']).Params.Input[1].VolatileData.AllData(True)]
            rec['loading']=dict(forceVectors=[point(v) for v in force],appliedTo='three upper nodes',unit='uncalibrated')
            rec['prestress']=dict(parameter=params['pretension_parameter'],restLengthRatio=1-params['pretension_parameter'],force_N=None)
        except Exception as e:
            rec['solver'].update(validated=False,converged=False,status='failed')
            rec['results'].update(feasible=False,failureReasons=[str(e)])
            with io.open(os.path.join(run_dir,'run.log'),'a',encoding='utf-8') as f:f.write(traceback.format_exc()+'\n')
        finally:
            rec['solver']['elapsedSeconds']=clock()-started
            if doc is not None: doc.Dispose()
        records.append(rec)
        with io.open(os.path.join(run_dir,'samples.json'),'w',encoding='utf-8') as f:f.write(json.dumps(records,ensure_ascii=False,indent=2,allow_nan=False))
        if rec['solver']['elapsedSeconds']>plan['maxSecondsPerSample']: break
    with io.open(os.path.join(run_dir,'samples.csv'),'w',encoding='utf-8-sig') as f:
        def row(items):
            f.write(','.join('"'+str(v if v is not None else '').replace('"','""')+'"' for v in items)+'\n')
        row(['id','angle_deg','load_model','displacement_m','feasible','validated','reason'])
        for r in records:row([r['id'],r['parameters']['twist_deg'],r['parameters']['loadPerNode'],r['results']['maxDisplacement_m'],r['results']['feasible'],r['solver']['validated'],'; '.join(r['results']['failureReasons'])])
    print('Exported to '+run_dir)

if __name__=='__main__': run()
