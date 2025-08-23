const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// yt-dlpのパスを取得する関数
const getYtDlpPath = () => {
  if (app.isPackaged) {
    // ビルドされたアプリの場合、extraResourcesから取得
    const ytDlpPath = path.join(process.resourcesPath, 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    console.log('Packaged app - yt-dlp path:', ytDlpPath);
    console.log('File exists:', fs.existsSync(ytDlpPath));
    
    // 実行権限を確認（Unix系システムのみ）
    if (process.platform !== 'win32' && fs.existsSync(ytDlpPath)) {
      try {
        const stats = fs.statSync(ytDlpPath);
        const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
        console.log('File is executable:', isExecutable);
        
        // 実行権限がない場合は付与を試行
        if (!isExecutable) {
          fs.chmodSync(ytDlpPath, '755');
          console.log('Execution permission granted');
        }
      } catch (error) {
        console.error('Permission check failed:', error.message);
      }
    }
    
    return ytDlpPath;
  } else {
    // 開発環境の場合、システムのyt-dlpを使用
    console.log('Development mode - using system yt-dlp');
    return 'yt-dlp';
  }
};

// アプリのデータディレクトリを取得
const getAppDataPath = () => {
  return path.join(app.getPath('downloads'), 'YouTube-Downloader');
};

// ダウンロード用の専用フォルダを取得
const getDownloadPath = () => {
  return path.join(app.getPath('downloads'), 'YouTube-Downloader');
};

// カスタムダウンロードパスを取得
const getCustomDownloadPath = () => {
  try {
    const dataPath = getAppDataPath();
    const configPath = path.join(dataPath, '_download_path.txt');
    
    if (fs.existsSync(configPath)) {
      const customPath = fs.readFileSync(configPath, 'utf8').trim();
      console.log('Using custom download path:', customPath);
      return customPath;
    } else {
      const defaultPath = getDownloadPath();
      console.log('Using default download path:', defaultPath);
      return defaultPath;
    }
  } catch (e) {
    console.error('Get custom download path error:', e.message);
    const defaultPath = getDownloadPath();
    return defaultPath;
  }
};

// データディレクトリを初期化
const initializeDataDirectory = () => {
  const dataPath = getAppDataPath();
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
};

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
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // アイコンファイルがあれば
    title: 'YouTube Downloader'
  });

  // 開発環境かどうかを判定
  const isDev = process.argv.includes('--dev');
  
  if (isDev) {
    // 開発環境の場合、Viteの開発サーバーを使用
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // プロダクション環境の場合、ビルドされたファイルを使用
    mainWindow.loadFile('dist/index.html');
  }


  
  // キーボードショートカットでDevToolsを開く
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'f12') {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(async () => {
  // yt-dlpの動作確認
  try {
    const ytDlpPath = getYtDlpPath();
    console.log('Testing yt-dlp...');
    const { stdout } = await execPromise(`"${ytDlpPath}" --version`);
    console.log('yt-dlp version:', stdout.trim());
  } catch (error) {
    console.error('yt-dlp test failed:', error.message);
  }
  
  // IPCハンドラーを登録
  console.log('Registering IPC handlers...');
  
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
      const dataPath = getAppDataPath();
      const cookiesPath = path.join(dataPath, '_cookies.txt');
      
      if (fs.existsSync(cookiesPath)) {
        console.log('Cookie file found:', cookiesPath);
        return { exists: true, type: 'file', path: dataPath };
      }
      
      console.log('No cookies configured');
      return { exists: false, path: dataPath };
    } catch (e) {
      console.error('Cookie check error:', e.message);
      return { exists: false, error: e.message };
    }
  });

  ipcMain.handle('get-video-info', async (event, url) => {
    try {
      console.log('get-video-info called with URL:', url);
      const options = [
        '--no-warnings',
        '--no-call-home',
        '--no-check-certificate',
        '--flat-playlist',
        '--dump-json'
      ];

      const dataPath = getAppDataPath();
      const cookiesPath = path.join(dataPath, '_cookies.txt');
      
      if (fs.existsSync(cookiesPath)) {
        options.push('--cookies', cookiesPath);
      }

      const ytDlpPath = getYtDlpPath();
      const { stdout } = await execPromise(`"${ytDlpPath}" ${options.join(' ')} "${url}"`);
      
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

      console.log('Video info retrieved successfully');
      return jsonObjects[0];
    } catch (e) {
      console.error('情報取得エラー:', e.message);
      console.error('Error details:', e);
      return null;
    }
  });

  ipcMain.handle('get-playlist-videos', async (event, url) => {
    try {
      console.log('get-playlist-videos called with URL:', url);
      const options = [
        '--no-warnings',
        '--no-call-home',
        '--no-check-certificate',
        '--dump-json'
      ];

      const dataPath = getAppDataPath();
      const cookiesPath = path.join(dataPath, '_cookies.txt');
      
      if (fs.existsSync(cookiesPath)) {
        options.push('--cookies', cookiesPath);
        console.log('🍪 Using cookies file:', cookiesPath);
      } else {
        console.log('🍪 No cookies file found');
      }

      const ytDlpPath = getYtDlpPath();
      console.log('yt-dlp path:', ytDlpPath);
      
      const command = `"${ytDlpPath}" ${options.join(' ')} "${url}"`;
      console.log('Command:', command);
      
      const { stdout } = await execPromise(command);
      
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

      console.log('Playlist videos retrieved successfully, count:', jsonObjects.length);
      console.log('First video object:', jsonObjects[0]);
      
      // 動画情報を整形（プレイリスト内の動画のみをフィルタ）
      const videos = jsonObjects.filter(obj => obj._type !== 'playlist' && obj._type !== 'playlist_video');
      console.log('Filtered videos count:', videos.length);
      
      return videos.map(obj => ({
        url: obj.url || obj.webpage_url || obj.id,
        title: obj.title || 'タイトル不明',
        duration: obj.duration_string || '不明',
        upload_date: obj.upload_date,
        thumbnail: obj.thumbnail
      }));
    } catch (e) {
      console.error('プレイリスト情報取得エラー:', e.message);
      console.error('Error details:', e);
      return null;
    }
  });

  ipcMain.handle('get-playlist-title', async (event, url) => {
    try {
      const options = [
        '--no-warnings',
        '--no-call-home', 
        '--no-check-certificate',
        '--playlist-end', '1',
        '--dump-json'
      ];

      const dataPath = getAppDataPath();
      const cookiesPath = path.join(dataPath, '_cookies.txt');
      
      if (fs.existsSync(cookiesPath)) {
        options.push('--cookies', cookiesPath);
      }

      const ytDlpPath = getYtDlpPath();
      const { stdout } = await execPromise(`"${ytDlpPath}" ${options.join(' ')} "${url}"`);
      
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

  ipcMain.handle('download-video', async (event, { url, mode, downloadMode, saveDir, rangeOption, thumbnailOption, fileNameTemplate, videoIndex }) => {
    try {
      console.log('Download video - saveDir:', saveDir);
      console.log('Download mode:', downloadMode);
      console.log('URL:', url);
      console.log('Directory exists?', fs.existsSync(saveDir));
      console.log('fileNameTemplate received:', fileNameTemplate);
      console.log('fileNameTemplate type:', typeof fileNameTemplate);
      
      // ディレクトリの存在確認
      if (!fs.existsSync(saveDir)) {
        throw new Error(`ダウンロードディレクトリが存在しません: ${saveDir}`);
      }
      
      // downloader.jsのrunDownload関数を呼び出す
      const { runDownload } = require('./downloader.js');
      
      // クッキーファイルをダウンロードディレクトリにコピー
      const dataPath = getAppDataPath();
      const cookiesPath = path.join(dataPath, '_cookies.txt');
      const targetCookiesPath = path.join(saveDir, '_cookies.txt');
      
      if (fs.existsSync(cookiesPath)) {
        fs.copyFileSync(cookiesPath, targetCookiesPath);
        console.log('🍪 クッキーファイルをコピーしました:', targetCookiesPath);
      } else {
        console.log('🍪 クッキーファイルが見つかりません:', cookiesPath);
      }
      
      // 現在のディレクトリを保存
      const originalCwd = process.cwd();
      
      try {
        // ダウンロードディレクトリに移動
        process.chdir(saveDir);
        console.log('Changed directory to:', process.cwd());
        
        // downloadModeを適切なmodeに変換
        const actualMode = downloadMode === 'audio' ? 'mp3' : 'mp4';
        console.log('Starting download with mode:', actualMode);
        
        // タイムアウト付きでダウンロードを実行
        const downloadPromise = runDownload(url, actualMode, '.', rangeOption, fileNameTemplate, thumbnailOption, videoIndex);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ダウンロードがタイムアウトしました')), 300000); // 5分
        });
        
        await Promise.race([downloadPromise, timeoutPromise]);
        console.log('Download completed successfully');
        return { success: true };
      } finally {
        // 元のディレクトリに戻る
        process.chdir(originalCwd);
        console.log('Restored directory to:', process.cwd());
      }
    } catch (e) {
      console.error('ダウンロードエラー:', e.message);
      console.error('Error stack:', e.stack);
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

  // 停止フラグリセットのIPC通信
  ipcMain.handle('reset-stop-flag', async () => {
    try {
      const { resetStopFlag } = require('./downloader.js');
      return { success: resetStopFlag() };
    } catch (e) {
      console.error('停止フラグリセットエラー:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('create-save-dir', (event, dirName) => {
    try {
      console.log('Original dirName:', dirName);
      const sanitizedName = sanitizeFileName(dirName);
      console.log('Sanitized name:', sanitizedName);
      
      // カスタムダウンロードパスを取得
      const customDownloadPath = getCustomDownloadPath();
      const saveDir = path.join(customDownloadPath, sanitizedName);
      console.log('Save dir path:', saveDir);
      
      // 親ディレクトリも含めて作成
      fs.mkdirSync(saveDir, { recursive: true });
      return saveDir;
    } catch (e) {
      console.error('フォルダ作成エラー:', e.message);
      return null;
    }
  });

  // カスタムダウンロードパスを取得
  ipcMain.handle('get-download-path', () => {
    try {
      const dataPath = getAppDataPath();
      const configPath = path.join(dataPath, '_download_path.txt');
      
      if (fs.existsSync(configPath)) {
        const customPath = fs.readFileSync(configPath, 'utf8').trim();
        console.log('Custom download path:', customPath);
        return { success: true, path: customPath };
      } else {
        const defaultPath = getDownloadPath();
        console.log('Default download path:', defaultPath);
        return { success: true, path: defaultPath };
      }
    } catch (e) {
      console.error('Get download path error:', e.message);
      const defaultPath = getDownloadPath();
      return { success: true, path: defaultPath };
    }
  });

  // デフォルトダウンロードパスを取得
  ipcMain.handle('get-default-download-path', () => {
    try {
      const defaultPath = getDownloadPath();
      console.log('Default download path for display:', defaultPath);
      return { success: true, path: defaultPath };
    } catch (e) {
      console.error('Get default download path error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // フォルダ選択ダイアログを開く
  ipcMain.handle('select-download-folder', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'ダウンロードフォルダを選択'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        console.log('Selected download folder:', selectedPath);
        
        // 選択されたパスを保存
        const dataPath = getAppDataPath();
        const configPath = path.join(dataPath, '_download_path.txt');
        fs.writeFileSync(configPath, selectedPath);
        
        return { success: true, path: selectedPath };
      } else {
        return { success: false, canceled: true };
      }
    } catch (e) {
      console.error('Folder selection error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // クッキーディレクトリを開く
  ipcMain.handle('open-cookies-directory', async () => {
    try {
      const dataPath = getAppDataPath();
      console.log('Opening cookies directory:', dataPath);
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }
      
      const { shell } = require('electron');
      await shell.openPath(dataPath);
      
      return { success: true, path: dataPath };
    } catch (e) {
      console.error('Failed to open cookies directory:', e.message);
      return { success: false, error: e.message };
    }
  });

  console.log('All IPC handlers registered successfully');
  
  // ファイル名更新のIPCハンドラー
  ipcMain.handle('update-current-filename', (event, filename) => {
    try {
      console.log('Updating current filename:', filename);
      return { success: true, filename };
    } catch (e) {
      console.error('Update filename error:', e.message);
      return { success: false, error: e.message };
    }
  });
  
  createWindow();
});

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
