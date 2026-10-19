'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const preload=fs.readFileSync(path.join(root,'electron','preload.cjs'),'utf8');
const main=fs.readFileSync(path.join(root,'electron','main.cjs'),'utf8');
const renderer=fs.readFileSync(path.join(root,'src','MusicWorkspace.tsx'),'utf8');

test('preload exports every transcription bridge method used by the React interface',()=>{
 const methods=['transcriptionStatus','saveTranscriptionKey','clearTranscriptionKey','transcribeAudio','cancelTranscription'];
 for(const method of methods){
   assert.match(renderer,new RegExp('window\\.desktop\\.'+method+'\\('));
   assert.match(preload,new RegExp('\\b'+method+':\\s*\\('));
 }
});
test('main process registers IPC channels needed by preload transcription functions',()=>{
 for(const channel of ['transcription:status','transcription:save-key','transcription:clear-key','transcription:run','transcription:cancel']){
   assert.ok(preload.includes(channel),'preload missing '+channel);
   assert.ok(main.includes('ipcMain.handle(\''+channel+'\''),'main missing '+channel);
 }
});
test('renderer checks for an out-of-date Electron preload instead of throwing a TypeError',()=>{
 assert.match(renderer,/function compatibleTranscriptionBridge\(/);
 assert.match(renderer,/if\(compatibleTranscriptionBridge\(\)\)/);
 assert.match(renderer,/typeof window\.desktop\?\.localTranscriptionStatus!=='function'/);
 assert.match(renderer,/Atualize o Nosso Culto para usar a versão gratuita/);
});
