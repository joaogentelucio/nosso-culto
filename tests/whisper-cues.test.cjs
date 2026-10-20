'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../src/whisper-cues.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const output={};vm.runInNewContext(code,{exports:output,Error,Map,Number,Math,Array}, {filename:'whisper-cues.js'});
const {assembleTimedVerses,validateRecognizedCues}=output;
test('groups recognized words into natural verses and preserves actual start times',()=>{
 const cues=assembleTimedVerses([
  {start:10.5,end:11,text:'Deus'},{start:11,end:11.5,text:'é'},
  {start:11.5,end:12.1,text:'bom.'},{start:16.4,end:17,text:'Senhor'},
  {start:17,end:17.6,text:'meu'},{start:17.6,end:18.2,text:'Deus.'}
 ],45);
 assert.deepEqual(JSON.parse(JSON.stringify(cues)),[
  {time:10.5,text:'Deus é bom.'},{time:16.4,text:'Senhor meu Deus.'}
 ]);
});
test('drops timestamps outside range; refuses mostly broken timing',()=>{
 assert.throws(()=>assembleTimedVerses([
  {start:24.98,end:24.98,text:'errado'},
  {start:24.98,end:24.98,text:'de novo'},
  {start:4,end:5,text:'válido'},
 ],25),/tempos retornados/);
});
test('never assigns a timestamp to a chunk without measured time',()=>{
 assert.throws(()=>assembleTimedVerses([{start:NaN,end:NaN,text:'música'}],60),/tempos retornados/);
});
test('rejects same-second duplicate verses and does not replace the prior lyrics',()=>{
 assert.throws(()=>validateRecognizedCues([
  {time:249,text:'Eu tenho que ser muito divertido'},
  {time:249,text:'Tu és uma presença'}
 ],518),/fora de ordem/);
});
test('rejects repeated hallucinated phrases, but allows separated repeated worship choruses',()=>{
 const hallucinated=Array.from({length:10},(_,i)=>({time:i*2,text:'a mesma frase inventada'}));
 assert.throws(()=>validateRecognizedCues(hallucinated,90),/repetiu/);
 assert.equal(validateRecognizedCues([
  {time:6,text:'Santo santo santo'},
  {time:20,text:'Deus de misericórdia'},
  {time:45,text:'Santo santo santo'}
 ],80).length,3);
});
