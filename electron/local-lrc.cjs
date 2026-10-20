'use strict';
function cuesFromLrc(raw) {
  if(typeof raw!=='string')throw Error('Resultado da transcrição inválido.');
  const cues=[];
  for(const line of raw.replace(/\r/g,'').split('\n')){
    const match=line.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if(!match)continue;
    const minutes=Number(match[1]),seconds=Number(match[2]);
    if(seconds>=60)continue;
    const decimals=match[3]?Number('0.'+match[3]):0;
    const time=minutes*60+seconds+decimals;
    const text=match[4].replace(/\s+/g,' ').trim();
    if(text&&Number.isFinite(time)&&time>=0)cues.push({time:Math.round(time*100)/100,text});
    if(cues.length>=2000)break;
  }
  cues.sort((a,b)=>a.time-b.time);
  if(!cues.length)throw Error('Nenhuma voz reconhecida. Verifique se a música tem voz e tente outro modelo.');
  return {cues,content:cues.map(c=>c.text).join('\n\n')};
}
module.exports={cuesFromLrc};