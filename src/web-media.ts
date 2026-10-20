import {useEffect,useState} from 'react';
import JSZip from 'jszip';
import type {MusicCue,MusicItem} from './music';

// The web version keeps recordings on the device. Never upload audio to Vercel.
const DB_NAME='nosso-culto-browser-audio-v1';
const STORE='audio';
const MAX_AUDIO=120*1024*1024;
const MAX_LRC=5*1024*1024;
const MAX_ZIP=256*1024*1024;
const MAX_ZIP_TOTAL=750*1024*1024;
const MAX_ITEMS=1500;
const AUDIO_EXT=new Set(['mp3','wav','flac','m4a','aac','ogg','opus']);
const ID=/^[a-f0-9-]{36}$/i;
let opening:Promise<IDBDatabase>|null=null;

function openDb():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')return Promise.reject(Error('Este navegador não permite armazenar músicas localmente.'));
 if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error??Error('Não foi possível abrir o armazenamento de áudio.'));
   request.onblocked=()=>reject(Error('O banco de áudio está aberto em outra versão da aplicação.'));
 }).catch((e:unknown)=>{opening=null;throw e;});
 return opening;
}
async function putAudio(id:string,blob:Blob):Promise<void>{
 const db=await openDb();
 await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(blob,id);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??Error('Espaço insuficiente para armazenar o áudio neste navegador.'));
   tx.onabort=()=>reject(tx.error??Error('Gravação do áudio interrompida.'));
 });
}
async function readAudio(id:string):Promise<Blob|null>{
 if(!ID.test(id))return null;
 const db=await openDb();
 return new Promise((resolve,reject)=>{
   const request=db.transaction(STORE,'readonly').objectStore(STORE).get(id);
   request.onsuccess=()=>resolve(request.result instanceof Blob?request.result:null);
   request.onerror=()=>reject(request.error??Error('Não foi possível carregar o áudio.'));
 });
}
// Audio stays in the user's browser; access only after clicking Transcrever.
export async function getWebAudioForTranscription(id:string):Promise<Blob|null>{
 return readAudio(id);
}
export async function deleteWebAudio(id:string):Promise<void>{
 if(!ID.test(id))return;
 const db=await openDb();
 await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).delete(id);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??Error('Não foi possível excluir o áudio.'));
 });
}
export function useWebAudioUrl(id?:string):{url:string|null;error:boolean}{
 const [state,setState]=useState<{id?:string;url:string|null;error:boolean}>({url:null,error:false});
 useEffect(()=>{
   if(!id||typeof window==='undefined')return;
   let alive=true;
   let created:string|null=null;
   void readAudio(id).then(blob=>{
     if(!alive)return;
     if(!blob){setState({id,url:null,error:true});return;}
     created=URL.createObjectURL(blob);
     setState({id,url:created,error:false});
   }).catch(()=>{if(alive)setState({id,url:null,error:true});});
   return ()=>{alive=false;if(created)URL.revokeObjectURL(created);};
 },[id]);
 return state.id===id?{url:state.url,error:state.error}:{url:null,error:false};
}
const fileExt=(name:string)=>name.split('.').pop()?.toLowerCase()??'';
const stem=(name:string)=>name.replace(/\\/g,'/').replace(/\.[^.\/]+$/,'').toLowerCase();
const shortStem=(name:string)=>stem(name).split('/').pop()??'';
const displayName=(name:string)=>name.replace(/\\/g,'/').split('/').pop()??name;
const displayTitle=(name:string)=>displayName(name).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,180);

export function parseWebLrc(raw:string):MusicCue[]{
 const result:MusicCue[]=[];
 for(const line of raw.replace(/^\uFEFF/,'').split(/\r?\n/)){
   const stamps=[...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
   const lyric=line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g,'').trim();
   if(!lyric)continue;
   for(const stamp of stamps){
     const seconds=Number(stamp[2]);
     if(seconds>=60)continue;
     const time=Number(stamp[1])*60+seconds+Number('0.'+(stamp[3]??'0').padEnd(3,'0'));
     if(Number.isFinite(time))result.push({time:Number(time.toFixed(3)),text:lyric.slice(0,1200)});
     if(result.length>=2000)break;
   }
   if(result.length>=2000)break;
 }
 result.sort((a,b)=>a.time-b.time);
 return result;
}
export async function parseWebLrcFile(file:File):Promise<{cues:MusicCue[];content:string}>{
 if(file.size>MAX_LRC)throw Error('Arquivo LRC maior que 5 MB.');
 const cues=parseWebLrc(await file.text());
 if(!cues.length)throw Error('O arquivo LRC não contém trechos com tempos válidos.');
 return {cues,content:cues.map(c=>c.text).join('\n\n')};
}

type AudioEntry={name:string;blob:Blob};
type LyricEntry={name:string;text:string};
export async function importWebMedia(files:File[],kind:'files'|'folder'|'zip'):Promise<{items:MusicItem[];errors:string[]}>{
 const errors:string[]=[];
 const audio:AudioEntry[]=[];
 const lyrics:LyricEntry[]=[];
 if(files.length>MAX_ITEMS)throw Error('Selecione no máximo 1500 arquivos por importação.');
 if(kind==='zip'){
   for(const file of files){
     if(fileExt(file.name)!=='zip'){errors.push('Não é ZIP: '+file.name);continue;}
     if(file.size>MAX_ZIP){errors.push('ZIP maior que 256 MB: '+file.name);continue;}
     let archive:JSZip;
     try{archive=await JSZip.loadAsync(file,{checkCRC32:false});}
     catch{errors.push('Arquivo ZIP inválido: '+file.name);continue;}
     const entries=Object.values(archive.files).filter(entry=>!entry.dir);
     if(entries.length>MAX_ITEMS){errors.push('ZIP contém mais de 1500 arquivos: '+file.name);continue;}
     let total=0;
     for(const entry of entries){
       const name=entry.name.replace(/\\/g,'/');
       if(name.split('/').includes('..')||name.startsWith('/'))continue;
       const ext=fileExt(name);
       if(ext!=='lrc'&&!AUDIO_EXT.has(ext))continue;
       // Validate sizes before decompression when the ZIP provides them.
       const declared=(entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
       const maximum=ext==='lrc'?MAX_LRC:MAX_AUDIO;
       if(declared!==undefined&&(declared>maximum||declared<0)){
         errors.push('Arquivo muito grande no ZIP: '+name);continue;
       }
       if(declared!==undefined&&total+declared>MAX_ZIP_TOTAL){
         errors.push('Limite de 750 MB descompactados excedido.');break;
       }
       try{
         const blob=await entry.async('blob');
         total+=blob.size;
         if(blob.size>maximum||total>MAX_ZIP_TOTAL){
           errors.push('Limite de tamanho excedido: '+name);break;
         }
         if(ext==='lrc')lyrics.push({name,text:await blob.text()});
         else audio.push({name,blob});
       }catch{errors.push('Não foi possível extrair: '+name);}
     }
   }
 }else{
   for(const file of files){
     const name=(file.webkitRelativePath||file.name).replace(/\\/g,'/');
     const ext=fileExt(name);
     if(ext==='lrc'){
       if(file.size>MAX_LRC){errors.push('LRC maior que 5 MB: '+name);continue;}
       lyrics.push({name,text:await file.text()});
     }else if(AUDIO_EXT.has(ext))audio.push({name,blob:file});
     else errors.push('Formato não suportado: '+name);
   }
 }
 const lrcByPath=new Map(lyrics.map(item=>[stem(item.name),item.text]));
 const lrcByName=new Map(lyrics.map(item=>[shortStem(item.name),item.text]));
 const items:MusicItem[]=[];
 for(const file of audio.slice(0,MAX_ITEMS)){
   if(!file.blob.size||file.blob.size>MAX_AUDIO){
     errors.push('Áudio vazio ou maior que 120 MB: '+file.name);continue;
   }
   try{
     const audioId=crypto.randomUUID();
     await putAudio(audioId,file.blob);
     const raw=lrcByPath.get(stem(file.name))??lrcByName.get(shortStem(file.name))??'';
     const cues=raw?parseWebLrc(raw):[];
     items.push({
       id:crypto.randomUUID(),title:displayTitle(file.name),type:'music',content:cues.map(c=>c.text).join('\n\n'),
       audioId,duration:0,cues,sourceName:file.name,timingSource:cues.length?'lrc':undefined
     });
   }catch(err){errors.push(file.name+': '+(err instanceof Error?err.message:String(err)));}
 }
 if(!audio.length&&lyrics.length)errors.push('Importe também o áudio correspondente ao arquivo .LRC.');
 return {items,errors};
}
