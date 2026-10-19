'use strict';
const {app, dialog, protocol} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Readable} = require('node:stream');
const AdmZip = require('adm-zip');

const AUDIO_EXT = new Set(['.mp3','.wav','.flac','.m4a','.aac','.ogg','.opus']);
const MAX_FILE = 120*1024*1024;
const MAX_ZIP = 256*1024*1024;
const MAX_TOTAL = 750*1024*1024;
const MAX_ITEMS = 1500;
const MAX_DEPTH = 12;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const CONTENT_TYPES = {
 '.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac',
 '.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.opus':'audio/ogg'
};
const baseDir = () => path.join(app.getPath('userData'),'audio-assets');
const fileFor = id => {
 if (!ID_PATTERN.test(id)) return null;
 const dir=baseDir();
 const list=fs.existsSync(dir)?fs.readdirSync(dir):[];
 const found=list.find(name=>name.startsWith(id+'.') && AUDIO_EXT.has(path.extname(name).toLowerCase()));
 return found?path.join(dir,found):null;
};
function registerScheme(){
 protocol.registerSchemesAsPrivileged([{
  scheme:'culto-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true}
 }]);
}
function installProtocol(){
 protocol.handle('culto-media',async request=>{
  try {
   const u=new URL(request.url);
   if(u.hostname!=='asset')return new Response('Not found',{status:404});
   const id=decodeURIComponent(u.pathname.slice(1));
   const file=fileFor(id);
   if(!file)return new Response('Not found',{status:404});
   const stat=await fs.promises.stat(file);
   const range=request.headers.get('range');
   let start=0,end=stat.size-1,status=200;
   if(range){
    const m=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!m)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+stat.size}});
    start=m[1]?Number(m[1]):0;
    end=m[2]?Number(m[2]):stat.size-1;
    if(!m[1]&&m[2]){start=Math.max(0,stat.size-Number(m[2]));end=stat.size-1;}
    if(start>=stat.size||start<0||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+stat.size}});
    end=Math.min(end,stat.size-1);status=206;
   }
   const headers={
    'Content-Type':CONTENT_TYPES[path.extname(file).toLowerCase()]||'application/octet-stream',
    'Accept-Ranges':'bytes','Content-Length':String(end-start+1),
    'Cache-Control':'private, max-age=3600','Access-Control-Allow-Origin':'*'
   };
   if(status===206)headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;
   if(request.method==='HEAD')return new Response(null,{status,headers});
   const body=Readable.toWeb(fs.createReadStream(file,{start,end}));
   return new Response(body,{status,headers});
  } catch(e) {console.error('Erro ao servir áudio:',e);return new Response('Erro ao ler áudio',{status:500});}
 });
}
function parseLrc(text){
 const cues=[];
 for(const line of String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const regex=/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const times=[...line.matchAll(regex)].map(m=>Number(m[1])*60+Number(m[2])+
    Number('0.'+(m[3]||'0').padEnd(3,'0')));
  const lyric=line.replace(regex,'').trim();
  if(!lyric||!times.length)continue;
  for(const time of times)cues.push({time:Number(time.toFixed(3)),text:lyric.slice(0,1200)});
 }
 cues.sort((a,b)=>a.time-b.time);
 return cues;
}
function titleOf(name) {return path.parse(name).name.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,180);}
function makeEntry(audioName,buffer,lrc,relativeName){
 const ext=path.extname(audioName).toLowerCase();
 if(!AUDIO_EXT.has(ext))return null;
 if(buffer.length>MAX_FILE)throw Error('Arquivo excede 120 MB: '+audioName);
 fs.mkdirSync(baseDir(),{recursive:true});
 const audioId=crypto.randomUUID();
 fs.writeFileSync(path.join(baseDir(),audioId+ext),buffer,{flag:'wx'});
 const cues=lrc?parseLrc(lrc):[];
 return {id:crypto.randomUUID(),title:titleOf(audioName),type:'music',
   content:cues.map(x=>x.text).join('\n\n'),
   audioId,cues,duration:0,sourceName:relativeName||audioName,timingSource:cues.length?'lrc':undefined};
}
const trackStem = filename => filename.replace(/\.[^.]+$/,'').toLowerCase();
function safeLrc(buffer) {
 if(!buffer)return '';
 // UTF-8 and UTF-8 BOM are supported. Malformed encodings can be edited manually.
 return buffer.toString('utf8').replace(/^\uFEFF/,'');
}
async function collectPaths(folder){
 const found=[];
 async function walk(dir,depth){
  if(depth>MAX_DEPTH||found.length>=MAX_ITEMS)return;
  for(const entry of await fs.promises.readdir(dir,{withFileTypes:true})){
   if(entry.isSymbolicLink())continue;
   const p=path.join(dir,entry.name);
   if(entry.isDirectory())await walk(p,depth+1);
   else if(entry.isFile()&&(AUDIO_EXT.has(path.extname(p).toLowerCase())||path.extname(p).toLowerCase()==='.lrc'))found.push(p);
   if(found.length>=MAX_ITEMS)return;
  }
 }
 await walk(folder,0);
 return found;
}
function importAudioFiles(files,errors){
 const audio=files.filter(f=>AUDIO_EXT.has(path.extname(f).toLowerCase()));
 const lrcs=new Map();
 for(const file of files.filter(f=>path.extname(f).toLowerCase()==='.lrc')){
  try {if(fs.statSync(file).size<5*1024*1024)lrcs.set(trackStem(file),fs.readFileSync(file));}
  catch(e){errors.push(path.basename(file)+': '+e.message);}
 }
 const items=[];
 let bytes=0;
 for(const file of audio.slice(0,MAX_ITEMS)){
  try {
   const stat=fs.statSync(file);
   if(stat.size>MAX_FILE||bytes+stat.size>MAX_TOTAL){errors.push(path.basename(file)+': limite de tamanho excedido');continue;}
   bytes+=stat.size;
   const content=fs.readFileSync(file);
   const lrc=lrcs.get(trackStem(file)) || (fs.existsSync(file.replace(/\.[^.]+$/,'.lrc'))?fs.readFileSync(file.replace(/\.[^.]+$/,'.lrc')):null);
   items.push(makeEntry(path.basename(file),content,safeLrc(lrc),path.basename(file)));
  }catch(e){errors.push(path.basename(file)+': '+e.message);}
 }
 return items.filter(Boolean);
}
function importZip(zipPath,errors){
 const stat=fs.statSync(zipPath);
 if(stat.size>MAX_ZIP)throw Error('ZIP excede 256 MB');
 const zip=new AdmZip(zipPath);
 const entries=zip.getEntries().filter(e=>!e.isDirectory);
 if(entries.length>MAX_ITEMS)throw Error('ZIP excede 1500 itens');
 let total=0;
 const acceptable=entries.filter(e=>AUDIO_EXT.has(path.extname(e.entryName).toLowerCase())||path.extname(e.entryName).toLowerCase()==='.lrc');
 for(const entry of acceptable){
  const size=entry.header.size;
  if(size>MAX_FILE||size<0)throw Error('Arquivo muito grande no ZIP: '+entry.entryName);
  total+=size;
  if(total>MAX_TOTAL)throw Error('ZIP descompactado excede 750 MB');
 }
 const lrcs=new Map();
 for(const e of acceptable.filter(e=>path.extname(e.entryName).toLowerCase()==='.lrc')){
  try{if(e.header.size<5*1024*1024)lrcs.set(trackStem(e.entryName),safeLrc(e.getData()));}
  catch(err){errors.push(e.entryName+': '+err.message);}
 }
 const items=[];
 for(const e of acceptable.filter(e=>AUDIO_EXT.has(path.extname(e.entryName).toLowerCase()))){
  try {
   const audio=e.getData();
   items.push(makeEntry(path.basename(e.entryName),audio,lrcs.get(trackStem(e.entryName))||'',e.entryName));
  }catch(err){errors.push(e.entryName+': '+err.message);}
 }
 return items.filter(Boolean);
}
async function importMedia(controller,kind){
 if(!['files','folder','zip'].includes(kind))throw Error('Modo de importação inválido');
 const filters=kind==='zip'?[{name:'Pacotes ZIP',extensions:['zip']}]:
  [{name:'Áudio e letras',extensions:['mp3','wav','flac','m4a','aac','ogg','opus','lrc','zip']}];
 const dialogOptions={title:kind==='folder'?'Escolher pasta de músicas':'Importar músicas',
  properties:kind==='folder'?['openDirectory']:['openFile','multiSelections'],filters};
 const result=await dialog.showOpenDialog(controller,dialogOptions);
 if(result.canceled||!result.filePaths.length)return {items:[],errors:[],cancelled:true};
 const errors=[], items=[];
 let files=[];
 for(const selected of result.filePaths){
  if(kind==='folder')files.push(...await collectPaths(selected));
  else if(path.extname(selected).toLowerCase()==='.zip'||kind==='zip'){
   try{items.push(...importZip(selected,errors));}catch(e){errors.push(path.basename(selected)+': '+e.message);}
  }else files.push(selected);
 }
 if(files.length)items.push(...importAudioFiles(files,errors));
 return {items:items.slice(0,MAX_ITEMS),errors,cancelled:false};
}
async function importLrc(controller){
 const result=await dialog.showOpenDialog(controller,{title:'Importar letra sincronizada LRC',
  properties:['openFile'],filters:[{name:'Letras sincronizadas',extensions:['lrc']}]});
 if(result.canceled||!result.filePaths.length)return null;
 const f=result.filePaths[0];
 if((await fs.promises.stat(f)).size>5*1024*1024)throw Error('LRC muito grande');
 const cues=parseLrc(await fs.promises.readFile(f,'utf8'));
 if(!cues.length)throw Error('Nenhuma marcação de tempo válida no LRC');
 return {cues,content:cues.map(x=>x.text).join('\n\n')};
}
module.exports={registerScheme,installProtocol,importMedia,importLrc};
