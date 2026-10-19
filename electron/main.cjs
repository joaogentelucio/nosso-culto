'use strict';
const {app, BrowserWindow, ipcMain, screen, dialog, Menu} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
let controller = null;
let projector = null;
let live = {slide:null,hidden:false,theme:'dark'};
const filePath = () => path.join(app.getPath('userData'),'nosso-culto.json');
const validTheme = v => ['dark','blue','warm'].includes(v) ? v : 'dark';
const isPlainObject = v => v && typeof v === 'object' && !Array.isArray(v);
function sanitizeLive(value) {
  if (!isPlainObject(value)) return live;
  const slide = isPlainObject(value.slide) && typeof value.slide.body === 'string'
    ? {title:String(value.slide.title||'').slice(0,150),body:value.slide.body.slice(0,15000)}
    : null;
  return {slide,hidden:Boolean(value.hidden),theme:validTheme(value.theme)};
}
function sanitizeData(value) {
  if (!isPlainObject(value)) throw Error('Dados inválidos.');
  const library = Array.isArray(value.library) ? value.library.slice(0,5000).map(v=>({
    id:String(v.id||'').slice(0,80),title:String(v.title||'').slice(0,180),
    type:v.type==='text'?'text':'music',content:String(v.content||'').slice(0,250000)
  })).filter(v=>v.id&&v.title) : [];
  const queue = Array.isArray(value.queue) ? value.queue.slice(0,2000).map(v=>String(v).slice(0,80)) : [];
  return {library,queue};
}
function readData() {
  try {return sanitizeData(JSON.parse(fs.readFileSync(filePath(),'utf8')));}
  catch (e) {if (e.code==='ENOENT') return null; console.error('Falha ao ler dados locais:',e); return null;}
}
function writeData(data) {
  const clean = sanitizeData(data);
  const dest = filePath(); fs.mkdirSync(path.dirname(dest),{recursive:true});
  const temporary = dest+'.tmp'; fs.writeFileSync(temporary,JSON.stringify(clean,null,2),'utf8');
  try {fs.renameSync(temporary,dest);} catch(e){ if(fs.existsSync(dest))fs.unlinkSync(dest); fs.renameSync(temporary,dest);}
  return true;
}
function loadPage(win, isProjection) {
  const suffix = isProjection ? '?projection=1' : '';
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) return win.loadURL(dev+suffix);
  return win.loadFile(path.join(__dirname,'../dist/index.html'),isProjection?{query:{projection:'1'}}:undefined);
}
function windowOptions(extra={}) {
  return {backgroundColor:'#11131e',show:false,webPreferences:{
    preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true
  },...extra};
}
function lockNavigation(win) {
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event)=>event.preventDefault());
}
function createController() {
  controller=new BrowserWindow(windowOptions({width:1440,height:880,minWidth:1020,minHeight:650,title:'Nosso Culto'}));
  lockNavigation(controller);
  controller.once('ready-to-show',()=>controller?.show());
  loadPage(controller,false);
  controller.on('closed',()=>{controller=null;if(projector&&!projector.isDestroyed())projector.close();});
}
function getDisplays() {
 const primaryId=screen.getPrimaryDisplay().id;
 return screen.getAllDisplays().map((d,i)=>({id:d.id,name:'Monitor '+(i+1),primary:d.id===primaryId,width:d.bounds.width,height:d.bounds.height}));
}
function sendState() {
 for(const win of [controller,projector]) if(win&&!win.isDestroyed()&&!win.webContents.isLoading())win.webContents.send('projection:state',live);
}
function openProjection(displayId) {
 const displays=screen.getAllDisplays();const primary=screen.getPrimaryDisplay();
 const selected=displays.find(d=>d.id===Number(displayId)) || displays.find(d=>d.id!==primary.id) || primary;
 if(projector&&!projector.isDestroyed()) {
   projector.setBounds(selected.bounds);projector.setFullScreen(true);projector.show();projector.focus();sendState();return true;
 }
 projector=new BrowserWindow(windowOptions({
   x:selected.bounds.x,y:selected.bounds.y,width:selected.bounds.width,height:selected.bounds.height,
   title:'Nosso Culto — Projeção',frame:false,autoHideMenuBar:true,fullscreen:true,
   backgroundColor:'#000000'
 }));
 lockNavigation(projector);
 projector.webContents.on('did-finish-load',()=>{projector?.webContents.send('projection:state',live)});
 projector.once('ready-to-show',()=>projector?.show());
 projector.on('closed',()=>{projector=null;});
 loadPage(projector,true);
 return true;
}
app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 ipcMain.handle('app:quit',()=>{app.quit();return true;});
 ipcMain.handle('displays:list',()=>getDisplays());
 ipcMain.handle('projection:open',(_event,id)=>openProjection(id));
 ipcMain.handle('projection:close',()=>{if(projector&&!projector.isDestroyed())projector.close();return true;});
 ipcMain.handle('projection:get',()=>live);
 ipcMain.on('projection:update',(_event,value)=>{live=sanitizeLive(value);sendState();});
 ipcMain.handle('data:read',()=>readData());
 ipcMain.handle('data:write',(_event,data)=>writeData(data));
 ipcMain.handle('data:export',async(_event,data)=>{
   const clean=sanitizeData(data);
   const result=await dialog.showSaveDialog(controller,{title:'Exportar backup do Nosso Culto',defaultPath:'nosso-culto-backup.json',filters:[{name:'JSON',extensions:['json']}]});
   if(result.canceled||!result.filePath)return false;
   fs.writeFileSync(result.filePath,JSON.stringify(clean,null,2),'utf8');return true;
 });
 ipcMain.handle('data:import',async()=>{
   const result=await dialog.showOpenDialog(controller,{title:'Importar backup do Nosso Culto',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});
   if(result.canceled||!result.filePaths.length)return null;
   return sanitizeData(JSON.parse(fs.readFileSync(result.filePaths[0],'utf8')));
 });
 createController();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createController()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
