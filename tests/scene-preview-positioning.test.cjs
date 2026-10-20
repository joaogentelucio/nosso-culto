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
 assert.match(app,/setPointerCapture\(event\.pointerId\)/);
 assert.match(app,/releasePointerCapture\(event\.pointerId\)/);
 assert.match(app,/onPointerCancel=\{event=>finishDrag\(event,true\)\}/);
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
});
