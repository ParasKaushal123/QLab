const fs=require('fs'); eval(fs.readFileSync('simlib.js','utf8')+';global.SIMLIB=SIMLIB'); global.Sim=SIMLIB();
eval(fs.readFileSync('code.js','utf8')+';global.Code=Code'); eval(fs.readFileSync('passes.js','utf8')+';global.Passes=Passes');
let fail=0; const chk=(n,c,g)=>{console.log(c?'PASS':'FAIL',n,g||''); if(!c)fail++;};
// every gate, 0..2 controls, random params: basis translation preserves the unitary
const names=['I','X','Y','Z','H','S','SDG','T','TDG','SX','SXDG','P','RX','RY','RZ','U','SWAP','ISWAP','RXX','RYY','RZZ'];
for(const g of names){for(const nc of [0,1,2]){ const G=Sim.G[g]; if(G.nt===2&&nc>1&&g!=='SWAP')continue; if(G.nt===2&&nc===1&&g!=='SWAP')continue;
  const p=Array.from({length:G.np},()=>Math.random()*6-3); const n=G.nt+nc; const q=Array.from({length:G.nt},(_,i)=>nc+i), c=Array.from({length:nc},(_,i)=>i);
  const op={g,q,c,p,col:0}; const b=Passes.toBasis({n,ops:[op]}); const r=Sim.sameUnitary(n,[op],b.ops);
  if(!r.ok) chk(`basis ${g} with ${nc} controls`, false, JSON.stringify(r)); }}
// 3-control MCX
{const op={g:'X',q:[3],c:[0,1,2],col:0}; const b=Passes.toBasis({n:4,ops:[op]}); chk('MCX(3) decomposes exactly',Sim.sameUnitary(4,[op],b.ops).ok, b.ops.filter(o=>o.c&&o.c.length).length+' CX');}
{const op={g:'Z',q:[3],c:[0,1,2],col:0}; const b=Passes.toBasis({n:4,ops:[op]}); chk('MCZ(3) decomposes exactly',Sim.sameUnitary(4,[op],b.ops).ok);}
chk('all basis translations exact', fail===0);
// optimise keeps unitary and removes H H
{const c={n:2,ops:[{g:'H',q:[0],col:0},{g:'H',q:[0],col:1},{g:'T',q:[1],col:0},{g:'T',q:[1],col:1},{g:'X',q:[1],c:[0],col:2},{g:'Z',q:[0],col:3},{g:'X',q:[1],c:[0],col:4}]};
 const o=Passes.optimise(c); chk('optimise preserves unitary',Sim.sameUnitary(2,c.ops,o.circ.ops).ok, o.circ.ops.map(x=>Sim.displayName(x)).join(' '));}
// routing on linear device preserves logical behaviour (check distribution of GHZ-4 routed)
{const c={n:4,ops:[{g:'H',q:[0],col:0},{g:'X',q:[3],c:[0],col:1},{g:'X',q:[2],c:[0],col:2},{g:'X',q:[1],c:[3],col:3}]}; const r=Passes.route(c,Passes.DEVICES.linear(4)); const p=Sim.probs(Sim.run(r.circ)); chk('routing: GHZ keeps 2 outcomes', Array.from(p).filter(x=>x>1e-9).length===2, r.swaps+' swaps');}
// code roundtrip in 4 SDKs
const sample={n:3,nc:3,ops:[{id:1,g:'H',q:[0],c:[],p:[],col:0},{id:2,g:'X',q:[1],c:[0],p:[],col:1},{id:3,g:'RZ',q:[2],c:[],p:[Math.PI/4],col:1},{id:4,g:'P',q:[2],c:[1],p:[0.3],col:2},{id:5,g:'X',q:[2],c:[0,1],p:[],col:3},{id:6,g:'SWAP',q:[0,2],c:[],p:[],col:4},{id:7,g:'RZZ',q:[0,1],c:[],p:['theta'],col:5},{id:8,g:'M',q:[0],c:[],p:[],cb:0,col:6},{id:9,g:'X',q:[1],c:[],p:[],col:7,cond:{bit:0,val:1}},{id:10,g:'SDG',q:[2],c:[],p:[],col:7}],params:{theta:0.7}};
for(const lang of ['qiskit','qasm','cirq','pennylane']){const t=Code.gen(lang,sample).text; const r=Code.parse(lang,t); const ok=!r.errors.length && r.n===3; let eq=false; if(ok){ const a=Sim.run({n:3,ops:sample.ops.filter(o=>o.g!=='M'&&!o.cond),params:{theta:.7}}); const bops=r.ops.filter(o=>o.g!=='M'&&!o.cond).map((o,i)=>Object.assign(o,{col:i})); const b=Sim.run({n:3,ops:bops,params:{theta:.7}}); eq=Sim.fidelity(a,b)>1-1e-9;} chk('roundtrip '+lang, ok&&eq, r.errors.map(e=>e.msg).join(' | ')+' ops '+r.ops.length); if(!(ok&&eq)) console.log(t);}
console.log(Code.quantikz(sample).split('\n').length>3?'quantikz ok':'');
const m=Passes.metrics(sample); console.log(JSON.stringify(m));
console.log(fail?fail+' fail':'green');
