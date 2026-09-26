const fs=require('fs'); eval(fs.readFileSync('simlib.js','utf8')+';global.SIMLIB=SIMLIB'); const Sim=SIMLIB();
const T=require('./tests.js')(Sim); let f=0; for(const t of T){console.log((t.pass?'PASS':'FAIL'),t.name,'→',t.got); if(!t.pass)f++;} console.log(f?f+' failing':'all green');
