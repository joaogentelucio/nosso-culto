'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const work=read('src/MusicWorkspace.tsx');
const app=read('src/App.tsx');
const browser=read('src/web-media.ts');
const music=read('src/music.ts');
const pkg=JSON.parse(read('package.json'));

test('browser audio importer is available without Electron',()=>{
 assert.ok(work.includes("onImportWeb:(kind:'files'|'folder'|'zip',files:File[])=>Promise<void>"));
 for(const kind of ["files","folder","zip"]){
   assert.ok(work.includes("importChosenFiles('"+kind+"'"),kind);
 }
 assert.doesNotMatch(work,/disabled=\{!window\.desktop\|\|importing\}/);
 assert.ok(browser.includes('indexedDB.open(DB_NAME,1)'));
 assert.ok(browser.includes('tx.objectStore(STORE).put(blob,id)'));
 assert.ok(!browser.includes('fetch('),'music must not be sent to a remote server');
});
test('web player restores stored audio as a temporary object URL',()=>{
 assert.ok(browser.includes('URL.createObjectURL(blob)'));
 assert.ok(browser.includes('URL.revokeObjectURL(created)'));
 assert.ok(work.includes('useWebAudioUrl(!window.desktop?current?.audioId:undefined)'));
 assert.ok(work.includes('src={window.desktop?audioUrl(current):browserAudio.url??undefined}'));
 assert.ok(music.includes('culto-media://asset/'),'keep native Electron protocol for desktop');
});
test('folder, ZIP and LRC handling are supported in web mode',()=>{
 assert.ok(work.includes("input?.setAttribute('webkitdirectory','')"));
 assert.ok(work.includes('zipFilesRef'));
 assert.ok(work.includes('lrcFilesRef'));
 assert.ok(browser.includes('JSZip.loadAsync(file'));
 assert.ok(browser.includes("ext==='lrc'"));
 assert.ok(browser.includes('parseWebLrcFile'));
 assert.ok(pkg.dependencies.jszip);
});
test('web and desktop import paths coexist in the controller',()=>{
 assert.ok(app.includes('await window.desktop.importMedia(kind)'));
 assert.ok(app.includes('await importWebMedia(webFiles??[],kind)'));
 assert.ok(app.includes('await parseWebLrcFile(webFile!)'));
 assert.ok(app.includes('deleteWebAudio(track.audioId)'));
 assert.ok(app.includes("localStorage.setItem(BROWSER_KEY,JSON.stringify(data))"));
});
