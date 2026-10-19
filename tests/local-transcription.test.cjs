'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');
const renderer=fs.readFileSync(path.join(root,'src/MusicWorkspace.tsx'),'utf8');
const local=fs.readFileSync(path.join(root,'electron/local-transcription.cjs'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('local offline bridge connects renderer, preload and main',()=>{
 for(const method of ['localTranscriptionStatus','transcribeLocalAudio','cancelLocalTranscription']){
   assert.ok(preload.includes(method),method+' preload missing');
   assert.ok(renderer.includes(method),method+' UI missing');
 }
 for(const channel of ['transcription:local-status','transcription:local-run','transcription:local-cancel']){
   assert.ok(preload.includes(channel),channel+' missing from preload');
   assert.ok(main.includes("ipcMain.handle('"+channel+"'"),channel+' missing in main');
 }
});
test('the free engine has no OpenAI API dependency',()=>{
 assert.doesNotMatch(local,/openai\.com|OPENAI_API_KEY|Authorization:/i);
 assert.ok(renderer.includes("useState<'local'|'api'>('local')"),'local should be the default');
});
test('python worker is included alongside Electron installer assets',()=>{
 assert.equal(fs.existsSync(path.join(root,'electron/local-whisper.py')),true);
 assert.ok(config.build.files.includes('electron/**/*'));
 assert.ok(config.build.asarUnpack.some(s=>s==='electron/*.py'));
});
test('local process does not execute shell strings',()=>{
 assert.match(local,/shell:false/g);
 assert.match(local,/new Set\(\['tiny','base','small'\]\)/);
 assert.match(local,/new Set\(\['auto','pt','en','es'\]\)/);
});
