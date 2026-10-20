'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const source=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('browser speech model remains the baseline until ALL release gates pass',()=>{
 const script=ts.transpileModule(source('src/ai-model-selection.ts'),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const output={};
 vm.runInNewContext(script,{exports:output},{filename:'ai-model-selection.js'});
 const choose=output.selectSpeechModel;
 const original='Xenova/whisper-base';
 const candidate='NexoCeo/nosso-culto-ai-whisper-pt';
 const good={schema_version:1,model_id:candidate,quality_gate_passed:true,
   timing_gate_passed:true,browser_export_verified:true};
 assert.equal(choose(null),original);
 assert.equal(choose({}),original);
 assert.equal(choose({...good,timing_gate_passed:false}),original);
 assert.equal(choose({...good,quality_gate_passed:false}),original);
 assert.equal(choose({...good,browser_export_verified:false}),original);
 assert.equal(choose({...good,model_id:'../../../system'}),original);
 assert.equal(choose(good),candidate);
 const release=JSON.parse(source('public/ai/active-model.json'));
 assert.equal(choose(release),original,'no custom model has been trained and deployed yet');
});
test('web worker loads verified candidate and falls back to baseline on error',()=>{
 const worker=source('src/web-whisper.worker.ts');
 assert.match(worker,/selectSpeechModel\(await response\.json\(\)\)/);
 assert.match(worker,/fetch\('\/ai\/active-model\.json'/); // manifest must be fetched from our origin
 assert.match(worker,/mod\.pipeline\('automatic-speech-recognition',selected,options\)/);
 assert.match(worker,/mod\.pipeline\('automatic-speech-recognition',MODEL_ID,options\)/);
 assert.match(worker,/RUNTIME_URL/);
});
test('desktop engine uses verified model or the existing Whisper without UI changes',async()=>{
 const modulePath=path.join(root,'electron/ai-model-selection.cjs');
 const {verifiedBundledModel}=require(modulePath);
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'nosso-culto-ai-gate-'));
 try{
   assert.equal(await verifiedBundledModel(dir),null);
   const modelDir=path.join(dir,'models');
   await fsp.mkdir(modelDir);
   await fsp.writeFile(path.join(modelDir,'release.json'),JSON.stringify({
     schema_version:1,filename:'ggml-nosso-culto-ai.bin',
     quality_gate_passed:true,timing_gate_passed:true,ggml_export_verified:true,
     sha256:'0'.repeat(64),baseline_test_wer:0.6,candidate_test_wer:0.4,
     mean_absolute_start_error_seconds:0.3
   }));
   assert.equal(await verifiedBundledModel(dir),null,'manifest alone is not a usable model');
   const sourceFile=source('electron/local-transcription.cjs');
   assert.match(sourceFile,/await verifiedBundledModel\(toolsDir\(\)\)/);
   assert.match(sourceFile,/await ensureModel\(model,job,sender\)/);
 }finally{await fsp.rm(dir,{recursive:true,force:true});}
});
test('training is isolated, requires licensed material, measures WER and timing',()=>{
 const pre=source('ai/prepare_dataset.py');
 const train=source('ai/train_whisper.py');
 const timing=source('ai/evaluate_timing.py');
 assert.match(pre,/licensed/);
 assert.match(pre,/A mesma gravação não pode aparecer/);
 assert.match(pre,/SPLITS = \{"train", "validation", "test"\}/);
 assert.match(train,/baseline_test_wer/);
 assert.match(train,/candidate_test_wer/);
 assert.match(train,/quality_gate_passed/);
 assert.match(train,/released_to_users": False/);
 assert.match(timing,/timing_gate_passed/);
 assert.match(timing,/mean_absolute_start_error_seconds/);
});

test('promotion does not mark a model as verified without both independent reports',()=>{
 const code=source('ai/promote_model.py');
 assert.match(code,/validate_reports\(training, timing\)/);
 assert.match(code,/quality_gate_passed/);
 assert.match(code,/timing_gate_passed/);
 assert.match(code,/--confirmed-runtime-tests/);
 assert.match(code,/--onnx-verified/);
 assert.match(code,/--ggml-verified/);
 assert.match(code,/hashlib\.sha256/);
 assert.doesNotMatch(source('public/ai/active-model.json'),/"browser_export_verified": true/);
});
