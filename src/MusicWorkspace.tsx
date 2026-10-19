import {useEffect,useRef,useState} from 'react';
import type {DragEvent} from 'react';
import {Download,FileArchive,FileAudio,FolderOpen,Music2,Pause,Play,Plus,Search,SkipBack,SkipForward,Square,Timer,Upload,Volume2,Sparkles,KeyRound,X,ShieldCheck,Trash2,LoaderCircle} from 'lucide-react';
import type {MusicItem} from './music';
import {audioUrl,cueAtTime,distributeLyrics,timeCode} from './music';
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
}
export default function MusicWorkspace(props:Props){
 const audio=useRef<HTMLAudioElement>(null);
 const lastCue=useRef<number>(-2);
 const [playing,setPlaying]=useState(false);
 const [position,setPosition]=useState(0);
 const [duration,setDuration]=useState(0);
 const [dragging,setDragging]=useState(false);
 const [mediaError,setMediaError]=useState('');
 const [importing,setImporting]=useState(false);
 const [transcribeOpen,setTranscribeOpen]=useState(false);
 const [transcribing,setTranscribing]=useState(false);
 const [transcriptionError,setTranscriptionError]=useState('');
 const [transcriptionStatus,setTranscriptionStatus]=useState<{configured:boolean;stored:boolean;supported:boolean}|null>(null);
 const [apiKey,setApiKey]=useState('');
 const [savingKey,setSavingKey]=useState(false);
 const [transcriptionLanguage,setTranscriptionLanguage]=useState<'auto'|'pt'|'en'|'es'>('auto');
 const current=props.selected;
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
 async function showTranscription(){
   if(!current?.audioId||!window.desktop)return;
   setTranscriptionError('');
   setApiKey('');
   setTranscribeOpen(true);
   try{setTranscriptionStatus(await window.desktop.transcriptionStatus());}
   catch(e){setTranscriptionError('Não foi possível abrir as configurações de transcrição: '+String(e));}
 }
 async function configureKey(){
   if(!window.desktop||!apiKey.trim())return;
   setSavingKey(true);setTranscriptionError('');
   try{
     const status=await window.desktop.saveTranscriptionKey(apiKey.trim());
     setTranscriptionStatus(status);setApiKey('');
   }catch(e){setTranscriptionError(String(e));}
   finally{setSavingKey(false);}
 }
 async function removeKey(){
   if(!window.desktop||!confirm('Remover a chave OpenAI salva neste computador?'))return;
   try{setTranscriptionStatus(await window.desktop.clearTranscriptionKey());setApiKey('');}
   catch(e){setTranscriptionError(String(e));}
 }
 async function startTranscribing(){
   if(!current?.audioId||!window.desktop||transcribing||!transcriptionStatus?.configured)return;
   if((current.content.trim()||current.cues?.length)&&
     !confirm('Substituir a letra e os tempos atuais da música pela transcrição automática?'))return;
   setTranscriptionError('');setTranscribing(true);
   try{
     const result=await window.desktop.transcribeAudio(current.audioId,transcriptionLanguage);
     if(!result.cues.length)throw Error('A transcrição não retornou trechos reconhecíveis.');
     props.onUpdate({...current,content:result.content,cues:result.cues,
       duration:current.duration||result.duration,timingSource:'transcribed'});
     lastCue.current=-2;
     setTranscribeOpen(false);
   }catch(e){setTranscriptionError(e instanceof Error?e.message:String(e));}
   finally{setTranscribing(false);}
 }
 async function cancelTranscribing(){
   if(!window.desktop)return;
   try{await window.desktop.cancelTranscription();}
   catch(e){setTranscriptionError(String(e));}
 }
 async function importTracks(kind:'files'|'folder'|'zip'){
   if(importing)return;
   setImporting(true);
   try{await props.onImport(kind);}finally{setImporting(false);}
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
   <section className="panel panel--library music-library">
     <div className="panel-heading"><h2>Conteúdos</h2><button className="music-square-button" onClick={()=>void importTracks('files')} title="Importar arquivos" disabled={!window.desktop||importing}><Plus size={18}/></button></div>
     <div className="music-import-actions">
       <button onClick={()=>void importTracks('files')} disabled={!window.desktop||importing}><Upload size={15}/> Arquivos</button>
       <button onClick={()=>void importTracks('folder')} disabled={!window.desktop||importing}><FolderOpen size={15}/> Pasta</button>
       <button onClick={()=>void importTracks('zip')} disabled={!window.desktop||importing}><FileArchive size={15}/> ZIP</button>
     </div>
     <div className="music-import-hint">MP3, WAV, FLAC, M4A, AAC, OGG, OPUS e letras .LRC</div>
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
     <div className="panel-foot"><button className="music-import-primary" onClick={()=>void importTracks('files')} disabled={!window.desktop||importing}><Plus size={17}/> {importing?'Importando...':'Importar músicas'}</button></div>
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
         {current.audioId&&<audio key={current.audioId} ref={audio} preload="metadata" src={audioUrl(current)}
           onLoadedMetadata={onMetadata} onTimeUpdate={onTime}
           onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);lastCue.current=-2;}}
           onError={()=>setMediaError('Falha ao abrir o áudio. Confira o formato e o arquivo importado.')}/>}
         <div className="music-player-row">
           <button onClick={stop} disabled={!current.audioId} title="Parar"><Square size={16}/></button>
           <button className="music-play-button" onClick={()=>void toggle()} disabled={!current.audioId} title={playing?'Pausar':'Reproduzir'}>{playing?<Pause size={19}/>:<Play size={19}/>}</button>
           <input type="range" min={0} max={Math.max(duration,1)} step={.1} value={Math.min(position,Math.max(duration,1))}
             onChange={e=>seek(Number(e.target.value))} disabled={!current.audioId} aria-label="Progresso do áudio"/>
           <span className="music-clock">{timeCode(position)} / {timeCode(duration)}</span>
         </div>
         {mediaError&&<p className="music-error">{mediaError}</p>}
       </div>
       <div className="music-cues-toolbar">
         <div><strong>Letras e tempos</strong><p>{cues.length?cues.length+' trecho(s) preparados para exibição':'A música ainda não possui letras sincronizadas.'}</p></div>
         <div className="music-cue-actions">
           <button disabled={!window.desktop} onClick={()=>void props.onImportLrc()}><Download size={15}/> Importar LRC</button>
           <button className="music-ai-action" disabled={!window.desktop||!current.audioId} onClick={()=>void showTranscription()}><Sparkles size={15}/> Transcrever IA</button>
           <button disabled={!current.content.trim()||!duration} onClick={()=>props.onUpdate({...current,cues:distributeLyrics(current.content,duration),timingSource:'estimated'})}><Timer size={15}/> Distribuir tempos</button>
         </div>
       </div>
       {!current.content.trim()&&<div className="music-lyrics-warning">
         A letra ainda não está disponível. Clique em <b>Transcrever IA</b> para reconhecer
         a voz com tempos, importe um .LRC ou use <b>Editar letra</b> para escrever manualmente.
         A transcrição precisa de internet e pode exigir correções, especialmente em músicas cantadas.
       </div>}
       {!!current.content.trim()&&(!cues.length)&&<div className="music-lyrics-warning">
         Insira um arquivo .LRC com os tempos ou reproduza a música e distribua os trechos pela duração como estimativa.
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
   {transcribeOpen&&<div className="scene-modal-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!transcribing)setTranscribeOpen(false);}}>
     <div className="scene-modal music-transcribe-dialog" role="dialog" aria-modal="true" aria-label="Transcrever letra com inteligência artificial">
       <div className="scene-modal-heading">
         <h2><Sparkles size={19}/> Transcrever música com IA</h2>
         <button type="button" aria-label="Fechar" disabled={transcribing} onClick={()=>setTranscribeOpen(false)}><X size={18}/></button>
       </div>
       <p className="music-ai-description">
         Transforma a voz do arquivo em letra e marcações de tempo usando Whisper, pela API OpenAI.
         É necessário internet e uma chave de API com cobrança própria.
       </p>
       <div className="music-ai-file"><FileAudio size={17}/><span>{current?.sourceName||current?.title||'Nenhum áudio selecionado'}</span></div>
       {transcriptionStatus&&!transcriptionStatus.configured&&<div className="music-ai-key-box">
         <label htmlFor="music-openai-key"><KeyRound size={15}/> Chave da API OpenAI</label>
         <input id="music-openai-key" type="password" autoComplete="off" spellCheck={false}
           value={apiKey} onChange={event=>setApiKey(event.target.value)} placeholder="sk-..." disabled={savingKey}/>
         <button type="button" onClick={()=>void configureKey()} disabled={!apiKey.trim()||savingKey||!transcriptionStatus.supported}>
           {savingKey?'Salvando...':'Salvar chave protegida'}
         </button>
         {!transcriptionStatus.supported&&<small>Criptografia do Windows indisponível. Você pode configurar OPENAI_API_KEY no sistema.</small>}
       </div>}
       {transcriptionStatus?.configured&&<div className="music-ai-ready">
         <ShieldCheck size={17}/><span>API configurada {transcriptionStatus.stored?'e protegida neste computador':'pela variável de ambiente'}.</span>
         {transcriptionStatus.stored&&<button type="button" title="Excluir chave salva" disabled={transcribing} onClick={()=>void removeKey()}><Trash2 size={16}/></button>}
       </div>}
       <label className="music-ai-language" htmlFor="music-ai-language">Idioma da voz
         <select id="music-ai-language" disabled={transcribing} value={transcriptionLanguage}
           onChange={event=>setTranscriptionLanguage(event.target.value as 'auto'|'pt'|'en'|'es')}>
           <option value="auto">Detectar automaticamente</option>
           <option value="pt">Português</option>
           <option value="en">Inglês</option>
           <option value="es">Espanhol</option>
         </select>
       </label>
       <p className="music-ai-disclaimer">O áudio será enviado à OpenAI somente após clicar em Transcrever.
         Arquivos de até 25 MB, nos formatos MP3, WAV, FLAC, M4A ou OGG.
         O reconhecimento de voz em músicas pode errar palavras, repetições e o instante exato dos versos.</p>
       {transcribing&&<p className="music-ai-running"><LoaderCircle size={16}/> Enviando áudio e reconhecendo letra. Aguarde...</p>}
       {transcriptionError&&<p className="music-ai-error" role="alert">{transcriptionError}</p>}
       <div className="scene-modal-actions">
         <button type="button" className="music-ai-cancel" onClick={()=>void (transcribing?cancelTranscribing():setTranscribeOpen(false))}>
           {transcribing?'Cancelar transcrição':'Fechar'}
         </button>
         <button type="button" className="music-ai-submit" disabled={!transcriptionStatus?.configured||transcribing||savingKey}
           onClick={()=>void startTranscribing()}>
           {transcribing?<LoaderCircle size={16}/>:<Sparkles size={16}/>} {transcribing?'Transcrevendo...':'Transcrever e sincronizar'}
         </button>
       </div>
     </div>
   </div>}
 </>;
}
