# -*- coding: utf-8 -*-
"""Live, finite-amplitude Kangaroo check for this 90-segment / 3-strut model.
No document mutation. Run three NEW physical systems, never shared GH goals.
This source is embedded in the installed GhPython component (no file dependency).
"""
import math

def magnitude(v):
    return math.sqrt(sum(x*x for x in v))

def unwrap(value):
    return value.ScriptVariable() if hasattr(value, 'ScriptVariable') else value

def coordinates(value):
    v=unwrap(value)
    return [float(v.X),float(v.Y),float(v.Z)]

def snapshot(positions,cables,struts,anchors,loads):
    s=dict(positions=[coordinates(p) for p in positions],springs=[],anchors=[],loads=[])
    for group,goals in [('cable',cables),('strut',struts)]:
        for item in goals:
            g=unwrap(item)
            if g.GetType().FullName!='KangarooSolver.Goals.Spring':raise ValueError('Only native Spring goals are supported')
            s['springs'].append(dict(nodes=[int(i) for i in g.PIndex],rest=float(g.RestLength),k=float(g.Stiffness),kind=group))
    for item in anchors:
        g=unwrap(item)
        if g.GetType().FullName!='KangarooSolver.Goals.Anchor':raise ValueError('Only finite Anchor goals are supported')
        s['anchors'].append(dict(node=int(g.PIndex[0]),target=coordinates(g.Pt),k=float(g.Strength)))
    for item in loads:
        g=unwrap(item)
        if g.GetType().FullName!='KangarooSolver.Goals.Unary':raise ValueError('Only constant Unary loads are supported')
        s['loads'].append(dict(node=int(g.PIndex[0]),force=coordinates(g.Force)))
    n=len(s['positions'])
    if n!=87 or len(s['springs'])!=93 or len(s['anchors'])!=3 or len(s['loads'])!=3:raise ValueError('Expected current 87-node, 90-cable-segment, 3-strut model')
    for g in s['springs']:
        if len(g['nodes'])!=2 or any(i<0 or i>=n for i in g['nodes']):raise ValueError('Goal particle indexing does not match solver V')
        if g['k']<=0 or g['rest']<=0:raise ValueError('Positive stiffness and rest length required')
    return s

def residual(s,positions):
    forces=[[0.,0.,0.] for p in positions]
    for g in s['springs']:
        a,b=g['nodes'];d=[positions[b][j]-positions[a][j] for j in range(3)];l=magnitude(d)
        if l<1e-12:raise ValueError('Degenerate spring')
        f=g['k']*(l-g['rest'])
        for j in range(3):forces[a][j]+=f*d[j]/l;forces[b][j]-=f*d[j]/l
    for g in s['anchors']:
        for j in range(3):forces[g['node']][j]+=g['k']*(g['target'][j]-positions[g['node']][j])
    for g in s['loads']:
        for j in range(3):forces[g['node']][j]+=g['force'][j]
    return max(magnitude(f) for f in forces)

def smallest_eigenpair(matrix):
    n=len(matrix);a=[list(row) for row in matrix];v=[[float(i==j) for j in range(n)] for i in range(n)]
    for iteration in range(100*n*n):
        p,q=0,1;maximum=0.
        for i in range(n):
            for j in range(i+1,n):
                if abs(a[i][j])>maximum:maximum=abs(a[i][j]);p,q=i,j
        if maximum<1e-11:
            index=min(range(n),key=lambda i:a[i][i])
            return a[index][index],[v[i][index] for i in range(n)]
        app,aqq,apq=a[p][p],a[q][q],a[p][q]
        angle=.5*math.atan2(2*apq,aqq-app);c,ss=math.cos(angle),math.sin(angle)
        for k in range(n):
            if k!=p and k!=q:
                akp,akq=a[k][p],a[k][q]
                a[k][p]=a[p][k]=c*akp-ss*akq;a[k][q]=a[q][k]=ss*akp+c*akq
        a[p][p]=c*c*app-2*ss*c*apq+ss*ss*aqq
        a[q][q]=ss*ss*app+2*ss*c*apq+c*c*aqq;a[p][q]=a[q][p]=0.
        for k in range(n):
            vp,vq=v[k][p],v[k][q];v[k][p]=c*vp-ss*vq;v[k][q]=ss*vp+c*vq
    raise ValueError('Eigen solver iteration limit')

def weakest_mode(s):
    corners=sorted(set(i for g in s['springs'][90:] for i in g['nodes']))
    if len(corners)!=6:raise ValueError('Expected six strut corners')
    mapping=dict((node,i) for i,node in enumerate(corners));springs=[];chains=[]
    for j in range(9):
        chain=s['springs'][10*j:10*j+10];a,b=chain[0]['nodes'][0],chain[-1]['nodes'][1]
        if a not in mapping or b not in mapping:raise ValueError('Cable chain endpoints mismatch')
        for i,g in enumerate(chain):
            if i and g['nodes'][0]!=chain[i-1]['nodes'][1]:raise ValueError('Cable chain ordering mismatch')
            length=magnitude([s['positions'][g['nodes'][1]][k]-s['positions'][g['nodes'][0]][k] for k in range(3)])
            if g['k']*(length-g['rest'])<=0:raise ValueError('Slack/compressed cable: this exact condensation is inapplicable')
        x,y=s['positions'][a],s['positions'][b];d=[y[k]-x[k] for k in range(3)];l2=sum(t*t for t in d)
        for g in chain:
            q=[s['positions'][g['nodes'][0]][k]-x[k] for k in range(3)];t=sum(q[k]*d[k] for k in range(3))/l2
            if magnitude([q[k]-t*d[k] for k in range(3)])>1e-5:raise ValueError('Cable is not straight: exact condensation is inapplicable')
        springs.append(dict(nodes=[a,b],k=1./sum(1./g['k'] for g in chain),rest=sum(g['rest'] for g in chain)))
        chains.append(chain)
    springs.extend(s['springs'][90:]);K=[[0.]*18 for i in range(18)]
    for g in springs:
        a,b=g['nodes'];d=[s['positions'][b][j]-s['positions'][a][j] for j in range(3)];l=magnitude(d);unit=[t/l for t in d]
        for j in range(3):
            for k in range(3):
                value=g['k']*((1.-g['rest']/l if j==k else 0.)+g['rest']/l*unit[j]*unit[k])
                ia,ib=3*mapping[a]+j,3*mapping[b]+j;ja,jb=3*mapping[a]+k,3*mapping[b]+k
                K[ia][ja]+=value;K[ib][jb]+=value;K[ia][jb]-=value;K[ib][ja]-=value
    for g in s['anchors']:
        for j in range(3):K[3*mapping[g['node']]+j][3*mapping[g['node']]+j]+=g['k']
    value,vector=smallest_eigenpair(K);scale=max(magnitude(vector[3*i:3*i+3]) for i in range(6))
    mode=[[0.,0.,0.] for p in s['positions']]
    for node,i in mapping.items():mode[node]=[v/scale for v in vector[3*i:3*i+3]]
    for chain in chains:
        a,b=chain[0]['nodes'][0],chain[-1]['nodes'][1];x,y=s['positions'][a],s['positions'][b];d=[y[k]-x[k] for k in range(3)];l2=sum(t*t for t in d)
        for g in chain:
            node=g['nodes'][0];t=sum((s['positions'][node][k]-x[k])*d[k] for k in range(3))/l2
            mode[node]=[mode[a][k]*(1-t)+mode[b][k]*t for k in range(3)]
    return value,mode,corners

def run_experiment(s,amplitude,max_iterations):
    import clr,time
    clr.AddReference('KangarooSolver')
    import KangarooSolver as KS
    from KangarooSolver.Goals import Spring,Anchor,Unary
    from Rhino.Geometry import Point3d,Vector3d
    from System.Collections.Generic import List
    if not (1e-7<=amplitude<=.001):raise ValueError('Amplitude must be 0.0001 to 1 mm')
    max_iterations=int(max_iterations)
    if not (10000<=max_iterations<=500000):raise ValueError('Iteration budget must be 10000 to 500000')
    initial_residual=residual(s,s['positions'])
    if initial_residual>1e-5:raise ValueError('Input is not equilibrated (residual %.3g). Solve the original Zombie first.'%initial_residual)
    eigen,mode,corners=weakest_mode(s);start=time.time();systems=[]
    for sign in [0,-1,1]:
        ps=KS.PhysicalSystem()
        for p,v in zip(s['positions'],mode):ps.AddParticle(Point3d(*[p[k]+sign*amplitude*v[k] for k in range(3)]),1.)
        goals=List[KS.IGoal]()
        for g in s['springs']:goals.Add(Spring(g['nodes'][0],g['nodes'][1],g['rest'],g['k']))
        for g in s['anchors']:goals.Add(Anchor(g['node'],Point3d(*g['target']),g['k']))
        for g in s['loads']:goals.Add(Unary(g['node'],Vector3d(*g['force'])))
        systems.append((ps,goals))
    def measure():
        control=systems[0][0];ratios=[]
        relative=[]
        for ps,goals in systems:
            ratios.append(max(ps.GetPosition(node).DistanceTo(Point3d(*s['positions'][node])) for node in corners)/amplitude)
            relative.append(max(ps.GetPosition(node).DistanceTo(control.GetPosition(node)) for node in corners)/amplitude)
        return dict(iterations=int(control.GetIterations()),iterationCounts=[int(ps.GetIterations()) for ps,goals in systems],control=ratios[0],minus=ratios[1],plus=ratios[2],relativeMinus=relative[1],relativePlus=relative[2])
    trace=[measure()]
    for step in range(max_iterations):
        # Native Step batches iterations adaptively. Record each system's actual
        # count and stop it independently when its soft iteration budget is met.
        for ps,goals in systems:
            if ps.GetIterations()<max_iterations:ps.Step(goals,False,1e-16)
        trace.append(measure())
        if min(ps.GetIterations() for ps,goals in systems)>=max_iterations:break
    if trace[-1]['iterations']!=int(systems[0][0].GetIterations()):trace.append(measure())
    final=[[[p.X,p.Y,p.Z] for p in ps.GetPositions()] for ps,goals in systems]
    residuals=[residual(s,positions) for positions in final]
    ratios=[trace[-1]['minus'],trace[-1]['plus']];gain=max(ratios)
    if gain>10:response='AMPLIFIED / 扰动放大'
    elif gain<.2 and trace[-1]['control']<.2 and max(residuals)<1e-6:response='DECAYED / 扰动衰减'
    else:response='INCONCLUSIVE / 延长迭代或减小扰动后复查'
    tangent='POSITIVE / 当前平衡局部稳定' if eigen>1e-6 else ('NEGATIVE / 当前平衡不稳定' if eigen< -1e-6 else 'NEAR ZERO / 临界附近')
    return dict(lambdaMin=eigen,mode=mode,corners=corners,amplitude=amplitude,trace=trace,ratios=ratios,response=response,tangent=tangent,positions=final,residuals=residuals,initialResidual=initial_residual,controlDrift=max(magnitude([final[0][n][k]-s['positions'][n][k] for k in range(3)]) for n in corners),iterations=[int(ps.GetIterations()) for ps,goals in systems],seconds=time.time()-start)
