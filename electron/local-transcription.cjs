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
   return [
     {exe:'py',args:['-3']},
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
async function locatePython(){
 for(const candidate of pythonCandidates()){
   try{
     const v=await run(candidate.exe,[...candidate.args,'-c','import sys;print(sys.version_info.major,sys.version_info.minor)']);
     const match=String(v).trim().match(/^3\s+(\d+)/);
     if(match&&Number(match[1])>=9)return candidate;
   }catch{}
 }
 return null;
}
async function status(){
 const python=await locatePython();
 if(!python)return {
   installed:false,python:false,
   message:'Python 3.9 ou superior não foi encontrado. Instale Python para Windows e reinicie o Nosso Culto.'
 };
 try{
   await run(python.exe,[...python.args,'-c','import faster_whisper;print("ok")'],{timeout:15000});
   return {installed:true,python:true,message:'Motor gratuito pronto para transcrever neste computador.'};
 }catch{
   return {
     installed:false,python:true,
     message:'O motor gratuito ainda não foi instalado. Execute no PowerShell: '+
       (process.platform==='win32'?'py -3 -m pip install faster-whisper':'python3 -m pip install faster-whisper')
   };
 }
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
 const python=await locatePython();
 if(!python)throw Error('Python 3.9+ não está instalado. Instale Python e reinicie o aplicativo.');
 const st=await status();
 if(!st.installed)throw Error(st.message);
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
