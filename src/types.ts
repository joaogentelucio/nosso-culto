export type ContentType = 'music' | 'text';
export type LibraryItem = {id:string; title:string; type:ContentType; content:string};
export type Slide = {id:string; title:string; body:string};
export type Theme = 'dark' | 'blue' | 'warm';
export const slidesFor = (item:LibraryItem):Slide[] => item.content.split(/\n\s*\n/g).map((body,i) => ({id:item.id+':'+i,title:item.title,body:body.trim()})).filter(s=>s.body.length>0);
