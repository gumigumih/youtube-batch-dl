const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Windows/macOS対応の安全なファイル名作成関数
function sanitizeFileName(fileName) {
  // Windows予約語リスト
  const windowsReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  
  let sanitized = fileName
    // Windows/macOS/Linuxで使えない文字を置換
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_')
    // 連続する空白を1つに
    .replace(/\s+/g, ' ')
    // 先頭と末尾の空白を削除
    .trim()
    // 先頭のドットを削除（隠しファイルを避ける）
    .replace(/^\.+/, '')
    // 末尾のドットを削除（Windowsで問題になる）
    .replace(/\.+$/, '')
    // ファイル名の最大長を制限（Windows: 255文字、macOS: 255バイト）
    .substring(0, 255);
  
  // Windows予約語をチェック
  const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
  if (windowsReserved.includes(nameWithoutExt)) {
    sanitized = '_' + sanitized;
  }
  
  return sanitized || 'untitled';
}

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
    title: 'YouTube Downloader'
  });

  mainWindow.loadFile('index.html');

  // 開発モードの場合はDevToolsを開く
  if (process.argv.includes('--dev') || process.argv.includes('--devtools')) {
    mainWindow.webContents.openDevTools();
  }
  
  // キーボードショートカットでDevToolsを開く
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'f12') {
      mainWindow.webContents.toggleDevTools();
    }
  });
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

ipcMain.handle('get-playlist-videos', async (event, url) => {
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

    // 動画情報を整形
    return jsonObjects.map(obj => ({
      url: obj.url || obj.webpage_url,
      title: obj.title,
      duration: obj.duration_string,
      upload_date: obj.upload_date,
      thumbnail: obj.thumbnail
    }));
  } catch (e) {
    console.error('プレイリスト情報取得エラー:', e.message);
    return null;
  }
});

// プレイリストのタイトル取得
ipcMain.handle('get-playlist-title', async (event, url) => {
  try {
    const options = [
      '--no-warnings',
      '--no-call-home', 
      '--no-check-certificate',
      '--playlist-end', '1',
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

    if (jsonObjects.length > 0) {
      const playlistInfo = jsonObjects[0];
      return playlistInfo.playlist_title || playlistInfo.uploader || playlistInfo.channel || 'プレイリスト';
    }
    
    return 'プレイリスト';
  } catch (e) {
    console.error('プレイリストタイトル取得エラー:', e.message);
    return 'プレイリスト';
  }
});

ipcMain.handle('download-video', async (event, { url, mode, downloadMode, saveDir, rangeOption, thumbnailOption }) => {
  try {
    console.log('Download video - saveDir:', saveDir);
    console.log('Download mode:', downloadMode);
    console.log('Directory exists?', fs.existsSync(saveDir));
    
    // downloader.jsのrunDownload関数を呼び出す
    const { runDownload } = require('./downloader.js');
    
    // 既に作成済みのディレクトリに移動
    process.chdir(saveDir);
    
    // downloadModeを適切なmodeに変換
    const actualMode = downloadMode === 'audio' ? 'mp3' : 'mp4';
    await runDownload(url, actualMode, '.', rangeOption, thumbnailOption);
    return { success: true };
  } catch (e) {
    console.error('ダウンロードエラー:', e.message);
    return { success: false, error: e.message };
  }
});

// ダウンロード停止のIPC通信
ipcMain.handle('stop-download', async () => {
  try {
    const { stopDownload } = require('./downloader.js');
    const stopped = stopDownload();
    return { success: stopped };
  } catch (e) {
    console.error('ダウンロード停止エラー:', e.message);
    return { success: false, error: e.message };
  }
});

// ダウンロード状態確認のIPC通信
ipcMain.handle('check-download-status', async () => {
  try {
    const { isStopRequested } = require('./downloader.js');
    return { isStopRequested: isStopRequested() };
  } catch (e) {
    console.error('ダウンロード状態確認エラー:', e.message);
    return { isStopRequested: false };
  }
});

ipcMain.handle('create-save-dir', (event, dirName) => {
  try {
    console.log('Original dirName:', dirName);
    const sanitizedName = sanitizeFileName(dirName);
    console.log('Sanitized name:', sanitizedName);
    const saveDir = path.resolve(sanitizedName);
    console.log('Save dir path:', saveDir);
    fs.mkdirSync(saveDir, { recursive: true });
    return saveDir;
  } catch (e) {
    console.error('フォルダ作成エラー:', e.message);
    return null;
  }
});
