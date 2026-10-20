'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
const ui=read('src/MusicWorkspace.tsx');
const worker=read('src/web-whisper.worker.ts');
const browser=read('src/web-transcription.ts');
const db=read('src/web-media.ts');
const alignment=read('src/web-lyrics-alignment.ts');

test('Transcrever is clickable on the web when a music file exists',()=>{
 assert.match(ui,/disabled=\{!current\.audioId\|\|transcribing\}/);
 assert.doesNotMatch(ui,/disabled=\{!window\.desktop\|\|!current\.audioId\|\|transcribing\}/);
 assert.match(ui,/await transcribeInBrowser\(current\.audioId,suppliedLyrics,/);
 assert.match(ui,/Transcrevendo…/);
 assert.match(ui,/Cancelar/);
});
test('web audio is read from IndexedDB and never uploaded to any server',()=>{
 assert.match(browser,/getWebAudioForTranscription\(audioId\)/);
 assert.match(db,/return readAudio\(id\)/);
 assert.match(browser,/new AudioContext\(\{sampleRate:16000\}\)/);
 assert.match(browser,/decodeAudioData/);
 assert.match(browser,/new Float32Array\(audio.length\)/);
 assert.match(browser,/worker\.postMessage\(\{type:'transcribe',audio:pcm\.buffer\},\[pcm\.buffer\]\)/);
 assert.doesNotMatch(browser,/fetch\(|XMLHttpRequest|FormData/);
 assert.doesNotMatch(worker,/fetch\(.*audio|FormData/);
});
test('Whisper runs in a dedicated web worker with visible progress, cancellation and timestamps',()=>{
 assert.match(browser,/new Worker\(new URL\('\.\/web-whisper\.worker\.ts',import\.meta\.url\),\{type:'module'\}\)/);
 assert.match(browser,/worker\.terminate\(\)/);
 assert.match(browser,/signal\.addEventListener\('abort',cancel/);
 assert.match(worker,/RUNTIME_URL/);
 assert.match(worker,/whisper-base/);
 assert.doesNotMatch(worker,/whisper-tiny/);
 assert.match(worker,/return_timestamps:'word'/);
 assert.doesNotMatch(worker,/time:offset/);
 assert.match(worker,/language:'portuguese'/);
 assert.match(worker,/windowSeconds=28,overlapSeconds=6/);
 assert.match(worker,/keepFrom/);
 assert.match(worker,/keepUntil/);
 assert.match(worker,/assembleTimedVerses/);
 assert.match(worker,/type:'result'/);
});
test('existing lyrics use alignment and poor matches fail instead of fabricating timings',()=>{
 assert.match(browser,/alignWebLyrics\(existingLyrics,verifiedCues\)/);
 assert.match(browser,/validateRecognizedCues\(result\.cues,audio\.duration\)/);
 assert.match(alignment,/count\/Math\.max\(n,1\)<0\.30/);
 assert.match(alignment,/matching\.some\(xs=>xs\.length===0\)/);
 assert.match(alignment,/A ordem dos versos não corresponde/);
});

test('previous AI output is not reused as trusted supplied lyrics on retry',()=>{
 assert.match(ui,/current\.timingSource==='transcribed'\?'':current\.content\.trim\(\)/);
 assert.match(ui,/timingSource:'transcribed'/);
});
test('missing word timestamps cannot be replaced by artificial window start times',()=>{
 assert.match(worker,/if\(!chunks\.length&&result\.text\?\.trim\(\)\)throw Error/);
 assert.match(worker,/typeof start!=='number'\|\|typeof stop!=='number'/);
 assert.match(worker,/invalid\/reported>0\.35/);
 assert.doesNotMatch(worker,/cues\.push\(\{text:result\.text\.trim\(\),time:offset\}\)/);
});
