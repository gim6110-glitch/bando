// Event-handler integration with a minimal DOM test double. Not browser/visual QA.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('./src/core.js'),html=fs.readFileSync('src/index.html','utf8');
function harness(role){
 const elements=new Map(),events=[],tabs=[],screens=[],download=[];const make=(id='')=>({id,value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,checked:false,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(e,f){this['on'+e]=f;},append(){},remove(){},click(){download.push(this.download);},closest(){return this;}});
 for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const e=make(m[1]),v=m[0].match(/\bvalue="([^"]*)"/);if(v)e.value=v[1];elements.set(e.id,e);if(/class="screen/.test(m[0]))screens.push(e);}
 for(const name of ['tab','event','scenario','download']){for(const m of html.matchAll(new RegExp('<[^>]*data-'+name+'="([^"]+)"[^>]*>','g'))){const e=make();e.dataset[name]=m[1];(name==='tab'?tabs:events).push(e);}}
 const select={'.process':make(),'.plot-key':make(),'.safety-card':make(),'.brand':make()};
 const document={getElementById:id=>{if(!elements.has(id))throw Error('Missing DOM id '+id);return elements.get(id);},querySelector:s=>select[s]||make(),querySelectorAll:s=>s==='.screen'?screens:s.includes('[data-tab]')?tabs:events.filter(e=>s.includes('[data-'+Object.keys(e.dataset)[0]+']')),createElement:()=>make(),body:make()};
 const storage=new Map(),localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const box={document,localStorage,console,URL:Object.assign(URL,{createObjectURL:()=>'',revokeObjectURL(){}}),Blob,Date,Math,Number,JSON,Intl,Set,Map,history:{replaceState(){}},location:{hash:'',reload(){}},confirm:()=>true,setTimeout:f=>{f();return 1;},clearTimeout(){}};
 box.window={CMP:C,CMP_ENTRY:role,addEventListener(){},scrollTo(){}};vm.createContext(box);vm.runInContext(fs.readFileSync('src/data.js','utf8'),box);vm.runInContext(fs.readFileSync('src/scenarios.js','utf8'),box);
 for(const [id,v] of Object.entries({pad:'.15',condition:'standard',day:'',policy:'A',sourceMode:'SIM',loopChange:'다음 작업의 연마 시간'}))elements.get(id).value=v;
 vm.runInContext(fs.readFileSync('src/app.js','utf8'),box);
 const state=()=>JSON.parse(storage.get('daa-cmp-'+role+'-v1')).state;
 return{$:id=>elements.get(id),event:(key,v)=>events.find(e=>e.dataset[key]===v),state,box,download};
}
(async()=>{
 const report=[];const sim=harness('lab');await sim.$('run').onclick();assert.equal(sim.state().sim.length,1);sim.$('pressure').value='26';await sim.$('run').onclick();sim.$('pressure').value='34';await sim.$('run').onclick();assert.equal(sim.state().sim.length,3);sim.$('batch').onclick();assert.equal(sim.state().sim.length,63);sim.$('exportSim').onclick();assert.ok(sim.download.includes('SIM_my_experiments.csv'));report.push('simulator handlers: three runs, 60-run grid, CSV creation');
 const tower=harness('tower');tower.$('demoData').onclick();assert.equal(tower.state().entries.length,36);tower.$('policyCompare').onclick();assert.match(tower.$('policyResult').innerHTML,/<td>18<\/td>/);report.push('36-case A/B DOM rendering');
 let entry=tower.state().entries.find(e=>e.assessment.status==='ROUTINE');let index=tower.state().entries.findIndex(e=>e.row.run_id===entry.row.run_id);
 tower.$('towerRows').onclick({target:{closest:s=>s==='[data-select]'?{dataset:{select:String(index)}}:null}});
 tower.event('event','PERMIT').onclick();tower.event('event','START').onclick();assert.equal(tower.state().safety.running,false);assert.equal(tower.state().safety.quality,'REVIEW');report.push('uninspected routine prediction cannot authorize operation');
 tower.event('scenario','A').onclick();tower.event('event','PERMIT').onclick();tower.event('event','START').onclick();assert.equal(tower.state().safety.running,true);
 tower.event('scenario','C').onclick();assert.equal(C.state(tower.state().safety),'STOP');tower.event('event','ACK').onclick();tower.event('event','RESET').onclick();assert.equal(C.state(tower.state().safety),'STOP');tower.event('event','RESTORE').onclick();assert.equal(C.state(tower.state().safety),'STOP');tower.event('event','RESET').onclick();assert.equal(C.state(tower.state().safety),'READY');assert.equal(tower.state().safety.permit,false);tower.event('event','PERMIT').onclick();tower.event('event','START').onclick();assert.equal(tower.state().safety.running,true);report.push('A/C click handlers: inspection, run, stop latch, reset and separate start');
 tower.event('scenario','B').onclick();assert.equal(C.state(tower.state().safety),'CHECK');assert.equal(tower.state().safety.latched,false);tower.event('scenario','D').onclick();assert.equal(tower.state().safety.quality,'INVALID');report.push('B/D actual click handlers block safely');
 tower.$('inspectAll').onclick();tower.$('loopBefore').value=tower.state().entries[0].row.run_id;tower.$('loopAfter').value=tower.state().entries[1].row.run_id;tower.$('loopEvidence').value='검사 두께 비교';tower.$('loopExpected').value='목표와 차이 감소';tower.$('loopResult').value='두 반복 결과만으로 일반화하지 않음';tower.$('saveLoop').onclick();assert.equal(tower.state().loops.length,1);report.push('LOOP saves actual two-wafer measurement references');
 tower.$('clearTower').onclick();assert.equal(tower.state().safety.quality,'INVALID');assert.equal(tower.state().safety.permit,false);report.push('clearing wafer list invalidates operation permit');
 const pack=JSON.parse(fs.readFileSync('src/downloads/replay_event_sequence.json'));const replay=C.replay(tower.box.window.CMP_BUNDLE.simModel,pack);assert.equal(replay.passed,true);assert.equal(replay.logs.length,23);fs.writeFileSync('replay_test_results.csv',C.csv(replay.logs));report.push('23 events replay through shared state engine');
 const result={environment:'Node VM with DOM test doubles; no browser layout or browser downloads verified',passed:report.length,tests:report};fs.writeFileSync('workflow_test_results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
