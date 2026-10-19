import AsyncStorage from '@react-native-async-storage/async-storage';
import type {LibraryItem} from './types';
export const initialItems:LibraryItem[] = [
{id:'sample1',title:'Boas-vindas',type:'text',content:'Sejam todos bem-vindos!\n\nQue este culto seja uma bênção.'},
{id:'sample2',title:'Momento de oração',type:'text',content:'Vamos nos unir em oração.\n\nEntregue suas preocupações a Deus.'},
];
const libraryKey='nosso-culto/library/v2';
const queueKey='nosso-culto/queue/v2';
export async function restore():Promise<{library:LibraryItem[];queue:string[]}>{const [a,b]=await Promise.all([AsyncStorage.getItem(libraryKey),AsyncStorage.getItem(queueKey)]);try {return {library:a?JSON.parse(a):initialItems,queue:b?JSON.parse(b):[]};}catch{return {library:initialItems,queue:[]};}}
export async function persist(library:LibraryItem[],queue:string[]){await AsyncStorage.multiSet([[libraryKey,JSON.stringify(library)],[queueKey,JSON.stringify(queue)]]);}
