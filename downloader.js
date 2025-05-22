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
const cliProgress = require('cli-progress');

// ローディングアニメーション用の変数
let loadingInterval = null;

// プログレスバーのインスタンス
const progressBar = new cliProgress.SingleBar({
  format: 'ダウンロード進捗 |{bar}| {percentage}% | {value}/{total} MB | {title}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

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
const downloadSingleVideo = async (url, mode, saveDir, currentIndex) => {
  const options = mode === 'mp3' 
    ? ['-x', '--audio-format', 'mp3', '--audio-quality', '0'] 
    : ['-f', '"bestvideo+bestaudio/best"', '--merge-output-format', 'mp4', '--embed-thumbnail'];

  // ダウンロードオプション
  const downloadOptions = [
    ...options,
    '-o', `"${String(currentIndex).padStart(3, '0')} - %(title)s.%(ext)s"`,
    '--write-thumbnail',
    '--convert-thumbnails', 'png',
    '--compat-options', 'filename-sanitization',
    '--download-archive', '_downloaded.txt',
    '--newline',
    '--progress-template', '"%(progress._percent_str)s of %(progress._total_bytes_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s"',
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
    let downloadedFiles = [];
    let totalBytes = 0;
    let downloadedBytes = 0;
    let currentTitle = '';
    let progressCompleted = false;  // 進捗完了フラグを追加
    
    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('[download] Destination:')) {
          const tempFileName = line.split('Destination:')[1].trim();
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
            if (progressBar.isActive) {
              progressBar.stop();
            }
            progressCompleted = true;  // ダウンロード済みの場合は完了フラグを設定
          }
        } else if (line.includes('[Merger] Merging formats into')) {
          const fileName = line.split('"')[1].replace('"', '');
          downloadedFiles.push(fileName);
          if (progressBar.isActive) {
            progressBar.stop();
          }
          console.log(`📥 ダウンロード完了: ${fileName}`);
          progressCompleted = true;  // マージ完了時に完了フラグを設定
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
                
                if (!progressBar.isActive) {
                  progressBar.start(Math.ceil(sizeInMB), 0, { title: currentTitle });
                }
                
                progressBar.update(Math.ceil(sizeInMB * percent / 100), { title: currentTitle });
                
                // 100%に達したら完了フラグを設定
                if (percent >= 100) {
                  progressCompleted = true;
                }
              } else {
                // パーセンテージのみの場合
                if (!progressBar.isActive) {
                  progressBar.start(100, 0, { title: currentTitle });
                }
                progressBar.update(Math.ceil(percent), { title: currentTitle });
                
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
        if (progressBar.isActive) {
          progressBar.stop();
        }
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ダウンロードが失敗しました（終了コード: ${code}）\nエラー詳細: ${errorOutput}`));
        }
      });
    });

    return true;
  } catch (e) {
    console.error(`\n❌ ${url} のダウンロードに失敗しました:`, e.message);
    return false;
  }
};

// yt-dlpでダウンロード
const runDownload = async (url, mode, saveDir, rangeOption) => {
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
      
      for (const video of targetVideos) {
        const videoUrl = `https://youtu.be/${video.id}`;
        console.log(`\n🎥 ${video.title} をダウンロード中...`);
        const success = await downloadSingleVideo(videoUrl, mode, saveDir, currentIndex);
        if (success) {
          currentIndex++;
        }
      }

      stopLoading();
      console.log(`✅ ${targetName} のダウンロードが完了しました！`);
      writeExcel(saveDir);
    } else {
      // 単一動画の場合
      startLoading("動画情報を取得中です...");
      const { stdout } = await execPromise(`yt-dlp --no-warnings --no-call-home --no-check-certificate --flat-playlist --dump-json --cookies _cookies.txt "${url}"`);
      const videoInfo = JSON.parse(stdout.trim());
      stopLoading();

      await downloadSingleVideo(url, mode, saveDir, currentIndex);

      stopLoading();
      console.log(`✅ ${videoInfo.title} のダウンロードが完了しました！`);
      writeExcel(saveDir);
    }
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
      const { stdout } = await execPromise(`yt-dlp --no-warnings --no-call-home --no-check-certificate --flat-playlist --dump-json --cookies _cookies.txt "${url}"`);
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