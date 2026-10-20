'use strict';
// Align pre-supplied lyrics to locally recognized Whisper segments.
// This is acoustic transcript-assisted alignment, NOT a separately fine-tuned
// forced-alignment model. Never invent evenly spaced cues on poor matches.
function tokens(text){
  return (String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().match(/[a-z0-9]+/g)||[]);
}
function slidesFromLyrics(text){
  const clean=String(text).replace(/\r/g,'').trim();
  if(!clean)return [];
  const chunks=clean.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  if(chunks.length>1)return chunks;
  const lines=clean.split('\n').map(s=>s.trim()).filter(Boolean);
  if(lines.length<=2)return [lines.join('\n')];
  const result=[];
  for(let i=0;i<lines.length;i+=2)result.push(lines.slice(i,i+2).join('\n'));
  return result;
}
function wordSimilarity(a,b){
  if(a===b)return 4;
  if(a.length>4&&b.length>4&&Math.abs(a.length-b.length)<=1){
    // Only one typo / syllable difference, no broad phonetic guessing.
    let i=0,j=0,edits=0;
    while(i<a.length&&j<b.length){
      if(a[i]===b[j]){i++;j++;continue;}
      if(++edits>1)return -2;
      if(a.length>b.length)i++;
      else if(b.length>a.length)j++;
      else{i++;j++;}
    }
    if(edits+(a.length-i)+(b.length-j)<=1)return 1.5;
  }
  return -2;
}
function alignLyrics(reference,recognizedCues){
  const slides=slidesFromLyrics(reference);
  if(!slides.length)throw Error('Adicione a letra da música para sincronizar.');
  const words=[];
  slides.forEach((line,index)=>tokens(line).forEach(word=>words.push({word,index})));
  if(words.length>3200)throw Error('Letra muito longa para a sincronização automática.');
  const acoustic=[];
  for(let ci=0;ci<recognizedCues.length;ci++){
    const cue=recognizedCues[ci];
    const cueWords=tokens(cue.text);
    if(!cueWords.length||!Number.isFinite(cue.time))continue;
    const next=recognizedCues[ci+1]?.time;
    const span=Math.min(10,Math.max(1.5,Number.isFinite(next)?next-cue.time:4));
    cueWords.forEach((word,j)=>acoustic.push({
      word,time:cue.time+span*j/cueWords.length
    }));
  }
  if(!acoustic.length)throw Error('Não foi possível identificar palavras cantadas nesta gravação.');
  if(acoustic.length>3200)throw Error('Áudio muito longo para alinhar automaticamente.');
  const n=words.length,m=acoustic.length;
  const trace=new Uint8Array((n+1)*(m+1));
  const gap=-0.85;
  let previous=new Float32Array(m+1);
  let current=new Float32Array(m+1);
  for(let j=1;j<=m;j++)previous[j]=previous[j-1]+gap;
  for(let i=1;i<=n;i++){
    current[0]=previous[0]+gap;
    const offset=i*(m+1);
    for(let j=1;j<=m;j++){
      const up=previous[j]+gap,left=current[j-1]+gap;
      const diag=previous[j-1]+wordSimilarity(words[i-1].word,acoustic[j-1].word);
      if(diag>=up&&diag>=left){current[j]=diag;trace[offset+j]=1;}
      else if(up>=left){current[j]=up;trace[offset+j]=2;}
      else{current[j]=left;trace[offset+j]=3;}
    }
    [previous,current]=[current,previous];
  }
  const matches=Array.from({length:slides.length},()=>[]);
  let i=n,j=m,matched=0;
  while(i>0&&j>0){
    const dir=trace[i*(m+1)+j];
    if(dir===1){
      if(wordSimilarity(words[i-1].word,acoustic[j-1].word)>0){
        matches[words[i-1].index].push(acoustic[j-1].time);matched++;
      }
      i--;j--;
    }else if(dir===2)i--;else j--;
  }
  const ratio=matched/Math.max(1,n);
  if(ratio<0.30||matches.some(x=>!x.length)){
    throw Error('Não foi possível localizar todos os versos no áudio com segurança. Confira a letra e marque os tempos manualmente.');
  }
  const cues=slides.map((text,index)=>({
    time:Math.round(Math.min(...matches[index])*100)/100,text
  }));
  // Enforce chronological movement: repeated choruses must not collapse.
  if(cues.some((cue,index)=>index>0&&cue.time<=cues[index-1].time)){
    throw Error('A ordem dos versos não corresponde à música. Confira a letra antes de sincronizar.');
  }
  return {content:reference.trim(),cues,matchedRatio:Math.round(ratio*100)/100};
}
module.exports={alignLyrics,slidesFromLyrics};
