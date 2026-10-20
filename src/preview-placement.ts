// Coordinates are percentages of the output frame, independent of resolution.
// Without Shift, positions move smoothly but magnetically align near the 3x3
// grid and its centers. With Shift there is no magnetic alignment.
export type PreviewPosition={x:number;y:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*1000)/1000;
export function clampPosition(pos:PreviewPosition):PreviewPosition{
 return {x:clamp(Number.isFinite(pos.x)?pos.x:50,0,100),
   y:clamp(Number.isFinite(pos.y)?pos.y:50,0,100)};
}
const guides=[100/6,100/3,50,200/3,500/6];
function magnet(value:number):number{
 const tolerance=3.5; // % of frame (about 8px at 240px preview width)
 let best=value;
 let distance=tolerance;
 for(const guide of guides){
   const delta=Math.abs(value-guide);
   if(delta<distance){best=guide;distance=delta;}
 }
 return round(best);
}
export function computePreviewPosition(candidate:PreviewPosition,free:boolean):PreviewPosition{
 const point=clampPosition(candidate);
 if(free)return {x:round(point.x),y:round(point.y)};
 return {x:magnet(point.x),y:magnet(point.y)};
}
