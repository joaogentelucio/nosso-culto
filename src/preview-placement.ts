// Output positions are percentages, independent from monitor resolution.
// The nine snap targets are the centers of a 3-by-3 alignment grid.
export type PreviewPosition={x:number;y:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function clampPosition(pos:PreviewPosition):PreviewPosition{
 return {x:clamp(Number.isFinite(pos.x)?pos.x:50,0,100),
   y:clamp(Number.isFinite(pos.y)?pos.y:50,0,100)};
}
export function computePreviewPosition(candidate:PreviewPosition,free:boolean):PreviewPosition{
 const point=clampPosition(candidate);
 if(free)return {x:+point.x.toFixed(3),y:+point.y.toFixed(3)};
 const zone=(n:number)=>(Math.min(2,Math.floor(n/100*3))+.5)*100/3;
 return {x:+zone(point.x).toFixed(3),y:+zone(point.y).toFixed(3)};
}
