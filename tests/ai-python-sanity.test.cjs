'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const scripts=['ai/prepare_dataset.py','ai/train_whisper.py','ai/evaluate_timing.py','ai/promote_model.py'];
const executables=process.platform==='win32'?
  [['py','-3'],['python',null]]:[['python3',null],['python',null]];
function findPython(){
 for(const [binary,prefix] of executables){
   const args=[...(prefix?[prefix]:[]),'--version'];
   const result=spawnSync(binary,args,{encoding:'utf8',timeout:5000});
   if(result.status===0&&/^Python 3\./.test((result.stdout||result.stderr||'').trim()))
     return {binary,args:prefix?[prefix]:[]};
 }
 return null;
}
function run(python,args){
 return spawnSync(python.binary,[...python.args,...args],{
   cwd:root,encoding:'utf8',timeout:15000
 });
}

test('training and model-promotion Python source files parse without installing ML libraries',t=>{
 const python=findPython();
 if(!python){t.skip('Python 3 não está instalado no runner.');return;}
 const code='import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding="utf-8"),filename=p) for p in sys.argv[1:]]';
 const output=run(python,['-c',code,...scripts]);
 assert.equal(output.status,0,output.stderr||output.stdout);
});
test('timing evaluator measures real errors and never approves a bogus perfect timestamp',async t=>{
 const python=findPython();
 if(!python){t.skip('Python 3 não está instalado no runner.');return;}
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nosso-culto-timing-'));
 try{
   const input=path.join(folder,'input.jsonl'),output=path.join(folder,'result.json');
   fs.writeFileSync(input,JSON.stringify({
     recording:'authorized_test.wav',
     reference:[{time:12.4,text:'Deus é amor'},{time:28.2,text:'Senhor da paz'}],
     prediction:[{time:12.7,text:'Deus é amor'},{time:34.2,text:'Senhor da paz'}]
   })+'\n');
   const result=run(python,['ai/evaluate_timing.py','--input',input,'--output',output]);
   assert.equal(result.status,0,result.stderr||result.stdout);
   const report=JSON.parse(fs.readFileSync(output,'utf8'));
   assert.equal(report.reference_verses,2);
   assert.equal(report.matched_verses,2);
   assert.equal(report.timing_gate_passed,false);
   assert.ok(report.mean_absolute_start_error_seconds>1);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
