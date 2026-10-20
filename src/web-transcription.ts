// Runs Whisper in a dedicated browser worker. Audio never leaves this device.
import type {MusicCue} from './music';
import {getWebAudioForTranscription} from './web-media';
import {alignWebLyrics} from './web-lyrics-alignment';
import {validateRecognizedCues} from './whisper-cues';

type Status={step:string;detail:string;percentage?:number};
type Outcome={content:string;cues:MusicCue[];duration:number};
const fail=(message:string)=>new Error(message);

export async function transcribeInBrowser(audioId:string,existingLyrics:string,
 onProgress:(status:Status)=>void,signal:AbortSignal):Promise<Outcome>{
 if(typeof Worker==='undefined'||typeof AudioContext==='undefined')
   throw fail('Este navegador não oferece o processamento de áudio necessário. Use o Chrome atualizado ou o aplicativo Windows.');
 if(signal.aborted)throw fail('Transcrição cancelada.');
 onProgress({step:'prepare',detail:'Preparando o áudio no navegador…'});
 const blob=await getWebAudioForTranscription(audioId);
 if(!blob)throw fail('O áudio desta música não foi encontrado no navegador. Importe-o novamente.');
 let ctx:AudioContext;
 try{ctx=new AudioContext({sampleRate:16000});}
 catch{throw fail('Este dispositivo não suporta o formato necessário para reconhecimento de voz.');}
 let audio:AudioBuffer;
 try{audio=await ctx.decodeAudioData(await blob.arrayBuffer());}
 catch{throw fail('Não foi possível decodificar a música neste navegador. Tente MP3 ou WAV.');}
 finally{await ctx.close().catch(()=>{});}
 if(signal.aborted)throw fail('Transcrição cancelada.');
 if(audio.duration>20*60)
   throw fail('Para músicas acima de 20 minutos, utilize o aplicativo Windows.');
 if(audio.duration<0.1)throw fail('O áudio está vazio.');
 if(audio.sampleRate!==16000)
   throw fail('Não foi possível converter o áudio para reconhecimento. Use o aplicativo Windows.');
 const pcm=new Float32Array(audio.length);
 if(audio.numberOfChannels===1)pcm.set(audio.getChannelData(0));
 else{
   const count=Math.min(audio.numberOfChannels,2);
   for(let channel=0;channel<count;channel++){
     const samples=audio.getChannelData(channel);
     for(let i=0;i<pcm.length;i++)pcm[i]+=samples[i]/count;
   }
 }
 if(signal.aborted)throw fail('Transcrição cancelada.');
 onProgress({step:'download',detail:'Iniciando o reconhecimento de voz…'});
 const result=await new Promise<{content:string;cues:MusicCue[]}>((resolve,reject)=>{
   const worker=new Worker(new URL('./web-whisper.worker.ts',import.meta.url),{type:'module'});
   let finished=false;
   const cleanup=()=>{
     worker.terminate();
     signal.removeEventListener('abort',cancel);
   };
   const finish=(error?:Error,value?:{content:string;cues:MusicCue[]})=>{
     if(finished)return;
     finished=true;cleanup();
     if(error)reject(error);else if(value)resolve(value);
   };
   const cancel=()=>finish(fail('Transcrição cancelada.'));
   if(signal.aborted){cancel();return;}
   signal.addEventListener('abort',cancel,{once:true});
   worker.onerror=event=>{
     event.preventDefault();
     finish(fail('Não foi possível iniciar o reconhecimento no navegador. Verifique sua conexão ou use o aplicativo Windows.'));
   };
   worker.onmessage=(event:MessageEvent<
     {type:'progress';step:string;detail:string;percentage?:number}|
     {type:'result';content:string;cues:MusicCue[]}|
     {type:'error';message:string}>)=>{
     if(finished)return;
     const message=event.data;
     if(message.type==='progress')onProgress(message);
     else if(message.type==='error')finish(fail('Falha no reconhecimento: '+message.message));
     else if(message.type==='result')finish(undefined,{
       content:message.content,cues:message.cues
     });
   };
   try{worker.postMessage({type:'transcribe',audio:pcm.buffer},[pcm.buffer]);}
   catch(error){finish(fail('Não foi possível iniciar o processamento: '+String(error)));}
 });
 if(signal.aborted)throw fail('Transcrição cancelada.');
 // Verify worker output again before touching the user's saved music.
 const verifiedCues=validateRecognizedCues(result.cues,audio.duration);
 if(existingLyrics.trim()){
   onProgress({step:'alignment',detail:'Sincronizando a letra com os versos cantados…'});
   const cues=alignWebLyrics(existingLyrics,verifiedCues);
   return {content:existingLyrics.trim(),cues,duration:audio.duration};
 }
 return {...result,cues:verifiedCues,duration:audio.duration};
}
