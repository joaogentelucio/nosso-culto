export {};
type Slide={title:string;body:string};
type ProjectionState={slide:Slide|null;hidden:boolean;theme:'dark'|'blue'|'warm'};
type StoredItem={id:string;title:string;type:'music'|'text';content:string};
type StoredData={library:StoredItem[];queue:string[]};
type DisplayInfo={id:number;name:string;primary:boolean;width:number;height:number};
declare global {
 interface Window {
  desktop?:{
   isElectron:true;
   exitApp:()=>Promise<boolean>;
   getDisplays:()=>Promise<DisplayInfo[]>;
   openProjection:(displayId?:number)=>Promise<boolean>;
   closeProjection:()=>Promise<boolean>;
   getProjectionState:()=>Promise<ProjectionState>;
   updateProjection:(state:ProjectionState)=>void;
   onProjectionChange:(callback:(state:ProjectionState)=>void)=>()=>void;
   readData:()=>Promise<StoredData|null>;
   saveData:(data:StoredData)=>Promise<boolean>;
   exportData:(data:StoredData)=>Promise<boolean>;
   importData:()=>Promise<StoredData|null>;
  }
 }
}
