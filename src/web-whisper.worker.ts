// Browser-only Whisper recognition. Audio is never uploaded.
import {assembleTimedVerses,validateRecognizedCues} from './whisper-cues';
import {selectSpeechModel} from './ai-model-selection';
type Progress={step:string;detail:string;percentage?:number};
type WhisperChunk={text:string;timestamp?:[number|null,number|null]};
type WhisperResult={text:string;chunks?:WhisperChunk[]};
type TimedWord={start:number;end:number;text:string};
const context=self as unknown as {
 postMessage:(message:unknown)=>void;
 onmessage:((event:MessageEvent<{type:string;audio?:ArrayBuffer}>)=>void)|null;
};
const RUNTIME_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
// The previous Whisper Tiny is too weak for Portuguese singing. Base improves
// general speech capacity, but cannot guarantee correct singing transcription.
const MODEL_ID='Xenova/whisper-base';
let transcriber:((audio:Float32Array,options:Record<string,unknown>)=>Promise<WhisperResult>)|null=null;
async function modelForThisDeployment():Promise<string>{
 try{
   const response=await fetch('/ai/active-model.json',{cache:'no-store'});
   if(!response.ok)return MODEL_ID;
   return selectSpeechModel(await response.json());
 }catch{return MODEL_ID;}
}
function progress(message:Progress){context.postMessage({type:'progress',...message});}
async function getTranscriber(){
 if(transcriber)return transcriber;
 progress({step:'download',detail:'Preparando reconhecimento aprimorado pela primeira vez…'});
 const mod=await import(/* @vite-ignore */ RUNTIME_URL) as {
   pipeline:(task:string,model:string,options:Record<string,unknown>)=>Promise<
     (audio:Float32Array,options:Record<string,unknown>)=>Promise<WhisperResult>>;
 };
 const selected=await modelForThisDeployment();
 const options={
   device:'wasm',
   progress_callback:(detail:{status?:string;progress?:number})=>{
     if(detail.status==='progress'&&typeof detail.progress==='number')
       progress({step:'download',detail:'Preparando reconhecimento de voz…',
         percentage:Math.min(100,Math.max(0,Math.floor(detail.progress)))});
   }
 };
 try{transcriber=await mod.pipeline('automatic-speech-recognition',selected,options);}
 catch(error){
   if(selected===MODEL_ID)throw error;
   // A promoted model may fail on a specific browser. Keep transcription usable.
   progress({step:'download',detail:'Preparando reconhecimento alternativo…'});
   transcriber=await mod.pipeline('automatic-speech-recognition',MODEL_ID,options);
 }
 return transcriber;
}
async function recognize(samples:Float32Array){
 const pipe=await getTranscriber();
 const sampleRate=16000,windowSeconds=28,overlapSeconds=6;
 const windowSize=windowSeconds*sampleRate;
 const hop=(windowSeconds-overlapSeconds)*sampleRate;
 const windows:TimedWord[]=[];
 const total=Math.max(1,Math.ceil(Math.max(0,samples.length-windowSize)/hop)+1);
 let invalid=0,reported=0;
 const lengthSeconds=samples.length/sampleRate;
 for(let index=0;index<total;index++){
   const begin=index*hop,end=Math.min(begin+windowSize,samples.length);
   if(begin>=end)break;
   progress({step:'transcribe',detail:`Reconhecendo a voz… parte ${index+1} de ${total}`,
     percentage:Math.round(index/total*100)});
   const result=await pipe(samples.subarray(begin,end),{
     return_timestamps:'word',language:'portuguese',task:'transcribe'
   });
   const offset=begin/sampleRate;
   const chunks=Array.isArray(result.chunks)?result.chunks:[];
   // Do not place un-timed text at 0, 25, 50 etc. Those would be invented cues.
   if(!chunks.length&&result.text?.trim())throw Error(
     'O reconhecimento não retornou tempos para os versos. Nenhuma letra foi substituída.'
   );
   for(const chunk of chunks){
     const text=String(chunk.text||'').trim();
     if(!text)continue;
     reported++;
     const start=chunk.timestamp?.[0],stop=chunk.timestamp?.[1];
     if(typeof start!=='number'||typeof stop!=='number'||!Number.isFinite(start)||
       !Number.isFinite(stop)||start<0||stop<=start||
       stop>(end-begin)/sampleRate+0.5){invalid++;continue;}
     const absoluteStart=offset+start,absoluteEnd=offset+stop;
     // Keep the middle of overlaps only. Avoid duplicating truncated words.
     const keepFrom=offset+(index===0?0:overlapSeconds/2);
     const keepUntil=end/sampleRate-(index===total-1?0:overlapSeconds/2);
     if(absoluteStart<keepFrom||absoluteStart>=keepUntil)continue;
     windows.push({start:absoluteStart,end:absoluteEnd,text});
   }
 }
 if(!reported||!windows.length)throw Error(
   'Não foram reconhecidas palavras com tempos confiáveis. Tente com a letra correta já preenchida ou ajuste os versos manualmente.'
 );
 if(invalid/reported>0.35)throw Error(
   'A sincronização apresentou muitos tempos inválidos. A letra anterior foi preservada.'
 );
 const cues=validateRecognizedCues(assembleTimedVerses(windows,lengthSeconds),lengthSeconds);
 progress({step:'complete',detail:'Reconhecimento concluído. Confira a letra e os tempos.',percentage:100});
 context.postMessage({type:'result',cues,content:cues.map(c=>c.text).join('\n\n')});
}
context.onmessage=(event:MessageEvent<{type:string;audio?:ArrayBuffer}>)=>{
 if(event.data?.type!=='transcribe'||!(event.data.audio instanceof ArrayBuffer))return;
 void recognize(new Float32Array(event.data.audio)).catch(error=>{
   context.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
 });
};
