// Shared browser version of the transcript-assisted alignment algorithm.
// Keeps existing lyrics unchanged; rejects uncertain timing instead of
// inventing timestamps. Based on locally recognized Whisper segments.
import type {MusicCue} from './music';
const words=(text:string)=>
 (text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[]);
function verses(text:string):string[]{
 const clean=text.replace(/\r/g,'').trim();
 if(!clean)return [];
 const paragraphs=clean.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 if(paragraphs.length>1)return paragraphs;
 const lines=clean.split('\n').map(x=>x.trim()).filter(Boolean);
 if(lines.length<=2)return [lines.join('\n')];
 const result:string[]=[];
 for(let i=0;i<lines.length;i+=2)result.push(lines.slice(i,i+2).join('\n'));
 return result;
}
function similarity(a:string,b:string){
 if(a===b)return 4;
 if(a.length>4&&b.length>4&&Math.abs(a.length-b.length)<=1){
   let i=0,j=0,edits=0;
   while(i<a.length&&j<b.length){
     if(a[i]===b[j]){i++;j++;continue;}
     if(++edits>1)return -2;
     if(a.length>b.length)i++;
     else if(b.length>a.length)j++;
     else{i++;j++;}
   }
   if(edits+a.length-i+b.length-j<=1)return 1.5;
 }
 return -2;
}
export function alignWebLyrics(reference:string,recognized:MusicCue[]):MusicCue[]{
 const blocks=verses(reference);
 if(!blocks.length)throw Error('Adicione a letra para sincronizar.');
 const target:{word:string;index:number}[]=[];
 blocks.forEach((part,index)=>words(part).forEach(word=>target.push({word,index})));
 if(target.length>3200)throw Error('A letra é muito longa para sincronização automática.');
 const acoustic:{word:string;time:number}[]=[];
 for(let i=0;i<recognized.length;i++){
   const cue=recognized[i];
   if(!Number.isFinite(cue.time))continue;
   const parts=words(cue.text);
   const next=recognized[i+1]?.time;
   const span=Math.max(1.5,Math.min(10,Number.isFinite(next)?next-cue.time:4));
   parts.forEach((word,j)=>acoustic.push({word,time:cue.time+span*j/parts.length}));
 }
 if(!acoustic.length)throw Error('Não foi possível identificar palavras na música.');
 if(acoustic.length>3200)throw Error('A gravação é muito longa para sincronização automática.');
 const n=target.length,m=acoustic.length,gap=-0.85;
 const directions=new Uint8Array((n+1)*(m+1));
 let prev=new Float32Array(m+1),curr=new Float32Array(m+1);
 for(let j=1;j<=m;j++)prev[j]=prev[j-1]+gap;
 for(let i=1;i<=n;i++){
   curr[0]=prev[0]+gap;
   for(let j=1;j<=m;j++){
     const up=prev[j]+gap,left=curr[j-1]+gap;
     const diag=prev[j-1]+similarity(target[i-1].word,acoustic[j-1].word);
     const at=i*(m+1)+j;
     if(diag>=up&&diag>=left){curr[j]=diag;directions[at]=1;}
     else if(up>=left){curr[j]=up;directions[at]=2;}
     else{curr[j]=left;directions[at]=3;}
   }
   [prev,curr]=[curr,prev];
 }
 const matching:number[][]=blocks.map(()=>[]);
 let i=n,j=m,count=0;
 while(i>0&&j>0){
   const direction=directions[i*(m+1)+j];
   if(direction===1){
     if(similarity(target[i-1].word,acoustic[j-1].word)>0){
       matching[target[i-1].index].push(acoustic[j-1].time);count++;
     }
     i--;j--;
   }else if(direction===2)i--;
   else j--;
 }
 if(count/Math.max(n,1)<0.30||matching.some(xs=>xs.length===0))
   throw Error('Não foi possível sincronizar todos os versos com segurança. Confira a letra ou ajuste os tempos manualmente.');
 const cues=blocks.map((text,index)=>({
   time:Math.round(Math.min(...matching[index])*100)/100,text
 }));
 if(cues.some((cue,index)=>index>0&&cue.time<=cues[index-1].time))
   throw Error('A ordem dos versos não corresponde à gravação. Confira a letra antes de sincronizar.');
 return cues;
}
