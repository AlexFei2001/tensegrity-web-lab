import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export function createViewport(container) {
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,500);camera.up.set(0,0,1);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;
 scene.add(new THREE.HemisphereLight(0xffffff,0x6c7f6b,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,-4,6);scene.add(light);
 const grid=new THREE.GridHelper(6,24,0xb1c7bb,0xd5dfd4);grid.rotation.x=Math.PI/2;grid.position.z=-.015;scene.add(grid);
 const group=new THREE.Group();scene.add(group);
 function resize(){if(!container.clientWidth||!container.clientHeight)return;renderer.setSize(container.clientWidth,container.clientHeight);camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(container);resize();renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera);});
 return {
 frame(p){const h=Math.max(.6,Math.abs(p.topZ-p.bottomZ)),r=Math.max(p.topRadius,p.bottomRadius),z=(p.topZ+p.bottomZ)/2;camera.position.set(3*r+1,-3*r-1,z+1.8*h);orbit.target.set(0,0,z);orbit.update();},
 draw(g,deformed=false){
  for(const child of [...group.children]){child.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});group.remove(child);}
  const pos=new Map(g.nodes.map(n=>[n.id,new THREE.Vector3(...(deformed&&n.deformedPosition?n.deformedPosition:n.position))]));
  for(const m of g.members){const a=pos.get(m.nodes[0]),b=pos.get(m.nodes[1]);if(!a||!b)continue;const direction=b.clone().sub(a),length=direction.length();if(length<1e-9)continue;const radius=m.kind==='strut'?.016:.004;
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,8),new THREE.MeshStandardMaterial({color:m.kind==='strut'?0xa95c3e:0x267d78,roughness:.7}));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);}
  for(const [id,p] of pos){const node=new THREE.Mesh(new THREE.SphereGeometry(.023,10,8),new THREE.MeshStandardMaterial({color:0x273f39}));node.position.copy(p);group.add(node);
   if(pos.size<=12){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;const ctx=canvas.getContext('2d');ctx.font='bold 32px sans-serif';ctx.fillStyle='#244f42';ctx.fillText('N'+id,5,40);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.position.copy(p).add(new THREE.Vector3(.08,0,.08));sprite.scale.set(.18,.12,1);group.add(sprite);}}
 }
 };
}
