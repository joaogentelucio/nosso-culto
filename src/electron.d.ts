import type {MonitorConfiguration} from './preferences';
export {};
type Slide={title:string;body:string;imageId?:string;layers?:{id:string;kind:'text'|'image';text?:string;imageId?:string;position?:{x:number;y:number};locked?:boolean}[]};
type ProjectionState={slide:Slide|null;hidden:boolean;theme:'dark'|'blue'|'warm'};
type StoredItem={id:string;title:string;type:'music'|'text';content:string;audioId?:string;duration?:number;sourceName?:string;cues?:{time:number;text:string}[]};
type StoredScene={id:string;name:string;items:{id:string;type:'music'|'text'|'bible'|'image';title:string;libraryId?:string;content?:string;imageId?:string;position?:{x:number;y:number};locked?:boolean}[]};
type StoredData={library:StoredItem[];queue:string[];scenes:StoredScene[]};
type DisplayInfo={id:number;name:string;primary:boolean;width:number;height:number;scaleFactor?:number};
declare global {
 interface Window {
  desktop?:{
   isElectron:true;
   transcriptionApiVersion?:number;
   exitApp:()=>Promise<boolean>;
   getDisplays:()=>Promise<DisplayInfo[]>;
   configureDisplays:(config:MonitorConfiguration)=>Promise<boolean>;
   onDisplaysChanged:(listener:(displays:DisplayInfo[])=>void)=>()=>void;
   openProjection:(config:MonitorConfiguration)=>Promise<boolean>;
   closeProjection:()=>Promise<boolean>;
   onProjectionOutputClosed:(listener:()=>void)=>()=>void;
   getProjectionState:()=>Promise<ProjectionState>;
   updateProjection:(state:ProjectionState)=>void;
   onProjectionChange:(callback:(state:ProjectionState)=>void)=>()=>void;
   importMedia:(kind:'files'|'folder'|'zip')=>Promise<{items:StoredItem[];errors:string[];cancelled:boolean}>;
   importLrc:()=>Promise<{cues:{time:number;text:string}[];content:string}|null>;
   transcriptionStatus:()=>Promise<{configured:boolean;stored:boolean;supported:boolean}>;
   saveTranscriptionKey:(key:string)=>Promise<{configured:boolean;stored:boolean;supported:boolean}>;
   clearTranscriptionKey:()=>Promise<{configured:boolean;stored:boolean;supported:boolean}>;
   transcribeAudio:(audioId:string,language:'auto'|'pt'|'en'|'es')=>Promise<{content:string;cues:{time:number;text:string}[];duration:number;language?:string}>;
   cancelTranscription:()=>Promise<boolean>;
   localTranscriptionStatus:()=>Promise<{installed:boolean;python:boolean;message:string;environment?:'development'|'installed';missing?:string[];engineDirectory?:string;version?:string}>;
   openTranscriptionDownloadPage:()=>Promise<boolean>;
   transcribeLocalAudio:(audioId:string,language:'auto'|'pt'|'en'|'es',model:'tiny'|'base'|'small')=>Promise<{content:string;cues:{time:number;text:string}[];duration:number;language?:string}>;
   cancelLocalTranscription:()=>Promise<boolean>;
   onLocalTranscriptionProgress:(listener:(status:{step:string;detail:string;percentage?:number})=>void)=>()=>void;
   readData:()=>Promise<StoredData|null>;
   saveData:(data:StoredData)=>Promise<boolean>;
   exportData:(data:StoredData)=>Promise<boolean>;
   importData:()=>Promise<StoredData|null>;
  }
 }
}
