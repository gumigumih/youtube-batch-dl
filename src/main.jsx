import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Electron APIの設定（preload.jsから提供される）
if (typeof window !== 'undefined') {
  // preload.jsから提供されるelectronAPIを使用
  if (!window.electronAPI) {
    console.warn('Electron API not available from preload script');
    // フォールバック用のモックAPI
    window.electronAPI = {
      checkCookiesFile: () => Promise.resolve({ exists: false }),
      openCookiesDirectory: () => Promise.resolve({ success: false }),
      getDownloadPath: () => Promise.resolve({ success: true, path: '/Downloads' }),
      getDefaultDownloadPath: () => Promise.resolve({ success: true, path: '/Downloads' }),
      selectDownloadFolder: () => Promise.resolve({ success: false }),
      getVideoInfo: () => Promise.resolve(null),
      getPlaylistVideos: () => Promise.resolve([]),
      getPlaylistTitle: () => Promise.resolve('プレイリスト'),
      downloadVideo: () => Promise.resolve({ success: false }),
      stopDownload: () => Promise.resolve({ success: false }),
      checkDownloadStatus: () => Promise.resolve({ isStopRequested: false }),
      createSaveDir: () => Promise.resolve(null),
      getClipboardUrls: () => Promise.resolve([]),
      getLastUrls: () => Promise.resolve([]),
      saveUrls: () => Promise.resolve(false),
      on: () => {},
      removeAllListeners: () => {}
    };
  } else {
    console.log('Electron API available from preload script');
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
