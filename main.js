const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // アイコンファイルがあれば
    title: 'YouTube Batch Downloader'
  });

  mainWindow.loadFile('index.html');

  // 開発モードの場合はDevToolsを開く
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



ipcMain.handle('get-clipboard-urls', async () => {
  try {
    const clipboardy = await import('clipboardy');
    const text = await clipboardy.default.read();
    
    if (!text) {
      return [];
    }

    const urlPattern = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/g;
    const urls = text.match(urlPattern) || [];

    const validUrls = urls.map(url => {
      if (url.startsWith('www.')) {
        return 'https://' + url;
      }
      return url;
    }).filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    return validUrls;
  } catch (e) {
    console.error('クリップボードの読み取りに失敗しました:', e.message);
    return [];
  }
});

ipcMain.handle('get-last-urls', () => {
  try {
    return fs.readFileSync('_last_urls.txt', 'utf8').split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('save-urls', (event, urls) => {
  try {
    fs.writeFileSync('_last_urls.txt', urls.join('\n'), 'utf8');
    return true;
  } catch (e) {
    console.error('URLの保存に失敗しました:', e.message);
    return false;
  }
});

ipcMain.handle('check-cookies-file', async () => {
  try {
    if (!fs.existsSync('_cookies.txt')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('get-cookies-from-browser', async (event, browser) => {
  try {
    await execPromise(`yt-dlp --cookies-from-browser ${browser} --cookies _cookies.txt`);
    return true;
  } catch (e) {
    console.error('クッキーの取得に失敗しました:', e.message);
    return false;
  }
});

ipcMain.handle('get-video-info', async (event, url) => {
  try {
    const options = [
      '--no-warnings',
      '--no-call-home',
      '--no-check-certificate',
      '--flat-playlist',
      '--dump-json'
    ];

    if (fs.existsSync('_cookies.txt')) {
      options.push('--cookies', '_cookies.txt');
    }

    const { stdout } = await execPromise(`yt-dlp ${options.join(' ')} "${url}"`);
    
    const jsonObjects = stdout.trim().split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(obj => obj !== null);

    if (jsonObjects.length === 0) {
      throw new Error('有効なJSONデータが見つかりませんでした');
    }

    return jsonObjects[0];
  } catch (e) {
    console.error('情報取得エラー:', e.message);
    return null;
  }
});

ipcMain.handle('download-video', async (event, { url, mode, saveDir, rangeOption }) => {
  try {
    // downloader.jsのrunDownload関数を呼び出す
    const { runDownload } = require('./downloader.js');
    
    // 保存ディレクトリを作成して移動
    const fs = require('fs-extra');
    fs.mkdirSync(saveDir, { recursive: true });
    process.chdir(saveDir);
    
    await runDownload(url, mode, '.', rangeOption);
    return { success: true };
  } catch (e) {
    console.error('ダウンロードエラー:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('create-save-dir', (event, dirName) => {
  try {
    const saveDir = dirName.replace(/[\\/:*?"<>|]/g, '_');
    fs.mkdirSync(saveDir, { recursive: true });
    return saveDir;
  } catch (e) {
    console.error('フォルダ作成エラー:', e.message);
    return null;
  }
});
