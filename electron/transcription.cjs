'use strict';
// This code runs only in Electron's trusted main process; the secret is never
// made available to React, the page, IPC responses, or browser storage.
const {app,safeStorage} = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {cuesFromResult}=require('./transcription-utils.cjs');
const AUDIO_FORMATS=new Set(['.mp3','.wav','.flac','.m4a','.ogg']);
const MAX_API_BYTES=25*1024*1024; // OpenAI transcription endpoint limit
const SECRET_NAME='transcription-key.bin';
const secretsPath=()=>path.join(app.getPath('userData'),SECRET_NAME);
const inProgress=new Map();
function keyStatus(){
 let saved=false;
 try{saved=fs.existsSync(secretsPath())&&Boolean(getStoredKey());}catch{}
 return {configured:Boolean(process.env.OPENAI_API_KEY||saved),stored:saved,supported:safeStorage.isEncryptionAvailable()};
}
function getStoredKey(){
 if(!safeStorage.isEncryptionAvailable())return null;
 const f=secretsPath();
 if(!fs.existsSync(f))return null;
 return safeStorage.decryptString(fs.readFileSync(f));
}
function getKey(){
 // An environment key is useful in development and never written to disk.
 return process.env.OPENAI_API_KEY||getStoredKey();
}
function saveKey(key){
 if(!safeStorage.isEncryptionAvailable())throw Error('Armazenamento criptografado indisponível. Use a variável OPENAI_API_KEY no sistema.');
 if(typeof key!=='string'||!/^sk-[a-zA-Z0-9_-]{15,}$/.test(key.trim()))throw Error('Digite uma chave de API OpenAI válida.');
 const sealed=safeStorage.encryptString(key.trim());
 fs.mkdirSync(app.getPath('userData'),{recursive:true});
 fs.writeFileSync(secretsPath(),sealed,{mode:0o600,flag:'w'});
 return keyStatus();
}
function deleteKey(){
 try{fs.rmSync(secretsPath(),{force:true});}catch{}
 return keyStatus();
}
async function transcribe(sender,audioId,language,resolveFile){
 if(!sender||sender.isDestroyed())throw Error('Janela de controle indisponível.');
 if(inProgress.has(sender.id))throw Error('Uma transcrição já está em andamento nesta janela.');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(audioId||'')))throw Error('Selecione uma música importada.');
 const file=resolveFile(audioId);
 if(!file)throw Error('O áudio importado não foi encontrado neste computador.');
 const ext=path.extname(file).toLowerCase();
 if(!AUDIO_FORMATS.has(ext))throw Error('Para transcrever, importe MP3, WAV, FLAC, M4A ou OGG. AAC/OPUS precisam ser convertidos antes.');
 const stat=await fs.promises.stat(file);
 if(stat.size===0||stat.size>MAX_API_BYTES)throw Error('A transcrição aceita arquivos de até 25 MB. Comprima ou divida o áudio antes de transcrever.');
 const key=getKey();
 if(!key)throw Error('Configure sua chave da API OpenAI antes de transcrever.');
 const abort=new AbortController();
 inProgress.set(sender.id,abort);
 const timeout=setTimeout(()=>abort.abort(new Error('Tempo limite da transcrição. Tente novamente.')),180000);
 try{
   const blob=new Blob([await fs.promises.readFile(file)],{type:({
     '.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4',
     '.flac':'audio/flac','.ogg':'audio/ogg'
   })[ext]});
   const form=new FormData();
   form.append('file',blob,'musica'+ext);
   form.append('model','whisper-1');
   form.append('response_format','verbose_json');
   form.append('timestamp_granularities[]','word');
   if(language==='pt'||language==='en'||language==='es')form.append('language',language);
   const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
     method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:abort.signal
   });
   if(!response.ok){
     if(response.status===401)throw Error('Chave da OpenAI inválida ou revogada (401).');
     if(response.status===429)throw Error('Limite de uso ou créditos insuficientes na API OpenAI (429).');
     if(response.status===413)throw Error('Áudio grande demais para a API (413).');
     if(response.status===400)throw Error('O formato do áudio foi rejeitado (400). Converta para MP3 e tente novamente.');
     throw Error('Serviço de transcrição indisponível (HTTP '+response.status+').');
   }
   const result=await response.json();
   return cuesFromResult(result);
 }catch(error){
   if(abort.signal.aborted)throw Error('Transcrição cancelada ou tempo limite excedido.');
   if(error instanceof TypeError)throw Error('Sem conexão com a API de transcrição. Verifique a internet.');
   throw error;
 }finally{
   clearTimeout(timeout);
   inProgress.delete(sender.id);
 }
}
function cancel(sender){const controller=inProgress.get(sender.id);if(controller)controller.abort();return Boolean(controller);}
module.exports={keyStatus,saveKey,deleteKey,transcribe,cancel};
