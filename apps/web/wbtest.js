const fs=require('fs'); global.navigator={languages:['en']}; global.window=global;
eval(fs.readFileSync('simlib.js','utf8')+';global.Sim=SIMLIB()'); eval(fs.readFileSync('code.js','utf8')+';global.Code=Code');
global.Store={get:()=>({}),set(){}}; global.ICON_DATA={}; global.matchMedia=()=>({matches:false});
eval(fs.readFileSync('workbench.js','utf8')+';global.Workbench=Workbench');
const W=Workbench; let pass=0, fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('FAIL',m);} };
function run(state,t){ const P=W._compile(state); const s=Sim.zero(state.n); for(const o of P.ir.ops){ if(o.g==='M')continue; Sim.applyUnitary(s, Object.assign({},o,{p:o.p.map(v=>typeof v==='number'?v:W.evalE(v,t))}),{t}); } return {s,P}; }
const amp=(s,i)=>[s.re[i],s.im[i]]; const close=(a,b,e=1e-9)=>Math.abs(a[0]-b[0])<e&&Math.abs(a[1]-b[1])<e;
const fid=(s,re,im)=>{ let r=0,i=0; for(let k=0;k<re.length;k++){ r+=s.re[k]*re[k]+s.im[k]*im[k]; i+=s.re[k]*im[k]-s.im[k]*re[k]; } return r*r+i*i; };
// X^t
for(const t of [0,.3,.5,.77,1]){ const {s}=run(W.grid(1,[['XT']]),t); const e=[Math.cos(Math.PI*t),Math.sin(Math.PI*t)]; ok(close(amp(s,0),[(1+e[0])/2,e[1]/2])&&close(amp(s,1),[(1-e[0])/2,-e[1]/2]),'X^t t='+t); }
// Z^t, Y^t on |+>: compare to matrix power via eigen
for(const t of [.2,.6]){ const {s}=run(Object.assign(W.grid(1,[['ZT']]),{init:['+']}),t); ok(close(amp(s,1),[Math.cos(Math.PI*t)/Math.SQRT2,Math.sin(Math.PI*t)/Math.SQRT2]),'Z^t'); }
// Y^1/2 |0> ∝ |+>, Y^t at t=1 = Y
{ const {s}=run(W.grid(1,[['YH']]),0); ok(Math.abs(fid(s,[Math.SQRT1_2,Math.SQRT1_2],[0,0])-1)<1e-9,'Y^1/2'); }
{ const {s}=run(W.grid(1,[['YT']]),1); ok(close(amp(s,1),[0,1]),'Y^t t=1 → i|1>'); }
{ const {s}=run(W.grid(1,[['YQ'],['YQ']]),0); const r=run(W.grid(1,[['YH']]),0).s; ok(Math.abs(fid(s,r.re,r.im)-1)<1e-9,'Y^1/4 twice = Y^1/2'); }
{ const {s}=run(W.grid(1,[['XQ'],['XQ'],['XQ'],['XQ']]),0); ok(close(amp(s,1),[1,0]),'X^1/4 ×4 = X'); }
{ const {s}=run(W.grid(1,[['XQD'],['XQ']]),0); ok(close(amp(s,0),[1,0]),'X^-1/4 X^1/4 = I'); }
// controlled X^t on |1>|0>: target gets X^t
{ const st=Object.assign(W.grid(2,[['•','XT']]),{init:['1','0']}); const {s}=run(st,.4); const e=[Math.cos(Math.PI*.4),Math.sin(Math.PI*.4)]; ok(close(amp(s,2),[(1+e[0])/2,e[1]/2])&&close(amp(s,3),[(1-e[0])/2,-e[1]/2]),'C-X^t'); }
{ const st=W.grid(2,[['•','XT']]); const {s}=run(st,.4); ok(close(amp(s,0),[1,0]),'C-X^t control off'); }
// anti-control
{ const {s}=run(W.grid(2,[['◦','X']]),0); ok(close(amp(s,1),[1,0]),'anticontrol'); }
// QFT3 on |x>
for(const x of [0,1,5,6]){ const st=W.grid(3,[['QFT3']]); st.init=x.toString(2).padStart(3,'0').split('').map(b=>b); const {s}=run(st,0); let g=1; for(let y=0;y<8;y++){ const a=2*Math.PI*x*y/8; if(!close(amp(s,y),[Math.cos(a)/Math.sqrt(8),Math.sin(a)/Math.sqrt(8)],1e-9)) g=0; } ok(g,'QFT |'+x+'>'); }
{ const st=W.grid(3,[['X','-','X'],['QFT3'],['IQFT3']]); const {s}=run(st,0); ok(close(amp(s,5),[1,0]),'IQFT∘QFT'); }
// INC / DEC
for(const x of [0,3,7]){ const st=W.grid(3,[['INC3']]); st.init=x.toString(2).padStart(3,'0').split(''); const {s}=run(st,0); ok(close(amp(s,(x+1)%8),[1,0]),'INC '+x); const st2=W.grid(3,[['DEC3']]); st2.init=st.init; ok(close(amp(run(st2,0).s,(x+7)%8),[1,0]),'DEC '+x); }
// REV
{ const st=W.grid(3,[['REV3']]); st.init=['1','0','0']; ok(close(amp(run(st,0).s,1),[1,0]),'REV'); }
// swap pair + error on lone swap
{ const st=W.grid(2,[['SW','SW']]); st.init=['1','0']; ok(close(amp(run(st,0).s,1),[1,0]),'SWAP'); const P=W._compile(W.grid(2,[['SW']])); ok(P.errors.size===1,'lone swap error'); }
// measured wire then gate = error; control from measured ok
{ const P=W._compile(W.grid(2,[['M'],['H']])); ok(P.errors.size===1,'gate after measure error'); const Q=W._compile(W.grid(2,[['M'],['•','X']])); ok(Q.errors.size===0,'classical control ok'); }
// teleport template: q2 Bloch equals q0's X^t state
{ const st=W.TEMPLATES.find(t=>t[0].startsWith('Teleport'))[1](); const {s}=run(st,.3); const b=Sim.bloch(s,2); ok(Math.abs(b[2]-Math.cos(Math.PI*.3))<1e-9&&Math.abs(b[1]+Math.sin(Math.PI*.3))<1e-9,'teleport bloch '+b.map(v=>v.toFixed(3))); }
// every template compiles without errors and code round-trips to the same state
for(const [name,f] of W.TEMPLATES){ const st=f(), P=W._compile(st); ok(P.errors.size===0,'template errors '+name);
  for(const lang of ['qiskit','cirq','pennylane','qasm']){ const g=Code.gen(lang,P.ir); const r=Code.parse(lang,g.text); if(r.errors.length){ ok(false,name+' '+lang+' parse '+r.errors[0].msg); continue; }
    const {cols,warn}=W.fromOps(r.n,r.ops.map(o=>Object.assign({},o,{p:(o.p||[]).map(v=>typeof v==='string'?v:v)}))); const st2={n:r.n,init:Array(r.n).fill('0'),cols};
    const a=run(st,.37).s, b=run(st2,.37).s; ok(Math.abs(fid(a,b.re,b.im)-1)<1e-8, `${name} ${lang} round trip ${fid(a,b.re,b.im)} ${warn}`); } }
console.log(`workbench: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
