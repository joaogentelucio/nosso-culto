'use strict';
const {app, BrowserWindow, ipcMain, screen, dialog, Menu} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const media = require('./media.cjs');
const transcription = require('./transcription.cjs');
const localTranscription = require('./local-transcription.cjs');
media.registerScheme();
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
    ? {
      title:String(value.slide.title||'').slice(0,150),
      body:value.slide.body.slice(0,15000),
      imageId:typeof value.slide.imageId==='string'&&/^[a-f0-9-]{36}$/i.test(value.slide.imageId)?value.slide.imageId:undefined,
      layers:Array.isArray(value.slide.layers)?value.slide.layers.slice(0,150).filter(layer=>isPlainObject(layer)&&
        (layer.kind==='image'||layer.kind==='text')&&typeof layer.id==='string')
        .map(layer=>({
          id:layer.id.slice(0,80),kind:layer.kind,
          text:layer.kind==='text'?String(layer.text||'').slice(0,15000):undefined,
          imageId:layer.kind==='image'&&typeof layer.imageId==='string'&&/^[a-f0-9-]{36}$/i.test(layer.imageId)?layer.imageId:undefined
        })) : undefined
    }
    : null;
  return {slide,hidden:Boolean(value.hidden),theme:validTheme(value.theme)};
}
function sanitizeData(value) {
  if (!isPlainObject(value)) throw Error('Dados inválidos.');
  const library = Array.isArray(value.library) ? value.library.slice(0,5000).map(v=>({
    id:String(v.id||'').slice(0,80),title:String(v.title||'').slice(0,180),
    type:v.type==='text'?'text':'music',content:String(v.content||'').slice(0,250000),
    audioId: typeof v.audioId==='string'&&/^[0-9a-f-]{36}$/i.test(v.audioId)?v.audioId:undefined,
    duration: Number.isFinite(v.duration)&&v.duration>=0&&v.duration<=43200?v.duration:0,
    sourceName: String(v.sourceName||'').slice(0,260),
    timingSource: ['lrc','estimated','manual','transcribed'].includes(v.timingSource)?v.timingSource:undefined,
    cues: Array.isArray(v.cues)?v.cues.slice(0,2000).filter(c=>c&&Number.isFinite(c.time)&&c.time>=0&&typeof c.text==='string').map(c=>({time:Math.min(43200,c.time),text:c.text.slice(0,2000)})):[]
  })).filter(v=>v.id&&v.title) : [];
  const queue = Array.isArray(value.queue) ? value.queue.slice(0,2000).map(v=>String(v).slice(0,80)) : [];
  const scenes=Array.isArray(value.scenes)?value.scenes.slice(0,250).map(scene=>({
    id:String(scene?.id||'').slice(0,80),
    name:String(scene?.name||'').slice(0,130),
    items:Array.isArray(scene?.items)?scene.items.slice(0,500).map(item=>({
      id:String(item?.id||'').slice(0,80),
      type:['music','text','bible','image'].includes(item?.type)?item.type:'text',
      title:String(item?.title||'').slice(0,160),
      libraryId:typeof item?.libraryId==='string'?item.libraryId.slice(0,80):undefined,
      content:typeof item?.content==='string'?item.content.slice(0,250000):undefined,
      imageId:typeof item?.imageId==='string'&&/^[a-f0-9-]{36}$/i.test(item.imageId)?item.imageId:undefined,
      visible:item?.visible!==false,
      locked:item?.locked===true
    })).filter(item=>item.id&&item.title):[]
  })).filter(scene=>scene.id&&scene.name):[];
  return {library,queue,scenes};
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
// Settings > Projeção > Monitor Principal is the authoritative destination.
// Do not move the operator's control window to the transmission display.
function updateScreenConfig(rawConfig) {
 const config=sanitizeScreenConfig(rawConfig);
 const assigned=resolveScreens(config);
 if(!assigned.main)throw Error('O Monitor Principal da transmissão não está conectado.');
 windowBounds(assigned.main,config.main.resolution);
 if(assigned.support)windowBounds(assigned.support,config.support.resolution);
 screenConfig=config;
 if(projector&&!projector.isDestroyed()){
   createOutput('secondary',assigned.main,config.main.resolution);
   createOutput('support',assigned.support,config.support.resolution);
 }
 return true;
}
function openProjection(rawConfig) {
 const config=sanitizeScreenConfig(rawConfig||screenConfig);
 const assigned=resolveScreens(config);
 // Always respect main.monitorId AND main.resolution without silent fallback.
 if(!assigned.main)throw Error('O Monitor Principal configurado está indisponível. Abra Configurações > Projeção.');
 windowBounds(assigned.main,config.main.resolution);
 if(assigned.support)windowBounds(assigned.support,config.support.resolution);
 screenConfig=config;
 createOutput('secondary',assigned.main,config.main.resolution);
 createOutput('support',assigned.support,config.support.resolution);
 sendState();
 return true;
}
app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 media.installProtocol();
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
 ipcMain.handle('media:import',(_event,kind)=>media.importMedia(controller,kind));
 ipcMain.handle('media:import-lrc',()=>media.importLrc(controller));
 ipcMain.handle('transcription:status',()=>transcription.keyStatus());
 ipcMain.handle('transcription:save-key',(_event,key)=>transcription.saveKey(key));
 ipcMain.handle('transcription:clear-key',()=>transcription.deleteKey());
 ipcMain.handle('transcription:run',(event,audioId,language)=>transcription.transcribe(event.sender,audioId,language,media.fileFor));
 ipcMain.handle('transcription:cancel',event=>transcription.cancel(event.sender));
 ipcMain.handle('transcription:local-status',()=>localTranscription.status());
 ipcMain.handle('transcription:local-run',(event,audioId,language,model)=>localTranscription.transcribe(event.sender,audioId,language,model,media.fileFor));
 ipcMain.handle('transcription:local-cancel',event=>localTranscription.cancel(event.sender));
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
