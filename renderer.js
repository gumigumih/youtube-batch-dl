const { ipcRenderer } = require('electron');

// DOM要素の取得
const urlInput = document.getElementById('urlInput');
const loadLastBtn = document.getElementById('loadLastBtn');

const checkCookiesBtn = document.getElementById('checkCookiesBtn');
const getCookiesBtn = document.getElementById('getCookiesBtn');
const cookiesStatus = document.getElementById('cookiesStatus');
const downloadBtn = document.getElementById('downloadBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const logOutput = document.getElementById('logOutput');
const statusText = typeof document !== 'undefined' ? document.getElementById('statusText') : null;
const rangeSection = document.getElementById('rangeSection');
const rangeInputs = document.getElementById('rangeInputs');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalOk = document.getElementById('modalOk');
const modalCancel = document.getElementById('modalCancel');

// 状態管理
let isDownloading = false;
let currentUrls = [];

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

// アプリケーションの初期化
async function initializeApp() {
    updateStatus('アプリケーションを初期化中...');
    
    // クッキーファイルの確認
    await checkCookiesFile();
    
    // 前回のURLを読み込み
    const lastUrls = await ipcRenderer.invoke('get-last-urls');
    if (lastUrls.length > 0) {
        urlInput.value = lastUrls.join('\n');
        currentUrls = lastUrls;
    }
    
    updateStatus('準備完了');
}

// イベントリスナーの設定
function setupEventListeners() {
    // 前回のURLを読み込み
    loadLastBtn.addEventListener('click', async () => {
        const lastUrls = await ipcRenderer.invoke('get-last-urls');
        if (lastUrls.length > 0) {
            urlInput.value = lastUrls.join('\n');
            currentUrls = lastUrls;
            addLog(`📂 前回のURL ${lastUrls.length} 件を読み込みました`, 'info');
        } else {
            addLog('❌ 前回のURLが見つかりませんでした', 'error');
        }
    });

    // クッキー確認
    checkCookiesBtn.addEventListener('click', async () => {
        await checkCookiesFile();
    });

    // ブラウザからクッキー取得
    getCookiesBtn.addEventListener('click', async () => {
        const browser = await showModal('ブラウザ選択', '使用するブラウザを選択してください', [
            { label: 'Chrome', value: 'chrome' },
            { label: 'Firefox', value: 'firefox' },
            { label: 'Edge', value: 'edge' },
            { label: 'Safari', value: 'safari' }
        ]);
        
        if (browser) {
            addLog(`🌐 ${browser}からクッキーを取得中...`, 'info');
            const success = await ipcRenderer.invoke('get-cookies-from-browser', browser);
            if (success) {
                addLog('✅ クッキーファイルを作成しました', 'success');
                await checkCookiesFile();
            } else {
                addLog('❌ クッキーの取得に失敗しました', 'error');
            }
        }
    });

    // ダウンロード開始
    downloadBtn.addEventListener('click', async () => {
        if (isDownloading) {
            addLog('⚠️ ダウンロードが既に実行中です', 'error');
            return;
        }

        const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
        if (urls.length === 0) {
            addLog('❌ URLが入力されていません', 'error');
            return;
        }

        const downloadMode = document.querySelector('input[name="downloadMode"]:checked').value;
        
        // URLを保存
        await ipcRenderer.invoke('save-urls', urls);
        currentUrls = urls;

        // ダウンロード実行
        await startDownload(urls, downloadMode);
    });

    // 範囲設定の表示/非表示
    document.querySelectorAll('input[name="rangeMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                rangeInputs.style.display = 'flex';
            } else {
                rangeInputs.style.display = 'none';
            }
        });
    });

    // URL入力の監視
    urlInput.addEventListener('input', () => {
        const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
        const hasPlaylist = urls.some(url => url.includes('list=') || url.includes('/@') || url.includes('/channel/'));
        
        if (hasPlaylist) {
            rangeSection.style.display = 'block';
        } else {
            rangeSection.style.display = 'none';
        }
    });

    // モーダルイベント
    modalOk.addEventListener('click', () => {
        modal.style.display = 'none';
        if (modal.resolve) {
            modal.resolve(modal.result);
        }
    });

    modalCancel.addEventListener('click', () => {
        modal.style.display = 'none';
        if (modal.resolve) {
            modal.resolve(null);
        }
    });
}

// クッキーファイルの確認
async function checkCookiesFile() {
    const exists = await ipcRenderer.invoke('check-cookies-file');
    if (exists) {
        cookiesStatus.textContent = '✅ 利用可能';
        cookiesStatus.className = 'status success';
    } else {
        cookiesStatus.textContent = '❌ 未設定';
        cookiesStatus.className = 'status error';
    }
    return exists;
}

// ダウンロード開始
async function startDownload(urls, mode) {
    isDownloading = true;
    downloadBtn.disabled = true;
    progressSection.style.display = 'block';
    
    updateStatus('ダウンロードを開始しています...');
    addLog('🚀 ダウンロードを開始します', 'info');
    
    try {
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            addLog(`📥 ${i + 1}/${urls.length}: ${url}`, 'info');
            
            // 動画情報を取得
            const videoInfo = await ipcRenderer.invoke('get-video-info', url);
            if (!videoInfo) {
                addLog(`❌ 動画情報の取得に失敗しました: ${url}`, 'error');
                continue;
            }
            
            // 保存ディレクトリを作成
            let targetName;
            if (url.includes('list=')) {
                targetName = videoInfo.playlist_title || videoInfo.channel || 'unknown_playlist';
            } else if (url.includes('/@') || url.includes('/channel/')) {
                targetName = videoInfo.channel || videoInfo.uploader || 'unknown_channel';
            } else {
                targetName = videoInfo.title || 'unknown_video';
            }
            
            const saveDir = targetName;
            const createdDir = await ipcRenderer.invoke('create-save-dir', saveDir);
            if (!createdDir) {
                addLog(`❌ 保存ディレクトリの作成に失敗しました: ${targetName}`, 'error');
                continue;
            }
            
            // 範囲オプションを取得
            let rangeOption = '';
            if (url.includes('list=') || url.includes('/@') || url.includes('/channel/')) {
                const rangeMode = document.querySelector('input[name="rangeMode"]:checked').value;
                if (rangeMode === 'custom') {
                    const start = document.getElementById('startRange').value;
                    const end = document.getElementById('endRange').value;
                    if (start && end) {
                        rangeOption = `--playlist-items ${start}-${end}`;
                    }
                }
            }
            
            // ダウンロード実行
            addLog(`🎥 ${targetName} をダウンロード中...`, 'info');
            const result = await ipcRenderer.invoke('download-video', {
                url,
                mode,
                saveDir,
                rangeOption
            });
            
            if (result.success) {
                addLog(`✅ ${targetName} のダウンロードが完了しました`, 'success');
            } else {
                addLog(`❌ ${targetName} のダウンロードに失敗しました: ${result.error}`, 'error');
            }
            
            // 進捗更新
            const progress = ((i + 1) / urls.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${i + 1}/${urls.length} 完了`;
        }
        
        addLog('🎉 すべてのダウンロードが完了しました', 'success');
        updateStatus('ダウンロード完了');
        
    } catch (error) {
        addLog(`❌ ダウンロード中にエラーが発生しました: ${error.message}`, 'error');
        updateStatus('エラーが発生しました');
    } finally {
        isDownloading = false;
        downloadBtn.disabled = false;
    }
}

// ログ追加
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = type;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logOutput.appendChild(logEntry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

// ステータス更新
function updateStatus(message) {
    if (statusText) statusText.textContent = message;
}

// モーダル表示
function showModal(title, message, options = null) {
    return new Promise((resolve) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        if (options) {
            // 選択肢がある場合
            const select = document.createElement('select');
            select.style.width = '100%';
            select.style.padding = '8px';
            select.style.marginBottom = '15px';
            
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                select.appendChild(optionElement);
            });
            
            modalMessage.appendChild(select);
            modal.result = select.value;
            
            select.addEventListener('change', () => {
                modal.result = select.value;
            });
        }
        
        modal.resolve = resolve;
        modal.style.display = 'flex';
    });
}

// エラーハンドリング
window.addEventListener('error', (event) => {
    addLog(`❌ エラーが発生しました: ${event.error.message}`, 'error');
});

// 未処理のPromise拒否
window.addEventListener('unhandledrejection', (event) => {
    addLog(`❌ 未処理のPromise拒否: ${event.reason}`, 'error');
});
