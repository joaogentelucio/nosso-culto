// Browser module worker (built separately by Vite).
// Browser-only speech recognition. Model and runtime are downloaded by the
// browser; the user's recording never leaves the browser.
// Pin the runtime to avoid silently changing behavior across deployments.
type Progress={step:string;detail:string;percentage?:number};
type Segment={time:number;text:string};
type WhisperChunk={text:string;timestamp?:[number,number]};
type WhisperResult={text:string;chunks?:WhisperChunk[]};
const context=self as unknown as {
 postMessage:(message:unknown)=>void;
 onmessage:((event:MessageEvent<{type:string;audio?:ArrayBuffer}>)=>void)|null;
};
const RUNTIME_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL_ID='Xenova/whisper-tiny'; // multilingual, supports Portuguese
let transcriber:((audio:Float32Array,options:Record<string,unknown>)=>Promise<WhisperResult>)|null=null;
function progress(message:Progress){context.postMessage({type:'progress',...message});}
async function getTranscriber(){
 if(transcriber)return transcriber;
 progress({step:'download',detail:'Preparando o reconhecimento de voz pela primeira vez…'});
 // Avoid changing the site package lock or bundling hundreds of MB of ML
 // runtime into Vite. CDN import is cached by the browser.
 const mod=await import(/* @vite-ignore */ RUNTIME_URL) as {
   pipeline:(task:string,model:string,options:Record<string,unknown>)=>Promise<
     (audio:Float32Array,options:Record<string,unknown>)=>Promise<WhisperResult>>;
 };
 transcriber=await mod.pipeline('automatic-speech-recognition',MODEL_ID,{
   device:'wasm',
   progress_callback:(detail:{status?:string;progress?:number})=>{
     if(detail.status==='progress'&&typeof detail.progress==='number')
       progress({step:'download',detail:'Preparando o reconhecimento de voz…',
         percentage:Math.min(100,Math.max(0,Math.floor(detail.progress)))});
   }
 });
 return transcriber;
}
async function recognize(samples:Float32Array){
 const pipe=await getTranscriber();
 const sampleRate=16000,chunkSize=25*sampleRate;
 const total=Math.max(1,Math.ceil(samples.length/chunkSize));
 const cues:Segment[]=[];
 for(let index=0;index<total;index++){
   const begin=index*chunkSize;
   const end=Math.min(begin+chunkSize,samples.length);
   progress({step:'transcribe',detail:`Analisando a música… trecho ${index+1} de ${total}`,
      percentage:Math.round(index/total*100)});
   const result=await pipe(samples.subarray(begin,end),{
     return_timestamps:true,language:'portuguese',task:'transcribe'
   });
   const offset=begin/sampleRate;
   const chunks=Array.isArray(result.chunks)?result.chunks:[];
   if(chunks.length){
     for(const chunk of chunks){
       const text=String(chunk.text||'').trim();
       const time=Number(chunk.timestamp?.[0]);
       if(!text||!Number.isFinite(time)||time<0)continue;
       cues.push({text,time:Math.round((offset+time)*100)/100});
     }
   }else if(result.text?.trim()){
     // Fallback if the runtime omits timestamps for a short audio chunk:
     // use the actual start of that chunk, not fabricated per-word timestamps.
     cues.push({text:result.text.trim(),time:offset});
   }
 }
 if(!cues.length)throw Error('Não foi possível reconhecer a voz desta música.');
 // Never invent timestamps between chunks. Preserve source chronology.
 cues.sort((a,b)=>a.time-b.time);
 const valid=cues.filter((x,i)=>i===0||x.time>cues[i-1].time+0.01);
 if(!valid.length)throw Error('Não foram encontrados trechos com tempos válidos.');
 progress({step:'complete',detail:'Análise concluída.',percentage:100});
 context.postMessage({type:'result',cues:valid,content:valid.map(x=>x.text).join('\n\n')});
}
context.onmessage=(event:MessageEvent<{type:string;audio?:ArrayBuffer}>)=>{
 if(event.data?.type!=='transcribe'||!(event.data.audio instanceof ArrayBuffer))return;
 void recognize(new Float32Array(event.data.audio)).catch(err=>{
   context.postMessage({type:'error',message:err instanceof Error?err.message:String(err)});
 });
};
