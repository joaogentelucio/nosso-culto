import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode,MouseEvent as ReactMouseEvent} from 'react';
import {BookOpen,ChevronDown,ChevronUp,Clapperboard,Copy,Edit3,Eye,EyeOff,FileText,Image as ImageIcon,Lock,LockOpen,Maximize2,Music2,Plus,Settings,Trash2,X,ArrowUpToLine} from 'lucide-react';
import DesktopToolbar from './DesktopToolbar';
import MusicWorkspace from './MusicWorkspace';
import {loadPreferences,savePreferences} from './preferences';
import type {AppPreferences,DisplayDevice,MonitorConfiguration} from './preferences';
import {initialScenes,makeId,sceneItemTitle} from './scenes';
import type {SavedProject,Scene,SceneItem,SceneItemType} from './scenes';
import type {MusicItem} from './music';
import {saveImage,useImageUrl} from './images';
import {deleteWebAudio,importWebMedia,parseWebLrcFile} from './web-media';
import './styles.css';
import './scenes-layout.css';
import './projection-fix.css';
import './transmission.css';
import './scene-sources.css';
import './scene-compositor.css';

type SceneLayer={
 id:string;
 kind:'text'|'image';
 text?:string;
 imageId?:string;
};
type Slide={title:string;body:string;imageId?:string;layers?:SceneLayer[]};
type Live={slide:Slide|null;hidden:boolean;theme:'dark'|'blue'|'warm'};
const LIVE_KEY='nosso-culto-live';
const CHANNEL='nosso-culto-projection';
function validLive(value:unknown):value is Live {
 if(!value||typeof value!=='object')return false;
 const data=value as Partial<Live>;
 return typeof data.hidden==='boolean'&&
   (data.theme==='dark'||data.theme==='blue'||data.theme==='warm')&&
   (data.slide===null||Boolean(data.slide&&typeof data.slide.body==='string'&&typeof data.slide.title==='string'&&(!data.slide.imageId||typeof data.slide.imageId==='string')&&(!data.slide.layers||Array.isArray(data.slide.layers))));
}
function persistedLive():Live|null {
 try {
   const raw=localStorage.getItem(LIVE_KEY);
   const value:unknown=raw?JSON.parse(raw):null;
   return validLive(value)?value:null;
 }catch{return null;}
}
// Items in the scene are true visual sources: index 0 is the uppermost layer.
function composeScene(scene:Scene|undefined,library:MusicItem[],
 override:{sceneId:string;itemId:string;text:string}|null):Slide|null {
 if(!scene)return null;
 const layers:SceneLayer[]=[];
 for(const item of scene.items){
   if(item.visible===false)continue;
   if(item.type==='image'){
     if(item.imageId)layers.push({id:item.id,kind:'image',imageId:item.imageId});
     continue;
   }
   const libraryItem=item.libraryId?library.find(entry=>entry.id===item.libraryId):undefined;
   const overridden=override?.sceneId===scene.id&&override.itemId===item.id?override.text:null;
   let text=overridden;
   if(text===null&&item.type==='music'){
     text=libraryItem?.cues?.find(cue=>cue.text.trim())?.text
       ??libraryItem?.content?.split(/\n\s*\n/).map(part=>part.trim()).find(Boolean)
       ??'';
   }
   if(text===null){
     text=(item.content||libraryItem?.content||'').split(/\n\s*\n/).map(part=>part.trim()).find(Boolean)??'';
   }
   if(text.trim())layers.push({id:item.id,kind:'text',text});
 }
 return layers.length?{title:scene.name,body:'',layers}:null;
}
const INITIAL_LIBRARY:MusicItem[]=[
 {id:'welcome',type:'text',title:'Boas-vindas',content:'Sejam bem-vindos ao nosso culto!\n\nQue esta reunião seja um momento de comunhão e esperança.'},
 {id:'prayer',type:'text',title:'Momento de oração',content:'Vamos nos unir em oração.\n\nEntregue a Deus suas preocupações.'},
 {id:'song',type:'music',title:'Louvor de abertura (exemplo)',content:'Esta é uma letra demonstrativa.\n\nSubstitua pelo louvor de sua igreja.'}
];
const EMPTY_LIVE:Live={slide:null,hidden:false,theme:'dark'};
const BROWSER_KEY='nosso-culto-scenes-v1';
const DEFAULT_QUEUE=['welcome','song','prayer'];
function readBrowser():SavedProject|null{
 try{return JSON.parse(localStorage.getItem(BROWSER_KEY)||'null') as SavedProject|null;}catch{return null;}
}
function ProjectionPage(){
 const [live,setLive]=useState<Live>(()=>persistedLive()??EMPTY_LIVE);
 const [fullscreen,setFullscreen]=useState(()=>Boolean(document.fullscreenElement));
 const [fullscreenError,setFullscreenError]=useState('');
 useEffect(()=>{
   document.body.classList.add('projector-body');
   const apply=(value:unknown)=>{if(validLive(value))setLive(value);};
   const stop=window.desktop?.onProjectionChange(apply);
   void window.desktop?.getProjectionState().then(apply).catch(()=>{});
   // Recover state sent before the new projection window mounted.
   const latest=persistedLive();if(latest&&!window.desktop)setLive(latest);
   const channel=new BroadcastChannel(CHANNEL);
   channel.onmessage=(event:MessageEvent<unknown>)=>{
     const message=event.data;
     if(message&&typeof message==='object'&&'type' in message&&message.type==='live-state'&&'value' in message)
       apply(message.value);
     else apply(message);
   };
   channel.postMessage({type:'request-state'});
   const onStorage=(event:StorageEvent)=>{if(event.key===LIVE_KEY){const current=persistedLive();if(current)setLive(current);}};
   const onFullscreen=()=>setFullscreen(Boolean(document.fullscreenElement));
   window.addEventListener('storage',onStorage);
   document.addEventListener('fullscreenchange',onFullscreen);
   return ()=>{
     document.body.classList.remove('projector-body');stop?.();channel.close();
     window.removeEventListener('storage',onStorage);
     document.removeEventListener('fullscreenchange',onFullscreen);
   };
 },[]);
 async function enterFullscreen(){
   try{setFullscreenError('');await document.documentElement.requestFullscreen();}
   catch(error){setFullscreenError('O navegador bloqueou a tela cheia. Use F11 para maximizar esta janela. '+String(error));}
 }
 const isSupport=new URLSearchParams(location.search).get('projection')==='support';
 return <div className={'projection projection--'+live.theme}>
   {window.desktop&&<div className="projection__drag-region" aria-hidden="true"/>}
   {isSupport&&<div className="projection__support-heading">MONITOR DE APOIO</div>}
   {!live.hidden&&live.slide
     ?<SlideContent slide={live.slide} projection/>
     :!live.hidden&&<div className="projection__empty">
        <strong>Nenhum conteúdo preparado</strong>
        <span>Digite o texto ou selecione uma música no painel de controle e envie um slide para a projeção.</span>
      </div>}
   {!window.desktop&&!fullscreen&&<div className="projection__browser-tools">
      <button onClick={()=>void enterFullscreen()}><Maximize2 size={16}/> Entrar em tela cheia</button>
      {fullscreenError&&<small>{fullscreenError}</small>}
   </div>}
 </div>;
}
function SceneImageLayer({imageId,title}:{imageId:string;title:string}){
 const asset=useImageUrl(imageId);
 return asset.url
   ?<img className="scene-compositor-image" src={asset.url} alt={title}/>
   :<span className="scene-screen-loading">{asset.error?'Imagem indisponível neste perfil.':'Carregando imagem...'}</span>;
}
function SlideContent({slide,projection=false}:{slide:Slide;projection?:boolean}){
 const legacy=useImageUrl(slide.imageId);
 if(slide.layers?.length){
   return <div className={'scene-compositor '+(projection?'scene-compositor-projected':'scene-compositor-preview')}>
     {slide.layers.map((layer,index)=><div key={layer.id} className={'scene-compositor-layer scene-compositor-'+layer.kind}
       style={{zIndex:slide.layers!.length-index}}>
       {layer.kind==='image'&&layer.imageId
         ?<SceneImageLayer imageId={layer.imageId} title={slide.title}/>
         :layer.kind==='text'
           ?<div className="scene-compositor-caption">{layer.text}</div>
           :null}
     </div>)}
   </div>;
 }
 if(slide.imageId){
   return legacy.url?<img className={projection?'scene-screen-image projected':'scene-screen-image'} src={legacy.url} alt={slide.title}/>
     :<span className="scene-screen-loading">{legacy.error?'Arquivo de imagem não disponível neste dispositivo.':'Carregando imagem...'}</span>;
 }
 return projection
   ?<div className="projection__text">{slide.body.split('\n').map((line,index)=><div key={index}>{line||'\u00a0'}</div>)}</div>
   :<p className="scene-preview-text">{slide.body}</p>;
}
function ImageWorkspace({item,onImage,onUpdate}:{item:SceneItem;onImage:(file:File)=>Promise<void>;onUpdate:(item:SceneItem)=>void}){
 const selected=useImageUrl(item.imageId);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 async function choose(file?:File){
   if(!file)return;
   setSaving(true);setError('');
   try{await onImage(file);}catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setSaving(false);}
 }
 return <section className="scene-image-workspace">
   <div className="scene-editor-label">EDITOR DE IMAGENS</div>
   <label>Nome do item<input value={item.title} onChange={e=>onUpdate({...item,title:e.target.value})}/></label>
   <label className="scene-upload-image"><ImageIcon size={22}/> {saving?'Salvando imagem...':item.imageId?'Substituir imagem':'Selecionar imagem (PNG, JPG, WebP ou GIF)'}
     <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={saving} onChange={e=>{const f=e.target.files?.[0];void choose(f);e.target.value='';}}/>
   </label>
   {error&&<p className="scene-image-error">{error}</p>}
   {item.imageId
     ?(selected.url?<div className="scene-image-editor-preview"><img src={selected.url} alt={item.title}/></div>:<p>{selected.error?'Imagem não encontrada na biblioteca local.':'Carregando imagem...'}</p>)
     :<div className="scene-image-editor-empty">Adicione uma imagem para vê-la na prévia antes de iniciar a transmissão.</div>}
   <small>As imagens são armazenadas localmente neste navegador ou computador. O backup JSON ainda não inclui os arquivos.</small>
 </section>;
}
function AppButton({children,onClick,disabled,primary=false,title}:{
 children:ReactNode;onClick:()=>void;disabled?:boolean;primary?:boolean;title?:string
}) {return <button type="button" title={title} className={'scene-button '+(primary?'scene-button-primary':'')} disabled={disabled} onClick={onClick}>{children}</button>;}
function TextWorkspace({item,onUpdate,onProject}:{
 item:SceneItem;
 onUpdate:(item:SceneItem)=>void;
 onProject:(body:string)=>void;
}){
 const sections=item.content?.trim().split(/\n\s*\n/).filter(Boolean)??[];
 return <div className="scene-text-workspace" key={item.id}>
   <div className="scene-editor-label">{item.type==='bible'?'REFERÊNCIA BÍBLICA / TEXTO':'EDITOR DE TEXTO'}</div>
   <label>Título do item<input value={item.title} onChange={e=>onUpdate({...item,title:e.target.value})} placeholder="Título"/></label>
   <label>{item.type==='bible'?'Versículos e referência (inserção manual)':'Conteúdo do texto'}
     <textarea value={item.content??''} onChange={e=>onUpdate({...item,content:e.target.value})} placeholder={item.type==='bible'?'Ex.: João 3:16\n\nPorque Deus amou o mundo...':'Escreva o conteúdo aqui. Separe slides com uma linha vazia.'} rows={8}/>
   </label>
   <p>As alterações são salvas automaticamente. Separe os slides com uma linha vazia.</p>
   <p className="scene-editor-help"><strong>Importante:</strong> o texto cinza dentro do campo é apenas um exemplo. Digite o versículo ou texto para que ele possa ser projetado.</p>
   {item.type==='bible'&&<p className="scene-bible-note">A integração com traduções bíblicas licenciadas ainda não está disponível. Você pode preparar versículos manualmente.</p>}
   <div className="scene-text-slides">
     {sections.map((part,index)=><button key={index} onClick={()=>onProject(part)}>
       <small>SLIDE {String(index+1).padStart(2,'0')}</small><span>{part}</span>
     </button>)}
   </div>
 </div>;
}
type ModalKind='scene-create'|'scene-rename'|'item-create'|'item-rename'|'music-edit'|null;
function ControlPage(){
 const [ready,setReady]=useState(false);
 const [library,setLibrary]=useState<MusicItem[]>([]);
 const [queue,setQueue]=useState<string[]>([]);
 const [scenes,setScenes]=useState<Scene[]>([]);
 const [sceneId,setSceneId]=useState('');
 const [sceneItemId,setSceneItemId]=useState('');
 const [activeCue,setActiveCue]=useState(0);
 const [cueOverride,setCueOverride]=useState<{sceneId:string;itemId:string;text:string}|null>(null);
 const [transmitting,setTransmitting]=useState(false);
 const transmittingRef=useRef(false);
 const popupRef=useRef<Window|null>(null);
 const [dropTarget,setDropTarget]=useState<{index:number;after:boolean}|null>(null);
 const [sceneDropTarget,setSceneDropTarget]=useState<{index:number;after:boolean}|null>(null);
 const [sceneContext,setSceneContext]=useState<{id:string;x:number;y:number}|null>(null);
 const draggingSceneId=useRef<string|null>(null);
 const [itemContext,setItemContext]=useState<{id:string;x:number;y:number}|null>(null);
 const [musicSearch,setMusicSearch]=useState('');
 const [preferences,setPreferences]=useState<AppPreferences>(()=>loadPreferences());
 const [previewMonitors,setPreviewMonitors]=useState<MonitorConfiguration|null>(null);
 const [displays,setDisplays]=useState<DisplayDevice[]>([]);
 const [live,setLive]=useState<Live>(()=>({...EMPTY_LIVE,theme:preferences.projectionTheme}));
 const liveRef=useRef<Live>(live);
 const [notice,setNotice]=useState('');
 const [modal,setModal]=useState<ModalKind>(null);
 const [draftName,setDraftName]=useState('');
 const [musicDraft,setMusicDraft]=useState<MusicItem|null>(null);
 const scene=useMemo(()=>scenes.find(x=>x.id===sceneId),[scenes,sceneId]);
 const sceneItem=useMemo(()=>scene?.items.find(x=>x.id===sceneItemId),[scene,sceneItemId]);
 const track=useMemo(()=>sceneItem?.type==='music'&&sceneItem.libraryId?library.find(x=>x.id===sceneItem.libraryId):undefined,[sceneItem,library]);
 const composedSlide=useMemo(()=>composeScene(scene,library,cueOverride),[scene,library,cueOverride]);
 const broadcast=useCallback((state:Live)=>{
   liveRef.current=state;
   setLive(state);
   window.desktop?.updateProjection(state);
   try{localStorage.setItem(LIVE_KEY,JSON.stringify(state));
     const ch=new BroadcastChannel(CHANNEL);ch.postMessage(state);ch.close();}catch{}
 },[]);
 useEffect(()=>{
   if(!window.desktop?.onProjectionOutputClosed)return;
   return window.desktop.onProjectionOutputClosed(()=>{
     // Esc or native X closed the projection outside the control panel.
     if(!transmittingRef.current)return;
     transmittingRef.current=false;
     setTransmitting(false);
     popupRef.current=null;
     broadcast({...liveRef.current,slide:null,hidden:true});
     setNotice('Janela de transmissão encerrada. Você pode iniciar novamente quando quiser.');
   });
 },[broadcast]);
 // A new popup explicitly requests the last transmitted slide after mounting.
 useEffect(()=>{
   const channel=new BroadcastChannel(CHANNEL);
   channel.onmessage=(event:MessageEvent<unknown>)=>{
     const message=event.data;
     if(message&&typeof message==='object'&&'type' in message&&message.type==='request-state'){
       channel.postMessage({type:'live-state',value:persistedLive()??EMPTY_LIVE});
     }
   };
   return ()=>channel.close();
 },[]);
 useEffect(()=>{
   if(!itemContext&&!sceneContext)return;
   const close=()=>{setItemContext(null);setSceneContext(null);};
   const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};
   document.addEventListener('pointerdown',close);
   document.addEventListener('keydown',key);
   window.addEventListener('resize',close);
   window.addEventListener('scroll',close,true);
   return ()=>{
     document.removeEventListener('pointerdown',close);
     document.removeEventListener('keydown',key);
     window.removeEventListener('resize',close);
     window.removeEventListener('scroll',close,true);
   };
 },[itemContext,sceneContext]);
 useEffect(()=>{
   document.documentElement.dataset.appTheme=preferences.appearance;
   document.documentElement.dataset.appDensity=preferences.density;
 },[preferences.appearance,preferences.density]);
 useEffect(()=>{
   let mounted=true;
   void (async()=>{
     try{
       const stored=window.desktop?await window.desktop.readData():readBrowser();
       if(!mounted)return;
       const data:SavedProject=stored?{library:stored.library as MusicItem[],queue:stored.queue,scenes:stored.scenes}: {library:INITIAL_LIBRARY,queue:DEFAULT_QUEUE,scenes:[]};
       const books=data.library??INITIAL_LIBRARY;
       const previous=data.queue??[];
       const list=data.scenes?.length?data.scenes:initialScenes(books,previous);
       setLibrary(books);setQueue(previous);setScenes(list);
       setSceneId(list[0]?.id??'');setSceneItemId(list[0]?.items[0]?.id??'');
       const found=window.desktop?await window.desktop.getDisplays():[{id:1,name:'Navegador',primary:true,width:1920,height:1080}];
       if(mounted)setDisplays(found);
     }catch(error){
       if(!mounted)return;
       const fallback=initialScenes(INITIAL_LIBRARY,DEFAULT_QUEUE);
       setLibrary(INITIAL_LIBRARY);setQueue(DEFAULT_QUEUE);setScenes(fallback);
       setSceneId(fallback[0].id);setSceneItemId(fallback[0].items[0]?.id??'');
       setNotice('Não foi possível carregar todos os dados locais: '+String(error));
     }finally{if(mounted)setReady(true);}
   })();
   const unsubscribe=window.desktop?.onDisplaysChanged?.(setDisplays);
   return ()=>{mounted=false;unsubscribe?.();};
 },[]);
 // Compose every visible source in scene order. Selecting a source only opens its
 // editor; the preview and the audience screen always show the whole scene.
 useEffect(()=>{
   if(!ready)return;
   if(transmittingRef.current)broadcast({...liveRef.current,slide:composedSlide});
 },[ready,composedSlide,broadcast]);
 useEffect(()=>{
   if(!ready)return;
   const data:SavedProject={library,queue,scenes};
   if(window.desktop){void window.desktop.saveData(data).catch(e=>setNotice('Falha ao salvar biblioteca e cenas: '+String(e)));}
   else try{localStorage.setItem(BROWSER_KEY,JSON.stringify(data));}catch(e){setNotice('Armazenamento do navegador cheio: '+String(e));}
 },[library,queue,scenes,ready]);
 async function applyPreferences(next:AppPreferences):Promise<void>{
   if(window.desktop&&JSON.stringify(next.monitors)!==JSON.stringify(preferences.monitors))
     await window.desktop.configureDisplays(next.monitors);
   setPreferences(next);savePreferences(next);
   if(transmittingRef.current)broadcast({...liveRef.current,theme:next.projectionTheme});
 }
 function updateScene(id:string,modify:(scene:Scene)=>Scene){
   setScenes(prev=>prev.map(v=>v.id===id?modify(v):v));
 }
 function chooseScene(id:string){
   setItemContext(null);setSceneContext(null);
   setDropTarget(null);setSceneDropTarget(null);
   setCueOverride(null);
   const target=scenes.find(x=>x.id===id);
   setSceneId(id);setSceneItemId(target?.items[0]?.id??'');setActiveCue(0);
 }
 function reorderScene(from:number,target:number){
   if(from<0||target<0||from>=scenes.length||target>=scenes.length||from===target)return;
   // A locked scene stays at its physical position; do not push it aside.
   if(scenes.slice(Math.min(from,target),Math.max(from,target)+1).some(entry=>entry.locked))return;
   const next=[...scenes];
   const [moved]=next.splice(from,1);next.splice(target,0,moved);
   setScenes(next);setSceneDropTarget(null);
 }
 function openSceneContext(event:ReactMouseEvent<HTMLElement>,entry:Scene){
   event.preventDefault();
   chooseScene(entry.id);
   setSceneContext({id:entry.id,x:Math.max(8,Math.min(event.clientX,window.innerWidth-228)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-345))});
 }
 function renameScene(entry:Scene){
   chooseScene(entry.id);setDraftName(entry.name);setModal('scene-rename');
 }
 function duplicateScene(entry:Scene){
   const copy:Scene={...entry,id:makeId(),name:entry.name+' (cópia)',locked:false,
     items:entry.items.map(item=>({...item,id:makeId()}))};
   const index=scenes.findIndex(x=>x.id===entry.id);
   setScenes(old=>{const next=[...old];next.splice(index+1,0,copy);return next;});
   setSceneContext(null);setItemContext(null);
   setSceneId(copy.id);setSceneItemId(copy.items[0]?.id??'');
   setActiveCue(0);setCueOverride(null);setSceneDropTarget(null);
 }
 function toggleSceneLock(entry:Scene){
   setScenes(old=>old.map(s=>s.id===entry.id?{...s,locked:!entry.locked}:s));
   setSceneContext(null);
 }
 function deleteSceneById(entry:Scene){
   setSceneContext(null);
   if(!confirm('Excluir a cena "'+entry.name+'" e seus itens?'))return;
   const remaining=scenes.filter(x=>x.id!==entry.id);
   setScenes(remaining);
   if(sceneId===entry.id){
     setSceneId(remaining[0]?.id??'');
     setSceneItemId(remaining[0]?.items[0]?.id??'');
     setActiveCue(0);setCueOverride(null);
   }
 }
 function selectItem(id:string){setItemContext(null);setSceneItemId(id);setActiveCue(0);}
 function reorderItem(from:number,target:number){
   if(!scene||from<0||target<0||from>=scene.items.length||target>=scene.items.length||from===target)return;
   if(scene.items[from]?.locked||scene.items[target]?.locked)return;
   const next=[...scene.items];
   const [moved]=next.splice(from,1);
   next.splice(target,0,moved);
   updateScene(scene.id,old=>({...old,items:next}));
   // On every reorder, the new first item becomes the scene's active starting item.
   setSceneItemId(next[0]?.id??'');
   setActiveCue(0);
   setDropTarget(null);
 }
 function updateSceneItem(updated:SceneItem){
   if(!scene)return;
   if(updated.content!==scene.items.find(x=>x.id===updated.id)?.content)
     setCueOverride(null);
   updateScene(scene.id,old=>({...old,items:old.items.map(x=>x.id===updated.id?updated:x)}));
 }
 function updateTrack(updated:MusicItem){setLibrary(list=>list.map(x=>x.id===updated.id?updated:x));}
 function selectTrack(id:string){
   if(!scene||!sceneItem||sceneItem.type!=='music')return;
   updateSceneItem({...sceneItem,libraryId:id});
   setActiveCue(0);
 }
 function projectSlide(body:string){
   if(!scene||!sceneItem||sceneItem.visible===false)return;
   // Change only this source's displayed verse; preserve images and other sources.
   setCueOverride({sceneId:scene.id,itemId:sceneItem.id,text:body});
 }
 function showCue(index:number){
   if(!track||!sceneItem)return;
   const cue=track.cues?.[index];
   if(!cue)return;
   setActiveCue(index);projectSlide(cue.text);
 }
 function openModal(kind:ModalKind){
   if(kind==='scene-create')setDraftName('');
   if(kind==='scene-rename')setDraftName(scene?.name??'');
   if(kind==='item-rename')setDraftName(sceneItem?.title??'');
   if(kind==='music-edit')setMusicDraft(track?{...track}:null);
   setModal(kind);
 }
 function createScene(){
   const name=draftName.trim();if(!name)return;
   const newScene:Scene={id:makeId(),name,items:[]};
   setScenes(old=>[...old,newScene]);setSceneId(newScene.id);setSceneItemId('');setModal(null);
 }
 function createItem(type:SceneItemType){
   if(!scene)return;
   const obj:SceneItem={id:makeId(),type,title:sceneItemTitle(type),visible:true,locked:false};
   updateScene(scene.id,old=>({...old,items:[...old.items,obj]}));
   setSceneItemId(obj.id);setActiveCue(0);setModal(null);
 }
 function rename(){
   if(!draftName.trim())return;
   if(modal==='scene-rename'&&scene)updateScene(scene.id,old=>({...old,name:draftName.trim()}));
   if(modal==='item-rename'&&sceneItem)updateSceneItem({...sceneItem,title:draftName.trim()});
   setModal(null);
 }
 function removeItem(){
   if(!scene||!sceneItem||!confirm('Remover "'+sceneItem.title+'" da cena?'))return;
   const updated=scene.items.filter(x=>x.id!==sceneItem.id);
   updateScene(scene.id,old=>({...old,items:updated}));setSceneItemId(updated[0]?.id??'');
 }
 function moveItem(from:number,direction:number){reorderItem(from,from+direction);}
 function openItemContext(event:ReactMouseEvent<HTMLElement>,item:SceneItem){
   event.preventDefault();
   setSceneItemId(item.id);
   setActiveCue(0);
   // Keep the OBS-like floating menu inside the available viewport.
   setItemContext({id:item.id,x:Math.max(8,Math.min(event.clientX,window.innerWidth-228)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-285))});
 }
 function renameItem(item:SceneItem){
   setItemContext(null);
   setSceneItemId(item.id);
   setDraftName(item.title);
   setModal('item-rename');
 }
 function toggleItemFlag(item:SceneItem,key:'visible'|'locked'){
   updateSceneItem({...item,[key]:key==='visible'?item.visible===false:item.locked!==true});
   setItemContext(null);
 }
 function duplicateItem(item:SceneItem){
   if(!scene)return;
   const copy:SceneItem={...item,id:makeId(),title:item.title+' (cópia)',locked:false};
   const index=scene.items.findIndex(x=>x.id===item.id);
   updateScene(scene.id,old=>{const items=[...old.items];items.splice(index+1,0,copy);return {...old,items};});
   setSceneItemId(copy.id);
   setItemContext(null);
 }

 async function importMusic(kind:'files'|'folder'|'zip',webFiles?:File[]){
   if(!window.desktop&&!webFiles?.length)return;
   try{
     const result=window.desktop
       ?await window.desktop.importMedia(kind)
       :await importWebMedia(webFiles??[],kind);
     if('cancelled' in result&&result.cancelled)return;
     const imported=result.items as MusicItem[];
     if(imported.length){
       setLibrary(old=>[...old,...imported]);
       if(sceneItem?.type==='music')selectTrack(imported[0].id);
     }
     setNotice(imported.length+' música(s) importada(s).'+(result.errors.length?' Falhas: '+result.errors.slice(0,3).join('; '):''));
   }catch(e){setNotice('Falha ao importar músicas: '+String(e));}
 }
 async function importLrc(webFile?:File){
   if(!track||(!window.desktop&&!webFile))return;
   try{
     const result=window.desktop?await window.desktop.importLrc():await parseWebLrcFile(webFile!);
     if(!result)return;
     updateTrack({...track,content:result.content,cues:result.cues,timingSource:'lrc'});
     setActiveCue(0);setNotice('Letra sincronizada importada: '+result.cues.length+' trechos.');
   }catch(e){setNotice('Falha ao importar LRC: '+String(e));}
 }
 function saveMusic(){
   if(!musicDraft?.title.trim())return;
   const before=library.find(x=>x.id===musicDraft.id);
   const revised={...musicDraft,title:musicDraft.title.trim(),
     cues:musicDraft.content!==before?.content?[]:musicDraft.cues,
     timingSource:musicDraft.content!==before?.content?undefined:musicDraft.timingSource};
   updateTrack(revised);setModal(null);setActiveCue(0);
 }
 function deleteTrack(){
   if(!track||!confirm('Excluir "'+track.title+'" da biblioteca de músicas?'))return;
   setLibrary(old=>old.filter(x=>x.id!==track.id));
   if(!window.desktop&&track.audioId)void deleteWebAudio(track.audioId).catch(e=>setNotice('Falha ao excluir áudio do navegador: '+String(e)));
   setScenes(old=>old.map(scene=>({...scene,items:scene.items.map(item=>item.libraryId===track.id?{...item,libraryId:undefined}:item)})));
   setActiveCue(0);
 }
 function appendSongToScene(){
   if(!scene||!track)return;
   const song:SceneItem={id:makeId(),title:track.title,type:'music',libraryId:track.id};
   updateScene(scene.id,old=>({...old,items:[...old.items,song]}));
   setSceneItemId(song.id);
 }
 function preparedSlide():Slide|null{return composedSlide;}
 function showProjection(){
   if(!transmittingRef.current)return;
   broadcast({...liveRef.current,hidden:false});
 }
 async function startTransmission(){
   if(transmittingRef.current)return;
   const staged=preparedSlide();
   let popup:Window|null=null;
   if(!window.desktop){
     popup=window.open(location.origin+location.pathname+'?projection=1','nosso-culto-projection','width=1280,height=720');
     if(!popup){setNotice('O navegador bloqueou a janela de projeção. Permita pop-ups para este site.');return;}
   }
   try{
     // The selected preview remains private until the operator starts transmission.
     const next:Live={slide:staged,hidden:preferences.startHidden,theme:preferences.projectionTheme};
     broadcast(next);
     if(window.desktop)await window.desktop.openProjection(preferences.monitors);
     transmittingRef.current=true;
     setTransmitting(true);
     popupRef.current=popup;
     if(!staged)setNotice('Transmissão iniciada sem slide. Prepare uma cena e ela será exibida automaticamente.');
   }catch(e){
     popup?.close();
     setNotice('Não foi possível iniciar a transmissão: '+String(e));
   }
 }
 async function stopTransmission(){
   if(!transmittingRef.current)return;
   transmittingRef.current=false;
   setTransmitting(false);
   try{if(window.desktop)await window.desktop.closeProjection();else popupRef.current?.close();}
   catch(e){setNotice('Falha ao encerrar janela: '+String(e));}
   popupRef.current=null;
   broadcast({...liveRef.current,slide:null,hidden:true});
 }
 function toggleTransmission(){if(transmittingRef.current)void stopTransmission();else void startTransmission();}
 async function uploadImage(file:File){
   if(!sceneItem||sceneItem.type!=='image')return;
   const imageId=await saveImage(file);
   updateSceneItem({...sceneItem,imageId,title:sceneItem.title==='Imagem'?file.name.replace(/\.[^.]+$/,''):sceneItem.title});
   setNotice('Imagem pronta na prévia. Ela não será enviada à janela externa antes de iniciar a transmissão.');
 }
 async function exportBackup(){
   if(!window.desktop)return;
   try{const saved=await window.desktop.exportData({library,queue,scenes});if(saved)setNotice('Backup de cenas e letras exportado. Áudios não estão incluídos no JSON.');}
   catch(e){setNotice('Falha no backup: '+String(e));}
 }
 async function importBackup(){
   if(!window.desktop)return;
   try{
     const data=await window.desktop.importData();
     if(!data)return;
     if(preferences.confirmImport&&!confirm('Substituir a biblioteca, as cenas e a programação pelo backup?'))return;
     const incoming=data as SavedProject;
     const next=incoming.scenes?.length?incoming.scenes:initialScenes(incoming.library,incoming.queue);
     setLibrary(incoming.library);setQueue(incoming.queue);setScenes(next);
     setSceneId(next[0]?.id??'');setSceneItemId(next[0]?.items[0]?.id??'');setNotice('Backup importado.');
     broadcast({...EMPTY_LIVE,theme:preferences.projectionTheme});
   }catch(e){setNotice('Falha ao importar backup: '+String(e));}
 }
 // Monitor/resolução escolhidos na janela de configurações aparecem
 // imediatamente aqui. Aplicar salva; Cancelar desfaz a prévia.
 const mainOutput=(previewMonitors??preferences.monitors).main;
 const configuredDisplay=mainOutput.monitorId==='primary'
   ?(displays.find(d=>d.primary)??displays[0])
   :displays.find(d=>String(d.id)===mainOutput.monitorId);
 const ratio=(()=>{
   const match=/^(\d+)x(\d+)$/.exec(mainOutput.resolution);
   if(match)return Number(match[1])+' / '+Number(match[2]);
   return configuredDisplay
     ? configuredDisplay.width+' / '+configuredDisplay.height
     : '16 / 9';
 })();
 const mainOutputLabel=configuredDisplay
   ? configuredDisplay.name+' · '+Math.round(configuredDisplay.width*(configuredDisplay.scaleFactor??1))+' × '+
     Math.round(configuredDisplay.height*(configuredDisplay.scaleFactor??1))+
     (configuredDisplay.primary?' (Windows principal)':'')
   : 'Monitor não detectado — revise as configurações';
 const configuredResolution=mainOutput.resolution==='native'?'Resolução nativa / tela inteira':mainOutput.resolution.replace('x',' × ');
 const isMusic=sceneItem?.type==='music';
 const sceneItems=scene?.items??[];
 const contextScene=scenes.find(entry=>entry.id===sceneContext?.id);
 const contextSceneIndex=contextScene?scenes.findIndex(entry=>entry.id===contextScene.id):-1;
 const contextItem=sceneItems.find(item=>item.id===itemContext?.id);
 const contextIndex=contextItem?sceneItems.findIndex(item=>item.id===contextItem.id):-1;
 const sceneReady=!!scene;
 if(!ready)return <div className="loading">Carregando o Nosso Culto...</div>;
 return <>
   <DesktopToolbar
     preferences={preferences} displays={displays} hasSelected={Boolean(sceneItem)}
     onMonitorPreview={setPreviewMonitors}
     onApply={applyPreferences} onNew={()=>openModal('item-create')}
     onEdit={()=>openModal(isMusic?'music-edit':'item-rename')}
     onDelete={removeItem} onAddQueue={appendSongToScene}
     onOpenProjection={toggleTransmission}
     transmitting={transmitting}
     onHideProjection={()=>{if(transmittingRef.current)broadcast({...liveRef.current,hidden:true});}}
     onShowProjection={showProjection}
     onImport={importBackup} onExport={exportBackup}
     onExit={()=>{void window.desktop?.exitApp();}}
   />
   <div className="scene-app">
     {notice&&<div className="scene-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
     <div className="scene-main-grid">
       <section className="scene-sidebar">
         <div className="scene-column-heading"><div><small>GERENCIADOR</small><h2>Cenas</h2></div></div>
         <div className="scene-list" aria-label="Cenas do culto">
           {scenes.map((entry,index)=><div key={entry.id}
             className={'scene-entry scene-compact-row '+(sceneId===entry.id?'selected ':'')+
               (entry.locked?'scene-entry-locked ':'')+
               (sceneDropTarget?.index===index?(sceneDropTarget.after?'scene-drop-after':'scene-drop-before'):'')}
             draggable={!entry.locked}
             onContextMenu={event=>openSceneContext(event,entry)}
             onDragStart={event=>{
               if(entry.locked){event.preventDefault();return;}
               draggingSceneId.current=entry.id;
               setSceneContext(null);
               event.dataTransfer.setData('application/x-nosso-culto-scene-id',entry.id);
               event.dataTransfer.effectAllowed='move';
             }}
             onDragEnd={()=>{draggingSceneId.current=null;setSceneDropTarget(null);}}
             onDragOver={event=>{
               if(!Array.from(event.dataTransfer.types).includes('application/x-nosso-culto-scene-id'))return;
               const source=scenes.findIndex(s=>s.id===draggingSceneId.current);
               if(entry.locked||source<0||scenes.slice(Math.min(source,index),Math.max(source,index)+1).some(s=>s.locked))return;
               event.preventDefault();event.dataTransfer.dropEffect='move';
               const bounds=event.currentTarget.getBoundingClientRect();
               setSceneDropTarget({index,after:event.clientY>=bounds.top+bounds.height/2});
             }}
             onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSceneDropTarget(null);}}
             onDrop={event=>{
               event.preventDefault();
               const from=scenes.findIndex(s=>s.id===event.dataTransfer.getData('application/x-nosso-culto-scene-id'));
               const bounds=event.currentTarget.getBoundingClientRect();
               const position=index+(event.clientY>=bounds.top+bounds.height/2?1:0);
               reorderScene(from,from<position?position-1:position);
               draggingSceneId.current=null;setSceneDropTarget(null);
             }}>
             <button type="button" className="scene-entry-pick" onClick={()=>chooseScene(entry.id)}
               onDoubleClick={()=>renameScene(entry)}
               onKeyDown={event=>{if(event.key==='F2'){event.preventDefault();renameScene(entry);}}}
               title={entry.name+' — '+entry.items.length+' item(ns). Clique direito para opções.'}
               aria-current={sceneId===entry.id?'true':undefined}>
               <span className={'scene-entry-number '+(index===0?'is-primary':'')}>{index+1}</span>
               <span className="scene-entry-icon"><Clapperboard size={16}/></span>
               <span className="scene-entry-main"><strong>{entry.name}</strong></span>
               {entry.locked&&<Lock size={14} className="scene-entry-lock-icon"/>}
             </button>
           </div>)}
           {!scenes.length&&<p className="scene-empty-text">Crie a primeira cena para iniciar a programação.</p>}
         </div>
         <div className="scene-sidebar-footer">
           <AppButton onClick={()=>openModal('scene-create')}><Plus size={16}/> Nova cena</AppButton>
         </div>
       </section>
       <section className="scene-items-column">
         <div className="scene-column-heading"><div><small>ITENS DA CENA</small><h2>{scene?.name??'Nenhuma cena'}</h2></div></div>
         <p className="scene-column-description">Camadas: o item nº 1 aparece por cima dos demais. Arraste para reordenar.</p>
         <div className="scene-items-list">
           {sceneItems.map((entry,index)=><div key={entry.id}
             className={'scene-item scene-source-row '+(sceneItemId===entry.id?'selected ':'')+(index===0?'scene-item-primary ':'')+(entry.visible===false?'scene-source-hidden ':'')+(entry.locked?'scene-source-locked ':'')+(dropTarget?.index===index?(dropTarget.after?'scene-drop-after':'scene-drop-before'):'')}
             draggable={!entry.locked}
             onContextMenu={event=>openItemContext(event,entry)}
             onDragStart={event=>{
               if(entry.locked){event.preventDefault();return;}
               event.dataTransfer.setData('application/x-scene-item-id',entry.id);event.dataTransfer.effectAllowed='move';
             }}
             onDragEnd={()=>setDropTarget(null)}
             onDragOver={event=>{
               if(entry.locked||!Array.from(event.dataTransfer.types).includes('application/x-scene-item-id'))return;
               event.preventDefault();event.dataTransfer.dropEffect='move';
               const bounds=event.currentTarget.getBoundingClientRect();
               setDropTarget({index,after:event.clientY>=bounds.top+bounds.height/2});
             }}
             onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropTarget(null);}}
             onDrop={event=>{
               event.preventDefault();
               if(entry.locked){setDropTarget(null);return;}
               const from=sceneItems.findIndex(x=>x.id===event.dataTransfer.getData('application/x-scene-item-id'));
               const bounds=event.currentTarget.getBoundingClientRect();
               const position=index+(event.clientY>=bounds.top+bounds.height/2?1:0);
               reorderItem(from,from<position?position-1:position);
               setDropTarget(null);
             }}>
             <button type="button" className="scene-item-pick" onClick={()=>selectItem(entry.id)}
               onKeyDown={event=>{if(event.key==='F2'){event.preventDefault();renameItem(entry);}}}
               title={entry.title+' — '+(index===0?'Item principal':'Item '+(index+1))+'. Clique direito para opções.'}>
               <span className={'scene-item-rank '+(index===0?'is-primary':'')}>{index+1}</span>
               <span className="scene-item-icon">{entry.type==='music'?<Music2 size={16}/>:entry.type==='bible'?<BookOpen size={16}/>:entry.type==='image'?<ImageIcon size={16}/>:<FileText size={16}/>}</span>
               <span className="scene-item-name"><strong>{entry.title}</strong></span>
             </button>
             <div className="scene-source-controls">
               <button type="button" aria-label={(entry.visible===false?'Mostrar ':'Ocultar ')+entry.title}
                 title={entry.visible===false?'Mostrar item':'Ocultar item'} onClick={()=>toggleItemFlag(entry,'visible')}>
                 {entry.visible===false?<EyeOff size={16}/>:<Eye size={16}/>}
               </button>
               <button type="button" aria-label={(entry.locked?'Desbloquear ':'Bloquear ')+entry.title}
                 title={entry.locked?'Desbloquear posição':'Bloquear posição'} onClick={()=>toggleItemFlag(entry,'locked')}>
                 {entry.locked?<Lock size={16}/>:<LockOpen size={16}/>}
               </button>
             </div>
           </div>)}
           {sceneReady&&!scene?.items.length&&<div className="scene-empty-text">Esta cena está vazia. Use Adicionar item para incluir Música, Texto, Bíblia ou Imagem.</div>}
           {!sceneReady&&<div className="scene-empty-text">Selecione ou crie uma cena.</div>}
         </div>
         <div className="scene-items-footer">
           <AppButton onClick={()=>openModal('item-create')} disabled={!sceneReady}><Plus size={16}/> Adicionar item</AppButton>
         </div>
       </section>
       <section className="scene-editor-column">
         {!sceneItem&&<div className="scene-editor-empty"><Clapperboard size={36}/><h2>Selecione um item da cena</h2><p>Escolha um item à esquerda para abrir o editor e a pré-visualização.</p></div>}
         {isMusic&&sceneItem&&<div className="scene-music-container">
           <MusicWorkspace key={sceneItem.id}
             items={library.filter(x=>x.type==='music')} selected={track}
             search={musicSearch} setSearch={setMusicSearch} active={activeCue}
             onSelect={selectTrack} onCue={showCue} onUpdate={updateTrack}
             onNew={()=>void importMusic('files')}
             onEdit={()=>openModal('music-edit')}
             onAddQueue={appendSongToScene} onDelete={deleteTrack}
             onImport={importMusic} onImportLrc={importLrc}
             onImportWeb={(kind,files)=>importMusic(kind,files)}
             onImportLrcWeb={(file)=>importLrc(file)}
           />
         </div>}
         {sceneItem&&sceneItem.type==='image'&&<ImageWorkspace item={sceneItem} onImage={uploadImage} onUpdate={updateSceneItem}/>}
         {sceneItem&&!isMusic&&sceneItem.type!=='image'&&<TextWorkspace item={sceneItem} onUpdate={updateSceneItem} onProject={projectSlide}/>}
       </section>
       <section className="scene-output">
         <div className="scene-output-heading"><h2>Pré-visualização</h2><span className={transmitting?'scene-live-indicator':'scene-ready-indicator'}>{transmitting?'● TRANSMITINDO':'● PREPARAÇÃO'}</span></div>
         <p className="scene-preview-caption">Prepare a cena e confira como ela será exibida no Monitor Principal configurado.</p>
         <div className={'preview preview--'+preferences.projectionTheme} style={{aspectRatio:ratio}}>
           {composedSlide
             ?<SlideContent slide={composedSlide}/>
             :<span className="preview__standby">Adicione conteúdo aos itens visíveis da cena.</span>}
         </div>
         <small className="scene-preview-private">{transmitting?'A saída externa acompanha as mudanças da cena.':'Prévia local: nenhuma janela externa está transmitindo.'}</small>
         <div className="scene-output-actions">
           <AppButton onClick={()=>{if(transmittingRef.current)broadcast({...liveRef.current,hidden:true});}} disabled={!transmitting}><EyeOff size={16}/> Ocultar</AppButton>
           <AppButton onClick={showProjection} disabled={!transmitting}><Eye size={16}/> Mostrar</AppButton>
         </div>
         <div className="scene-output-setting">
           <label>Monitor Principal da transmissão</label>
           <div className="scene-output-readonly">
             <strong>{mainOutputLabel}</strong>
             <small>{configuredResolution}</small>
             {previewMonitors&&JSON.stringify(previewMonitors.main)!==JSON.stringify(preferences.monitors.main)&&
               <small>Prévia da seleção — clique em Aplicar ou OK para salvar.</small>}
           </div>
           <p className="scene-monitor-hint">Destino definido exclusivamente em Arquivo → Configuração → Projeção → Monitor Principal.</p>
           {!window.desktop&&<p className="scene-monitor-hint">O Chrome não permite posicionar automaticamente a janela em um monitor físico. Mova a janela manualmente ou utilize a versão Electron para obedecer ao monitor configurado.</p>}
         </div>
         <div className="scene-output-setting">
           <label>Plano de fundo</label>
           <div className="themes">{(['dark','blue','warm'] as const).map(v=><button key={v} title={'Tema '+v} className={'theme theme--'+v+(preferences.projectionTheme===v?' chosen':'')} onClick={()=>{void applyPreferences({...preferences,projectionTheme:v});}}/>)}</div>
         </div>
         <AppButton onClick={toggleTransmission} primary={!transmitting}>
           <Maximize2 size={16}/> {transmitting?'Encerrar transmissão':'Iniciar transmissão'}
         </AppButton>
         <div className="scene-output-help"><Settings size={16}/><span>{transmitting
           ?'Transmissão em andamento: as mudanças nos itens são enviadas automaticamente à saída selecionada.'
           :'Prepare cenas, textos e imagens sem afetar a tela do público. Iniciar transmissão abre a saída.'}</span></div>
       </section>
     </div>
   </div>
   {sceneContext&&contextScene&&<div
     className="scene-context-menu" role="menu"
     aria-label={'Opções para a cena '+contextScene.name}
     style={{left:sceneContext.x,top:sceneContext.y}}
     onPointerDown={event=>event.stopPropagation()}
     onContextMenu={event=>event.preventDefault()}>
     <div className="scene-context-heading">{contextScene.name}</div>
     <button role="menuitem" onClick={()=>renameScene(contextScene)}><Edit3 size={15}/> Renomear <kbd>F2</kbd></button>
     <button role="menuitem" onClick={()=>duplicateScene(contextScene)}><Copy size={15}/> Duplicar</button>
     <button role="menuitem" onClick={()=>toggleSceneLock(contextScene)}>
       {contextScene.locked?<LockOpen size={15}/>:<Lock size={15}/>}
       {contextScene.locked?'Desbloquear posição':'Bloquear posição'}
     </button>
     <div className="scene-context-divider"/>
     <button role="menuitem" disabled={contextSceneIndex<=0||Boolean(contextScene.locked)||Boolean(scenes[contextSceneIndex-1]?.locked)}
       onClick={()=>{reorderScene(contextSceneIndex,contextSceneIndex-1);setSceneContext(null);}}>
       <ChevronUp size={15}/> Mover para cima
     </button>
     <button role="menuitem" disabled={contextSceneIndex<0||contextSceneIndex===scenes.length-1||Boolean(contextScene.locked)||Boolean(scenes[contextSceneIndex+1]?.locked)}
       onClick={()=>{reorderScene(contextSceneIndex,contextSceneIndex+1);setSceneContext(null);}}>
       <ChevronDown size={15}/> Mover para baixo
     </button>
     <button role="menuitem" disabled={contextSceneIndex<=0||Boolean(contextScene.locked)||scenes.slice(0,contextSceneIndex).some(entry=>entry.locked)}
       onClick={()=>{reorderScene(contextSceneIndex,0);setSceneContext(null);}}>
       <ArrowUpToLine size={15}/> Mover para o início
     </button>
     <div className="scene-context-divider"/>
     <button role="menuitem" className="scene-context-danger" onClick={()=>deleteSceneById(contextScene)}>
       <Trash2 size={15}/> Excluir cena
     </button>
   </div>}
   {itemContext&&contextItem&&<div
     className="scene-context-menu" role="menu"
     aria-label={'Opções para '+contextItem.title}
     style={{left:itemContext.x,top:itemContext.y}}
     onPointerDown={event=>event.stopPropagation()}
     onContextMenu={event=>event.preventDefault()}>
     <div className="scene-context-heading">{contextItem.title}</div>
     <button role="menuitem" onClick={()=>renameItem(contextItem)}><Edit3 size={15}/> Renomear <kbd>F2</kbd></button>
     <button role="menuitem" onClick={()=>duplicateItem(contextItem)}><Copy size={15}/> Duplicar</button>
     <button role="menuitem" onClick={()=>toggleItemFlag(contextItem,'visible')}>
       {contextItem.visible===false?<Eye size={15}/>:<EyeOff size={15}/>}
       {contextItem.visible===false?'Mostrar':'Ocultar'}
     </button>
     <button role="menuitem" onClick={()=>toggleItemFlag(contextItem,'locked')}>
       {contextItem.locked?<LockOpen size={15}/>:<Lock size={15}/>}
       {contextItem.locked?'Desbloquear posição':'Bloquear posição'}
     </button>
     <div className="scene-context-divider"/>
     <button role="menuitem" disabled={contextIndex<=0||Boolean(contextItem.locked)} onClick={()=>{moveItem(contextIndex,-1);setItemContext(null);}}><ChevronUp size={15}/> Mover para cima</button>
     <button role="menuitem" disabled={contextIndex<0||contextIndex===sceneItems.length-1||Boolean(contextItem.locked)} onClick={()=>{moveItem(contextIndex,1);setItemContext(null);}}><ChevronDown size={15}/> Mover para baixo</button>
     <button role="menuitem" disabled={contextIndex<=0||Boolean(contextItem.locked)} onClick={()=>{reorderItem(contextIndex,0);setItemContext(null);}}><ArrowUpToLine size={15}/> Tornar principal</button>
     <div className="scene-context-divider"/>
     <button role="menuitem" className="scene-context-danger" onClick={()=>{setItemContext(null);removeItem();}}><Trash2 size={15}/> Remover</button>
   </div>}
   {modal&&<div className="scene-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}>
     <div className="scene-modal" role="dialog" aria-modal="true" aria-label="Gerenciar cenas e itens">
       <div className="scene-modal-heading"><h2>{modal==='scene-create'?'Nova cena':modal==='scene-rename'?'Renomear cena':modal==='item-create'?'Adicionar item à cena':modal==='item-rename'?'Renomear item':'Editar música'}</h2><button onClick={()=>setModal(null)} aria-label="Fechar"><X size={18}/></button></div>
       {modal==='item-create'&&<div className="scene-source-selector" role="list" aria-label="Escolher tipo de item">
         {([
           {type:'music',label:'Música',description:'Áudio e letra sincronizada',icon:<Music2 size={20}/>},
           {type:'text',label:'Texto',description:'Textos e avisos',icon:<FileText size={20}/>},
           {type:'bible',label:'Bíblia',description:'Versículos e referências',icon:<BookOpen size={20}/>},
           {type:'image',label:'Imagem',description:'Fotos, cartazes e artes',icon:<ImageIcon size={20}/>}
         ] as Array<{type:SceneItemType;label:string;description:string;icon:ReactNode}>).map(option=><button key={option.type} type="button"
           className="scene-source-choice" onClick={()=>createItem(option.type)}>
           <span className="scene-source-choice-icon">{option.icon}</span>
           <span><strong>{option.label}</strong><small>{option.description}</small></span>
           <Plus size={17}/>
         </button>)}
       </div>}
       {modal!=='music-edit'&&modal!=='item-create'&&<label>{modal.startsWith('scene')?'Nome da cena':'Nome do item'}
         <input autoFocus value={draftName} maxLength={160} onChange={e=>setDraftName(e.target.value)} placeholder="Digite um nome"
           onKeyDown={e=>{if(e.key==='Enter'){if(modal==='scene-create')createScene();else rename();}}}/>
       </label>}
       {modal==='music-edit'&&(!musicDraft?<p>Selecione uma música da biblioteca para editar a letra.</p>:<>
         <label>Nome da música<input value={musicDraft.title} onChange={e=>setMusicDraft({...musicDraft,title:e.target.value})}/></label>
         <label>Letra (separe os slides por linhas vazias)<textarea rows={12} value={musicDraft.content} onChange={e=>setMusicDraft({...musicDraft,content:e.target.value})}/></label>
         <p>Ao alterar a letra, as marcações antigas serão removidas. Use o editor de tempos para sincronizá-la novamente.</p>
       </>)}
       <div className="scene-modal-actions"><AppButton onClick={()=>setModal(null)}>Cancelar</AppButton>{modal!=='item-create'&&<AppButton primary disabled={modal==='music-edit'?!musicDraft?.title.trim():!draftName.trim()}
         onClick={()=>{if(modal==='scene-create')createScene();else if(modal==='music-edit')saveMusic();else rename();}}>Salvar</AppButton>}</div>
     </div>
   </div>}
 </>;
}
export default function App(){
 const projection=new URLSearchParams(location.search).get('projection');
 return projection&&['1','secondary','support'].includes(projection)?<ProjectionPage/>:<ControlPage/>;
}
