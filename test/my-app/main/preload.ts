// preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Create a safe version of global objects with only serializable properties
const globalPolyfill = {
  // Basic environment info
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome,
  electronVersion: process.versions.electron,
  platform: process.platform,
  // Safe window properties
  windowSize: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  // Safe document properties
  documentInfo: {
    title: document.title,
    url: document.URL,
    readyState: document.readyState
  }
};

const handler = {
  send(channel: string, value: unknown) {
    if (typeof channel !== 'string') return;
    ipcRenderer.send(channel, value);
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    if (typeof channel !== 'string') return;
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
};

// Expose safe versions through contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  ipc: handler,
  env: globalPolyfill
});

export type IpcHandler = typeof handler;