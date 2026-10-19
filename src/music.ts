export type MusicCue = {time:number;text:string};
export type MusicItem = {
 id:string;title:string;type:'music'|'text';content:string;
 audioId?:string;duration?:number;sourceName?:string;cues?:MusicCue[];timingSource?:'lrc'|'estimated'|'manual'|'transcribed';
};
export function linesForSlides(content:string):string[]{
 const normalized=content.replace(/\r\n/g,'\n').trim();
 if(!normalized)return [];
 const sections=normalized.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 if(sections.length>1)return sections;
 const lines=normalized.split('\n').map(x=>x.trim()).filter(Boolean);
 const parts:string[]=[];
 for(let i=0;i<lines.length;i+=2)parts.push(lines.slice(i,i+2).join('\n'));
 return parts;
}
export function distributeLyrics(content:string,duration:number):MusicCue[]{
 const slides=linesForSlides(content);
 if(!slides.length)return [];
 // An estimate, not speech recognition: reserve 4% as intro and 4% as outro.
 const length=Number.isFinite(duration)&&duration>0?duration:slides.length*8;
 const start=Math.min(5,length*.04),span=Math.max(0,length-start-Math.min(5,length*.04));
 return slides.map((text,i)=>({time:Math.round((start+span*i/slides.length)*10)/10,text}));
}
export function normalizeCues(cues:MusicCue[]):MusicCue[]{
 return cues.filter(x=>Number.isFinite(x.time)&&x.time>=0&&x.text.trim())
   .map(x=>({time:Math.round(x.time*100)/100,text:x.text.trim()}))
   .sort((a,b)=>a.time-b.time);
}
export function timeCode(seconds:number):string {
 const s=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
export function cueAtTime(cues:MusicCue[],time:number):number {
 let answer=-1;
 for(let i=0;i<cues.length;i++)if(cues[i].time<=time+0.02)answer=i;else break;
 return answer;
}
export function audioUrl(item:MusicItem):string|undefined {
 return item.audioId?'culto-media://asset/'+item.audioId:undefined;
}
