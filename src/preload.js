const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  setAlwaysOnTop: (on) => ipcRenderer.invoke('set-always-on-top', on),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),

  minimize: () => ipcRenderer.send('win-minimize'),
  close: () => ipcRenderer.send('win-close'),
  quit: () => ipcRenderer.send('win-quit'),
  collapseNow: () => ipcRenderer.send('collapse-now'),

  onCollapsedChange: (cb) => ipcRenderer.on('collapsed-change', (e, payload) => cb(payload))
});
