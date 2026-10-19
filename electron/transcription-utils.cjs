'use strict';
const MAX_CUES=2000;
function cleanText(input){
 return String(input||'').replace(/\s+/g,' ').trim();
}
function validTime(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=43200;}
function groupedWords(words){
 const arr=words.filter(w=>w&&validTime(w.start)&&validTime(w.end)&&typeof w.word==='string'&&cleanText(w.word))
   .sort((a,b)=>a.start-b.start);
 const cues=[];
 let text='',start=0,lastEnd=0,count=0;
 const flush=()=>{
   if(text.trim()&&cues.length<MAX_CUES)cues.push({time:Math.round(start*100)/100,text:cleanText(text)});
   text='';count=0;
 };
 for(const word of arr){
   const segment=cleanText(word.word);
   const gap=count?word.start-lastEnd:0;
   const elapsed=count?word.end-start:0;
   if(count&&(gap>=0.85||elapsed>=5.5||count>=9||text.length+segment.length>75))flush();
   if(!count)start=word.start;
   text+=(text?' ':'')+segment;
   count++;
   lastEnd=Math.max(word.end,word.start);
   if(/[.!?]$/.test(segment)&&count>=3)flush();
 }
 flush();
 return cues;
}
function cuesFromResult(json){
 if(!json||typeof json!=='object')throw Error('Resposta da transcrição inválida.');
 let cues=Array.isArray(json.words)?groupedWords(json.words):[];
 if(!cues.length&&Array.isArray(json.segments)){
   cues=json.segments.filter(s=>s&&validTime(s.start)&&typeof s.text==='string'&&cleanText(s.text))
     .sort((a,b)=>a.start-b.start).slice(0,MAX_CUES)
     .map(s=>({time:Math.round(s.start*100)/100,text:cleanText(s.text)}));
 }
 if(!cues.length){
   const plain=cleanText(json.text);
   if(plain)cues=[{time:0,text:plain}];
 }
 if(!cues.length)throw Error('A IA não encontrou voz ou letra reconhecível neste áudio.');
 return {
   cues,
   content:cues.map(x=>x.text).join('\n\n').slice(0,250000),
   duration:validTime(json.duration)?json.duration:0,
   language:typeof json.language==='string'?json.language.slice(0,20):undefined
 };
}
module.exports={groupedWords,cuesFromResult};
