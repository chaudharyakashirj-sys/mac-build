const { contextBridge, ipcRenderer } = require('electron');

// Expose Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Tracking APIs
  startTracking: () => ipcRenderer.invoke('startTracking'),
  stopTracking: () => ipcRenderer.invoke('stopTracking'),
  setMeetingMode: (isMeetingMode) => ipcRenderer.invoke('setMeetingMode', isMeetingMode),
  setBreakMode: (isBreakMode) => ipcRenderer.invoke('setBreakMode', isBreakMode),
  
  // Event listeners
  onTrackingUpdate: (callback) => {
    ipcRenderer.on('trackingUpdate', (event, data) => callback(data));
  },
  onAutoStop: (callback) => {
    ipcRenderer.on('autoStop', () => callback());
  },
  removeTrackingListener: () => {
    ipcRenderer.removeAllListeners('trackingUpdate');
    ipcRenderer.removeAllListeners('autoStop');
  }
});
