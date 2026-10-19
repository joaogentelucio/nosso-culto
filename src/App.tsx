import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import DesktopToolbar from './DesktopToolbar';
import MusicWorkspace from './MusicWorkspace';
import {distributeLyrics} from './music';
import type {MusicItem} from './music';
import {loadPreferences, savePreferences} from './preferences';
import type {AppPreferences, DisplayDevice} from './preferences';
import {BookOpen,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Clapperboard,Download,Edit3,Eye,EyeOff,FileText,FolderOpen,Maximize2,Monitor,MonitorPlay,Music2,Plus,Search,Settings,Trash2,X} from 'lucide-react';

type Item=MusicItem;
type Slide={title:string;body:string};
type Live={slide:Slide|null;hidden:boolean;theme:'dark'|'blue'|'warm'};
type Display=DisplayDevice;
type Store={library:Item[];queue:string[]};
type Tab='music'|'text'|'schedule';
const demos:Item[]=[
{id:'welcome',title:'Boas-vindas',type:'text',content:'Sejam bem-vindos ao nosso culto!\n\nQue esta reunião seja um momento de comunhão e esperança.'},
{id:'prayer',title:'Momento de oração',type:'text',content:'Vamos nos unir em oração.\n\nEntregue a Deus suas preocupações.'},
{id:'song',title:'Louvor de abertura (exemplo)',type:'music',content:'Esta é uma letra demonstrativa.\nSubstitua pelo louvor de sua igreja.\n\nSepare cada slide com uma linha vazia.'}
];
const INITIAL:Store={library:demos,queue:['welcome','song','prayer']};
const BLACK:Live={slide:null,hidden:false,theme:'dark'};
const STORAGE='nosso-culto-data-v3';
function slidesOf(item?:Item):Slide[]{if(!item)return [];if(item.audioId)return (item.cues??[]).map(c=>({title:item.title,body:c.text}));return item.content.split(/\n\s*\n/).map(part=>({title:item.title,body:part.trim()})).filter(x=>x.body.length>0);}
function readBrowser():Store{try{const raw=localStorage.getItem(STORAGE);return raw?JSON.parse(raw) as Store:INITIAL;}catch{return INITIAL;}}
function ProjectionPage(){
 const [live,setLive]=useState<Live>(BLACK);
 useEffect(()=>{
   document.body.classList.add('projector-body');
   const stop=window.desktop?.onProjectionChange(setLive);
   window.desktop?.getProjectionState().then(setLive).catch(()=>{});
   const channel=new BroadcastChannel('nosso-culto-projection');
   channel.onmessage=(ev:MessageEvent<Live>)=>setLive(ev.data);
   const handleStorage=(ev:StorageEvent)=>{if(ev.key==='nosso-culto-live'&&ev.newValue){try{setLive(JSON.parse(ev.newValue));}catch{}}};
   window.addEventListener('storage',handleStorage);
   return ()=>{stop?.();channel.close();window.removeEventListener('storage',handleStorage);document.body.classList.remove('projector-body');};
 },[]);
 const isSupport=new URLSearchParams(location.search).get('projection')==='support';
 return <div className={'projection projection--'+live.theme}>
   {isSupport&&<div className="projection__support-heading">MONITOR DE APOIO</div>}
   {!live.hidden&&live.slide&&<div className="projection__text">{live.slide.body.split('\n').map((s,i)=><div key={i}>{s||'\u00a0'}</div>)}</div>}
 </div>;
}
function Button({children,onClick,variant='default',title,disabled=false}:{
 children:ReactNode;onClick:()=>void;variant?:'default'|'primary'|'ghost'|'danger';title?:string;disabled?:boolean
}){return <button type="button" title={title} disabled={disabled} onClick={onClick} className={'button button--'+variant}>{children}</button>;}
function AppControl(){
 const [ready,setReady]=useState(false);
 const [library,setLibrary]=useState<Item[]>([]);
 const [queue,setQueue]=useState<string[]>([]);
 const [tab,setTab]=useState<Tab>('music');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState('welcome');
 const [active,setActive]=useState(0);
 const [preferences,setPreferences]=useState<AppPreferences>(()=>loadPreferences());
 const [live,setLive]=useState<Live>(()=>({...BLACK,theme:preferences.projectionTheme}));
 const [displays,setDisplays]=useState<Display[]>([]);
 const [editing,setEditing]=useState<Item|null>(null);
 const [notice,setNotice]=useState('');
 const item=useMemo(()=>library.find(i=>i.id===selected),[library,selected]);
 const slides=useMemo(()=>slidesOf(item),[item]);
 const results=useMemo(()=>library.filter(i=>i.type===tab&&i.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())),[library,search,tab]);
 const current=slides[active]??null;
 useEffect(()=>{
   document.documentElement.dataset.appTheme=preferences.appearance;
   document.documentElement.dataset.appDensity=preferences.density;
 },[preferences.appearance,preferences.density]);
 const broadcast=useCallback((next:Live)=>{
   setLive(next);window.desktop?.updateProjection(next);
   try{localStorage.setItem('nosso-culto-live',JSON.stringify(next));const c=new BroadcastChannel('nosso-culto-projection');c.postMessage(next);c.close();}catch{}
 },[]);
 async function applyPreferences(next:AppPreferences):Promise<void>{
   if(window.desktop&&JSON.stringify(preferences.monitors)!==JSON.stringify(next.monitors)){
     await window.desktop.configureDisplays(next.monitors);
   }
   setPreferences(next);
   savePreferences(next);
   broadcast({...live,theme:next.projectionTheme});
 }
 function selectDisplay(value:string){
   const next={...preferences,monitors:{
     ...preferences.monitors,secondary:{...preferences.monitors.secondary,monitorId:value,resolution:'native'}
   }};
   void applyPreferences(next).catch(e=>setNotice('Não foi possível selecionar o monitor: '+String(e)));
 }
 useEffect(()=>{
   let mounted=true;
   (async()=>{
     try{
       const saved=window.desktop?await window.desktop.readData():readBrowser();
       if(!mounted)return;
       const data=saved??INITIAL;setLibrary(data.library);setQueue(data.queue);
       if(data.library.length)setSelected(data.library[0].id);
       setDisplays(window.desktop?await window.desktop.getDisplays():[{id:1,name:'Navegador',primary:true,width:1920,height:1080}]);
     }catch(e){if(mounted){setLibrary(INITIAL.library);setQueue(INITIAL.queue);setNotice('Falha ao carregar dados locais: '+String(e));}}
     finally{if(mounted)setReady(true);}
   })();
   const stop=window.desktop?.onDisplaysChanged?.(setDisplays);
   return()=>{mounted=false;stop?.();};
 },[]);
 useEffect(()=>{if(!ready)return;const data={library,queue};if(window.desktop){window.desktop.saveData(data).catch(e=>setNotice('Erro ao salvar dados: '+String(e)))}else{localStorage.setItem(STORAGE,JSON.stringify(data))}},[library,queue,ready]);
 useEffect(()=>{const handler=(ev:KeyboardEvent)=>{
   const t=ev.target as HTMLElement|null;
   if(t&&['INPUT','TEXTAREA','SELECT'].includes(t.tagName))return;
   if(editing||document.querySelector('[data-settings-open="true"]'))return;
   if(['ArrowRight','ArrowDown','PageDown',' '].includes(ev.key)){ev.preventDefault();changeSlide(1);}
   else if(['ArrowLeft','ArrowUp','PageUp'].includes(ev.key)){ev.preventDefault();changeSlide(-1);}
   else if(ev.key==='Escape'){broadcast({...live,hidden:true})}
 };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
 // Handler follows the current selection and live state.
 },[active,slides,editing,live,broadcast]);
 function choose(id:string){setSelected(id);setActive(0);}
 function updateItem(next:Item){setLibrary(items=>items.map(x=>x.id===next.id?next:x));}
 async function importMusic(kind:'files'|'folder'|'zip'){
   if(!window.desktop){setNotice('A importação de arquivos precisa do aplicativo Electron.');return;}
   try{
     const imported=await window.desktop.importMedia(kind);
     if(imported.cancelled)return;
     const newItems=imported.items as Item[];
     if(newItems.length){setLibrary(old=>[...old,...newItems]);setTab('music');choose(newItems[0].id);}
     setNotice(newItems.length+' música(s) importada(s).'+(imported.errors.length?' '+imported.errors.length+' arquivo(s) ignorado(s): '+imported.errors.slice(0,3).join('; '):''));
   }catch(e){setNotice('Erro ao importar músicas: '+String(e));}
 }
 async function importLyricsLrc(){
   if(!item||!window.desktop)return;
   try{
     const data=await window.desktop.importLrc();if(!data)return;
     updateItem({...item,content:data.content,cues:data.cues,timingSource:'lrc'});
     setActive(0);setNotice('Letra sincronizada importada com '+data.cues.length+' trechos.');
   }catch(e){setNotice('Erro ao importar LRC: '+String(e));}
 }
 function showSlide(n:number){if(!slides.length)return;const next=Math.max(0,Math.min(n,slides.length-1));setActive(next);broadcast({...live,slide:slides[next],hidden:false});}
 function changeSlide(n:number){showSlide(active+n)}
 function startEditor(target?:Item){setEditing(target?{...target}:{id:'',type:tab==='text'?'text':'music',title:'',content:''})}
 function saveEditor(){
   if(!editing?.title.trim())return;
   const previous=library.find(x=>x.id===editing.id);
   const cues=editing.audioId&&editing.content!==previous?.content?distributeLyrics(editing.content,editing.duration||0):editing.cues;
   const next={...editing,title:editing.title.trim(),id:editing.id||crypto.randomUUID(),cues,
     timingSource:editing.audioId&&editing.content!==previous?.content?'estimated':editing.timingSource};
   setLibrary(a=>a.some(x=>x.id===next.id)?a.map(x=>x.id===next.id?next:x):[...a,next]);
   choose(next.id);setEditing(null);
 }
 function deleteSelected(){if(!item||(preferences.confirmDelete&&!confirm('Excluir "'+item.title+'"?')))return;setLibrary(a=>a.filter(x=>x.id!==item.id));setQueue(a=>a.filter(x=>x!==item.id));setSelected('');setActive(0);}
 function addQueue(){if(item)setQueue(q=>[...q,item.id]);}
 function moveQueue(from:number,delta:number){const to=from+delta;if(to<0||to>=queue.length)return;setQueue(q=>{const copy=[...q];[copy[from],copy[to]]=[copy[to],copy[from]];return copy})}
 async function openProjector(){
   const nextState=preferences.startHidden?{...live,hidden:true}:live;
   if(preferences.startHidden)broadcast(nextState);
   if(!window.desktop){window.open('?projection=1','nosso-culto-projection','width=1280,height=720');return;}
   try{await window.desktop.openProjection(preferences.monitors);window.desktop.updateProjection(nextState)}catch(e){setNotice('Não foi possível abrir a projeção: '+String(e))}
 }
 async function exportBackup(){if(!window.desktop)return;try{if(await window.desktop.exportData({library,queue}))setNotice('Backup exportado com sucesso.')}catch(e){setNotice('Erro ao exportar: '+String(e))}}
 async function importBackup(){if(!window.desktop)return;try{
   const data=await window.desktop.importData();if(!data)return;
   if(preferences.confirmImport&&!confirm('Substituir a biblioteca e a programação atuais pelos dados do backup?'))return;
   setLibrary(data.library);setQueue(data.queue);setSelected(data.library[0]?.id??'');setActive(0);broadcast(BLACK);setNotice('Backup importado com sucesso.');
 }catch(e){setNotice('Falha ao importar backup: '+String(e))}}
 if(!ready)return <div className="loading">Carregando Nosso Culto...</div>;
 return <>
   <DesktopToolbar
     preferences={preferences} displays={displays} hasSelected={Boolean(item)}
     onApply={applyPreferences} onNew={()=>startEditor()}
     onEdit={()=>{if(item)startEditor(item)}} onDelete={deleteSelected}
     onAddQueue={addQueue} onOpenProjection={openProjector}
     onHideProjection={()=>broadcast({...live,hidden:true})}
     onShowProjection={()=>broadcast({...live,hidden:false})}
     onImport={importBackup} onExport={exportBackup}
     onExit={()=>{void window.desktop?.exitApp()}}
   />
   <div className="app-shell" data-density={preferences.density} data-appearance={preferences.appearance}>
   <aside className="sidebar">
     <div className="brand"><div className="brand__icon"><MonitorPlay size={24}/></div><div><strong>Nosso Culto</strong><small>PROJEÇÃO & LOUVOR</small></div></div>
     <div className="nav-label">BIBLIOTECA</div>
     <nav className="nav">
       <button className={tab==='music'?'on':''} onClick={()=>{setTab('music');const found=library.find(i=>i.type==='music');if(found)choose(found.id)}}><Music2 size={18}/>Músicas</button>
       <button className={tab==='text'?'on':''} onClick={()=>{setTab('text');const found=library.find(i=>i.type==='text');if(found)choose(found.id)}}><BookOpen size={18}/>Textos e Bíblia</button>
       <button className={tab==='schedule'?'on':''} onClick={()=>setTab('schedule')}><Clapperboard size={18}/>Programação <span className="nav-count">{queue.length}</span></button>
     </nav>
     <div className="sidebar__bottom"><div className="sidebar__panel"><Monitor size={18}/>Pronto para projetar</div><span>Nosso Culto Desktop · Electron</span></div>
   </aside>
   <main className="main">
     <header className="header">
       <div><p className="eyebrow">PAINEL DE CONTROLE</p><h1>{tab==='music'?'Biblioteca de músicas':tab==='text'?'Textos e Bíblia':'Programação do culto'}</h1><p>Prepare o conteúdo e acompanhe a projeção em tempo real.</p></div>
       <div className="header__actions">
         {tab==='music'&&<Button onClick={()=>void importMusic('files')} variant="primary" disabled={!window.desktop}><Plus size={16}/> Importar músicas</Button>}
         <Button onClick={importBackup} title="Importar backup" variant="ghost" disabled={!window.desktop}><FolderOpen size={16}/> Importar</Button>
         <Button onClick={exportBackup} title="Exportar backup" variant="ghost" disabled={!window.desktop}><Download size={16}/> Backup</Button>
         <Button onClick={openProjector} variant="primary"><MonitorPlay size={18}/> Abrir projetor</Button>
       </div>
     </header>
     {notice&&<div role="status" className="notice"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={14}/></button></div>}
     <div className="workarea">
       {tab==='music'?<MusicWorkspace
         items={library.filter(i=>i.type==='music')} selected={item?.type==='music'?item:undefined}
         search={search} setSearch={setSearch} active={active} onSelect={choose}
         onCue={showSlide} onUpdate={updateItem}
         onNew={()=>startEditor()} onEdit={()=>{if(item)startEditor(item)}}
         onAddQueue={addQueue} onDelete={deleteSelected}
         onImport={importMusic} onImportLrc={importLyricsLrc}
       />:<>
       <section className="panel panel--library">
         <div className="panel-heading"><h2>{tab==='schedule'?'Ordem do culto':'Conteúdos'}</h2><Button onClick={()=>startEditor()} variant="ghost" title="Novo conteúdo"><Plus size={18}/></Button></div>
         {tab!=='schedule'&&<label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar conteúdo..."/></label>}
         <div className="list">
           {tab==='schedule'?queue.map((id,i)=>{const q=library.find(x=>x.id===id);return q&&<div className={'queue-item '+(selected===id?'selected':'')} key={i}>
              <button onClick={()=>choose(id)} className="queue-item__name"><small>{String(i+1).padStart(2,'0')}</small><span>{q.title}</span></button>
              <div className="queue-item__tools"><button disabled={i===0} title="Subir" onClick={()=>moveQueue(i,-1)}><ChevronUp size={15}/></button><button disabled={i===queue.length-1} title="Descer" onClick={()=>moveQueue(i,1)}><ChevronDown size={15}/></button><button title="Remover" onClick={()=>setQueue(a=>a.filter((_,j)=>j!==i))}><X size={15}/></button></div>
             </div>}):results.map(x=><button key={x.id} className={'library-item '+(selected===x.id?'selected':'')} onClick={()=>choose(x.id)}>
               {x.type==='music'?<Music2 size={17}/>:<FileText size={17}/>}<span><strong>{x.title}</strong><small>{slidesOf(x).length} slide(s)</small></span>
             </button>)}
           {tab==='schedule'&&queue.length===0&&<div className="empty">Adicione conteúdos à programação usando o botão “Adicionar ao culto”.</div>}
           {tab!=='schedule'&&results.length===0&&<div className="empty">Nenhum conteúdo encontrado.</div>}
         </div>
         <div className="panel-foot"><Button onClick={()=>startEditor()}><Plus size={15}/> Novo {tab==='text'?'texto':'conteúdo'}</Button></div>
       </section>
       <section className="panel panel--slides">
         <div className="panel-heading panel-heading--stack"><div><p className="eyebrow">EDIÇÃO & APRESENTAÇÃO</p><h2>{item?.title||'Selecione um conteúdo'}</h2></div><div className="panel-buttons">
           <Button onClick={addQueue} disabled={!item} title="Adicionar à programação"><Plus size={16}/> Ao culto</Button>
           <Button onClick={()=>item&&startEditor(item)} disabled={!item} title="Editar"><Edit3 size={15}/></Button>
           <Button onClick={deleteSelected} disabled={!item} variant="danger" title="Excluir"><Trash2 size={15}/></Button>
         </div></div>
         <div className="slide-grid">
           {slides.map((s,i)=><button key={i} className={'slide-card '+(i===active?'active':'')} onClick={()=>showSlide(i)}>
             <small>SLIDE {String(i+1).padStart(2,'0')}</small><p>{s.body}</p>
           </button>)}
           {!slides.length&&<div className="empty empty--large"><FileText size={26}/><span>Selecione um conteúdo ou crie o primeiro slide.</span></div>}
         </div>
         <div className="transport"><div className="transport__controls">
           <Button onClick={()=>changeSlide(-1)} disabled={!slides.length||active===0}><ChevronLeft size={19}/> Anterior</Button>
           <span>{slides.length?active+1:0} / {slides.length}</span>
           <Button onClick={()=>changeSlide(1)} disabled={!slides.length||active>=slides.length-1}>Próximo <ChevronRight size={19}/></Button>
         </div><Button onClick={()=>showSlide(active)} disabled={!current} variant="primary"><MonitorPlay size={16}/> Projetar slide</Button></div>
       </section>
       </>}
       <section className="panel panel--preview"><div className="panel-heading"><h2>Saída de vídeo</h2><span className="live-chip">● AO VIVO</span></div>
         <div className={'preview preview--'+live.theme}>
           {!live.hidden&&live.slide?<p>{live.slide.body}</p>:<div className="preview__standby">{live.hidden?'TELA PRETA':'Nenhum slide projetado'}</div>}
         </div>
         <div className="preview__actions"><Button onClick={()=>broadcast({...live,hidden:true})}><EyeOff size={15}/> Ocultar</Button><Button onClick={()=>broadcast({...live,hidden:false})}><Eye size={15}/> Mostrar</Button></div>
         <div className="setting"><label>Monitor secundário (projeção)</label><select value={preferences.monitors.secondary.monitorId} onChange={e=>selectDisplay(e.target.value)}>
           <option value="auto">Automático (preferir externo)</option><option value="off">Não utilizar</option>{displays.map(x=><option key={x.id} value={String(x.id)}>{x.name} · {x.width}×{x.height}{x.primary?' (principal)':''}</option>)}</select></div>
         <div className="setting"><label>Plano de fundo</label><div className="themes">{(['dark','blue','warm'] as const).map(t=><button key={t} className={'theme theme--'+t+(live.theme===t?' chosen':'')} onClick={()=>applyPreferences({...preferences,projectionTheme:t})} title={t}/>)}</div></div>
         <Button onClick={openProjector} variant="primary"><Maximize2 size={16}/> Abrir em tela cheia</Button>
         <div className="help"><Settings size={15}/><div><strong>Atalhos de apresentação</strong><p>← → alterna os slides</p><p>Espaço avança · ESC oculta</p></div></div>
       </section>
     </div>
   </main>
   {editing&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><div className="modal" role="dialog" aria-modal="true" aria-label="Editor de conteúdo">
     <div className="modal-heading"><div><p className="eyebrow">BIBLIOTECA</p><h2>{editing.id?'Editar conteúdo':'Novo conteúdo'}</h2></div><button onClick={()=>setEditing(null)}><X size={20}/></button></div>
     <label className="form-field">Título<input autoFocus value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})} placeholder="Nome do louvor ou texto"/></label>
     <label className="form-field">Categoria<select value={editing.type} onChange={e=>setEditing({...editing,type:e.target.value as Item['type']})}><option value="music">Música</option><option value="text">Texto / Versículo</option></select></label>
     <label className="form-field">Conteúdo<textarea rows={13} value={editing.content} onChange={e=>setEditing({...editing,content:e.target.value})} placeholder="Cole aqui a letra ou texto.\n\nDeixe uma linha vazia entre os slides."/></label>
     <p className="field-help">Uma linha em branco separa os slides automaticamente.</p>
     <div className="modal-footer"><Button onClick={()=>setEditing(null)}>Cancelar</Button><Button onClick={saveEditor} variant="primary" disabled={!editing.title.trim()}>Salvar conteúdo</Button></div>
   </div></div>}
 </div></>;
}
export default function App(){return ['1','secondary','support'].includes(new URLSearchParams(window.location.search).get('projection')??'')?<ProjectionPage/>:<AppControl/>;}
