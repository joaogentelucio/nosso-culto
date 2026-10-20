'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const app=read('src/App.tsx');
const css=read('src/scene-compositor.css');
const main=read('electron/main.cjs');
const types=read('src/scenes.ts');
const guide=read('src/preview-placement.ts');

test('scene layers have per-item output-relative percentage positions',()=>{
 assert.ok(types.includes('position?:{x:number;y:number}'));
 assert.ok(app.includes('position:item.position,locked:item.locked'));
 assert.ok(app.includes('item.id===id&&!item.locked?{...item,position}:item'));
 assert.ok(main.includes('position:isPlainObject(item?.position)'));
 assert.ok(main.includes('position:isPlainObject(layer.position)'));
});
test('right-button drag with shift toggles between 3x3 snapping and free movement',()=>{
 assert.match(app,/event\.button!==2/);
 assert.match(app,/computePreviewPosition\(\{x,y\},event\.shiftKey\)/);
 assert.match(app,/window\.addEventListener\('mousemove',move,true\)/);
 assert.match(app,/window\.addEventListener\('mouseup',stop,true\)/);
 assert.match(app,/window\.addEventListener\('contextmenu',blockMenu,true\)/);
 assert.match(app,/window\.removeEventListener\('mousemove',move,true\)/);
 assert.match(app,/window\.removeEventListener\('mouseup',stop,true\)/);
 assert.match(app,/onContextMenu=\{editable\?event=>event\.preventDefault\(\):undefined\}/);
 assert.match(guide,/Math\.floor\(n\/100\*3\)/);
 assert.match(guide,/if\(free\)return/);
 assert.match(app,/scene-position-selected-cell/);
 assert.match(css,/scene-guide-center-v/);
 assert.match(css,/scene-guide-center-h/);
});
test('projection uses same scene layer positions but remains non-interactive',()=>{
 assert.match(app,/editable=!projection&&Boolean\(onPositionChange\)/);
 assert.match(app,/position\?\.x\?\?50/);
 assert.match(app,/position\?\.y\?\?50/);
 assert.match(css,/scene-compositor-projected/); // inherited compositor stylesheet
 assert.match(css,/scene-compositor-object--image\.is-positioned/);
 assert.match(app,/onPositionChange=\{\(id,position\)=>/);
});
test('locked sources cannot be dragged and legacy scenes remain centered',()=>{
 assert.match(app,/layer\.locked\)return/);
 assert.match(app,/layer\.position\?\?\{x:50,y:50\}/);
 assert.match(app,/onSelectLayer=\{id=>/);
 assert.match(app,/selectedLayerId\?:string/);
 assert.match(app,/selected&&!selected\.locked/);
 assert.match(app,/hit\?\.kind==='text'/);
});

test('preview canvas itself receives pointer events and renders positioned hit targets',()=>{
 assert.match(css,/\.scene-compositor-preview\{pointer-events:auto/);
 assert.match(css,/\.scene-compositor-object\{/);
 assert.match(css,/position:absolute;left:50%;top:50%;transform:translate\(-50%,-50%\)/);
 assert.match(css,/scene-compositor-object--image\.is-positioned/);
 assert.match(app,/onMouseDownCapture=\{editable\?startDrag:undefined\}/);
 assert.match(app,/onMouseDownCapture/);
 assert.match(app,/selectedLayerId=\{sceneItemId\}/);
 assert.match(app,/data-preview-layer-id=\{layer\.id\}/);
 assert.match(app,/closest<HTMLElement>\('\[data-preview-layer-id\]'\)/);
});
test('name fields are not repeated in text bible and image editors',()=>{
 assert.doesNotMatch(app,/<label>Nome do item<input value=\{item\.title\}/);
 assert.doesNotMatch(app,/<label>Título do item<input value=\{item\.title\}/);
 assert.match(app,/renameItem\(contextItem\)/);
 assert.match(app,/onKeyDown=\{event=>\{if\(event\.key==='F2'\)/);
});

test('native right-button mouse drag is robust against Chrome context-menu cancellation',()=>{
 assert.match(app,/event\.button!==2/);
 assert.match(app,/mouse\.buttons&2/);
 assert.match(app,/window\.addEventListener\('blur',cancel\)/);
 assert.match(app,/window\.removeEventListener\('blur',cancel\)/);
 assert.match(app,/if\(save&&session\.moved\)onPositionChange\?\.\(session\.id,session\.last\)/);
 assert.doesNotMatch(app,/setPointerCapture/);
 assert.doesNotMatch(app,/onPointerDown=\{editable\?/);
});
