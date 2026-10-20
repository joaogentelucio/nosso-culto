import {useEffect,useRef,useState} from 'react';
import type {DragEvent} from 'react';
import {Download,FileArchive,FileAudio,FolderOpen,Music2,Pause,Play,Plus,Search,SkipBack,SkipForward,Square,Timer,Upload,Volume2,Sparkles,LoaderCircle} from 'lucide-react';
import type {MusicItem} from './music';
import {audioUrl,cueAtTime,distributeLyrics,timeCode} from './music';
import {useWebAudioUrl} from './web-media';
import {transcribeInBrowser} from './web-transcription';
import './music-workspace.css';
import './transcription.css';

interface Props {
 items:MusicItem[];
 selected?:MusicItem;
 search:string;
 setSearch:(s:string)=>void;
 active:number;
 onSelect:(id:string)=>void;
 onCue:(index:number)=>void;
 onUpdate:(item:MusicItem)=>void;
 onNew:()=>void;
 onEdit:()=>void;
 onAddQueue:()=>void;
 onDelete:()=>void;
 onImport:(kind:'files'|'folder'|'zip')=>Promise<void>;
 onImportLrc:()=>Promise<void>;
 onImportWeb:(kind:'files'|'folder'|'zip',files:File[])=>Promise<void>;
 onImportLrcWeb:(file:File)=>Promise<void>;
}
export default function MusicWorkspace(props:Props){
 const audio=useRef<HTMLAudioElement>(null);
 const audioFilesRef=useRef<HTMLInputElement>(null);
 const audioFolderRef=useRef<HTMLInputElement>(null);
 const zipFilesRef=useRef<HTMLInputElement>(null);
 const lrcFilesRef=useRef<HTMLInputElement>(null);
 const lastCue=useRef<number>(-2);
 const browserTranscription=useRef<AbortController|null>(null);
 const [playing,setPlaying]=useState(false);
 const [position,setPosition]=useState(0);
 const [duration,setDuration]=useState(0);
 const [dragging,setDragging]=useState(false);
 const [mediaError,setMediaError]=useState('');
 const [importing,setImporting]=useState(false);
 const [transcribing,setTranscribing]=useState(false);
 const [transcriptionError,setTranscriptionError]=useState('');
 const [transcriptionProgress,setTranscriptionProgress]=useState<{step:string;detail:string;percentage?:number}|null>(null);
 const current=props.selected;
 const browserAudio=useWebAudioUrl(!window.desktop?current?.audioId:undefined);
 const canPlayAudio=Boolean(current?.audioId&&(window.desktop||browserAudio.url));
 useEffect(()=>{
   // Progress is the only technical feedback shown during the one-click flow.
   const unsubscribe=window.desktop?.onLocalTranscriptionProgress?.(update=>setTranscriptionProgress(update));
   return ()=>{unsubscribe?.();browserTranscription.current?.abort();};
 },[]);
 const cues=current?.cues?.length?current.cues:[];
 const searchResults=props.items.filter(item=>item.title.toLowerCase().includes(props.search.toLowerCase()));
 useEffect(()=>{
   setPlaying(false);setPosition(0);setDuration(current?.duration||0);lastCue.current=-2;setMediaError('');
 },[current?.id,current?.audioId]);
 useEffect(()=>{
   // The audio HTML element exists only in the controller window, never on projectors.
   if(!current?.audioId||!audio.current)return;
   if(playing&&!audio.current.paused) return;
 },[playing,current?.audioId]);
 function select(id:string){props.onSelect(id);}

 async function startTranscribing(){
   if(!current?.audioId||transcribing)return;
   setTranscriptionError('');
   setTranscriptionProgress({step:'starting',detail:'Preparando a música…'});
   setTranscribing(true);
   const controller=new AbortController();
   if(!window.desktop)browserTranscription.current=controller;
   try{
     const suppliedLyrics=current.content.trim();
     let result:{content:string;cues:{time:number;text:string}[];duration:number};
     if(window.desktop){
       if(typeof window.desktop.localTranscriptionStatus!=='function'||
          typeof window.desktop.transcribeLocalAudio!=='function'){
         throw Error('Atualize o Nosso Culto para usar a transcrição automática.');
       }
       const status=await window.desktop.localTranscriptionStatus();
       if(!status.installed){
         throw Error('Este aplicativo não contém o reconhecimento de voz. Instale a versão Windows completa do Nosso Culto.');
       }
       result=await window.desktop.transcribeLocalAudio(current.audioId,'pt','base',suppliedLyrics);
     }else{
       result=await transcribeInBrowser(current.audioId,suppliedLyrics,
         update=>{if(!controller.signal.aborted)setTranscriptionProgress(update);},
         controller.signal);
     }
     if(controller.signal.aborted)return;
     if(!result.cues.length)throw Error('Não foi possível identificar a voz nesta gravação.');
     props.onUpdate({...current,content:suppliedLyrics||result.content,
       cues:result.cues,duration:current.duration||result.duration,
       timingSource:'transcribed'});
     lastCue.current=-2;
     setTranscriptionProgress(null);
   }catch(error){
     if(!controller.signal.aborted)
       setTranscriptionError(error instanceof Error?error.message:String(error));
   }finally{
     if(browserTranscription.current===controller)browserTranscription.current=null;
     setTranscribing(false);
     setTranscriptionProgress(null);
   }
 }
 async function cancelTranscribing(){
   if(!window.desktop){browserTranscription.current?.abort();return;}
   try{await window.desktop.cancelLocalTranscription?.();}
   catch(error){setTranscriptionError(String(error));}
 }
 async function importTracks(kind:'files'|'folder'|'zip'){
   if(importing)return;
   if(!window.desktop){
     const input=kind==='folder'?audioFolderRef.current:kind==='zip'?zipFilesRef.current:audioFilesRef.current;
     // Directory selection is supported in Chromium, which powers the web client.
     if(kind==='folder')input?.setAttribute('webkitdirectory','');
     input?.click();
     return;
   }
   setImporting(true);
   try{await props.onImport(kind);}finally{setImporting(false);}
 }
 async function importChosenFiles(kind:'files'|'folder'|'zip',files:File[]){
   if(importing||!files.length)return;
   setImporting(true);
   try{await props.onImportWeb(kind,files);}finally{setImporting(false);}
 }
 async function importChosenLrc(file:File|undefined){
   if(!file||importing)return;
   setImporting(true);
   try{await props.onImportLrcWeb(file);}finally{setImporting(false);}
 }
 function drop(event:DragEvent<HTMLElement>){
   event.preventDefault();setDragging(false);
   const id=event.dataTransfer.getData('application/x-nosso-culto-id')
     ||event.dataTransfer.getData('text/plain');
   if(props.items.some(item=>item.id===id))select(id);
 }
 function onMetadata(){
   if(!audio.current||!current)return;
   const d=audio.current.duration;
   if(!Number.isFinite(d)||d<=0)return;
   setDuration(d);
   if(Math.abs((current.duration||0)-d)>.5){
     props.onUpdate({...current,duration:d,
       cues:current.timingSource==='estimated'?distributeLyrics(current.content,d):current.cues?.length?current.cues:current.content.trim()?distributeLyrics(current.content,d):[],
       timingSource:current.content.trim()&&!current.cues?.length?'estimated':current.timingSource});
   }
 }
 function onTime(){
   if(!audio.current)return;
   const now=audio.current.currentTime;
   setPosition(now);
   const index=cueAtTime(cues,now);
   if(index>=0&&index!==lastCue.current){lastCue.current=index;props.onCue(index);}
 }
 async function toggle(){
   if(!audio.current)return;
   if(audio.current.paused){
     try{await audio.current.play();setPlaying(true);}catch(e){setMediaError('Não foi possível reproduzir este arquivo: '+String(e));}
   }else{audio.current.pause();setPlaying(false);}
 }
 function stop(){if(!audio.current)return;audio.current.pause();audio.current.currentTime=0;setPosition(0);setPlaying(false);lastCue.current=-2;}
 function seek(t:number){
   if(!audio.current)return;
   const clamped=Math.min(Math.max(0,t),Number.isFinite(audio.current.duration)?audio.current.duration:t);
   audio.current.currentTime=clamped;setPosition(clamped);
   const index=cueAtTime(cues,clamped);
   if(index>=0){lastCue.current=index;props.onCue(index);}
 }
 function mark(index:number) {
   if(!current||!cues[index])return;
   const time=Math.round(position*10)/10;
   const updated=current.cues?.map((c,i)=>i===index?{...c,time}:c)??[];
   updated.sort((a,b)=>a.time-b.time);
   props.onUpdate({...current,cues:updated,timingSource:'manual'});
 }
 function adjust(index:number,value:string){
   if(!current||!cues[index])return;
   const num=Number(value);
   if(!Number.isFinite(num)||num<0)return;
   const updated=current.cues!.map((c,i)=>i===index?{...c,time:num}:c);
   updated.sort((a,b)=>a.time-b.time);
   props.onUpdate({...current,cues:updated,timingSource:'manual'});
 }
 return <>
   {!window.desktop&&<>
     <input ref={audioFilesRef} type="file" multiple
       accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.lrc"
       style={{display:'none'}} aria-label="Escolher arquivos de música"
       onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void importChosenFiles('files',files);}}/>
     <input ref={audioFolderRef} type="file" multiple
       style={{display:'none'}} aria-label="Escolher pasta de músicas"
       onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void importChosenFiles('folder',files);}}/>
     <input ref={zipFilesRef} type="file" multiple accept=".zip"
       style={{display:'none'}} aria-label="Escolher arquivo ZIP"
       onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void importChosenFiles('zip',files);}}/>
     <input ref={lrcFilesRef} type="file" accept=".lrc"
       style={{display:'none'}} aria-label="Escolher letra LRC"
       onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importChosenLrc(file);}}/>
   </>}
   <section className="panel panel--library music-library">
     <div className="panel-heading"><h2>Conteúdos</h2></div>
     <div className="music-import-actions">
       <button onClick={()=>void importTracks('files')} disabled={importing}><Upload size={15}/> Arquivos</button>
       <button onClick={()=>void importTracks('folder')} disabled={importing}><FolderOpen size={15}/> Pasta</button>
       <button onClick={()=>void importTracks('zip')} disabled={importing}><FileArchive size={15}/> ZIP</button>
     </div>
     <div className="music-import-hint">MP3, WAV, FLAC, M4A, AAC, OGG, OPUS e letras .LRC{!window.desktop&&<span> · Os arquivos ficam salvos neste navegador.</span>}</div>
     <label className="search"><Search size={17}/><input value={props.search} onChange={e=>props.setSearch(e.target.value)} placeholder="Buscar músicas..."/></label>
     <div className="list">
       {searchResults.map(track=><div key={track.id} role="button" tabIndex={0}
         draggable onDragStart={event=>{event.dataTransfer.setData('application/x-nosso-culto-id',track.id);event.dataTransfer.setData('text/plain',track.id);event.dataTransfer.effectAllowed='copy';}}
         onClick={()=>select(track.id)} onKeyDown={e=>{if(e.key==='Enter')select(track.id);}}
         className={'music-library-item '+(current?.id===track.id?'selected':'')}>
         <div className="music-library-icon"><FileAudio size={18}/></div>
         <div className="music-library-meta"><strong>{track.title}</strong><small>
           {track.audioId?(track.duration?timeCode(track.duration):'Arquivo de áudio'): 'Somente letra'}
           {track.cues?.length?' · '+track.cues.length+' trechos':''}
         </small></div>
       </div>)}
       {!searchResults.length&&<div className="empty">Nenhuma música encontrada. Importe arquivos para começar.</div>}
     </div>
     <div className="panel-foot"><button className="music-import-primary" onClick={()=>void importTracks('files')} disabled={importing}><Plus size={17}/> {importing?'Importando...':'Importar músicas'}</button></div>
   </section>
   <section className={'panel panel--slides music-stage '+(dragging?'music-stage--drag':'')}
      onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';setDragging(true);}}
      onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}}
      onDrop={drop}>
     <div className="panel-heading panel-heading--stack"><div>
       <p className="eyebrow">EDIÇÃO & APRESENTAÇÃO</p>
       <h2>{current?.title||'Selecione ou arraste uma música'}</h2>
     </div><div className="panel-buttons">
       <button className="music-toolbar-btn" onClick={props.onAddQueue} disabled={!current}><Plus size={16}/> Ao culto</button>
       <button className="music-toolbar-btn" onClick={props.onEdit} disabled={!current}>Editar letra</button>
       <button className="music-toolbar-btn music-danger" onClick={props.onDelete} disabled={!current}>Excluir</button>
     </div></div>
     {!current&&<div className="music-drop-empty"><Music2 size={38}/><h3>Arraste uma música para cá</h3><p>Ou escolha um item da biblioteca para preparar a apresentação.</p></div>}
     {current&&<>
       <div className="music-playback">
         <div className="music-track-head"><Volume2 size={16}/><span>{current.sourceName?.split(/[\\/]/).pop()||current.title}</span><small>{current.audioId?'Áudio no monitor principal':'Letra sem áudio vinculado'}</small></div>
         {canPlayAudio&&<audio key={current.audioId} ref={audio} preload="metadata" src={window.desktop?audioUrl(current):browserAudio.url??undefined}
           onLoadedMetadata={onMetadata} onTimeUpdate={onTime}
           onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);lastCue.current=-2;}}
           onError={()=>setMediaError('Falha ao abrir o áudio. Confira o formato e o arquivo importado.')}/>}
         <div className="music-player-row">
           <button onClick={stop} disabled={!canPlayAudio} title="Parar"><Square size={16}/></button>
           <button className="music-play-button" onClick={()=>void toggle()} disabled={!canPlayAudio} title={playing?'Pausar':'Reproduzir'}>{playing?<Pause size={19}/>:<Play size={19}/>}</button>
           <input type="range" min={0} max={Math.max(duration,1)} step={.1} value={Math.min(position,Math.max(duration,1))}
             onChange={e=>seek(Number(e.target.value))} disabled={!canPlayAudio} aria-label="Progresso do áudio"/>
           <span className="music-clock">{timeCode(position)} / {timeCode(duration)}</span>
         </div>
         {mediaError&&<p className="music-error">{mediaError}</p>}
         {!window.desktop&&browserAudio.error&&<p className="music-error">Áudio não encontrado no armazenamento do navegador. Importe a música novamente.</p>}
       </div>
       <div className="music-cues-toolbar">
         <div><strong>Letras e tempos</strong><p>{cues.length?cues.length+' trecho(s) preparados para exibição':'A música ainda não possui letras sincronizadas.'}</p></div>
         <div className="music-cue-actions">
           <button onClick={()=>window.desktop?void props.onImportLrc():lrcFilesRef.current?.click()} disabled={importing}><Download size={15}/> Importar LRC</button>
           <button className="music-ai-action" disabled={!current.audioId||transcribing}
             onClick={()=>void startTranscribing()} title="Reconhecer ou sincronizar a letra automaticamente">
             {transcribing?<LoaderCircle size={15}/>:<Sparkles size={15}/>} {transcribing?'Transcrevendo…':'Transcrever'}
           </button>
           <button disabled={!current.content.trim()||!duration} onClick={()=>props.onUpdate({...current,cues:distributeLyrics(current.content,duration),timingSource:'estimated'})}><Timer size={15}/> Distribuir tempos</button>
         </div>
       </div>
       {transcribing&&<div className="music-ai-inline-progress" role="status">
         <LoaderCircle size={16}/>
         <span>{transcriptionProgress?.detail||'Reconhecendo a música…'}
           {typeof transcriptionProgress?.percentage==='number'&&<small> {transcriptionProgress.percentage}%</small>}
         </span>
         <button type="button" onClick={()=>void cancelTranscribing()}>Cancelar</button>
       </div>}
       {transcriptionError&&<p className="music-ai-error" role="alert">{transcriptionError}</p>}
       {!current.content.trim()&&<div className="music-lyrics-warning">
         A letra ainda não está disponível. Clique em <b>Transcrever</b> para reconhecer
         a voz com tempos, importe um .LRC ou use <b>Editar letra</b> para escrever manualmente.
         Na primeira execução, o reconhecimento baixará os arquivos necessários. O processamento pode demorar, especialmente em músicas longas. Confira as palavras e os tempos antes de apresentar.
       </div>}
       {!!current.content.trim()&&(!cues.length)&&<div className="music-lyrics-warning">
         Clique em <b>Transcrever</b> para sincronizar a letra existente com a gravação. Também é possível importar um LRC ou marcar tempos manualmente.
       </div>}
       {current.timingSource==='transcribed'&&<p className="music-ai-caption">
         <Sparkles size={13}/> Letra e tempos gerados automaticamente. Revise os versos antes da apresentação.
       </p>}
       {!!cues.length&&<div className="music-timed-grid">
         {cues.map((cue,i)=><div key={i} className={'music-cue '+(props.active===i?'music-cue--active':'')}>
           <button className="music-cue-content" onClick={()=>{seek(cue.time);props.onCue(i);}} title="Ir para este trecho">
             <small>TRECHO {String(i+1).padStart(2,'0')} · {timeCode(cue.time)}</small>
             <span>{cue.text}</span>
           </button>
           <div className="music-cue-footer">
             <label>Início (s)<input aria-label={'Tempo inicial do trecho '+(i+1)} type="number" min={0} max={43200} step={.1}
               value={cue.time} onChange={e=>adjust(i,e.target.value)}/></label>
             <button onClick={()=>mark(i)} disabled={!current.audioId} title="Marca este trecho no tempo atual do áudio">Marcar agora</button>
           </div>
         </div>)}
       </div>}
       <div className="music-transport">
         <div><button disabled={!cues.length||props.active===0} onClick={()=>{const i=Math.max(0,props.active-1);seek(cues[i].time);props.onCue(i);}}><SkipBack size={17}/> Anterior</button>
         <span>{cues.length?props.active+1:0} / {cues.length}</span>
         <button disabled={!cues.length||props.active>=cues.length-1} onClick={()=>{const i=Math.min(cues.length-1,props.active+1);seek(cues[i].time);props.onCue(i);}}>Próximo <SkipForward size={17}/></button></div>
         <small>O áudio é reproduzido no controle; as letras acompanham o tempo nos projetores.</small>
       </div>
     </>}
   </section>
 </>;
}
