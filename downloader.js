// index.js
const prompts = require('prompts');
const clipboardy = require('clipboardy');
const fs = require('fs-extra');
const path = require('path');
const xlsx = require('xlsx');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const readline = require('readline');

// ローディングアニメーション用の変数
let loadingInterval = null;

// ローディングアニメーションを開始
const startLoading = (message) => {
  // 既存のアニメーションを停止
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  
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
};

// ローディングアニメーションを停止
const stopLoading = () => {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  process.stdout.write('\r\x1B[K'); // 現在の行をクリア
  process.stdout.write('\x1B[?25h'); // カーソルを表示
};

// ffmpegのパスを設定
process.env.FFMPEG_PATH = ffmpeg.path;

// クリップボードからURL取得
const getClipboardUrls = async () => {
  try {
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

  // 前回のURLがあれば追加
  if (lastUrls.length > 0) {
    options.push({ title: `前回のURLを使う (${lastUrls.length}件)`, value: 'last' });
  }

  // クリップボードのURLがあれば追加
  if (clipboardUrls.length > 0) {
    options.push({ title: `クリップボードのURLを使う (${clipboardUrls.length}件)`, value: 'clipboard' });
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
    if (!fs.existsSync('_cookies.txt')) {
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
          await execPromise(`yt-dlp --cookies-from-browser ${browserResponse.browser} --cookies _cookies.txt`);
          console.log('✅ クッキーファイルを作成しました');
          return true;
        } catch (e) {
          console.error('❌ クッキーの取得に失敗しました:', e.message);
          return false;
        }
      }
      return false;
    }
    return true;
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

    const { stdout } = await execPromise(`yt-dlp ${options.join(' ')} "${url}"`);
    
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

// 保存ディレクトリ作成
const createSaveDir = (dirName) => {
  const saveDir = dirName.replace(/[\\/:*?"<>|]/g, '_');
  fs.mkdirSync(saveDir, { recursive: true });
  console.log(`📁 フォルダを作成しました: ${saveDir}`);
  return saveDir;
};

// プレイリスト情報を取得
const getPlaylistInfo = async (url) => {
  const { stdout } = await execPromise(`yt-dlp --no-warnings --no-call-home --no-check-certificate --flat-playlist --dump-json --cookies _cookies.txt "${url}"`);
  
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

  return videoInfos.map((v, i) => `${i + 1}: ${v.title}`);
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
    choices: videoList.map(v => ({ title: v, value: v.split(':')[0] }))
  });

  // 終了動画を選択
  const endResponse = await prompts({
    type: 'select',
    name: 'end',
    message: '終了動画を選んでください',
    choices: videoList.map(v => ({ title: v, value: v.split(':')[0] }))
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

// yt-dlpでダウンロード
const runDownload = async (url, mode, saveDir, rangeOption) => {
  const options = mode === 'mp3' 
    ? ['-x', '--audio-format', 'mp3', '--audio-quality', '0'] 
    : ['-f', '"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"', '--merge-output-format', 'mp4', '--embed-thumbnail'];

  // ダウンロードオプション
  const downloadOptions = [
    ...options,
    ...(rangeOption ? [rangeOption] : []),
    '-o', '"%(title)s.%(ext)s"',
    '--write-thumbnail',
    '--convert-thumbnails', 'png',
    '--compat-options', 'filename-sanitization',
    '--download-archive', '_downloaded.txt',
    '--newline',
    '--progress-template', '"%(progress._percent_str)s"',
    '--no-warnings',
    '--no-call-home',
    '--no-check-certificate'
  ];

  // クッキーファイルが存在する場合のみ追加
  if (await checkCookiesFile()) {
    downloadOptions.push('--cookies', '_cookies.txt');
  }

  try {    
    const command = `yt-dlp ${downloadOptions.join(' ')} "${url}"`;
    const process = exec(command, { 
      cwd: saveDir,
      shell: '/bin/bash'
    });
    
    let errorOutput = '';
    let currentVideo = '';
    let currentIndex = 0;
    let downloadedFiles = [];
    
    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('[download] Destination:')) {
          const tempFileName = line.split('Destination:')[1].trim();
          currentVideo = tempFileName.replace(/\.f\d+\.mp4$/, '.mp4');
          console.log(`ダウンロード中: ${currentVideo}`);
        } else if (line.includes('has already been downloaded')) {
          const fileName = line.split('"')[1];
          downloadedFiles.push(fileName);
          console.log(`📥 ダウンロード済み: ${fileName}`);
        } else if (line.includes('[Merger] Merging formats into')) {
          const fileName = line.split('"')[1].replace('"', '');
          downloadedFiles.push(fileName);
          console.log(`📥 ダウンロード完了: ${fileName}`);
        }
      }
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    await new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ダウンロードが失敗しました（終了コード: ${code}）\nエラー詳細: ${errorOutput}`));
        }
      });
    });

    // ダウンロード完了後にファイル名を変更
    for (const file of downloadedFiles) {
      try {
        const ext = path.extname(file);
        const baseName = path.basename(file, ext);
        currentIndex++;
        const newName = `${String(currentIndex).padStart(3, '0')} - ${baseName}${ext}`;
        
        // ファイル名を変更
        fs.renameSync(path.join(saveDir, file), path.join(saveDir, newName));
        console.log(`✅ リネーム完了: ${newName}`);
      } catch (e) {
        console.error(`❌ リネーム失敗: ${file}`, e.message);
      }
    }

    stopLoading();
    console.log(`✅ ${url} のダウンロードが完了しました！`);
    writeExcel(saveDir);
  } catch (e) {
    console.error(`\n❌ ${url} のダウンロードに失敗しました:`, e.message);
  }
};

// 中断時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n🛑 中断を検知しました。スクリプトを終了します。');
  fs.unlinkSync('_metadata.jsonl').catch(() => {});
  process.exit(1);
});

// メイン処理
(async () => {
  // URL選択
  const urls = await selectUrls();
  console.log('選択されたURL:', urls);

  // ダウンロードモード選択
  const mode = await selectDownloadMode();
  console.log('選択されたモード:', mode);

  let rangeOption = '';
  let applyToAll = false;

  // 各URLに対して処理
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    startLoading("動画のタイトルと情報を取得中です...");
    const targetName = await getTargetName(url);
    stopLoading();
    const saveDir = createSaveDir(targetName);
    
    if (url.includes('list=') || url.includes('/@') || url.includes('/channel/')) {
      if (i === 0 || !applyToAll) {
        const rangeResult = await selectDownloadRange(url, i === 0, urls.length);
        rangeOption = rangeResult.option;
        applyToAll = rangeResult.applyToAll;
      }
    } else {
      // 通常の動画の場合は範囲選択をスキップ
      rangeOption = '';
    }
    
    await runDownload(url, mode, saveDir, rangeOption);
  }
})();