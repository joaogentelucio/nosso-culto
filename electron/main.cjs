'use strict';
const {app, BrowserWindow, ipcMain, screen, dialog, Menu} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
let controller = null;
let projector = null;
let supportWindow = null;
let screenConfig = {main:{monitorId:'primary',resolution:'native'},secondary:{monitorId:'auto',resolution:'native'},support:{monitorId:'off',resolution:'native'}};
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
function loadPage(win, projectionRole) {
  const suffix = projectionRole ? '?projection='+projectionRole : '';
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) return win.loadURL(dev+suffix);
  return win.loadFile(path.join(__dirname,'../dist/index.html'),projectionRole?{query:{projection:projectionRole}}:undefined);
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
  loadPage(controller,null);
  controller.on('closed',()=>{controller=null;for(const w of [projector,supportWindow])if(w&&!w.isDestroyed())w.close();});
}
function getDisplays() {
 const primaryId=screen.getPrimaryDisplay().id;
 return screen.getAllDisplays().map((d,i)=>({
   id:d.id,name:'Monitor '+(i+1),primary:d.id===primaryId,
   width:d.bounds.width,height:d.bounds.height,scaleFactor:d.scaleFactor
 }));
}
function sanitizeAssignment(a,defaultId) {
 const id=String(a?.monitorId??defaultId);
 const resolution=String(a?.resolution??'native');
 if (!/^(primary|auto|off|\d+)$/.test(id)) throw Error('Identificador de monitor inválido');
 if (!/^(native|\d{3,4}x\d{3,4})$/.test(resolution)) throw Error('Resolução inválida');
 return {monitorId:id,resolution};
}
function sanitizeScreenConfig(config) {
 if(!isPlainObject(config)) throw Error('Configuração de monitores inválida');
 return {
   main:sanitizeAssignment(config.main,'primary'),
   secondary:sanitizeAssignment(config.secondary,'auto'),
   support:sanitizeAssignment(config.support,'off')
 };
}
function resolveScreens(config) {
 const all=screen.getAllDisplays();
 const systemPrimary=screen.getPrimaryDisplay();
 const used=new Set();
 function match(role) {
   const id=config[role].monitorId;
   if(id==='off') return null;
   const d=id==='primary'?systemPrimary
     :id==='auto'?(role==='main'?systemPrimary:all.find(x=>!used.has(x.id)))
     :all.find(x=>String(x.id)===id);
   if(!d||used.has(d.id)){
     if(role==='main'||(id!=='auto'&&id!=='off'))throw Error('O monitor definido para '+role+' não está disponível ou já está em uso.');
     return null;
   }
   used.add(d.id);return d;
 }
 return {main:match('main'),secondary:match('secondary'),support:match('support')};
}
function windowBounds(display,resolution) {
 const bounds=display.bounds;
 if(resolution==='native')return {...bounds,fullscreen:true};
 const [pxW,pxH]=resolution.split('x').map(Number);
 const w=Math.round(pxW/display.scaleFactor),h=Math.round(pxH/display.scaleFactor);
 if(w>bounds.width||h>bounds.height)throw Error('Resolução maior que o monitor selecionado.');
 return {x:bounds.x+Math.floor((bounds.width-w)/2),y:bounds.y+Math.floor((bounds.height-h)/2),
   width:w,height:h,fullscreen:false};
}
function placeWindow(win,display,resolution){
 const target=windowBounds(display,resolution);
 if(win.isFullScreen())win.setFullScreen(false);
 win.setBounds({x:target.x,y:target.y,width:target.width,height:target.height});
 win.setFullScreen(target.fullscreen);
}
function configureController(config,assigned) {
 const display=assigned.main;
 if(!controller||controller.isDestroyed()||!display)return;
 const target=windowBounds(display,config.main.resolution);
 controller.unmaximize();
 if(target.fullscreen){
   const area=display.workArea;
   controller.setBounds({x:area.x+20,y:area.y+20,width:Math.max(800,area.width-40),height:Math.max(600,area.height-40)});
   controller.maximize();
 }else{
   const bounds=display.workArea;
   controller.setBounds({
     x:Math.max(bounds.x,target.x),y:Math.max(bounds.y,target.y),
     width:Math.min(bounds.width,Math.max(1020,target.width)),
     height:Math.min(bounds.height,Math.max(650,target.height))
   });
 }
}
function sendState() {
 for(const win of [controller,projector,supportWindow])
   if(win&&!win.isDestroyed()&&!win.webContents.isLoading())win.webContents.send('projection:state',live);
}
function createOutput(role,display,resolution){
 let win=role==='secondary'?projector:supportWindow;
 if(!display) {
   if(win&&!win.isDestroyed())win.close();
   return null;
 }
 const rect=windowBounds(display,resolution);
 if(win&&!win.isDestroyed()){
   placeWindow(win,display,resolution);win.show();sendState();
   return win;
 }
 win=new BrowserWindow(windowOptions({
   x:rect.x,y:rect.y,width:rect.width,height:rect.height,title:role==='secondary'
     ?'Nosso Culto — Projeção':'Nosso Culto — Apoio',
   frame:false,autoHideMenuBar:true,fullscreen:rect.fullscreen,backgroundColor:'#000000'
 }));
 if(role==='secondary')projector=win;else supportWindow=win;
 lockNavigation(win);
 const out=win;
 out.webContents.on('did-finish-load',()=>{if(!out.isDestroyed())out.webContents.send('projection:state',live)});
 out.once('ready-to-show',()=>{if(!out.isDestroyed())out.showInactive()});
 out.on('closed',()=>{
   if(role==='secondary'&&projector===out)projector=null;
   if(role==='support'&&supportWindow===out)supportWindow=null;
 });
 loadPage(win,role);
 return win;
}
function updateScreenConfig(rawConfig) {
 const config=sanitizeScreenConfig(rawConfig);
 const assigned=resolveScreens(config);
 // Validate the three window sizes before applying anything.
 for(const role of ['main','secondary','support']){
   if(assigned[role])windowBounds(assigned[role],config[role].resolution);
 }
 screenConfig=config;
 configureController(config,assigned);
 if(projector&&!projector.isDestroyed()){
   createOutput('secondary',assigned.secondary,config.secondary.resolution);
   createOutput('support',assigned.support,config.support.resolution);
 }else if(supportWindow&&!supportWindow.isDestroyed()){
   createOutput('support',assigned.support,config.support.resolution);
 }
 return true;
}
function openProjection(rawConfig) {
 const config=sanitizeScreenConfig(rawConfig||screenConfig);
 const assigned=resolveScreens(config);
 if(config.secondary.monitorId==='off')
   throw Error('Habilite o Monitor Secundário nas Configurações > Projeção.');
 if(!assigned.secondary)
   throw Error('Nenhum monitor secundário livre. Conecte outra tela e use o modo Estender no Windows.');
 for(const role of ['secondary','support'])
   if(assigned[role])windowBounds(assigned[role],config[role].resolution);
 screenConfig=config;
 createOutput('secondary',assigned.secondary,config.secondary.resolution);
 createOutput('support',assigned.support,config.support.resolution);
 sendState();
 return true;
}
app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 ipcMain.handle('app:quit',()=>{app.quit();return true;});
 ipcMain.handle('displays:list',()=>getDisplays());
 ipcMain.handle('displays:configure',(_event,config)=>updateScreenConfig(config));
 const refresh=()=>{if(controller&&!controller.isDestroyed())controller.webContents.send('displays:changed',getDisplays());};
 screen.on('display-added',refresh);
 screen.on('display-removed',refresh);
 screen.on('display-metrics-changed',refresh);
 ipcMain.handle('projection:open',(_event,config)=>openProjection(config));
 ipcMain.handle('projection:close',()=>{for(const w of [projector,supportWindow])if(w&&!w.isDestroyed())w.close();return true;});
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
