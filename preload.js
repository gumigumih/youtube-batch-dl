const { contextBridge, ipcRenderer } = require('electron');

// セキュアなAPIをレンダラープロセスに公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 既存のAPI
  getClipboardUrls: () => ipcRenderer.invoke('get-clipboard-urls'),
  getLastUrls: () => ipcRenderer.invoke('get-last-urls'),
  saveUrls: (urls) => ipcRenderer.invoke('save-urls', urls),
  checkCookiesFile: () => ipcRenderer.invoke('check-cookies-file'),
  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),
  getPlaylistVideos: (url) => ipcRenderer.invoke('get-playlist-videos', url),
  getPlaylistTitle: (url) => ipcRenderer.invoke('get-playlist-title', url),
  downloadVideo: (params) => ipcRenderer.invoke('download-video', params),
  stopDownload: () => ipcRenderer.invoke('stop-download'),
  checkDownloadStatus: () => ipcRenderer.invoke('check-download-status'),
  resetStopFlag: () => ipcRenderer.invoke('reset-stop-flag'),
  createSaveDir: (dirName) => ipcRenderer.invoke('create-save-dir', dirName),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),
  selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),
  openCookiesDirectory: () => ipcRenderer.invoke('open-cookies-directory'),
  
  // イベントリスナー
  on: (channel, callback) => {
    // 許可されたチャンネルのみ
    const validChannels = ['current-filename-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  // リスナーの削除
  removeAllListeners: (channel) => {
    const validChannels = ['current-filename-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // 不足しているAPIを追加
  resetStopFlag: () => ipcRenderer.invoke('reset-stop-flag')
});
