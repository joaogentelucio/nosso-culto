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
 const methods=['localTranscriptionStatus','transcribeLocalAudio','cancelLocalTranscription','onLocalTranscriptionProgress'];
 for(const method of methods){
   assert.match(renderer,new RegExp('window\\.desktop\\.'+method+'\\('));
   assert.match(preload,new RegExp('\\b'+method+':\\s*\\('));
 }
});
test('main process registers IPC channels needed by preload transcription functions',()=>{
 for(const channel of ['transcription:local-status','transcription:local-run','transcription:local-cancel']){
   assert.ok(preload.includes(channel),'preload missing '+channel);
   assert.ok(main.includes('ipcMain.handle(\''+channel+'\''),'main missing '+channel);
 }
});
test('renderer verifies local transcription without showing infrastructure settings',()=>{
 assert.match(renderer,/typeof window\.desktop\.localTranscriptionStatus!=='function'/);
 assert.match(renderer,/typeof window\.desktop\.transcribeLocalAudio!=='function'/);
 assert.match(renderer,/Instale a versão Windows completa do Nosso Culto/);
 assert.doesNotMatch(renderer,/music-openai-key|music-ai-mode-picker/);
});
