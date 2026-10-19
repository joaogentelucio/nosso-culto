import {useEffect,useState} from 'react';

// Files stay in IndexedDB (not localStorage), shared by the controller and projector
// windows on the same origin. The scene JSON stores only the asset ID.
const DATABASE='nosso-culto-image-assets';
const STORE='images';
const MAX_IMAGE_BYTES=20*1024*1024;
const TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif']);
let connection:Promise<IDBDatabase>|null=null;
function database():Promise<IDBDatabase>{
 if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
   const req=indexedDB.open(DATABASE,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error??new Error('Não foi possível abrir a biblioteca de imagens.'));
 }).catch((e:unknown)=>{connection=null;throw e;});
 return connection!;
}
export async function saveImage(file:File):Promise<string>{
 if(!TYPES.has(file.type))throw Error('Formato não permitido. Use PNG, JPG, WebP ou GIF.');
 if(!file.size||file.size>MAX_IMAGE_BYTES)throw Error('Imagem acima de 20 MB ou vazia.');
 const db=await database();
 const id=crypto.randomUUID();
 await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(file,id);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??Error('Falha ao salvar imagem.'));
   tx.onabort=()=>reject(tx.error??Error('Falha ao salvar imagem.'));
 });
 return id;
}
export async function getImage(id:string):Promise<Blob|null>{
 if(!/^[a-f0-9-]{36}$/i.test(id))return null;
 const db=await database();
 return new Promise<Blob|null>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly');
   const req=tx.objectStore(STORE).get(id);
   req.onsuccess=()=>resolve(req.result instanceof Blob?req.result:null);
   req.onerror=()=>reject(req.error??Error('Não foi possível ler imagem.'));
 });
}
export function useImageUrl(id?:string):{url:string|null;error:boolean}{
 const [state,setState]=useState<{url:string|null;error:boolean}>({url:null,error:false});
 useEffect(()=>{
   let alive=true;
   let created:string|null=null;
   if(!id){return;}
   void getImage(id).then(blob=>{
     if(!alive)return;
     if(!blob){setState({url:null,error:true});return;}
     created=URL.createObjectURL(blob);
     setState({url:created,error:false});
   }).catch(()=>{if(alive)setState({url:null,error:true});});
   return ()=>{alive=false;if(created)URL.revokeObjectURL(created);};
 },[id]);
 return id?state:{url:null,error:false};
}
