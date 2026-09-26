const fs=require('fs'); eval(fs.readFileSync('simlib.js','utf8')+';global.SIMLIB=SIMLIB'); global.Sim=SIMLIB();
eval(fs.readFileSync('passes.js','utf8')+';global.Passes=Passes');
const Y=Sim.G.Y.m(); const aa=Sim.axisAngle(Y); console.log(aa);
const {theta,phi,lambda,alpha}=Passes.zyz(Y); console.log(theta,phi,lambda,alpha);
// check zyz reconstruct
const mm=(A,B)=>[0,1].flatMap(r=>[0,1].map(c=>{let re=0,im=0;for(let k=0;k<2;k++){const a=A[r*2+k],b=B[k*2+c];re+=a[0]*b[0]-a[1]*b[1];im+=a[0]*b[1]+a[1]*b[0];}return[re,im]}));
const RZ=t=>Sim.G.RZ.m([t]),RY=t=>Sim.G.RY.m([t]);
const R=mm(RZ(phi),mm(RY(theta),RZ(lambda))); console.log(R.map(x=>x.map(v=>v.toFixed(3))), 'phase', alpha);
const ops=Passes.toBasis({n:3,ops:[{g:'Y',q:[2],c:[0,1],col:0}]}).ops;
// compare against matrix-level: controlled-controlled Y on each basis
for(let k=0;k<8;k++){const pre=[];for(let q=0;q<3;q++)if(k&(4>>q))pre.push({g:'X',q:[q],col:-1});
 const a=Sim.run({n:3,ops:pre.concat([{g:'Y',q:[2],c:[0,1],col:0}])}), b=Sim.run({n:3,ops:pre.concat(ops)});
 console.log(k, Array.from(a.re).map(x=>x.toFixed(2)).join(','),'|',Array.from(a.im).map(x=>x.toFixed(2)).join(','),' vs ',Array.from(b.re).map(x=>x.toFixed(2)).join(','),'|',Array.from(b.im).map(x=>x.toFixed(2)).join(','));}
