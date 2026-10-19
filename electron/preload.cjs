'use strict';
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  transcriptionApiVersion: 2,
  exitApp: () => ipcRenderer.invoke('app:quit'),
  getDisplays: () => ipcRenderer.invoke('displays:list'),
  configureDisplays: (config) => ipcRenderer.invoke('displays:configure', config),
  onDisplaysChanged: (listener) => {
    const handler = (_event, data) => listener(data);
    ipcRenderer.on('displays:changed', handler);
    return () => ipcRenderer.removeListener('displays:changed', handler);
  },
  openProjection: (config) => ipcRenderer.invoke('projection:open', config),
  closeProjection: () => ipcRenderer.invoke('projection:close'),
  getProjectionState: () => ipcRenderer.invoke('projection:get'),
  updateProjection: (state) => ipcRenderer.send('projection:update', state),
  onProjectionChange: (listener) => {
    const handler = (_event, data) => listener(data);
    ipcRenderer.on('projection:state', handler);
    return () => ipcRenderer.removeListener('projection:state', handler);
  },
  importMedia: (kind) => ipcRenderer.invoke('media:import',kind),
  importLrc: () => ipcRenderer.invoke('media:import-lrc'),
  transcriptionStatus: () => ipcRenderer.invoke('transcription:status'),
  saveTranscriptionKey: (key) => ipcRenderer.invoke('transcription:save-key',key),
  clearTranscriptionKey: () => ipcRenderer.invoke('transcription:clear-key'),
  transcribeAudio: (audioId,language) => ipcRenderer.invoke('transcription:run',audioId,language),
  cancelTranscription: () => ipcRenderer.invoke('transcription:cancel'),
  localTranscriptionStatus: () => ipcRenderer.invoke('transcription:local-status'),
  transcribeLocalAudio: (audioId,language,model) => ipcRenderer.invoke('transcription:local-run',audioId,language,model),
  cancelLocalTranscription: () => ipcRenderer.invoke('transcription:local-cancel'),
  readData: () => ipcRenderer.invoke('data:read'),
  saveData: (data) => ipcRenderer.invoke('data:write', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
});
