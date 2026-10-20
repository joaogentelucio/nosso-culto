// Pure timing/quality rules shared by the Web Whisper worker and UI.
export type TimedWord={start:number;end:number;text:string};
export type TimedVerse={time:number;text:string};

export function assembleTimedVerses(words:TimedWord[],lengthSeconds:number):TimedVerse[]{
 const valid=words.filter(w=>
   Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=0&&
   w.end>w.start&&w.end<=lengthSeconds+0.5&&
   w.text.trim().length>0&&w.text.length<160
 ).sort((a,b)=>a.start-b.start);
 const minValid=Math.max(1,Math.ceil(words.length*0.60));
 if(valid.length<minValid)throw Error('Os tempos retornados pelo reconhecimento não são confiáveis. Nenhuma letra foi substituída.');
 const verses:TimedVerse[]=[];
 let beginning=0,lastEnd=0,buffer:string[]=[],first=0;
 const flush=()=>{
   if(!buffer.length)return;
   const text=buffer.join(' ').replace(/\s+([,.;!?])/g,'$1').trim();
   if(text)verses.push({time:Math.round(first*100)/100,text});
   buffer=[];beginning=0;lastEnd=0;
 };
 for(const word of valid){
   // A new phrase begins after a substantial pause or a long subtitle.
   if(buffer.length&&(word.start-lastEnd>1.1||buffer.length>=8||
     word.end-beginning>=7.5))flush();
   if(!buffer.length){first=word.start;beginning=word.start;}
   buffer.push(word.text.trim());lastEnd=word.end;
   if(/[.!?]$/.test(word.text.trim())&&buffer.length>=3)flush();
 }
 flush();
 if(!verses.length)throw Error('Nenhum verso com início confiável foi encontrado.');
 const result:TimedVerse[]=[];
 for(const verse of verses){
   const previous=result[result.length-1];
   if(previous&&verse.time<=previous.time+0.04){
     throw Error('A transcrição retornou marcações de tempo repetidas. Nenhuma letra foi substituída.');
   }
   result.push(verse);
 }
 return result;
}

export function validateRecognizedCues(cues:TimedVerse[],lengthSeconds:number):TimedVerse[]{
 if(!cues.length)throw Error('Não foi possível reconhecer a letra desta gravação.');
 if(!Number.isFinite(lengthSeconds)||lengthSeconds<=0)throw Error('Duração do áudio inválida.');
 let previous=-1,totalWords=0;
 const consecutiveRepeats=new Map<string,number>();
 let repeated=0;
 for(const cue of cues){
   const text=cue.text?.trim()??'';
   if(!Number.isFinite(cue.time)||cue.time<0||cue.time>=lengthSeconds||cue.time<=previous+0.04||!text)
     throw Error('Foram encontrados versos fora de ordem ou sem tempos válidos. Nenhuma letra foi substituída.');
   previous=cue.time;
   totalWords+=text.split(/\s+/).length;
   const normalized=text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
   const repetitions=consecutiveRepeats.get(normalized)??0;
   if(repetitions)repeated++;
   consecutiveRepeats.clear();
   consecutiveRepeats.set(normalized,repetitions+1);
 }
 // This signals extreme hallucinations, not ordinary repeated choruses.
 if(cues.length>=8&&repeated/cues.length>0.65)
   throw Error('O reconhecimento repetiu muitos versos possivelmente incorretos. Importe a letra correta e tente sincronizar.');
 if(lengthSeconds>90&&totalWords<8)
   throw Error('O reconhecimento identificou poucas palavras para sincronizar esta música.');
 return cues;
}
