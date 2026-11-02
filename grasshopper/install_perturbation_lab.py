# -*- coding: utf-8 -*-
"""Run from RhinoMCP. Adds a self-contained live GhPython experiment group."""
from __future__ import unicode_literals
import os,io,json,datetime,clr
clr.AddReference('Grasshopper')
clr.AddReference('System.Drawing')
import Grasshopper as GH
from Grasshopper.Kernel import GH_ParamAccess
from Grasshopper.Kernel.Parameters import Param_ScriptVariable,Param_GenericObject
from Grasshopper.Kernel.Special import GH_NumberSlider,GH_BooleanToggle,GH_Panel,GH_Group
from System import Guid,Decimal
from System.Drawing import PointF,SizeF,Color
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRECTORY=os.path.join(ROOT,'data','stability')

def install():
    d=GH.Instances.ActiveCanvas.Document
    if d is None:raise ValueError('No active Grasshopper document')
    for o in d.Objects:
        if o.NickName=='Perturbation Lab | 小扰动试验':raise ValueError('Lab already exists; update it rather than duplicating')
    def obj(gid):
        o=d.FindObject(Guid(gid),False)
        if o is None:raise ValueError('Missing source '+gid)
        return o
    source_ids=['b0b555e1-939e-4393-9097-2a343da045dc','3bf40468-f039-4d8d-981b-7de73ebcd0f4','27f83eea-0020-4b97-ae24-3504ae555f73','15b2b416-bcd1-4c21-a213-67de79c57bf6','82b2f35d-975a-47c2-ad1f-f09dcaa828cc']
    source=[obj(gid) for gid in source_ids]
    backup=os.path.join(DIRECTORY,'before_perturbation_lab_'+datetime.datetime.now().strftime('%Y%m%d_%H%M%S')+'.ghx')
    old_path=d.FilePath
    try:
        archive=GH.Kernel.GH_DocumentIO();archive.Document=d
        if not archive.SaveQuiet(backup):raise ValueError('Backup failed')
    finally:d.FilePath=old_path
    created=[];aliases={}
    # Place beyond the occupied canvas bounds so no existing group is covered.
    x=float(max(o.Attributes.Bounds.Right for o in d.Objects))+400.;y=2200.
    def add(o,alias,dx,dy):
        o.CreateAttributes();o.Attributes.Pivot=PointF(x+dx,y+dy);d.AddObject(o,False)
        created.append(o);aliases[alias]=str(o.InstanceGuid);return o
    try:
        component=GH.Instances.ComponentServer.EmitObjectProxy(Guid('410755b1-224a-4c1e-a407-bf32fb45ea7e')).CreateInstance()
        component.NickName='Perturbation Lab | 小扰动试验'
        for p in list(component.Params.Input):component.Params.UnregisterInputParameter(p,True)
        inputs=['V','Cables','Struts','Anchors','Loads','I','Run','Amplitude_mm','Steps']
        for i,name in enumerate(inputs):
            p=Param_ScriptVariable();p.Name=name;p.NickName=name;p.Description=name
            p.Access=GH_ParamAccess.list if i<5 else GH_ParamAccess.item
            if i<5:p.DataMapping=GH.Kernel.GH_DataMapping.Flatten
            component.Params.RegisterInputParam(p)
        # Keep GhPython's built-in 'out' output, replace the default user output.
        for p in list(component.Params.Output)[1:]:component.Params.UnregisterOutputParameter(p,True)
        outputs=['Report','LambdaMin','GainMinus','GainPlus','Reference','Initial','Minus','Plus','Chart','Trace']
        for name in outputs:
            p=Param_GenericObject();p.Name=name;p.NickName=name;p.Description=name
            component.Params.RegisterOutputParam(p)
        code=io.open(os.path.join(ROOT,'grasshopper','perturbation_core.py'),encoding='utf-8').read()+'\n'+io.open(os.path.join(ROOT,'grasshopper','perturbation_component.py'),encoding='utf-8').read()
        component.Code=code;component.Params.OnParametersChanged();component.Hidden=True
        add(component,'component',420,240)
        toggle=add(GH_BooleanToggle(),'run',30,110);toggle.NickName='Run test | 运行试验';toggle.Value=False
        def slider(alias,nick,value,minimum,maximum,places,dy):
            o=add(GH_NumberSlider(),alias,30,dy);o.NickName=nick
            o.Slider.Minimum=Decimal(minimum);o.Slider.Maximum=Decimal(maximum);o.Slider.DecimalPlaces=places
            o.SetSliderValue(Decimal(value));return o
        amplitude=slider('amplitude','Amplitude (mm) | 扰动',.1,.0001,1.,4,180)
        steps=slider('steps','Iteration budget | 迭代',300000,10000,500000,0,250)
        for i,(parent,port) in enumerate([(source[0],1),(source[1],0),(source[2],0),(source[3],0),(source[4],0),(source[0],0)]):component.Params.Input[i].AddSource(parent.Params.Output[port])
        for index,parent in [(6,toggle),(7,amplitude),(8,steps)]:component.Params.Input[index].AddSource(parent)
        report=add(GH_Panel(),'report',760,80);report.NickName='RESULT | 试验结果';report.Attributes.Bounds=__import__('System').Drawing.RectangleF(x+760,y+80,560,440)
        report.AddSource(component.Params.Output[1])
        notes=add(GH_Panel(),'guide',20,380);notes.NickName='HOW TO USE | 使用说明'
        notes.UserText='小扰动试验 / Perturbation Lab\n\n1. 原荷载 P 调为 0.55；Run=True。\n2. 看 Gain<1、DECAYED，扰动衰减。\n3. 原荷载 P 调为 0.58，再看 AMPLIFIED。\n4. Run=False 暂停；改输入后旧结果隐藏。\n\nAmplitude 单位 mm；默认正负各 0.1 mm。\nSteps 是求解迭代预算，不是物理时间。\n结果使用当前模型、静长与原始荷载。\n不改写原求解器，也不自动连接优化器。\n\nChart 曲线顺序：对照、负扰动、正扰动、增益1线。\n横轴迭代进程，纵轴 log10(增益)。\n低于0衰减，高于0放大。\n\nlambda_min 是凝聚切线矩阵最小特征值。\n只能用于当前87节点、直线拉紧索的弹簧模型。\n侧向模态方向可能随数值误差旋转，正负方向无固定左右含义。'
        notes.Attributes.Bounds=__import__('System').Drawing.RectangleF(x+20,y+380,640,440)
        for i,alias in [(5,'reference'),(6,'initial'),(7,'minus'),(8,'plus'),(9,'chart')]:
            p=add(Param_GenericObject(),alias,1410,120+80*(i-5));p.NickName=alias.upper();p.AddSource(component.Params.Output[i]);p.Hidden=alias!='plus'
        group=add(GH_Group(),'group',0,0);group.NickName='小扰动稳定性实验 / Native Kangaroo ±0.1 mm';group.Colour=Color.FromArgb(90,60,160,200)
        for o in created[:-1]:group.AddObject(o.InstanceGuid)
        component.ExpireSolution(False)
        metadata=dict(aliases=aliases,backup=backup,sourceIds=source_ids,originalLoad=float(obj('1cd6de1a-439a-4266-a4ff-0b6c938c0269').CurrentValue),position=[x,y])
        with io.open(os.path.join(DIRECTORY,'perturbation-lab-install.json'),'w',encoding='utf-8') as f:f.write(json.dumps(metadata,ensure_ascii=False,indent=2))
        d.NewSolution(False)
        print(json.dumps(metadata))
    except:
        for o in reversed(created):d.RemoveObject(o,False)
        raise
