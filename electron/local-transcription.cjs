'use strict';
// whisper.cpp executables and FFmpeg are shipped with the Windows installer.
// Only the model weights are downloaded once. No Python, API key or paid service.
const {app}=require('electron');
const {spawn}=require('node:child_process');
const {createWriteStream}=require('node:fs');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {Readable,Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {randomUUID}=require('node:crypto');
const {cuesFromLrc}=require('./local-lrc.cjs');

const MODELS=Object.freeze({
  tiny:{min:30e6,max:150e6},
  base:{min:100e6,max:300e6},
  small:{min:300e6,max:800e6},
});
const LANGUAGES=new Set(['auto','pt','en','es']);
const FORMATS=new Set(['.mp3','.wav','.flac','.m4a','.aac','.ogg','.opus']);
const running=new Map();
const MODEL_ROOT='https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
function toolsDir(){
  return app.isPackaged
    ?path.join(process.resourcesPath,'transcription')
    :path.resolve(__dirname,'../build-tools/transcription');
}
function binaries(){
  const dir=toolsDir();
  return {whisper:path.join(dir,'whisper-cli.exe'),ffmpeg:path.join(dir,'ffmpeg.exe')};
}
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
async function status(){
  const {whisper,ffmpeg}=binaries();
  const missing=[];
  if(!await exists(whisper))missing.push('whisper-cli.exe');
  if(!await exists(ffmpeg))missing.push('ffmpeg.exe');
  const installed=missing.length===0;
  const environment=app.isPackaged?'installed':'development';
  const message=installed
    ?'Motor local encontrado. O modelo será baixado automaticamente na primeira transcrição.'
    :environment==='development'
      ?'Você está executando o código-fonte (npm run dev). Os binários nativos não são gerados pelo npm install. Use o instalador Windows completo, disponível no GitHub Actions.'
      :'Esta cópia do Nosso Culto não contém o motor nativo. Feche o aplicativo e reinstale usando o instalador Windows mais recente (artefato nosso-culto-windows).';
  return {
    installed,python:false,message,environment,missing,
    engineDirectory:toolsDir(),version:app.getVersion()
  };
}
function announce(sender,step,detail,percentage){
  if(!sender.isDestroyed())sender.send('transcription:local-progress',{step,detail,percentage});
}
function runProcess(exe,args,job,{cwd,logLimit=3000}={}){
  return new Promise((resolve,reject)=>{
    if(job.controller.signal.aborted)return reject(Error('Transcrição cancelada.'));
    const child=spawn(exe,args,{cwd,windowsHide:true,shell:false,stdio:['ignore','ignore','pipe']});
    job.child=child;
    let stderr='',settled=false;
    const abort=()=>child.kill();
    job.controller.signal.addEventListener('abort',abort,{once:true});
    const finish=(error)=>{
      if(settled)return;
      settled=true;job.controller.signal.removeEventListener('abort',abort);
      if(job.child===child)job.child=null;
      if(error)reject(error);else resolve();
    };
    child.stderr.on('data',data=>{stderr=(stderr+String(data)).slice(-logLimit);});
    child.on('error',err=>finish(Error('Não foi possível iniciar o motor: '+err.message)));
    child.on('close',code=>finish(
      job.controller.signal.aborted?Error('Transcrição cancelada.'):
      code===0?null:Error('Falha no processamento: '+(stderr.trim()||'código '+code))
    ));
  });
}
async function ensureModel(model,job,sender){
  const spec=MODELS[model];
  const folder=path.join(app.getPath('userData'),'whisper-models');
  await fs.mkdir(folder,{recursive:true});
  const target=path.join(folder,'ggml-'+model+'.bin');
  try{
    const stat=await fs.stat(target);
    if(stat.size>=spec.min&&stat.size<=spec.max)return target;
  }catch{}
  if(job.controller.signal.aborted)throw Error('Transcrição cancelada.');
  const tmp=target+'.'+randomUUID()+'.download';
  try{
    announce(sender,'download','Baixando modelo '+model+' (somente na primeira vez)…',0);
    const res=await fetch(MODEL_ROOT+'ggml-'+model+'.bin?download=true',{
      signal:job.controller.signal,redirect:'follow'
    });
    if(!res.ok||!res.body)throw Error('Não foi possível baixar o modelo (HTTP '+res.status+'). Verifique a internet.');
    const declared=Number(res.headers.get('content-length')||0);
    if(declared>spec.max)throw Error('Arquivo de modelo maior que o esperado.');
    let received=0,reported=-1;
    const counter=new Transform({transform(chunk,enc,cb){
      received+=chunk.length;
      if(received>spec.max)return cb(Error('Download maior que o permitido.'));
      if(declared>0){
        const percent=Math.min(99,Math.round(received/declared*100));
        if(percent>=reported+5){reported=percent;announce(sender,'download','Baixando modelo '+model+'…',percent);}
      }
      cb(null,chunk);
    }});
    await pipeline(Readable.fromWeb(res.body),counter,createWriteStream(tmp,{flags:'wx'}),{signal:job.controller.signal});
    if(received<spec.min)throw Error('O modelo foi baixado incompleto. Tente novamente.');
    // Another window could finish this model first; keep the final file atomic.
    await fs.rename(tmp,target);
    announce(sender,'ready','Modelo pronto.',100);
    return target;
  }finally{await fs.rm(tmp,{force:true}).catch(()=>{});}
}
async function transcribe(sender,audioId,language,model,resolveFile){
  if(!sender||sender.isDestroyed())throw Error('Janela de controle indisponível.');
  if(running.has(sender.id))throw Error('Uma transcrição já está em andamento.');
  if(!/^[0-9a-f-]{36}$/i.test(String(audioId||'')))throw Error('Selecione uma música importada.');
  if(!LANGUAGES.has(language)||!Object.hasOwn(MODELS,model))throw Error('Idioma ou modelo inválido.');
  const file=resolveFile(audioId);
  if(!file||!FORMATS.has(path.extname(file).toLowerCase())||!await exists(file))
    throw Error('Áudio não encontrado. Importe novamente a música em um formato compatível.');
  const installed=await status();
  if(!installed.installed)throw Error(installed.message);
  const job={controller:new AbortController(),child:null};
  running.set(sender.id,job);
  const temp=path.join(os.tmpdir(),'nosso-culto-transcribe-'+randomUUID());
  try{
    await fs.mkdir(temp,{recursive:true});
    const weights=await ensureModel(model,job,sender);
    const {whisper,ffmpeg}=binaries();
    const wav=path.join(temp,'audio.wav'),out=path.join(temp,'lyrics');
    announce(sender,'convert','Preparando o áudio para reconhecimento…');
    await runProcess(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-i',file,'-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',wav],job);
    announce(sender,'transcribe','Reconhecendo a voz localmente. Pode levar alguns minutos…');
    const args=['-m',weights,'-f',wav,'-l',language,
      '-t',String(Math.max(2,Math.min(8,os.cpus().length-1))),
      '-ml','75','-sow','-olrc','-of',out,'-ng'];
    await runProcess(whisper,args,job,{cwd:path.dirname(whisper)});
    const lrc=await fs.readFile(out+'.lrc','utf8');
    const result=cuesFromLrc(lrc);
    announce(sender,'complete','Letra e tempos prontos.',100);
    return {...result,duration:0};
  }catch(err){
    if(job.controller.signal.aborted)throw Error('Transcrição cancelada.');
    throw err;
  }finally{
    running.delete(sender.id);
    await fs.rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(()=>{});
  }
}
function cancel(sender){
  const job=running.get(sender.id);
  if(!job)return false;
  job.controller.abort();
  if(job.child)job.child.kill();
  return true;
}
module.exports={status,transcribe,cancel};