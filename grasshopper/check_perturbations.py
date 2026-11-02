# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import os, io, json, math, time, clr
clr.AddReference('KangarooSolver')
import KangarooSolver as KS
from KangarooSolver.Goals import Spring, Anchor, Unary
from Rhino.Geometry import Point3d, Vector3d
from System.Collections.Generic import List
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRECTORY=os.path.join(ROOT,'data','stability')

def execute(max_iterations=30000):
    seeds=json.load(io.open(os.path.join(DIRECTORY,'perturbation-seeds.json'),encoding='utf-8'));results=[]
    for seed in seeds:
        for sign in [-1,1]:
            start=time.time();s=seed['system'];ps=KS.PhysicalSystem()
            for p,v in zip(s['positions'],seed['perturb']):ps.AddParticle(Point3d(*[p[i]+sign*v[i] for i in range(3)]),1.)
            goals=List[KS.IGoal]()
            for g in s['springs']:goals.Add(Spring(int(g['nodes'][0]),int(g['nodes'][1]),g['rest'],g['k']))
            for g in s['anchors']:goals.Add(Anchor(int(g['node']),Point3d(*g['target']),g['k']))
            for g in s['loads']:goals.Add(Unary(int(g['node']),Vector3d(*g['force'])))
            trace=[]
            for step in range(max_iterations//10):
                ps.Step(goals,False,1e-16)
                if step%100==0:
                    dev=max(ps.GetPosition(int(node)).DistanceTo(Point3d(*s['positions'][node])) for node in seed['corners'])
                    z=[ps.GetPosition(int(g['node'])).Z for g in s['loads']]
                    trace.append(dict(iterations=ps.GetIterations(),maxCornerDeviation=dev,upperZSpread=max(z)-min(z),meanZ=sum(z)/3.))
                if ps.GetIterations()>=max_iterations:break
            positions=[[p.X,p.Y,p.Z] for p in ps.GetPositions()]
            force=[[0.,0.,0.] for p in positions]
            particles=List[KS.Particle](ps.Particles)
            for g in goals:
                g.Calculate(particles)
                for i,node in enumerate(g.PIndex):
                    v=g.Move[i]*g.Weighting[i]
                    force[node][0]+=v.X;force[node][1]+=v.Y;force[node][2]+=v.Z
            record=dict(P=seed['P'],sign=sign,lambdaMin=seed['lambdaMin'],initialAmplitude=seed['amplitude'],iterations=ps.GetIterations(),trace=trace,positions=positions,residualMax=max(math.sqrt(sum(v*v for v in f)) for f in force),maxCornerDeviation=max(Point3d(*positions[node]).DistanceTo(Point3d(*s['positions'][node])) for node in seed['corners']),seconds=time.time()-start)
            results.append(record)
            with io.open(os.path.join(DIRECTORY,'native-perturbations.json'),'w',encoding='utf-8') as f:f.write(json.dumps(results,ensure_ascii=False,indent=2))
    print(json.dumps([dict((k,v) for k,v in r.items() if k not in ['positions','trace']) for r in results]))
