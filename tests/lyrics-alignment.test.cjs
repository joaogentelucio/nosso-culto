'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {alignLyrics,slidesFromLyrics}=require('../electron/lyrics-alignment.cjs');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');

test('alignment keeps original accents/words and uses real recognition timings',()=>{
 const lyric='Deus é bom\n\nDeus é amor';
 const out=alignLyrics(lyric,[
  {time:8,text:'Deus e bom'},
  {time:18,text:'Deus e amor'}
 ]);
 assert.equal(out.content,lyric);
 assert.deepEqual(out.cues.map(x=>x.text),['Deus é bom','Deus é amor']);
 assert.equal(out.cues[0].time,8);
 assert.equal(out.cues[1].time,18);
 assert.equal(out.matchedRatio,1);
});
test('alignment supports a repeat chorus and estimates positions within segments',()=>{
 const out=alignLyrics('Tu és fiel\n\nMeu bom Senhor\n\nTu és fiel',[
  {time:6,text:'Tu és fiel'},
  {time:15,text:'Meu bom Senhor'},
  {time:25,text:'Tu és fiel'}
 ]);
 assert.deepEqual(out.cues.map(x=>x.time),[6,15,25]);
});
test('lyrics with no matching singing fail without fake evenly distributed cues',()=>{
 assert.throws(()=>alignLyrics('Eu sei que estás aqui\n\nNunca me abandonarás',[
   {time:5,text:'Tecnologia em software'},
   {time:25,text:'Bem vindo ao aplicativo'}
 ]),/Não foi possível localizar todos os versos/);
});
test('line separated lyrics produce slides and refuse ambiguous ordering',()=>{
 assert.deepEqual(slidesFromLyrics('Primeira linha\nSegunda linha\nTerceira linha'),[
  'Primeira linha\nSegunda linha','Terceira linha'
 ]);
});
test('the local IPC supports both auto recognition and user-lyrics alignment silently',()=>{
 const engine=read('electron/local-transcription.cjs');
 const main=read('electron/main.cjs');
 const preload=read('electron/preload.cjs');
 const ui=read('src/MusicWorkspace.tsx');
 assert.ok(engine.includes("lyrics.trim()?'alignment':'recognition'"));
 assert.ok(engine.includes("alignLyrics(lyrics,recognized.cues)"));
 assert.ok(main.includes('localTranscription.transcribe(event.sender,audioId,language,model,media.fileFor,lyrics)'));
 assert.ok(preload.includes("'transcription:local-run',audioId,language,model,lyrics"));
 assert.ok(ui.includes("transcribeLocalAudio(current.audioId,'pt','base',suppliedLyrics)"));
 assert.doesNotMatch(ui,/music-ai-mode-picker|music-openai-key|music-local-model/);
});
