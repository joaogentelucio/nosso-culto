'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {windowBounds}=require('../electron/projection-window.cjs');
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');

test('native resolution creates a centered draggable window within Windows work area',()=>{
 const display={bounds:{x:1920,y:0,width:1920,height:1080},
   workArea:{x:1920,y:0,width:1920,height:1040},scaleFactor:1};
 const bounds=windowBounds(display,'native');
 assert.ok(bounds.width<1920);
 assert.ok(bounds.height<1040);
 assert.ok(bounds.x>1920);
 assert.ok(bounds.y>=0);
 assert.ok(bounds.y+bounds.height<=1040);
 assert.equal(Object.hasOwn(bounds,'fullscreen'),false);
});
test('window placement respects configured monitor location and scale',()=>{
 const display={bounds:{x:-2560,y:40,width:2560,height:1440},
   workArea:{x:-2560,y:40,width:2560,height:1400},scaleFactor:1.25};
 const rect=windowBounds(display,'1920x1080');
 assert.equal(rect.width,1536);
 assert.equal(rect.height,864);
 assert.ok(rect.x<0);
 assert.ok(rect.y>=40);
});
test('oversized resolution fails clearly',()=>{
 const display={bounds:{x:0,y:0,width:1280,height:720},scaleFactor:1};
 assert.throws(()=>windowBounds(display,'1920x1080'),/Resolução maior/);
});
test('Electron output is frameless and draggable, controlled only by F11 and Escape',()=>{
 assert.match(main,/frame:false,autoHideMenuBar:true,fullscreen:false/);
 assert.doesNotMatch(main,/frame:true,autoHideMenuBar:true,fullscreen:false/);
 assert.match(app,/projection__drag-region/);
 const css=fs.readFileSync(path.join(root,'src/transmission.css'),'utf8');
 assert.match(css,/-webkit-app-region:drag/);
 assert.match(main,/bindProjectionShortcuts\(win\)/);
 assert.match(main,/before-input-event/);
 assert.match(main,/input\.key==='F11'/);
 assert.match(main,/input\.key==='Escape'/);
 assert.match(main,/if\(win\.isFullScreen\(\)\)win\.setFullScreen\(false\)/);
 assert.match(main,/else win\.close\(\)/);
});
test('Escape in window mode closes projection and resets transmission state',()=>{
 assert.match(main,/projection:output-closed/);
 assert.match(preload,/onProjectionOutputClosed/);
 assert.match(app,/onProjectionOutputClosed\(\(\)=>/);
 assert.match(app,/setTransmitting\(false\)/);
});
