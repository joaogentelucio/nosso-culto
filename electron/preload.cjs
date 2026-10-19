'use strict';
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  exitApp: () => ipcRenderer.invoke('app:quit'),
  getDisplays: () => ipcRenderer.invoke('displays:list'),
  openProjection: (displayId) => ipcRenderer.invoke('projection:open', displayId),
  closeProjection: () => ipcRenderer.invoke('projection:close'),
  getProjectionState: () => ipcRenderer.invoke('projection:get'),
  updateProjection: (state) => ipcRenderer.send('projection:update', state),
  onProjectionChange: (listener) => {
    const handler = (_event, data) => listener(data);
    ipcRenderer.on('projection:state', handler);
    return () => ipcRenderer.removeListener('projection:state', handler);
  },
  readData: () => ipcRenderer.invoke('data:read'),
  saveData: (data) => ipcRenderer.invoke('data:write', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
});
