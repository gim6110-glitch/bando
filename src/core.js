(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CMP=factory();})(typeof window!=='undefined'?window:this,function(){
'use strict';
const VERSION='1.0.0';
const FEATURES={SIM:['pressure_kpa','rotation_rpm','pad_wear','slurry_ml_min'],REAL:['pressure_scaled','rotation_scaled','pad_usage_scaled','slurry_scaled']};
const COLUMNS=['schema_version','source','run_id','wafer_id','stage','timestamp','sequence','pressure_set_kpa','rotation_set_rpm','pressure_kpa','rotation_rpm','pad_wear','slurry_ml_min','duration_s','initial_thickness_nm','mrr','inspection_thickness_nm','condition','split','experiment_note'];
const LABELS={ROUTINE:'통상 검사',REVIEW:'추가 검사',HOLD:'보류 · 확인',INVALID:'판정 불가',READY:'시작 대기',RUNNING:'모의 운전',STOP:'안전 정지 유지',CHECK:'확인 필요'};
const finite=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v));
const round=(x,n=4)=>Number(x.toFixed(n));
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function simulate(options={},seed=42){
 const o={pressure:30,rotation:60,duration:60,pad:.15,condition:'standard',sequence:1,prefix:'SIM',...options};
 for(const [k,a,b] of [['pressure',20,36],['rotation',40,70],['duration',30,75],['pad',0,1]])if(!finite(o[k])||o[k]<a||o[k]>b)throw Error(k+' 입력 범위를 확인하세요.');
 if(!['standard','changed'].includes(o.condition))throw Error('알 수 없는 공정 조건입니다.');
 const r=rng(seed),noise=()=>r()+r()+r()+r()+r()+r()-3;
 const trace=[];const slurry=round(200+noise()*2),p=round(o.pressure+noise()*.25),rpm=round(o.rotation+noise()*.45);
 const rel=1-.38*o.pad; const factor=o.condition==='changed'?.86:1;
 const mrr=round(Math.max(1,525*(p/30)*(rpm/60)*rel*(.9+.1*slurry/200)*factor+noise()*4));
 const thickness=round(1000-mrr*o.duration/60);
 for(let i=0;i<12;i++)trace.push({second:round(o.duration*i/11,1),pressure_kpa:round(p+noise()*.2,2),rotation_rpm:round(rpm+noise()*.35,2)});
 // Recenter traces so exported means equal the feature values used in the physics model.
 for(const [key,value] of [['pressure_kpa',p],['rotation_rpm',rpm]]){const avg=trace.reduce((s,v)=>s+v[key],0)/trace.length;trace.forEach(v=>v[key]=round(v[key]+value-avg,6));}
 const id=o.prefix+'-'+String(o.sequence).padStart(4,'0');
 const row={schema_version:VERSION,source:'SIM',run_id:id,wafer_id:id,stage:'EDU',timestamp:o.timestamp||new Date().toISOString(),sequence:o.sequence,pressure_set_kpa:o.pressure,rotation_set_rpm:o.rotation,pressure_kpa:p,rotation_rpm:rpm,pad_wear:o.pad,slurry_ml_min:slurry,duration_s:o.duration,initial_thickness_nm:1000,mrr,inspection_thickness_nm:thickness,condition:o.condition,split:'',experiment_note:String(o.experiment_note||'').slice(0,500)};
 if(thickness<0||thickness>1000)throw Error('두께가 교육용 물리 범위를 벗어났습니다. 조건을 확인하세요.');
 return {row,trace};
}
function csv(rows,columns){if(!rows.length)return (columns||COLUMNS).join(',')+'\r\n';const keys=columns||Object.keys(rows[0]);const esc=v=>{let s=v==null?'':String(v);if(/^[=+@]/.test(s)||/^-[^\d.]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};return '\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(a=>a.map(esc).join(',')).join('\r\n');}
function parseCSV(text){
 if(typeof text!=='string'||text.length>20e6)throw Error('CSV는 20 MB 이하로 준비하세요.');
 text=text.replace(/^\uFEFF/,'');let rows=[],row=[],v='',quoted=false,ended=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){v+='"';i++;}else {quoted=false;ended=true;}}else v+=c;}else if(c==='"'){if(v||ended)throw Error('CSV 따옴표 형식이 잘못되었습니다.');quoted=true;}else if(c===','){row.push(v);v='';ended=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);if(row.some(x=>x!==''))rows.push(row);row=[];v='';ended=false;}else{if(ended&&c.trim())throw Error('CSV 따옴표 뒤의 문자를 확인하세요.');v+=c;}}
 if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');row.push(v);if(row.some(x=>x!==''))rows.push(row);
 if(rows.length<2)throw Error('제목과 데이터 행이 있는 CSV를 선택하세요.');const h=rows.shift().map(x=>x.trim());if(h.some(x=>!x)||new Set(h).size!==h.length)throw Error('빈 열 이름 또는 중복된 열 이름이 있습니다.');if(rows.length>20000)throw Error('수업용 CSV는 20,000행 이하로 준비하세요.');
 return rows.map((r,i)=>{if(r.length!==h.length)throw Error((i+2)+'행의 열 개수가 다릅니다.');const o=Object.create(null);h.forEach((k,j)=>{if(['__proto__','prototype','constructor'].includes(k))throw Error('허용되지 않는 열 이름입니다.');o[k]=r[j].trim();});return o;});
}
function validateModel(m){
 if(!m||m.format!=='daa-cmp-rf-v1'||!FEATURES[m.source])throw Error('CMP Colab에서 저장한 모델 JSON이 필요합니다.');
 if(typeof m.model_version!=='string'||!m.model_version||m.model_version.length>80||!m.split_counts||!Number.isInteger(m.split_counts.train)||m.split_counts.train<1||!m.metrics||!m.metrics.test||!Number.isFinite(m.metrics.test.mae))throw Error('모델 버전·학습 수·평가 정보가 없습니다.');
 if(m.schema_version!==VERSION||m.stage!==(m.source==='SIM'?'EDU':'A'))throw Error('모델의 자료 규격 버전 또는 공정 단계가 맞지 않습니다.');
 if(JSON.stringify(m.features)!==JSON.stringify(FEATURES[m.source]))throw Error('모델의 입력 열과 순서가 다릅니다.');
 if(m.target!=='mrr'||m.inference_timing!=='post_process_pre_inspection')throw Error('예측 대상 또는 판정 시점이 맞지 않습니다.');
 if(!Array.isArray(m.trees)||m.trees.length<1||m.trees.length>200)throw Error('모델의 나무 수가 허용 범위를 벗어납니다.');
 let total=0;
 for(const t of m.trees){if(!t||!Array.isArray(t.left))throw Error('모델 구조가 잘못되었습니다.');const n=t.left.length;total+=n;if(n<1||n>20000||total>200000)throw Error('모델이 너무 크거나 비어 있습니다.');for(const k of ['right','feature','threshold','value'])if(!Array.isArray(t[k])||t[k].length!==n)throw Error('모델 배열 길이가 다릅니다.');let seen=new Set(),active=new Set();
  function check(i,depth){if(!Number.isInteger(i)||i<0||i>=n||depth>50||active.has(i)||seen.has(i))throw Error('모델의 나무 구조가 올바르지 않습니다.');active.add(i);seen.add(i);if(!Number.isFinite(t.value[i]))throw Error('모델 값이 유효하지 않습니다.');if(t.left[i]===-1){if(t.right[i]!==-1)throw Error('모델 말단이 잘못되었습니다.');}else{if(!Number.isInteger(t.feature[i])||t.feature[i]<0||t.feature[i]>=m.features.length||!Number.isFinite(t.threshold[i]))throw Error('모델 분기 값이 잘못되었습니다.');check(t.left[i],depth+1);check(t.right[i],depth+1);}active.delete(i);}check(0,0);if(seen.size!==n)throw Error('연결되지 않은 모델 노드가 있습니다.');}
 return m;
}
function predict(m,row){
 if(!m)throw Error('학습 모델을 먼저 불러오세요.');if(row.schema_version!==VERSION)throw Error('데이터 규격 버전이 맞지 않습니다.');if(row.source!==m.source)throw Error('데이터와 모델의 출처가 다릅니다. SIM과 REAL을 구분하세요.');if(m.stage&&row.stage!==m.stage)throw Error('모델과 데이터의 공정 단계가 다릅니다.');
 const x=m.features.map(k=>{if(!finite(row[k])||!Number.isFinite(Math.fround(Number(row[k]))))throw Error(k+' 값이 비어 있거나 사용할 수 있는 숫자가 아닙니다.');return Math.fround(Number(row[k]));});
 const predictions=m.trees.map(t=>{let i=0,steps=0;while(t.left[i]!==-1){if(++steps>50)throw Error('모델 탐색 오류');i=x[t.feature[i]]<=t.threshold[i]?t.left[i]:t.right[i];}return t.value[i];});
 const value=predictions.reduce((s,v)=>s+v,0)/predictions.length;
 const outside=m.features.filter((k,i)=>m.training_ranges&&m.training_ranges[k]&&(Number(row[k])<m.training_ranges[k][0]||Number(row[k])>m.training_ranges[k][1]));
 return {value,outside};
}
function policy(thickness,kind='A'){if(!Number.isFinite(thickness))return 'INVALID';if(thickness<480||thickness>520)return 'HOLD';const lo=kind==='B'?490:485,hi=kind==='B'?510:515;return thickness<lo||thickness>hi?'REVIEW':'ROUTINE';}
function assess(m,row,kind='A'){
 try{const p=predict(m,row);if(row.source==='REAL')return {status:'REAL',mrr:p.value,outside:p.outside,thickness:null,error:null};if(!finite(row.duration_s)||Number(row.duration_s)<30||Number(row.duration_s)>75||Number(row.initial_thickness_nm)!==1000)throw Error('수업용 연마 시간 30~75초, 시작 두께 1000 nm를 확인하세요.');const thickness=Number(row.initial_thickness_nm)-p.value*Number(row.duration_s)/60;let status=policy(thickness,kind);if(p.outside.length&&status==='ROUTINE')status='REVIEW';return {status,mrr:p.value,thickness,outside:p.outside,error:null};}catch(e){return {status:'INVALID',mrr:null,thickness:null,outside:[],error:e.message};}
}
function inspected(row){return row.source==='SIM'&&finite(row.inspection_thickness_nm)&&Number(row.inspection_thickness_nm)>=0&&Number(row.inspection_thickness_nm)<=1000?(Number(row.inspection_thickness_nm)>=480&&Number(row.inspection_thickness_nm)<=520?'PASS':'FAIL'):null;}
function dayKey(ts){const d=new Date(ts);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null;}
function daily(rows,date){const selected=rows.filter(x=>x.row.source==='SIM'&&dayKey(x.row.timestamp)===date);const checked=selected.filter(x=>x.inspection_revealed&&inspected(x.row));const fail=checked.filter(x=>inspected(x.row)==='FAIL').length;return{total:selected.length,inspected:checked.length,uninspected:selected.length-checked.length,failed:fail,rate:checked.length?100*fail/checked.length:null};}
function newSafety(){return{safe:true,latched:false,ack:false,permit:false,running:false,quality:'ROUTINE',dataOK:true};}
function state(s){if(!s.safe||s.latched)return 'STOP';if(!s.dataOK||['HOLD','REVIEW','INVALID'].includes(s.quality))return 'CHECK';return s.running?'RUNNING':'READY';}
function safety(s,event){const n={...s};let message='';switch(event){case'ESTOP':n.safe=false;n.latched=true;n.ack=false;n.permit=false;n.running=false;message='비상정지 발생. 정지 상태를 유지합니다.';break;case'RESTORE':n.safe=true;message='위험 원인을 해소했습니다. RESET 전까지 정지 유지.';break;case'ACK':n.ack=true;message='알람을 확인했습니다. 운전 상태는 바뀌지 않습니다.';break;case'RESET':if(!n.safe){message='복구 거부: 위험 원인을 먼저 해소하세요.';}else if(!n.latched){message='해제할 안전 정지 유지 상태가 없습니다.';}else {n.latched=false;n.running=false;n.permit=false;message='복구 처리. 데이터·품질 조건을 다시 확인하며 자동 시작하지 않습니다.';}break;case'PERMIT':if(state(n)==='STOP'||state(n)==='CHECK'){message='운전 허가 거부: 안전·데이터·품질 조건을 확인하세요.';}else{n.permit=true;message='운전을 허가했습니다. 시작 버튼이 별도로 필요합니다.';}break;case'START':if(state(n)==='STOP'||state(n)==='CHECK'||!n.permit){message='시작 거부: 복구·확인·운전 허가가 필요합니다.';}else{n.running=true;message='별도 시작 요청으로 모의 운전을 시작했습니다.';}break;case'COMPLETE':n.running=false;n.permit=false;message='모의 운전을 완료했습니다.';break;default:throw Error('알 수 없는 안전 이벤트');}return {next:n,message,state:state(n)};}
function qualityUpdate(s,status){const n={...s,quality:status,dataOK:status!=='INVALID',running:false,permit:false};if(['HOLD','REVIEW','INVALID'].includes(status)){n.running=false;n.permit=false;}return n;}

function qualityForEntry(e){
 if(!e||e.row.source!=='SIM'||e.assessment.status==='INVALID')return 'INVALID';
 if(!e.inspection_revealed||!inspected(e.row))return e.assessment.status==='HOLD'?'HOLD':'REVIEW';
 return inspected(e.row)==='PASS'?'ROUTINE':'HOLD';
}
function replay(m,pack){
 if(!pack||pack.format!=='cmp-safety-replay-v1'||!Array.isArray(pack.events)||pack.events.length>200||!pack.rows)throw Error('시험 재현 JSON의 형식이 다릅니다.');
 if(pack.model_version!==m.model_version)throw Error('시험 파일과 모델 버전이 다릅니다. 제공 모델을 연결하세요.');
 let s=qualityUpdate(newSafety(),'INVALID'),selected=null;const logs=[];
 for(const item of pack.events){
  if(item.event.startsWith('APPLY_')){const key=item.event.slice(6),row=pack.rows[key];if(!row)throw Error('시험 웨이퍼가 없습니다.');selected={row,assessment:assess(m,row),inspection_revealed:true};s=qualityUpdate(s,qualityForEntry(selected));}
  else if(['ESTOP','RESTORE','ACK','RESET','PERMIT','START','COMPLETE'].includes(item.event))s=safety(s,item.event).next;
  else throw Error('지원하지 않는 시험 이벤트입니다.');
  const actual=state(s);logs.push({event:item.event,expected_state:item.expected_state,actual_state:actual,expected_permit:item.expected_permit,actual_permit:s.permit,result:actual===item.expected_state&&s.permit===item.expected_permit?'PASS':'FAIL',run_id:selected?.row.run_id||'',quality:s.quality,stop_latched:s.latched,source:m.source,model_version:m.model_version});
 }
 return{state:s,logs,passed:logs.every(l=>l.result==='PASS')};
}

return{qualityForEntry,replay,VERSION,FEATURES,COLUMNS,LABELS,finite,round,rng,simulate,csv,parseCSV,validateModel,predict,policy,assess,inspected,dayKey,daily,newSafety,state,safety,qualityUpdate};
});
