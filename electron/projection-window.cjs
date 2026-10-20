'use strict';
// Native window coordinates are device-independent pixels (DIPs), unlike a
// monitor's pixel resolution. Always create a draggable Windows window first.
function windowBounds(display,resolution){
 if(!display||!display.bounds)throw Error('Monitor de projeção indisponível.');
 const bounds=display.bounds;
 const area=display.workArea||bounds;
 let width,height;
 if(resolution==='native'){
   width=Math.max(Math.min(area.width,640),Math.floor(area.width*.90));
   height=Math.max(Math.min(area.height,420),Math.floor(area.height*.88));
 }else{
   if(!/^\d{3,4}x\d{3,4}$/.test(resolution))throw Error('Resolução inválida.');
   const [pxW,pxH]=resolution.split('x').map(Number);
   const scale=display.scaleFactor||1;
   width=Math.round(pxW/scale);height=Math.round(pxH/scale);
   if(width>bounds.width||height>bounds.height)
     throw Error('Resolução maior que o monitor selecionado.');
 }
 return {
   x:area.x+Math.max(0,Math.floor((area.width-width)/2)),
   y:area.y+Math.max(0,Math.floor((area.height-height)/2)),
   width,height
 };
}
module.exports={windowBounds};
