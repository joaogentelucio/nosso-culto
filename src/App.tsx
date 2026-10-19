import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {BookOpen,ChevronDown,ChevronUp,Clapperboard,Download,Edit3,Eye,EyeOff,FileText,FolderOpen,Maximize2,Monitor,MonitorPlay,Music2,Plus,Settings,Trash2,X} from 'lucide-react';
import DesktopToolbar from './DesktopToolbar';
import MusicWorkspace from './MusicWorkspace';
import {loadPreferences,savePreferences} from './preferences';
import type {AppPreferences,DisplayDevice} from './preferences';
import {initialScenes,makeId,sceneItemSummary,sceneItemTitle} from './scenes';
import type {SavedProject,Scene,SceneItem,SceneItemType} from './scenes';
import type {MusicItem} from './music';
import './styles.css';
import './scenes-layout.css';

type Slide={title:string;body:string};
type Live={slide:Slide|null;hidden:boolean;theme:'dark'|'blue'|'warm'};
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
 const [live,setLive]=useState<Live>(EMPTY_LIVE);
 useEffect(()=>{
   document.body.classList.add('projector-body');
   const stop=window.desktop?.onProjectionChange(setLive);
   void window.desktop?.getProjectionState().then(setLive).catch(()=>{});
   const channel=new BroadcastChannel('nosso-culto-projection');
   channel.onmessage=(event:MessageEvent<Live>)=>setLive(event.data);
   const storage=(event:StorageEvent)=>{if(event.key==='nosso-culto-live'&&event.newValue)try{setLive(JSON.parse(event.newValue));}catch{}};
   window.addEventListener('storage',storage);
   return ()=>{document.body.classList.remove('projector-body');stop?.();channel.close();window.removeEventListener('storage',storage);};
 },[]);
 const isSupport=new URLSearchParams(location.search).get('projection')==='support';
 return <div className={'projection projection--'+live.theme}>
   {isSupport&&<div className="projection__support-heading">MONITOR DE APOIO</div>}
   {!live.hidden&&live.slide&&<div className="projection__text">{live.slide.body.split('\n').map((line,index)=><div key={index}>{line||'\u00a0'}</div>)}</div>}
 </div>;
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
 const [musicSearch,setMusicSearch]=useState('');
 const [preferences,setPreferences]=useState<AppPreferences>(()=>loadPreferences());
 const [displays,setDisplays]=useState<DisplayDevice[]>([]);
 const [live,setLive]=useState<Live>(()=>({...EMPTY_LIVE,theme:preferences.projectionTheme}));
 const [notice,setNotice]=useState('');
 const [modal,setModal]=useState<ModalKind>(null);
 const [draftName,setDraftName]=useState('');
 const [draftType,setDraftType]=useState<SceneItemType>('music');
 const [musicDraft,setMusicDraft]=useState<MusicItem|null>(null);
 const scene=useMemo(()=>scenes.find(x=>x.id===sceneId),[scenes,sceneId]);
 const sceneItem=useMemo(()=>scene?.items.find(x=>x.id===sceneItemId),[scene,sceneItemId]);
 const track=useMemo(()=>sceneItem?.type==='music'&&sceneItem.libraryId?library.find(x=>x.id===sceneItem.libraryId):undefined,[sceneItem,library]);
 const broadcast=useCallback((state:Live)=>{
   setLive(state);
   window.desktop?.updateProjection(state);
   try{localStorage.setItem('nosso-culto-live',JSON.stringify(state));
     const ch=new BroadcastChannel('nosso-culto-projection');ch.postMessage(state);ch.close();}catch{}
 },[]);
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
   broadcast({...live,theme:next.projectionTheme});
 }
 function updateScene(id:string,modify:(scene:Scene)=>Scene){
   setScenes(prev=>prev.map(v=>v.id===id?modify(v):v));
 }
 function chooseScene(id:string){
   const target=scenes.find(x=>x.id===id);
   setSceneId(id);setSceneItemId(target?.items[0]?.id??'');setActiveCue(0);
 }
 function selectItem(id:string){setSceneItemId(id);setActiveCue(0);}
 function updateSceneItem(updated:SceneItem){
   if(!scene)return;
   updateScene(scene.id,old=>({...old,items:old.items.map(x=>x.id===updated.id?updated:x)}));
 }
 function updateTrack(updated:MusicItem){setLibrary(list=>list.map(x=>x.id===updated.id?updated:x));}
 function selectTrack(id:string){
   if(!scene||!sceneItem||sceneItem.type!=='music')return;
   updateSceneItem({...sceneItem,libraryId:id});
   setActiveCue(0);
 }
 function projectSlide(body:string,title?:string){
   broadcast({slide:{title:title||sceneItem?.title||'',body},theme:live.theme,hidden:false});
 }
 function showCue(index:number){
   if(!track||!sceneItem)return;
   const cue=track.cues?.[index];
   if(!cue)return;
   setActiveCue(index);projectSlide(cue.text,track.title);
 }
 function openModal(kind:ModalKind){
   if(kind==='scene-create')setDraftName('');
   if(kind==='scene-rename')setDraftName(scene?.name??'');
   if(kind==='item-create'){setDraftName('');setDraftType('music');}
   if(kind==='item-rename')setDraftName(sceneItem?.title??'');
   if(kind==='music-edit')setMusicDraft(track?{...track}:null);
   setModal(kind);
 }
 function createScene(){
   const name=draftName.trim();if(!name)return;
   const newScene:Scene={id:makeId(),name,items:[]};
   setScenes(old=>[...old,newScene]);setSceneId(newScene.id);setSceneItemId('');setModal(null);
 }
 function createItem(){
   if(!scene)return;
   const obj:SceneItem={id:makeId(),type:draftType,title:draftName.trim()||sceneItemTitle(draftType)};
   updateScene(scene.id,old=>({...old,items:[...old.items,obj]}));
   setSceneItemId(obj.id);setActiveCue(0);setModal(null);
 }
 function rename(){
   if(!draftName.trim())return;
   if(modal==='scene-rename'&&scene)updateScene(scene.id,old=>({...old,name:draftName.trim()}));
   if(modal==='item-rename'&&sceneItem)updateSceneItem({...sceneItem,title:draftName.trim()});
   setModal(null);
 }
 function deleteScene(){
   if(!scene||!confirm('Excluir a cena "'+scene.name+'" e seus itens?'))return;
   const remaining=scenes.filter(x=>x.id!==scene.id);
   setScenes(remaining);setSceneId(remaining[0]?.id??'');setSceneItemId(remaining[0]?.items[0]?.id??'');
 }
 function removeItem(){
   if(!scene||!sceneItem||!confirm('Remover "'+sceneItem.title+'" da cena?'))return;
   const updated=scene.items.filter(x=>x.id!==sceneItem.id);
   updateScene(scene.id,old=>({...old,items:updated}));setSceneItemId(updated[0]?.id??'');
 }
 function moveItem(from:number,direction:number){
   if(!scene)return;const to=from+direction;if(to<0||to>=scene.items.length)return;
   updateScene(sceneId,old=>{const copy=[...old.items];[copy[from],copy[to]]=[copy[to],copy[from]];return {...old,items:copy};});
 }
 async function importMusic(kind:'files'|'folder'|'zip'){
   if(!window.desktop){setNotice('A importação precisa da versão Electron.');return;}
   try{
     const result=await window.desktop.importMedia(kind);
     if(result.cancelled)return;
     const imported=result.items as MusicItem[];
     if(imported.length){
       setLibrary(old=>[...old,...imported]);
       if(sceneItem?.type==='music')selectTrack(imported[0].id);
     }
     setNotice(imported.length+' música(s) importada(s).'+(result.errors.length?' Falhas: '+result.errors.slice(0,3).join('; '):''));
   }catch(e){setNotice('Falha ao importar músicas: '+String(e));}
 }
 async function importLrc(){
   if(!track||!window.desktop)return;
   try{
     const result=await window.desktop.importLrc();
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
   setScenes(old=>old.map(scene=>({...scene,items:scene.items.map(item=>item.libraryId===track.id?{...item,libraryId:undefined}:item)})));
   setActiveCue(0);
 }
 function appendSongToScene(){
   if(!scene||!track)return;
   const song:SceneItem={id:makeId(),title:track.title,type:'music',libraryId:track.id};
   updateScene(scene.id,old=>({...old,items:[...old.items,song]}));
   setSceneItemId(song.id);
 }
 async function openProjection(){
   const next=preferences.startHidden?{...live,hidden:true}:live;
   if(preferences.startHidden)broadcast(next);
   if(!window.desktop){window.open('?projection=1','_blank','width=1280,height=720');return;}
   try{await window.desktop.openProjection(preferences.monitors);window.desktop.updateProjection(next);}
   catch(e){setNotice('Não foi possível abrir o projetor: '+String(e));}
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
 function selectPreviewMonitor(id:string){
   const next:AppPreferences={...preferences,monitors:{
     ...preferences.monitors,secondary:{monitorId:id,resolution:'native'}
   }};
   void applyPreferences(next).catch(e=>setNotice('Monitor indisponível: '+String(e)));
 }
 const isMusic=sceneItem?.type==='music';
 const sceneItems=scene?.items??[];
 const sceneReady=!!scene;
 if(!ready)return <div className="loading">Carregando o Nosso Culto...</div>;
 return <>
   <DesktopToolbar
     preferences={preferences} displays={displays} hasSelected={Boolean(sceneItem)}
     onApply={applyPreferences} onNew={()=>openModal('item-create')}
     onEdit={()=>openModal(isMusic?'music-edit':'item-rename')}
     onDelete={removeItem} onAddQueue={appendSongToScene}
     onOpenProjection={openProjection}
     onHideProjection={()=>broadcast({...live,hidden:true})}
     onShowProjection={()=>broadcast({...live,hidden:false})}
     onImport={importBackup} onExport={exportBackup}
     onExit={()=>{void window.desktop?.exitApp();}}
   />
   <div className="scene-app">
     <div className="scene-top">
       <div className="scene-top-brand">
         <div className="scene-logo"><MonitorPlay size={23}/></div>
         <div><strong>Nosso Culto</strong><span>PROJEÇÃO & LOUVOR</span></div>
       </div>
       <div className="scene-top-heading">
         <div><small>PAINEL DE CONTROLE</small><h1>Gerenciador de cenas</h1><p>Organize as cenas e os itens que serão apresentados durante o culto.</p></div>
         <div className="scene-top-actions">
           <AppButton onClick={()=>openModal('scene-create')}><Plus size={16}/> Nova cena</AppButton>
           <AppButton onClick={importBackup} disabled={!window.desktop}><FolderOpen size={16}/> Importar</AppButton>
           <AppButton onClick={exportBackup} disabled={!window.desktop}><Download size={16}/> Backup</AppButton>
           <AppButton onClick={openProjection} primary><MonitorPlay size={17}/> Abrir projetor</AppButton>
         </div>
       </div>
     </div>
     {notice&&<div className="scene-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
     <div className="scene-main-grid">
       <section className="scene-sidebar">
         <div className="scene-column-heading"><div><small>GERENCIADOR</small><h2>Cenas</h2></div><button onClick={()=>openModal('scene-create')} title="Adicionar cena" aria-label="Adicionar cena"><Plus size={19}/></button></div>
         <div className="scene-list">
           {scenes.map((entry,index)=><button key={entry.id} className={'scene-entry '+(sceneId===entry.id?'selected':'')} onClick={()=>chooseScene(entry.id)} onDoubleClick={()=>openModal('scene-rename')}>
             <span className="scene-entry-number">{String(index+1).padStart(2,'0')}</span>
             <span className="scene-entry-main"><strong>{entry.name}</strong><small>{entry.items.length} item(ns)</small></span>
             <Clapperboard size={16}/>
           </button>)}
           {!scenes.length&&<p className="scene-empty-text">Crie a primeira cena para iniciar a programação.</p>}
         </div>
         <div className="scene-sidebar-footer">
           <AppButton onClick={()=>openModal('scene-create')}><Plus size={16}/> Nova cena</AppButton>
           <div className="scene-sidebar-footer-buttons">
             <button onClick={()=>openModal('scene-rename')} disabled={!sceneReady}><Edit3 size={15}/> Renomear</button>
             <button onClick={deleteScene} disabled={!sceneReady}><Trash2 size={15}/> Excluir</button>
           </div>
         </div>
       </section>
       <section className="scene-items-column">
         <div className="scene-column-heading"><div><small>ITENS DA CENA</small><h2>{scene?.name??'Nenhuma cena'}</h2></div><button disabled={!sceneReady} onClick={()=>openModal('item-create')} title="Adicionar item à cena" aria-label="Adicionar item"><Plus size={19}/></button></div>
         <p className="scene-column-description">Selecione um item para editar ou apresentar.</p>
         <div className="scene-items-list">
           {sceneItems.map((entry,index)=><div key={entry.id} className={'scene-item '+(sceneItemId===entry.id?'selected':'')} draggable
             onDragStart={event=>{event.dataTransfer.setData('application/x-scene-item-id',entry.id);event.dataTransfer.effectAllowed='move';}}
             onDragOver={event=>event.preventDefault()}
             onDrop={event=>{
               event.preventDefault();
               const moving=event.dataTransfer.getData('application/x-scene-item-id');
               const from=sceneItems.findIndex(x=>x.id===moving);
               if(from<0||from===index)return;
               updateScene(sceneId,old=>{
                 const next=[...old.items];const [el]=next.splice(from,1);next.splice(index,0,el);return {...old,items:next};
               });
             }}>
             <button className="scene-item-pick" onClick={()=>selectItem(entry.id)}>
               <span className="scene-item-icon">{entry.type==='music'?<Music2 size={17}/>:entry.type==='bible'?<BookOpen size={17}/>:<FileText size={17}/>}</span>
               <span className="scene-item-name"><strong>{entry.title}</strong><small>{sceneItemSummary(entry,library)}</small></span>
             </button>
             <div className="scene-item-reorder">
               <button title="Mover para cima" onClick={()=>moveItem(index,-1)} disabled={index===0}><ChevronUp size={14}/></button>
               <button title="Mover para baixo" onClick={()=>moveItem(index,1)} disabled={index===sceneItems.length-1}><ChevronDown size={14}/></button>
             </div>
           </div>)}
           {sceneReady&&!scene?.items.length&&<div className="scene-empty-text">Esta cena está vazia. Clique em + para adicionar Música, Texto ou Bíblia.</div>}
           {!sceneReady&&<div className="scene-empty-text">Selecione ou crie uma cena.</div>}
         </div>
         <div className="scene-items-footer">
           <AppButton onClick={()=>openModal('item-create')} disabled={!sceneReady}><Plus size={16}/> Adicionar item</AppButton>
           <div className="scene-sidebar-footer-buttons">
             <button onClick={()=>openModal('item-rename')} disabled={!sceneItem}><Edit3 size={15}/> Renomear</button>
             <button onClick={removeItem} disabled={!sceneItem}><Trash2 size={15}/> Remover</button>
           </div>
         </div>
       </section>
       <section className="scene-editor-column">
         {!sceneItem&&<div className="scene-editor-empty"><Clapperboard size={36}/><h2>Selecione um item da cena</h2><p>Escolha um item à esquerda para abrir o editor e a pré-visualização.</p><AppButton onClick={()=>openModal('item-create')} disabled={!sceneReady}><Plus size={16}/> Adicionar item</AppButton></div>}
         {isMusic&&sceneItem&&<div className="scene-music-container">
           <MusicWorkspace key={sceneItem.id}
             items={library.filter(x=>x.type==='music')} selected={track}
             search={musicSearch} setSearch={setMusicSearch} active={activeCue}
             onSelect={selectTrack} onCue={showCue} onUpdate={updateTrack}
             onNew={()=>void importMusic('files')}
             onEdit={()=>openModal('music-edit')}
             onAddQueue={appendSongToScene} onDelete={deleteTrack}
             onImport={importMusic} onImportLrc={importLrc}
           />
         </div>}
         {sceneItem&&!isMusic&&<TextWorkspace item={sceneItem} onUpdate={updateSceneItem} onProject={text=>projectSlide(text,sceneItem.title)}/>}
       </section>
       <section className="scene-output">
         <div className="scene-output-heading"><h2>Saída de vídeo</h2><span>● AO VIVO</span></div>
         <div className={'preview preview--'+live.theme}>{!live.hidden&&live.slide?<p>{live.slide.body}</p>:<span className="preview__standby">{live.hidden?'TELA PRETA':'Nenhum slide projetado'}</span>}</div>
         <div className="scene-output-actions">
           <AppButton onClick={()=>broadcast({...live,hidden:true})}><EyeOff size={16}/> Ocultar</AppButton>
           <AppButton onClick={()=>broadcast({...live,hidden:false})}><Eye size={16}/> Mostrar</AppButton>
         </div>
         <div className="scene-output-setting">
           <label htmlFor="scene-output-monitor">Monitor secundário (projeção)</label>
           <select id="scene-output-monitor" value={preferences.monitors.secondary.monitorId} onChange={e=>selectPreviewMonitor(e.target.value)}>
             <option value="auto">Automático (preferir externo)</option>
             <option value="off">Não utilizar</option>
             {displays.map(d=><option key={d.id} value={String(d.id)}>{d.name} · {d.width}×{d.height}{d.primary?' (principal)':''}</option>)}
           </select>
         </div>
         <div className="scene-output-setting">
           <label>Plano de fundo</label>
           <div className="themes">{(['dark','blue','warm'] as const).map(v=><button key={v} title={'Tema '+v} className={'theme theme--'+v+(live.theme===v?' chosen':'')} onClick={()=>{void applyPreferences({...preferences,projectionTheme:v});}}/>)}</div>
         </div>
         <AppButton onClick={openProjection} primary><Maximize2 size={16}/> Abrir em tela cheia</AppButton>
         <div className="scene-output-help"><Settings size={16}/><span>As mudanças dos itens e dos slides são enviadas para as janelas de projeção.</span></div>
       </section>
     </div>
   </div>
   {modal&&<div className="scene-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}>
     <div className="scene-modal" role="dialog" aria-modal="true" aria-label="Gerenciar cenas e itens">
       <div className="scene-modal-heading"><h2>{modal==='scene-create'?'Nova cena':modal==='scene-rename'?'Renomear cena':modal==='item-create'?'Adicionar item à cena':modal==='item-rename'?'Renomear item':'Editar música'}</h2><button onClick={()=>setModal(null)} aria-label="Fechar"><X size={18}/></button></div>
       {modal==='item-create'&&<label>Tipo de item<select value={draftType} onChange={e=>setDraftType(e.target.value as SceneItemType)}>
         <option value="music">Música</option><option value="text">Texto</option><option value="bible">Bíblia</option>
       </select></label>}
       {modal!=='music-edit'&&<label>{modal.startsWith('scene')?'Nome da cena':'Nome do item'}
         <input autoFocus value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder={modal==='item-create'?sceneItemTitle(draftType):'Digite um nome'}
           onKeyDown={e=>{if(e.key==='Enter'){if(modal==='scene-create')createScene();else if(modal==='item-create')createItem();else rename();}}}/>
       </label>}
       {modal==='music-edit'&&(!musicDraft?<p>Selecione uma música da biblioteca para editar a letra.</p>:<>
         <label>Nome da música<input value={musicDraft.title} onChange={e=>setMusicDraft({...musicDraft,title:e.target.value})}/></label>
         <label>Letra (separe os slides por linhas vazias)<textarea rows={12} value={musicDraft.content} onChange={e=>setMusicDraft({...musicDraft,content:e.target.value})}/></label>
         <p>Ao alterar a letra, as marcações antigas serão removidas. Use o editor de tempos para sincronizá-la novamente.</p>
       </>)}
       <div className="scene-modal-actions"><AppButton onClick={()=>setModal(null)}>Cancelar</AppButton><AppButton primary disabled={modal==='music-edit'?!musicDraft?.title.trim():modal==='scene-create'||modal.endsWith('rename')?!draftName.trim():false}
         onClick={()=>{if(modal==='scene-create')createScene();else if(modal==='item-create')createItem();else if(modal==='music-edit')saveMusic();else rename();}}>Salvar</AppButton></div>
     </div>
   </div>}
 </>;
}
export default function App(){
 const projection=new URLSearchParams(location.search).get('projection');
 return projection&&['1','secondary','support'].includes(projection)?<ProjectionPage/>:<ControlPage/>;
}
