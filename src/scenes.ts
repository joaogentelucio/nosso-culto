import type {MusicItem} from './music';
export type SceneItemType = 'music' | 'text' | 'bible' | 'image';
export type SceneItem = {
  id:string;
  type:SceneItemType;
  title:string;
  libraryId?:string;
  content?:string;
  imageId?:string;
  visible?:boolean;
  locked?:boolean;
};
export type Scene = {id:string;name:string;items:SceneItem[];locked?:boolean};
export type SavedProject = {library:MusicItem[];queue:string[];scenes:Scene[]};
export const makeId = () => crypto.randomUUID();
export function initialScenes(library:MusicItem[],queue:string[]):Scene[]{
  const starter:Scene={id:makeId(),name:'Louvor',items:[
    {id:makeId(),title:'Música',type:'music'}
  ]};
  // Migrate the old order-of-service list instead of discarding the user's data.
  const legacy=queue.map(id=>library.find(item=>item.id===id)).filter((v):v is MusicItem=>Boolean(v));
  if(!legacy.length)return [starter];
  const older:Scene={id:makeId(),name:'Programação anterior',items:legacy.map(entry=>({
    id:makeId(),type:entry.type,title:entry.title,libraryId:entry.id
  }))};
  return [starter,older];
}
export function sceneItemTitle(type:SceneItemType):string {
  return type==='music'?'Música':type==='bible'?'Bíblia':type==='image'?'Imagem':'Texto';
}
export function sceneItemSummary(item:SceneItem,library:MusicItem[]):string{
  if(item.libraryId){
    const chosen=library.find(v=>v.id===item.libraryId);
    if(chosen)return chosen.title;
  }
  return item.type==='image'?(item.imageId?'Imagem pronta':'Adicione uma imagem'):(item.content?.trim() ? 'Conteúdo configurado' : 'Clique para configurar');
}
