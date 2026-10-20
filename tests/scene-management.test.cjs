'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const app=read('src/App.tsx');
const css=read('src/scene-sources.css');
const main=read('electron/main.cjs');
const scenes=read('src/scenes.ts');
const music=read('src/MusicWorkspace.tsx');

test('scene cards use the same compact visual hierarchy as source items',()=>{
 assert.match(app,/scene-entry scene-compact-row/);
 assert.match(app,/scene-entry-pick/);
 assert.match(css,/\.scene-entry\.scene-compact-row\.selected/);
 assert.match(css,/\.scene-entry\.scene-compact-row \.scene-entry-main strong/);
 assert.match(css,/\.scene-entry\.scene-compact-row \.scene-entry-icon/);
});
test('only one create button remains in each column; duplicate footer actions are removed',()=>{
 assert.doesNotMatch(app,/title="Adicionar cena" aria-label="Adicionar cena"/);
 assert.doesNotMatch(app,/title="Adicionar item à cena" aria-label="Adicionar item"/);
 assert.equal((app.match(/Nova cena<\/AppButton>/g)||[]).length,1);
 assert.equal((app.match(/Adicionar item<\/AppButton>/g)||[]).length,1);
 assert.doesNotMatch(app,/scene-sidebar-footer-buttons/);
 assert.doesNotMatch(music,/className="music-square-button"/);
 assert.ok(music.includes('Importar músicas'));
});
test('scene menu is available via right click with rename, duplicate, lock and delete',()=>{
 assert.match(app,/onContextMenu=\{event=>openSceneContext\(event,entry\)\}/);
 assert.match(app,/sceneContext&&contextScene&&/);
 assert.match(app,/renameScene\(contextScene\)/);
 assert.match(app,/duplicateScene\(contextScene\)/);
 assert.match(app,/toggleSceneLock\(contextScene\)/);
 assert.match(app,/deleteSceneById\(contextScene\)/);
 assert.match(app,/event\.key==='F2'.*renameScene\(entry\)/);
});
test('scene drag-and-drop distinguishes drop above and below, matching item ordering',()=>{
 assert.match(app,/application\/x-nosso-culto-scene-id/);
 assert.match(app,/sceneDropTarget\.after\?'scene-drop-after':'scene-drop-before'/);
 assert.match(app,/event\.clientY>=bounds\.top\+bounds\.height\/2/);
 assert.match(app,/reorderScene\(from,from<position\?position-1:position\)/);
 assert.match(css,/\.scene-entry\.scene-drop-before:before/);
 assert.match(css,/\.scene-entry\.scene-drop-after:after/);
});
test('scene order and position lock survive native data save',()=>{
 assert.match(scenes,/items:SceneItem\[\];locked\?:boolean/);
 assert.match(main,/locked:scene\?\.locked===true/);
 assert.match(app,/scenes\.slice\(Math\.min\(from,target\),Math\.max\(from,target\)\+1\)\.some\(entry=>entry\.locked\)/);
 assert.match(app,/items:entry\.items\.map\(item=>\(\{\.\.\.item,id:makeId\(\)\}\)\)/);
});
