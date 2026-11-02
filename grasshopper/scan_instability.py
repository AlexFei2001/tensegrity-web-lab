# -*- coding: utf-8 -*-
"""Read current GH snapshot, solve raw load samples in disposable GH documents.
No feasibility filter: a prescribed serviceability limit cannot locate instability.
Compatible with RhinoMCP IronPython. Use execute_batch(loads, tag) in short batches.
"""
from __future__ import unicode_literals
import os, io, json, time, math
import clr
clr.AddReference('Grasshopper')
import Grasshopper as GH
from System import Guid, Decimal
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRECTORY=os.path.join(ROOT,'data','stability')
ns={'__file__':os.path.join(ROOT,'grasshopper','export_samples.py'),'__name__':'export_helpers'}
exec(compile(io.open(ns['__file__'],encoding='utf-8').read(),ns['__file__'],'exec'),ns)
obj,values,scalar,point,ancestors=ns['obj'],ns['values'],ns['scalar'],ns['point'],ns['ancestors']
IDS=ns['IDS']
GOALS=['3bf40468-f039-4d8d-981b-7de73ebcd0f4','27f83eea-0020-4b97-ae24-3504ae555f73','15b2b416-bcd1-4c21-a213-67de79c57bf6','82b2f35d-975a-47c2-ad1f-f09dcaa828cc']

def force_check(d):
    positions=[point(p) for p in values(obj(d,IDS['loaded']),1)]
    forces=[[0.,0.,0.] for p in positions]
    springs=[];anchors=[];loads=[]
    for group,id in enumerate(GOALS):
        for g in values(obj(d,id)):
            pi=list(g.PIndex)
            if group<2:
                a,b=pi;delta=[positions[b][j]-positions[a][j] for j in range(3)]
                length=math.sqrt(sum(v*v for v in delta))
                if length<1e-12:raise ValueError('Zero spring length')
                force=float(g.Stiffness)*(length-float(g.RestLength))
                for j in range(3):
                    f=force*delta[j]/length;forces[a][j]+=f;forces[b][j]-=f
                springs.append(dict(nodes=pi,rest=float(g.RestLength),k=float(g.Stiffness),length=length,axial=force,kind='cable' if group==0 else 'strut'))
            elif group==2:
                a=pi[0];target=point(g.Pt)
                for j in range(3):forces[a][j]+=float(g.Strength)*(target[j]-positions[a][j])
                anchors.append(dict(node=a,target=target,k=float(g.Strength)))
            else:
                a=pi[0];f=point(g.Force)
                for j in range(3):forces[a][j]+=f[j]
                loads.append(dict(node=a,force=f))
    return dict(positions=positions,springs=springs,anchors=anchors,loads=loads,residualMax=max(math.sqrt(sum(v*v for v in f)) for f in forces))

def execute_batch(loads,tag,max_iterations=10000,quiet=False):
    snapshot=json.load(io.open(os.path.join(DIRECTORY,'latest_snapshot.json'),encoding='utf-8'))
    output=os.path.join(DIRECTORY,tag+'.json');records=[]
    for requested in loads:
        start=time.time();d=None
        record=dict(requestedP=requested,angle=snapshot['angle'],initialization='fresh-original-goals',converged=False)
        try:
            archive=GH.Kernel.GH_DocumentIO()
            if not archive.Open(snapshot['snapshot']):raise ValueError('Cannot open snapshot')
            d=archive.Document
            needed=ancestors([obj(d,v) for v in IDS.values()])
            for o in d.Objects:
                if hasattr(o,'Locked'):o.Locked=str(o.InstanceGuid) not in needed
            slider=obj(d,'1cd6de1a-439a-4266-a4ff-0b6c938c0269');slider.Slider.DecimalPlaces=6
            slider.SetSliderValue(Decimal(requested));record['P']=float(slider.CurrentValue)
            obj(d,IDS['maxIter']).UserText=str(max_iterations)
            d.Enabled=True;d.NewSolution(True,GH.Kernel.GH_SolutionMode.Silent)
            iu=int(scalar(obj(d,IDS['unloaded'])));il=int(scalar(obj(d,IDS['loaded'])))
            up=[point(p) for p in values(obj(d,IDS['upperL']))];un=[point(p) for p in values(obj(d,IDS['upperU']))]
            u=float(scalar(obj(d,IDS['displacement'])))
            record.update(Iunloaded=iu,Iloaded=il,u=u,upper=up,upperUnloaded=un,meanZ=sum(p[2] for p in up)/3.,meanVerticalDisplacement=sum(a[2]-b[2] for a,b in zip(un,up))/3.)
            system=force_check(d);record['system']=system;record['residualMax']=system['residualMax']
            record['converged']=il<max_iterations and iu<max_iterations and system['residualMax']<1e-4
        except Exception as e:record['error']=str(e)
        finally:
            record['seconds']=time.time()-start
            if d is not None:d.Dispose()
        records.append(record)
        with io.open(output,'w',encoding='utf-8') as f:f.write(json.dumps({'snapshot':snapshot,'maxIterations':max_iterations,'samples':records},ensure_ascii=False,indent=2))
    if not quiet:print(json.dumps([dict((k,v) for k,v in r.items() if k not in ['system','upper','upperUnloaded']) for r in records]))
    return output
