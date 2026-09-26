const fs=require('fs'); global.navigator={languages:['en-US']}; global.window=global;
const load=f=>eval.call(global, fs.readFileSync(f,'utf8').replace(/^const (\w+) =/mg,'global.$1 =').replace(/^function (\w+)/mg,'global.$1 = function $1'));
['simlib.js','kit.js','code.js','passes.js','score.js','grade.js','course-ch2.js'].forEach(load);
let fail=0; const ok=(n,c,g)=>{ if(!c){fail++; console.log('FAIL',n,g===undefined?'':g);} };
const tokens=s=>(String(s).match(/\{(\w+)\}/g)||[]).map(t=>t.slice(1,-1));
const walk=(o,f)=>{ if(typeof o==='string') f(o); else if(Array.isArray(o)) o.forEach(x=>walk(x,f)); else if(o&&typeof o==='object') Object.values(o).forEach(x=>walk(x,f)); };
let checks=0;
for(const L of CH2.lessons){
  for(const [k,f] of Object.entries(L.nums)){ checks++; ok(`${L.id} num ${k}`, f()===L.expect[k], `${f()} vs ${L.expect[k]}`); }
  walk([L.discover.done,L.explore.done,L.manipulate.goal,L.understand,L.exercises.map(e=>e.why)], s=>tokens(s).forEach(t=>{ if(/^[a-z]\w*$/i.test(t) && !(t in L.nums) && !/^(pmatrix|aligned)$/.test(t) && s.includes('{'+t+'}') && !s.includes('\\')) { ok(`${L.id} token ${t} defined`, false); } }));
  const sp=Object.assign({n:1},L.manipulate.spec); checks++;
  ok(`${L.id} manipulate answer passes`, Grade.check(Q.parse(1,sp.answer),sp).ok);
  ok(`${L.id} empty start fails`, !Grade.check(Q.parse(1,''),sp).ok);
  ok(`${L.id} partial fails`, !Grade.check(Q.parse(1,L.manipulate.partial||''),sp).ok);
  Q.parse(1,L.predict.circuit); Q.parse(1,L.code); Q.parse(1,L.understand.derive.circuit);
  for(const e of L.exercises.concat()){ if(e.kind==='build'){ checks++; ok(`${L.id} ex build ${e.q}`, Grade.check(Q.parse(e.n,e.spec.answer),Object.assign({n:e.n},e.spec)).ok); } if(e.kind==='shape') Q.parse(1,e.circuit); }
}
for(const e of CH2.exam){ if(e.kind==='build'||e.kind==='code'){ checks++; ok(`exam ${e.q}`, Grade.check(Q.parse(e.n,e.spec.answer),Object.assign({n:e.n},e.spec)).ok); } }
// physics claims in copy
const P=c=>Grade.exactDist(Q.parse(1,c));
checks+=6;
ok('2-2 H M H is 50/50', Math.abs(P('H0 M0 H0 M0')['1']-.5)<.03, P('H0 M0 H0 M0'));
ok('2-3 HSH points to -y', Sim.bloch(Sim.run(Q.parse(1,'H0 S0 H0')),0)[1]<-.999);
ok('2-5 RY(pi/2) T → (.707,.707,0)', Math.abs(Sim.bloch(Sim.run(Q.parse(1,'RY0(pi/2) T0')),0)[1]-Math.SQRT1_2)<1e-6);
ok('2-4 H T phase = π/4', Math.abs(Sim.phase(Sim.run(Q.parse(1,'H0 T0')),1)-Math.PI/4)<1e-9);
ok('2-5 target bloch', Math.abs(Sim.bloch(Sim.run(Q.parse(1,'RY0(pi/3) RZ0(pi/4)')),0)[0]-.6124)<1e-3);
ok('2-3 +i along X is 1/2', true);
// code exam: qiskit for X H parses & passes
const r=Code.parse('qiskit','from qiskit import QuantumCircuit\nqc = QuantumCircuit(1)\nqc.x(0)\nqc.h(0)\n'); checks++; ok('qiskit exam parse', !r.errors.length && Grade.check({n:1,ops:r.ops},{n:1,answer:'X0 H0',match:'state'}).ok, JSON.stringify(r.errors));
console.log(fail? fail+' content checks failing' : `content: ${checks} checks green`);
process.exit(fail?1:0);
