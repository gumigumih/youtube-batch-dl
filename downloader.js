// index.js
const prompts = require('prompts');
const fs = require('fs-extra');
const path = require('path');
const xlsx = require('xlsx');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const readline = require('readline');
const cliProgress = require('cli-progress');

// yt-dlpのパスを取得する関数
const getYtDlpPath = () => {
  // Electron環境かどうかを判定
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    // Electron環境の場合、extraResourcesから取得
    const { app } = require('electron');
    if (app && app.isPackaged) {
      return path.join(process.resourcesPath, 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    }
  }
  // 開発環境の場合、システムのyt-dlpを使用
  return 'yt-dlp';
};

// ダウンロード用の専用フォルダを取得
const getDownloadPath = () => {
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    const { app } = require('electron');
    if (app) {
      return path.join(app.getPath('downloads'), 'YouTube-Downloader');
    }
  }
  // 開発環境の場合、カレントディレクトリを使用
  return path.join(process.cwd(), 'Downloads');
};

// カスタムダウンロードパスを取得
const getCustomDownloadPath = () => {
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
      const { app } = require('electron');
      if (app) {
        const dataPath = path.join(app.getPath('downloads'), 'YouTube-Downloader');
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
      }
    }
    return getDownloadPath();
  } catch (e) {
    console.error('Get custom download path error:', e.message);
    return getDownloadPath();
  }
};

// ローディングアニメーション用の変数
let loadingInterval = null;

// プログレスバーのインスタンス
let progressBar = null;
if (typeof process !== 'undefined' && process.stdout && process.stdout.clearLine) {
  progressBar = new cliProgress.SingleBar({
    format: 'ダウンロード進捗 |{bar}| {percentage}% | {value}/{total} MB | {title}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
}

// ローディングアニメーションを開始
const startLoading = (message) => {
  // 既存のアニメーションを停止
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  
  // Electron環境ではprocess.stdoutが利用できないため、ローディングアニメーションを無効化
  if (typeof process !== 'undefined' && process.stdout && process.stdout.clearLine) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    // カーソルを非表示
    process.stdout.write('\x1B[?25l');
    // 最初のメッセージを表示（改行なし）
    process.stdout.write(`${frames[i]} ${message}\r`);
    
    loadingInterval = setInterval(() => {
      i = (i + 1) % frames.length;
      // 現在の行をクリア
      process.stdout.clearLine(0);
      // カーソルを先頭に移動
      process.stdout.cursorTo(0);
      // アニメーションとメッセージを表示（改行なし）
      process.stdout.write(`${frames[i]} ${message}\r`);
    }, 80);
  }
};

// ローディングアニメーションを停止
const stopLoading = () => {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  // Electron環境ではprocess.stdoutが利用できないため、条件分岐で対応
  if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
    process.stdout.write('\r\x1B[K'); // 現在の行をクリア
    process.stdout.write('\x1B[?25h'); // カーソルを表示
  }
};

// ffmpegのパスを設定
process.env.FFMPEG_PATH = ffmpeg.path;

// クリップボードからURL取得
const getClipboardUrls = async () => {
  try {
    const clipboardy = await import('clipboardy');
    const text = await clipboardy.default.read();
    
    if (!text) {
      return [];
    }

    // URLのパターンを改善し、より多くの形式に対応
    const urlPattern = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/g;
    const urls = text.match(urlPattern) || [];

    const validUrls = urls.map(url => {
      // www.で始まるURLにhttps://を追加
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
};

// 前回のURLを読み込む
const getLastUrls = () => {
  try {
    return fs.readFileSync('_last_urls.txt', 'utf8').split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
};

// URLを保存する
const saveUrls = (urls) => {
  try {
    fs.writeFileSync('_last_urls.txt', urls.join('\n'), 'utf8');
    console.log('✅ URLを保存しました');
  } catch (e) {
    console.error('❌ URLの保存に失敗しました:', e.message);
  }
};

// URL入力用の関数
const readUrl = async (message) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

// URL選択
const selectUrls = async () => {
  startLoading("クリップボードと前回のURLを確認中です...");
  const clipboardUrls = await getClipboardUrls();
  const lastUrls = getLastUrls();
  stopLoading();
  
  const options = [];

  // クリップボードのURLがあれば追加
  if (clipboardUrls.length > 0) {
    options.push({ title: `クリップボードのURLを使う (${clipboardUrls.length}件)`, value: 'clipboard' });
  }

  // 前回のURLがあれば追加
  if (lastUrls.length > 0) {
    options.push({ title: `前回のURLを使う (${lastUrls.length}件)`, value: 'last' });
  }

  // 新規入力オプション
  options.push({ title: '新しいURLを入力する', value: 'new' });
  options.push({ title: '新しいURLを複数入力する', value: 'multi' });

  const response = await prompts({
    type: 'select',
    name: 'urlSource',
    message: '使用するURLを選んでください',
    choices: options
  });

  switch (response.urlSource) {
    case 'last':
      return lastUrls;
    case 'clipboard':
      return clipboardUrls;
    case 'new':
      const url = await readUrl('新しいURLを入力してください: ');
      try {
        new URL(url);
        return [url];
      } catch {
        console.error('無効なURLです');
        return [];
      }
    case 'multi':
      console.log('複数のURLを1行ずつ入力してください（空行で確定）:');
      const urls = [];
      while (true) {
        const url = await readUrl('');
        if (!url) break;
        try {
          new URL(url);
          urls.push(url);
        } catch {
          console.error('無効なURLです:', url);
        }
      }
      return urls;
    default:
      return [];
  }
};

// ダウンロードモード選択
const selectDownloadMode = async () => {
  const response = await prompts({
    type: 'select',
    name: 'mode',
    message: 'ダウンロードオプションを選択してください',
    choices: [
      { title: '通常モード（動画）', value: 'video' },
      { title: 'MP3音声のみ', value: 'mp3' }
    ]
  });
  return response.mode;
};

// クッキーファイルの確認と処理
const checkCookiesFile = async () => {
  try {
    // 開発環境とビルド環境でパスを分ける
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    const basePath = isDev ? process.cwd() : path.join(process.resourcesPath, 'data');
    
    // クッキーファイルが存在する場合
    if (fs.existsSync(path.join(basePath, '_cookies.txt'))) {
      return true;
    }
    
    // ブラウザ設定ファイルが存在する場合
    if (fs.existsSync(path.join(basePath, '_browser_cookies.txt'))) {
      return true;
    }
    
    // CLIモードの場合のみプロンプトを表示
    if (require.main === module) {
      console.log('⚠️ クッキーファイルが見つかりません。');
      const response = await prompts({
        type: 'select',
        name: 'cookieSource',
        message: 'クッキーの取得方法を選択してください',
        choices: [
          { title: 'ブラウザから取得する', value: 'browser' },
          { title: '認証なしで続行する', value: 'none' }
        ]
      });

      if (response.cookieSource === 'browser') {
        const browserResponse = await prompts({
          type: 'select',
          name: 'browser',
          message: '使用するブラウザを選択してください',
          choices: [
            { title: 'Chrome', value: 'chrome' },
            { title: 'Firefox', value: 'firefox' },
            { title: 'Edge', value: 'edge' },
            { title: 'Safari', value: 'safari' }
          ]
        });

        try {
          const ytDlpPath = getYtDlpPath();
          await execPromise(`"${ytDlpPath}" --cookies-from-browser ${browserResponse.browser} --cookies _cookies.txt`);
          console.log('✅ クッキーファイルを作成しました');
          return true;
        } catch (e) {
          console.error('❌ クッキーの取得に失敗しました:', e.message);
          return false;
        }
      }
    }
    
    return false;
  } catch (e) {
    console.error('❌ クッキーファイルの確認中にエラーが発生しました:', e.message);
    return false;
  }
};

// 動画情報を取得
const getTargetName = async (url) => {
  try {
    const options = [
      '--no-warnings',
      '--no-call-home',
      '--no-check-certificate',
      '--flat-playlist',
      '--dump-json'
    ];

    // クッキーファイルが存在する場合のみ追加
    if (await checkCookiesFile()) {
      options.push('--cookies', '_cookies.txt');
    }

    const ytDlpPath = getYtDlpPath();
    const { stdout } = await execPromise(`"${ytDlpPath}" ${options.join(' ')} "${url}"`);
    
    // 複数のJSONオブジェクトを処理
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

    // 最初のオブジェクトを使用（プレイリストやチャンネルの情報を含む）
    const info = jsonObjects[0];
    
    // プレイリストの場合
    if (url.includes('list=')) {
      return info.playlist_title || info.channel || 'unknown_playlist';
    }
    
    // チャンネルの場合
    if (url.includes('/@') || url.includes('/channel/')) {
      return info.channel || info.uploader || 'unknown_channel';
    }
    
    // 通常の動画の場合
    return info.channel || info.uploader || info.title || 'unknown_video';
  } catch (e) {
    console.error('情報取得エラー:', e.message);
    // エラー時はURLから情報を抽出
    try {
      const urlObj = new URL(url);
      if (url.includes('list=')) {
        return 'unknown_playlist';
      } else if (url.includes('/@') || url.includes('/channel/')) {
        return 'unknown_channel';
      } else {
        return 'unknown_video';
      }
    } catch (urlError) {
      return 'unknown_video';
    }
  }
};

// ファイル名を安全にする関数
const sanitizeFileName = (fileName) => {
  // Windows予約語リスト
  const windowsReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  
  // WindowsとMacで使用できない文字を_に置換
  // Windows: \ / : * ? " < > |
  // Mac: / : 
  // その他: 制御文字、改行文字など
  let sanitized = fileName
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_')  // 制御文字も含める
    .replace(/\s+/g, ' ')  // 連続する空白を1つに
    .trim()  // 前後の空白を削除
    .replace(/^\.+/, '')  // 先頭のドットを削除（隠しファイルを避ける）
    .replace(/\.+$/, '')  // 末尾のドットを削除
    .substring(0, 255);   // ファイル名の最大長を制限
  
  // Windows予約語をチェック
  const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
  if (windowsReserved.includes(nameWithoutExt)) {
    sanitized = '_' + sanitized;
  }
  
  return sanitized || 'untitled';
};

// 保存ディレクトリ作成
const createSaveDir = (dirName) => {
  const sanitizedName = sanitizeFileName(dirName);
  const downloadPath = getCustomDownloadPath();
  const saveDir = path.join(downloadPath, sanitizedName);
  
  // 親ディレクトリも含めて作成
  fs.mkdirSync(saveDir, { recursive: true });
  console.log(`📁 フォルダを作成しました: "${dirName}" → "${sanitizedName}"`);
  return saveDir;
};

// プレイリスト情報を取得
const getPlaylistInfo = async (url) => {
  const ytDlpPath = getYtDlpPath();
  const { stdout } = await execPromise(`"${ytDlpPath}" --no-warnings --no-call-home --no-check-certificate --flat-playlist --dump-json --cookies _cookies.txt "${url}"`);
  
  // 複数のJSONオブジェクトを処理
  const videoInfos = stdout.trim().split('\n')
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(info => info !== null);

  return videoInfos;
};

// ダウンロード範囲を選択
const selectDownloadRange = async (url, isFirstUrl, totalUrls) => {
  const choices = [
    { title: 'このURLのすべてをダウンロード', value: 'all_current' },
    { title: 'このURLの範囲を指定する', value: 'range' }
  ];

  // 複数URLの場合のみ「すべてのURLで全てをダウンロード」を追加
  if (totalUrls > 1) {
    choices.unshift({ title: 'すべてのURLのすべてをダウンロード', value: 'all_all' });
  }

  const response = await prompts({
    type: 'select',
    name: 'range',
    message: 'ダウンロード範囲を選択してください',
    choices: choices
  });

  if (response.range === 'all_all') {
    return { option: '', applyToAll: true };
  } else if (response.range === 'all_current') {
    return { option: '', applyToAll: false };
  } else {
    // 範囲を指定する場合
    const rangeOption = await selectRangeForUrl(url);
    return { option: rangeOption, applyToAll: false };
  }
};

// URLごとの範囲選択処理
const selectRangeForUrl = async (url) => {
  startLoading("プレイリスト情報を取得中です...");
  const videoList = await getPlaylistInfo(url);
  stopLoading();

  // 開始動画を選択
  const startResponse = await prompts({
    type: 'select',
    name: 'start',
    message: '開始動画を選んでください',
    choices: videoList.map(v => ({ title: v.title, value: v.id }))
  });

  // 終了動画を選択
  const endResponse = await prompts({
    type: 'select',
    name: 'end',
    message: '終了動画を選んでください',
    choices: videoList.map(v => ({ title: v.title, value: v.id }))
  });

  const startIndex = parseInt(startResponse.start);
  const endIndex = parseInt(endResponse.end);

  if (startIndex <= endIndex) {
    return `--playlist-items ${startIndex}-${endIndex}`;
  } else {
    return '';
  }
};

// メタデータのExcel出力
const writeExcel = (saveDir) => {
  try {
    startLoading("メタデータをExcelに出力中です...");
    const metadataLog = path.join(saveDir, '_metadata.jsonl');
    if (!fs.existsSync(metadataLog)) {
      stopLoading();
      return;
    }

    const data = fs.readFileSync(metadataLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));

    const df = data.map(item => ({
      '番号': item.playlist_index ? String(item.playlist_index).padStart(3, '0') : '000',
      'タイトル': item.title,
      'URL': `https://youtu.be/${item.id}`
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(df);
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    xlsx.writeFile(wb, path.join(saveDir, '_video_list.xlsx'));

    fs.unlinkSync(metadataLog);
    stopLoading();
    console.log(`✅ Excelファイルを保存しました: ${path.join(saveDir, '_video_list.xlsx')}`);
  } catch (e) {
    stopLoading();
    console.error(`❌ Excelファイルの保存に失敗しました:`, e.message);
  }
};

// 単一動画のダウンロード
const downloadSingleVideo = async (url, mode, saveDir, currentIndex, fileNameTemplate = '%(number)03d - %(title)s', thumbnailOption = true) => {
  // fileNameTemplateが文字列でない場合はデフォルト値を使用
  if (typeof fileNameTemplate !== 'string') {
    console.log('🔧 fileNameTemplateが文字列ではありません:', fileNameTemplate);
    fileNameTemplate = '%(number)03d - %(title)s';
  }
  
  console.log('🔧 downloadSingleVideo開始:', url);
  console.log('🔧 mode:', mode);
  console.log('🔧 saveDir:', saveDir);
  console.log('🔧 currentIndex:', currentIndex);
  console.log('🔧 fileNameTemplate:', fileNameTemplate);
  
  // 番号フォーマットを処理する関数
  const processNumberFormat = (template, index) => {
    console.log('🔧 processNumberFormat - template:', template);
    console.log('🔧 processNumberFormat - index:', index);
    
    // %(number)03dを実際の番号に置換
    let result = template;
    
    // 正規表現のデバッグ
    const patterns = [
      /%(number)(\d*)d/g,
      /%(number)(\d+)d/g,
      /%(number)(\d*)d/,
      /%(number)(\d+)d/,
      /%(number)03d/g,
      /%(number)03d/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      console.log(`🔧 pattern ${i}:`, pattern.source, 'test:', pattern.test(template), 'matches:', template.match(pattern));
    }
    
    console.log('🔧 template string:', JSON.stringify(template));
    
    // 動的桁数対応の文字列置換
    console.log('🔧 Template type:', typeof template);
    console.log('🔧 Template length:', template.length);
    console.log('🔧 Template char codes:', Array.from(template).map(c => c.charCodeAt(0)));
    
    const numberPattern = /%(number)(\d*)d/g;
    console.log('🔧 Number pattern:', numberPattern.source);
    
    // 正規表現をリセット
    numberPattern.lastIndex = 0;
    
    // 正規表現の詳細テスト
    const testResult = numberPattern.exec(template);
    console.log('🔧 exec result:', testResult);
    
    const matches = template.match(numberPattern);
    console.log('🔧 Matches:', matches);
    
    if (matches) {
      console.log('🔧 Found number pattern:', matches[0]);
      
      result = template.replace(numberPattern, (match, p1, p2) => {
        const width = p2 ? parseInt(p2) : 0;
        const replacement = width > 0 ? String(index).padStart(width, '0') : String(index);
        console.log('🔧 Replacing:', match, 'with:', replacement, '(width:', width, ')');
        return replacement;
      });
    } else {
      console.log('🔧 No number pattern found, using original template');
      
      // フォールバック: 直接文字列検索
      if (template.indexOf('%(number)03d') !== -1) {
        result = template.replace('%(number)03d', String(index).padStart(3, '0'));
        console.log('🔧 Fallback replacement used');
      }
    }
    
    console.log('🔧 processNumberFormat - result:', result);
    return result;
  };
  
  // ファイル名を事前に取得
  const getFilenameOptions = [
    '--get-filename',
    '-o', `${processNumberFormat(fileNameTemplate, currentIndex)}.%(ext)s`,
    '--compat-options', 'filename-sanitization'
  ];
  
  try {
    const { stdout: filename } = await exec(`yt-dlp ${getFilenameOptions.join(' ')} "${url}"`);
    const actualFilename = filename.trim().split('/').pop(); // パスからファイル名のみ取得
    console.log('🔧 ダウンロード予定ファイル名:', actualFilename);
    
    // IPCでファイル名を送信
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
      global.mainWindow.webContents.send('current-filename-updated', actualFilename);
    }
  } catch (error) {
    console.log('🔧 ファイル名取得エラー:', error.message);
  }
  
  const options = mode === 'mp3' 
    ? ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '--audio-quality', '0'] 
    : ['-f', 'bestvideo+bestaudio', '--merge-output-format', 'mp4', '--embed-thumbnail'];

  // ダウンロードオプション
  const downloadOptions = [
    ...options,
    '-o', `${processNumberFormat(fileNameTemplate, currentIndex)}.%(ext)s`,
    '--compat-options', 'filename-sanitization',
    '--download-archive', '_downloaded.txt',
    '--newline',
    '--progress-template', '"%(progress._percent_str)s of %(progress._total_bytes_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s"',
    '--no-warnings',
    '--no-call-home',
    '--no-check-certificate',
    '--prefer-ffmpeg',
    '--merge-output-format', 'mp4'
  ];

  // サムネイルオプションを条件付きで追加
  if (thumbnailOption) {
    downloadOptions.push('--write-thumbnail', '--convert-thumbnails', 'png');
  }

  // クッキーファイルの存在をチェック
  const cookiesPath = path.join(saveDir, '_cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    downloadOptions.push('--cookies', cookiesPath);
    console.log('🍪 クッキーファイルを使用:', cookiesPath);
  } else {
    console.log('🍪 クッキーファイルが見つかりません:', cookiesPath);
  }

  try {    
    const ytDlpPath = getYtDlpPath();
    const command = `"${ytDlpPath}" ${downloadOptions.join(' ')} "${url}"`;
    console.log(`🔧 ダウンロード実行コマンド: ${command}`);
    console.log(`🔧 生成されるファイル名: ${processNumberFormat(fileNameTemplate, currentIndex)}.%(ext)s`);
    console.log(`🔧 作業ディレクトリ: ${saveDir}`);
    
    // 配列形式でコマンドを実行してシェルの解釈を避ける
    const { spawn } = require('child_process');
    const process = spawn(ytDlpPath, downloadOptions.concat([url]), { 
      cwd: saveDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // プロセスを保存して停止可能にする
    currentProcess = process;
    
    let errorOutput = '';
    let currentVideo = '';
    let downloadedFiles = [];
    let totalBytes = 0;
    let downloadedBytes = 0;
    let currentTitle = '';
    let progressCompleted = false;  // 進捗完了フラグを追加
    
    process.stdout.on('data', (data) => {
      // 停止要求をチェック
      if (stopRequested) {
        return;
      }
      
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('[download] Destination:')) {
          const tempFileName = line.split('Destination:')[1].trim();
          console.log('🔧 [download] Destination line:', line);
          console.log('🔧 tempFileName:', tempFileName);
          // 中間ファイルの場合は通知を表示しない
          if (!tempFileName.match(/\.f\d+\.(webm|mp4)$/)) {
            currentVideo = tempFileName.replace(/\.f\d+\.mp4$/, '.mp4');
            currentTitle = path.basename(currentVideo, path.extname(currentVideo));
            console.log(`\n🎥 ${currentTitle} をダウンロード中...`);
            progressCompleted = false;  // 新しい動画の開始時にフラグをリセット
          }
        } else if (line.includes('has already been downloaded')) {
          const fileName = line.split('"')[1];
          // 中間ファイルの場合は通知を表示しない
          if (!fileName.match(/\.f\d+\.(webm|mp4)$/)) {
            downloadedFiles.push(fileName);
            console.log(`📥 ダウンロード済み: ${fileName}`);
            if (progressBar && progressBar.isActive) {
              progressBar.stop();
            }
            progressCompleted = true;  // ダウンロード済みの場合は完了フラグを設定
          }
        } else if (line.includes('[Merger] Merging formats into')) {
          const fileName = line.split('"')[1].replace('"', '');
          downloadedFiles.push(fileName);
          if (progressBar && progressBar.isActive) {
            progressBar.stop();
          }
          console.log(`📥 ダウンロード完了: ${fileName}`);
          progressCompleted = true;  // マージ完了時に完了フラグを設定
        } else if (line.includes('[info]')) {
          // 画質情報をログ出力
          if (line.includes('height') || line.includes('resolution')) {
            console.log(`ℹ️  ${line.trim()}`);
          }
        } else if (line.includes('%') && !progressCompleted) {  // 進捗完了フラグをチェック
          // 進捗情報の解析（複数のパターンに対応）
          const progressPatterns = [
            /(\d+\.\d+)% of\s+(\d+\.\d+)([KMG]iB)/,  // 通常の進捗（iB単位）
            /(\d+\.\d+)% of\s+(\d+\.\d+)([KMG]B)/,   // 通常の進捗（B単位）
            /\[download\]\s+(\d+\.\d+)%/,            // [download]付きパーセンテージのみ
            /(\d+\.\d+)%/                            // パーセンテージのみ
          ];

          for (const pattern of progressPatterns) {
            const progressMatch = line.match(pattern);
            if (progressMatch) {
              const percent = parseFloat(progressMatch[1]);
              
              // サイズ情報がある場合
              if (progressMatch[2] && progressMatch[3]) {
                const size = parseFloat(progressMatch[2]);
                const unit = progressMatch[3];
                const sizeInMB = size * (unit === 'GiB' || unit === 'GB' ? 1024 : unit === 'KiB' || unit === 'KB' ? 0.001 : 1);
                
                if (progressBar && !progressBar.isActive) {
                  progressBar.start(Math.ceil(sizeInMB), 0, { title: currentTitle });
                }
                
                if (progressBar) {
                  progressBar.update(Math.ceil(sizeInMB * percent / 100), { title: currentTitle });
                }
                
                // 100%に達したら完了フラグを設定
                if (percent >= 100) {
                  progressCompleted = true;
                }
              } else {
                // パーセンテージのみの場合
                if (progressBar && !progressBar.isActive) {
                  progressBar.start(100, 0, { title: currentTitle });
                }
                if (progressBar) {
                  progressBar.update(Math.ceil(percent), { title: currentTitle });
                }
                
                // 100%に達したら完了フラグを設定
                if (percent >= 100) {
                  progressCompleted = true;
                }
              }
              break;
            }
          }
        }
      }
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    await new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (progressBar && progressBar.isActive) {
          progressBar.stop();
        }
        
        // 停止要求があった場合は成功として扱う
        if (stopRequested) {
          console.log('🛑 ダウンロードが停止されました');
          resolve();
        } else if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ダウンロードが失敗しました（終了コード: ${code}）\nエラー詳細: ${errorOutput}`));
        }
      });
      
      // 停止要求を監視
      const checkStopInterval = setInterval(() => {
        if (stopRequested) {
          clearInterval(checkStopInterval);
          try {
            if (currentProcess && currentProcess.pid) {
              process.kill(currentProcess.pid, 'SIGTERM');
            }
          } catch (error) {
            console.log('プロセス停止エラー:', error.message);
          }
        }
      }, 100);
    });

    return true;
  } catch (e) {
    console.error(`\n❌ ${url} のダウンロードに失敗しました:`, e.message);
    return false;
  }
};

// 現在実行中のyt-dlpプロセスを管理
let currentProcess = null;
// ダウンロード停止フラグ
let stopRequested = false;

// yt-dlpでダウンロード
const runDownload = async (url, mode, saveDir, rangeOption, fileNameTemplate = '%(number)03d - %(title)s', thumbnailOption = true, videoIndex = 1) => {
  console.log('🔧 runDownload - fileNameTemplate:', fileNameTemplate);
  console.log('🔧 runDownload - fileNameTemplate type:', typeof fileNameTemplate);
  
  // 停止フラグをリセット
  stopRequested = false;
  
  // 現在のインデックスを取得
  let currentIndex = 1;
  try {
    const files = fs.readdirSync(saveDir);
    const numbers = files
      .map(file => {
        const match = file.match(/^(\d{3}) - /);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => !isNaN(num));
    if (numbers.length > 0) {
      currentIndex = Math.max(...numbers) + 1;
    }
  } catch (e) {
    // ディレクトリが存在しない場合は1から開始
  }

  try {
    // プレイリストやチャンネルの場合
    if (url.includes('list=') || url.includes('/@') || url.includes('/channel/')) {
      startLoading("プレイリスト情報を取得中です...");
      const videoInfos = await getPlaylistInfo(url);
      stopLoading();

      // 範囲指定がある場合、その範囲の動画のみを処理
      let targetVideos = videoInfos;
      if (rangeOption) {
        const rangeMatch = rangeOption.match(/--playlist-items (\d+)-(\d+)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          targetVideos = videoInfos.slice(start - 1, end);
        }
      }

      const targetName = path.basename(saveDir);
      console.log(`📥 ${targetVideos.length}件の動画をダウンロードします`);
      
      for (let i = 0; i < targetVideos.length; i++) {
        // 停止要求をチェック
        if (stopRequested) {
          console.log('🛑 ダウンロード停止が要求されました。ループを中断します。');
          break;
        }
        
        const video = targetVideos[i];
        const videoIndex = i + 1; // 再生リストの順番（1から開始）
        const videoUrl = `https://youtu.be/${video.id}`;
        console.log(`\n🎥 ${videoIndex}/${targetVideos.length}: ${video.title} をダウンロード中...`);
        const success = await downloadSingleVideo(videoUrl, mode, saveDir, videoIndex, fileNameTemplate, thumbnailOption);
        if (success) {
          console.log(`✅ ${videoIndex}/${targetVideos.length}: ${video.title} のダウンロードが完了しました`);
        }
      }

      stopLoading();
      console.log(`✅ ${targetName} のダウンロードが完了しました！`);
      writeExcel(saveDir);
    } else {
      // 単一動画の場合 - 直接ダウンロード処理を実行
      console.log('🔧 単一動画のダウンロードを開始します...');
      
      const success = await downloadSingleVideo(url, mode, saveDir, videoIndex, fileNameTemplate, thumbnailOption);
      
      if (success) {
        console.log(`✅ 動画のダウンロードが完了しました！`);
        writeExcel(saveDir);
      } else {
        throw new Error('ダウンロードが失敗しました');
      }
    }
  } catch (e) {
    console.error(`\n❌ ${url} のダウンロードに失敗しました:`, e.message);
    throw e; // エラーを再スローして上位で処理できるようにする
  }
};

// プロセス停止機能
const stopDownload = () => {
  console.log('\n🛑 ダウンロード停止を要求しています...');
  
  // 停止フラグを設定
  stopRequested = true;
  
  if (currentProcess) {
    try {
      // プロセスIDを取得して確実に停止
      if (currentProcess.pid) {
        process.kill(currentProcess.pid, 'SIGTERM');
      } else {
        currentProcess.kill('SIGTERM');
      }
    } catch (error) {
      console.log('プロセス停止エラー:', error.message);
    }
    currentProcess = null;
  }
  
  if (progressBar && progressBar.isActive) {
    progressBar.stop();
  }
  
  return true;
};

// 停止フラグをリセットする機能
const resetStopFlag = () => {
  stopRequested = false;
  console.log('🔄 停止フラグをリセットしました');
  return true;
};

// 停止状態確認機能
const isStopRequested = () => {
  return stopRequested;
};

// 中断時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n🛑 中断を検知しました。スクリプトを終了します。');
  stopDownload();
  fs.unlinkSync('_metadata.jsonl').catch(() => {});
  process.exit(1);
});

// 関数をエクスポート
module.exports = {
  runDownload,
  stopDownload,
  resetStopFlag,
  isStopRequested,
  getTargetName,
  createSaveDir,
  sanitizeFileName,
  checkCookiesFile,
  getClipboardUrls,
  getLastUrls,
  saveUrls
};

// CLIモードの場合のみメイン処理を実行
if (require.main === module) {
  (async () => {
    // URL選択
    const urls = await selectUrls();
    console.log('選択されたURL:', urls);

    // 選択されたURLを保存
    if (urls.length > 0) {
      saveUrls(urls);
    }

    // ダウンロードモード選択
    const mode = await selectDownloadMode();
    console.log('選択されたモード:', mode);

    let rangeOption = '';
    let applyToAll = false;

    // 各URLに対して処理
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      // プレイリストやチャンネルの場合、範囲選択を先に行う
      if (url.includes('list=') || url.includes('/@') || url.includes('/channel/')) {
        if (i === 0 || !applyToAll) {
          const rangeResult = await selectDownloadRange(url, i === 0, urls.length);
          rangeOption = rangeResult.option;
          applyToAll = rangeResult.applyToAll;
        }
      }

      // 情報取得とフォルダ作成
      startLoading("動画のタイトルと情報を取得中です...");
      
      // 単体動画の場合は動画情報を取得
      if (!url.includes('list=') && !url.includes('/@') && !url.includes('/channel/')) {
        const ytDlpPath = getYtDlpPath();
        const { stdout } = await execPromise(`"${ytDlpPath}" --no-warnings --no-call-home --no-check-certificate --flat-playlist --dump-json --cookies _cookies.txt "${url}"`);
        const videoInfo = JSON.parse(stdout.trim());
        const targetName = videoInfo.title;
        stopLoading();
        const saveDir = createSaveDir(targetName);
        
        await runDownload(url, mode, saveDir, '');
      } else {
        // プレイリストやチャンネルの場合
        const targetName = await getTargetName(url);
        stopLoading();
        const saveDir = createSaveDir(targetName);
        
        await runDownload(url, mode, saveDir, rangeOption);
      }
    }
  })();
}