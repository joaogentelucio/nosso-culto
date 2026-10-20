'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const main=read('electron/main.cjs');
const preload=read('electron/preload.cjs');
const ui=read('src/MusicWorkspace.tsx');
const local=read('electron/local-transcription.cjs');
const build=JSON.parse(read('package.json'));

test('the local bridge includes progress events, cancellation and IPC handlers',()=>{
 for(const method of ['localTranscriptionStatus','transcribeLocalAudio','cancelLocalTranscription','onLocalTranscriptionProgress']){
   assert.ok(preload.includes(method),'missing preload method: '+method);
   assert.ok(ui.includes(method),'missing renderer method: '+method);
 }
 for(const channel of ['transcription:local-status','transcription:local-run','transcription:local-cancel']){
   assert.ok(preload.includes(channel)&&main.includes("ipcMain.handle('"+channel+"'"),channel);
 }
 assert.ok(preload.includes('transcription:local-progress'));
 assert.ok(local.includes("sender.send('transcription:local-progress'"));
});
test('the local engine requires no Python or OpenAI tokens',()=>{
 assert.doesNotMatch(local,/faster_whisper|locatePython|Python 3|OPENAI_API_KEY|api\.openai\.com/i);
 assert.ok(ui.includes("useState<'local'|'api'>('local')"),'must default to free local mode');
 assert.match(local,/shell:false/);
 assert.match(local,/https:\/\/huggingface\.co\/ggerganov\/whisper\.cpp/);
});
test('the Windows installer packages whisper.cpp and FFmpeg programs',()=>{
 assert.ok(build.build.extraResources.some(x=>x.from==='build-tools/transcription'&&x.to==='transcription'));
 const script=read('scripts/prepare-transcription-windows.ps1');
 assert.match(script,/whisper-cli\.exe/);
 assert.match(script,/ffmpeg\.exe/);
 const workflow=read('.github/workflows/windows.yml');
 assert.match(workflow,/Build bundled Whisper and FFmpeg/);
 assert.match(workflow,/prepare-transcription-windows\.ps1/);
});
test('the renderer provides a simple local one-click flow with model options',()=>{
 assert.ok(ui.includes('Transcrever e sincronizar'));
 assert.match(ui,/sem Python/);
 assert.match(local,/ggml-.*\.bin/);
});
const {cuesFromLrc}=require('../electron/local-lrc.cjs');
test('read LRC timestamp metadata and keep timestamp ordering',()=>{
 const data=cuesFromLrc('[by:whisper.cpp]\n[00:11.40]Santo Espírito\n[00:04.05]Vem me renovar\n[01:00.00]Teu amor');
 assert.deepEqual(data.cues,[
   {time:4.05,text:'Vem me renovar'},
   {time:11.4,text:'Santo Espírito'},
   {time:60,text:'Teu amor'}
 ]);
 assert.equal(data.content,'Vem me renovar\n\nSanto Espírito\n\nTeu amor');
});
test('empty LRC must not silently generate fake lyrics',()=>{
 assert.throws(()=>cuesFromLrc('[by:whisper.cpp]'),/Nenhuma voz reconhecida/);
});
