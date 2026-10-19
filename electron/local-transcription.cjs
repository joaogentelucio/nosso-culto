'use strict';
// Free offline recognition via faster-whisper + CTranslate2 on Windows CPU.
// Python and faster-whisper are prerequisites. No API key and no cloud upload.
const {app}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {cuesFromResult}=require('./transcription-utils.cjs');

const MODELS=new Set(['tiny','base','small']);
const LANGUAGES=new Set(['auto','pt','en','es']);
const AUDIO_FORMATS=new Set(['.mp3','.wav','.flac','.m4a','.aac','.ogg','.opus']);
const jobs=new Map();

function pythonCandidates(){
 if(process.platform==='win32'){
   // Never let 'py -3' pick the newest installed Python (e.g. 3.15),
   // which lacks binary wheels for faster-whisper's PyAV dependencies.
   return [
     {exe:'py',args:['-3.12']},
     {exe:'py',args:['-3.11']},
     {exe:'py',args:['-3.13']},
     {exe:'py',args:['-3.10']},
     {exe:'py',args:['-3.9']},
     {exe:'python',args:[]},
   ];
 }
 return [{exe:'python3',args:[]},{exe:'python',args:[]}];
}
function run(exe,args,{timeout=9000}={}){
 return new Promise((resolve,reject)=>{
   let done=false;
   let stdout='',stderr='';
   const child=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
   const timer=setTimeout(()=>{child.kill();finish(new Error('Tempo esgotado ao verificar Python.'));},timeout);
   const finish=(err,result)=>{
     if(done)return;
     done=true;clearTimeout(timer);
     if(err)reject(err);else resolve(result);
   };
   child.stdout.on('data',part=>{stdout+=(String(part)).slice(0,10000);});
   child.stderr.on('data',part=>{stderr+=(String(part)).slice(0,10000);});
   child.on('error',finish);
   child.on('close',code=>finish(code===0?null:new Error(stderr||'Python não encontrado.'),stdout));
 });
}
async function locatePython(requireWhisper=false){
 for(const candidate of pythonCandidates()){
   try{
     const v=await run(candidate.exe,[...candidate.args,'-c',
       'import sys;print(sys.version_info.major,sys.version_info.minor)']);
     const match=String(v).trim().match(/^3\s+(\d+)/);
     if(!match)continue;
     const minor=Number(match[1]);
     // Supported Python wheels; exclude newer experimental interpreters.
     if(minor<9||minor>13)continue;
     if(requireWhisper){
       try{
         await run(candidate.exe,[...candidate.args,'-c',
           'import faster_whisper;print("ok")'],{timeout:30000});
       }catch{continue;}
     }
     return candidate;
   }catch{}
 }
 return null;
}
async function status(){
 const python=await locatePython();
 if(!python)return {
   installed:false,python:false,
   message:'Nenhum Python compatível encontrado. O Python 3.15 não possui todas as dependências necessárias. Instale Python 3.12 (64 bits) e execute: py -3.12 -m pip install faster-whisper.'
 };
 const installedPython=await locatePython(true);
 if(installedPython){
   return {installed:true,python:true,message:'Motor gratuito pronto para transcrever neste computador.'};
 }
 const installCommand=process.platform==='win32'
   ?'py '+(python.args[0]||'-3.12')+' -m pip install faster-whisper'
   :'python3 -m pip install faster-whisper';
 return {
   installed:false,python:true,
   message:'O pacote faster-whisper não foi encontrado em um Python compatível. Execute no PowerShell: '+installCommand
 };
}
function scriptPath(){
 const direct=path.join(__dirname,'local-whisper.py');
 // Python cannot open a file inside an Electron ASAR archive.
 return direct.replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
}
async function transcribe(sender,audioId,language,model,resolveFile){
 if(!sender||sender.isDestroyed())throw Error('Janela indisponível.');
 if(jobs.has(sender.id))throw Error('Já existe uma transcrição local em andamento.');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(audioId||'')))throw Error('Música importada inválida.');
 if(!LANGUAGES.has(language))throw Error('Idioma inválido.');
 if(!MODELS.has(model))throw Error('Selecione um modelo local válido.');
 const file=resolveFile(audioId);
 if(!file||!fs.existsSync(file))throw Error('Arquivo de áudio indisponível. Importe-o novamente.');
 if(!AUDIO_FORMATS.has(path.extname(file).toLowerCase()))throw Error('Formato de áudio não suportado.');
 const python=await locatePython(true);
 if(!python){
   const st=await status();
   throw Error(st.message);
 }
 const script=scriptPath();
 if(!fs.existsSync(script))throw Error('Motor local não encontrado na instalação do Nosso Culto. Atualize o programa.');
 const modelCache=path.join(app.getPath('userData'),'whisper-models');
 fs.mkdirSync(modelCache,{recursive:true});
 return new Promise((resolve,reject)=>{
   const child=spawn(python.exe,[...python.args,script,file,language,model,modelCache,'0'],{
     windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false
   });
   jobs.set(sender.id,child);
   let output='',errors='',canceled=false,settled=false;
   const finish=(err,res)=>{
     if(settled)return;
     settled=true;
     jobs.delete(sender.id);
     if(err)reject(err);else resolve(res);
   };
   const maxStdout=10*1024*1024;
   child.stdout.on('data',part=>{
     if(output.length+part.length>maxStdout){canceled=true;child.kill();return;}
     output+=String(part);
   });
   child.stderr.on('data',part=>{errors=(errors+String(part)).slice(-3000);});
   child.on('error',err=>finish(Error('Não foi possível iniciar o motor local: '+err.message)));
   child.on('close',code=>{
     if(settled)return;
     if(canceled)return finish(Error('Transcrição cancelada ou saída muito grande.'));
     if(code!==0)return finish(Error('Falha ao transcrever localmente: '+(errors.trim()||'erro '+code)));
     try{finish(null,cuesFromResult(JSON.parse(output)));}
     catch(err){finish(err);}
   });
   // Store marker on the process itself so cancellation is distinguished from crashes.
   child.once('exit',()=>{if(child._localCanceled)canceled=true;});
 });
}
function cancel(sender){
 const child=jobs.get(sender.id);
 if(!child)return false;
 child._localCanceled=true;
 child.kill();
 return true;
}
module.exports={status,transcribe,cancel};
