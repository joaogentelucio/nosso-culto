'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {groupedWords,cuesFromResult}=require('../electron/transcription-utils.cjs');

test('agrupar palavras com instante original e respeitar pausa entre frases',()=>{
 const result=groupedWords([
  {start:0.5,end:0.8,word:'Deus'},
  {start:0.8,end:1.15,word:'é'},
  {start:1.15,end:1.6,word:'bom.'},
  {start:3.1,end:3.4,word:'Sempre'},
  {start:3.4,end:3.8,word:'fiel.'}
 ]);
 assert.deepEqual(result,[
  {time:0.5,text:'Deus é bom.'},
  {time:3.1,text:'Sempre fiel.'}
 ]);
});
test('segmentos são utilizados quando palavras não vieram no retorno',()=>{
 const output=cuesFromResult({language:'portuguese',duration:11,segments:[
  {start:6.2,end:8,text:' Senhor me guia '},
  {start:1.5,end:3,text:' Eu confio em ti '}
 ]});
 assert.deepEqual(output.cues,[
  {time:1.5,text:'Eu confio em ti'},
  {time:6.2,text:'Senhor me guia'}
 ]);
 assert.equal(output.content,'Eu confio em ti\n\nSenhor me guia');
 assert.equal(output.duration,11);
});
test('transcrição sem voz reconhecível não inventa letra',()=>{
 assert.throws(()=>cuesFromResult({text:'',segments:[],words:[]}),/não encontrou voz/);
});
test('segurança: ignorar horários inválidos e texto vazio',()=>{
 assert.deepEqual(groupedWords([
  {word:'',start:0,end:1},
  {word:'inválida',start:-1,end:2},
  {word:'Graça',start:4.123,end:4.5},
  {word:'salvou.',start:4.6,end:5.1}
 ]),[{time:4.12,text:'Graça salvou.'}]);
});
