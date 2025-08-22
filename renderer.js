const { ipcRenderer } = require('electron');

// DOM要素の取得
const urlInput = document.getElementById('urlInput');
const loadLastBtn = document.getElementById('loadLastBtn');

const checkCookiesBtn = document.getElementById('checkCookiesBtn');
const getCookiesBtn = document.getElementById('getCookiesBtn');
const cookiesStatus = document.getElementById('cookiesStatus');
const downloadBtn = document.getElementById('downloadBtn');
const progressSection = document.getElementById('progressSection');
const logOutput = document.getElementById('logOutput'); // For expanded log container
const logOutputSingle = document.getElementById('logOutputSingle'); // For single line log
const logContainer = document.getElementById('logContainer'); // Log container
const toggleLogBtn = document.getElementById('toggleLogBtn'); // Toggle log button
const statusText = typeof document !== 'undefined' ? document.getElementById('statusText') : null;
const rangeSection = document.getElementById('rangeSection');
const rangeInputs = document.getElementById('rangeInputs');
const videoSelectionSection = document.getElementById('videoSelectionSection');
const videoListContainer = document.getElementById('videoListContainer');
const loadVideoListBtn = document.getElementById('loadVideoListBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectedCount = document.getElementById('selectedCount');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalOk = document.getElementById('modalOk');
const modalCancel = document.getElementById('modalCancel');
const progressModal = document.getElementById('progressModal');
const modalProgressFill = document.getElementById('modalProgressFill');
const modalProgressText = document.getElementById('modalProgressText');
const modalCurrentFile = document.getElementById('modalCurrentFile');
const modalProgressCount = document.getElementById('modalProgressCount');
const modalLogOutput = document.getElementById('modalLogOutput');
const modalCancelDownload = document.getElementById('modalCancelDownload');

// 状態管理
let isDownloading = false;
let currentUrls = [];

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM読み込み完了');
    console.log('downloadBtn:', downloadBtn);
    console.log('urlInput:', urlInput);
    
    initializeApp();
    setupEventListeners();
});

// アプリケーションの初期化
async function initializeApp() {
    addLog('アプリケーションを初期化中...', 'info');
    
    // クッキーファイルの確認
    await checkCookiesFile();
    
    // 前回のURLを読み込み
    const lastUrls = await ipcRenderer.invoke('get-last-urls');
    if (lastUrls.length > 0) {
        urlInput.value = lastUrls.join('\n');
        currentUrls = lastUrls;
    }
    
    addLog('準備完了', 'info');
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
    console.log('ダウンロードボタンのイベントリスナーを設定中...');
    downloadBtn.addEventListener('click', async () => {
        console.log('ダウンロードボタンがクリックされました');
        
        if (isDownloading) {
            addLog('⚠️ ダウンロードが既に実行中です', 'error');
            return;
        }

        const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
        console.log('URLs:', urls);
        
        if (urls.length === 0) {
            addLog('❌ URLが入力されていません', 'error');
            return;
        }

        // 動画選択モーダルを表示
        const result = await showVideoSelectionModal(urls);
        if (!result) {
            addLog('❌ ダウンロードがキャンセルされました', 'info');
            return;
        }
        
        const { downloadUrls, downloadMode } = result;
        
        // URLを保存
        await ipcRenderer.invoke('save-urls', urls);
        currentUrls = urls;

        // ダウンロード実行
        await startDownload(downloadUrls, downloadMode);
    });

    // 範囲設定の表示/非表示
    document.querySelectorAll('input[name="rangeMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                rangeInputs.style.display = 'flex';
                videoSelectionSection.style.display = 'none';
            } else if (e.target.value === 'select') {
                rangeInputs.style.display = 'none';
                videoSelectionSection.style.display = 'block';
                loadVideoList();
            } else {
                rangeInputs.style.display = 'none';
                videoSelectionSection.style.display = 'none';
            }
        });
    });

    // 動画リスト読み込みボタン
    loadVideoListBtn.addEventListener('click', () => {
        loadVideoList();
    });

    // すべて選択ボタン
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = videoListContainer.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        updateSelectedCount();
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

    // 進捗モーダルのキャンセルボタン
    modalCancelDownload.addEventListener('click', () => {
        if (confirm('ダウンロードを停止しますか？')) {
            isDownloading = false;
            progressModal.style.display = 'none';
            addLog('⚠️ ダウンロードが停止されました', 'warning');
        }
    });

    // ログ開閉ボタン
    toggleLogBtn.addEventListener('click', () => {
        const isExpanded = !logContainer.classList.contains('hidden');
        if (isExpanded) {
            // ログを閉じる
            logContainer.classList.add('hidden');
            toggleLogBtn.innerHTML = '<i class="fas fa-chevron-up text-xs"></i><span>ログ</span>';
        } else {
            // ログを開く
            logContainer.classList.remove('hidden');
            toggleLogBtn.innerHTML = '<i class="fas fa-chevron-down text-xs"></i><span>ログ</span>';
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

// 動画リストを読み込む
async function loadVideoList() {
    const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
    const playlistUrl = urls.find(url => url.includes('list=') || url.includes('/@') || url.includes('/channel/'));
    
    if (!playlistUrl) {
        videoListContainer.innerHTML = `
            <div class="text-center text-gray-500 text-sm py-8">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>プレイリストまたはチャンネルURLが必要です</p>
            </div>
        `;
        return;
    }

    try {
        videoListContainer.innerHTML = `
            <div class="text-center text-gray-500 text-sm py-8">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>動画リストを読み込み中...</p>
            </div>
        `;

        const videoList = await ipcRenderer.invoke('get-playlist-videos', playlistUrl);
        
        if (videoList && videoList.length > 0) {
            displayVideoList(videoList);
        } else {
            videoListContainer.innerHTML = `
                <div class="text-center text-gray-500 text-sm py-8">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>動画リストの取得に失敗しました</p>
                </div>
            `;
        }
    } catch (error) {
        videoListContainer.innerHTML = `
            <div class="text-center text-red-500 text-sm py-8">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>エラー: ${error.message}</p>
            </div>
        `;
    }
}

// 動画リストを表示
function displayVideoList(videos) {
    const videoListHTML = videos.map((video, index) => `
        <div class="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors duration-200">
            <input type="checkbox" id="video-${index}" value="${video.url}" checked class="text-purple-600 w-4 h-4 rounded focus:ring-purple-500">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">${index + 1}</span>
                    <span class="text-sm font-medium text-gray-800 truncate">${video.title}</span>
                </div>
                <div class="text-xs text-gray-500 flex items-center gap-2">
                    <span>${video.duration || '不明'}</span>
                    <span>•</span>
                    <span>${video.upload_date || '不明'}</span>
                </div>
            </div>
        </div>
    `).join('');

    videoListContainer.innerHTML = `
        <div class="space-y-1">
            ${videoListHTML}
        </div>
    `;

    // チェックボックスのイベントリスナーを追加
    const checkboxes = videoListContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedCount);
    });

    updateSelectedCount();
}

// 選択された動画数を更新
function updateSelectedCount() {
    const checkboxes = videoListContainer.querySelectorAll('input[type="checkbox"]');
    const selectedVideos = Array.from(checkboxes).filter(cb => cb.checked);
    selectedCount.textContent = `選択済み: ${selectedVideos.length}件`;
}

// 動画選択モーダルを表示
async function showVideoSelectionModal(urls) {
    const playlistUrl = urls.find(url => url.includes('list=') || url.includes('/@') || url.includes('/channel/'));
    const isPlaylist = !!playlistUrl;
    
    // モーダルを表示
    modal.style.display = 'flex';
    modalTitle.textContent = 'ダウンロードする動画を選択';
    modalMessage.innerHTML = `
        <div class="space-y-4">
            <p>${isPlaylist ? 'プレイリストまたはチャンネルからダウンロードする動画を選択してください。' : 'ダウンロードする動画を確認してください。'}</p>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-sm text-gray-600">動画リストを読み込み中...</span>
                    <button id="modalLoadVideoListBtn" class="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        <i class="fas fa-sync-alt mr-1"></i>更新
                    </button>
                </div>
                <div id="modalVideoListContainer" class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                    <div class="text-center text-gray-500 text-sm py-8">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>動画リストを読み込み中...</p>
                    </div>
                </div>
                <div class="flex items-center justify-between text-sm text-gray-600 mt-3">
                    <span id="modalSelectedCount">選択済み: 0件</span>
                    <button id="modalSelectAllBtn" class="text-purple-600 hover:text-purple-700 font-medium">すべて選択</button>
                </div>
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-3">ダウンロードモード</label>
                        <div class="flex gap-4">
                            <label class="group flex items-center gap-3 cursor-pointer p-4 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 transition-all duration-300 border border-transparent hover:border-purple-200">
                                <input type="radio" name="modalDownloadMode" value="video" checked class="text-purple-600 w-5 h-5">
                                <div class="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                                    <i class="fas fa-video text-purple-600"></i>
                                </div>
                                <div>
                                    <span class="text-gray-800 font-semibold">動画（MP4）</span>
                                    <p class="text-gray-500 text-sm">高品質な動画ファイル</p>
                                </div>
                            </label>
                            <label class="group flex items-center gap-3 cursor-pointer p-4 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 transition-all duration-300 border border-transparent hover:border-purple-200">
                                <input type="radio" name="modalDownloadMode" value="mp3" class="text-purple-600 w-5 h-5">
                                <div class="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                                    <i class="fas fa-music text-purple-600"></i>
                                </div>
                                <div>
                                    <span class="text-gray-800 font-semibold">音声のみ（MP3）</span>
                                    <p class="text-gray-500 text-sm">軽量な音声ファイル</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 動画リストを読み込み
    await loadModalVideoList(playlistUrl);

    // モーダル内のボタンイベントを設定
    const modalLoadVideoListBtn = document.getElementById('modalLoadVideoListBtn');
    const modalSelectAllBtn = document.getElementById('modalSelectAllBtn');
    
    // 単体動画の場合は更新ボタンを非表示
    if (!isPlaylist) {
        modalLoadVideoListBtn.style.display = 'none';
    }
    
    modalLoadVideoListBtn.addEventListener('click', () => {
        loadModalVideoList(playlistUrl);
    });

    modalSelectAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#modalVideoListContainer input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        updateModalSelectedCount();
    });

    // モーダルの結果を待つ
    return new Promise((resolve) => {
        modal.resolve = resolve;
        
        // 確認ボタンのイベントを設定
        const modalConfirm = document.getElementById('modalConfirm');
        modalConfirm.onclick = () => {
            const selectedCheckboxes = document.querySelectorAll('#modalVideoListContainer input[type="checkbox"]:checked');
            const downloadMode = document.querySelector('input[name="modalDownloadMode"]:checked').value;
            
            if (selectedCheckboxes.length === 0) {
                alert('ダウンロードする動画を選択してください。');
                return;
            }
            
            const downloadUrls = Array.from(selectedCheckboxes).map(cb => cb.value);
            modal.style.display = 'none';
            resolve({ downloadUrls, downloadMode });
        };
        
        // キャンセルボタンのイベントを設定
        const modalCancel = document.getElementById('modalCancel');
        modalCancel.onclick = () => {
            modal.style.display = 'none';
            resolve(null);
        };
    });
}

// モーダル内の動画リストを読み込む
async function loadModalVideoList(playlistUrl) {
    const modalVideoListContainer = document.getElementById('modalVideoListContainer');
    
    try {
        modalVideoListContainer.innerHTML = `
            <div class="text-center text-gray-500 text-sm py-8">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>動画情報を読み込み中...</p>
            </div>
        `;

        if (playlistUrl) {
            // プレイリストの場合
            const videoList = await ipcRenderer.invoke('get-playlist-videos', playlistUrl);
            
            if (videoList && videoList.length > 0) {
                displayModalVideoList(videoList);
            } else {
                modalVideoListContainer.innerHTML = `
                    <div class="text-center text-gray-500 text-sm py-8">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>動画リストの取得に失敗しました</p>
                    </div>
                `;
            }
        } else {
            // 単体動画の場合
            const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
            const videoList = [];
            
            for (const url of urls) {
                const videoInfo = await ipcRenderer.invoke('get-video-info', url);
                if (videoInfo) {
                    videoList.push({
                        url: videoInfo.url || videoInfo.webpage_url,
                        title: videoInfo.title,
                        duration: videoInfo.duration_string,
                        upload_date: videoInfo.upload_date,
                        thumbnail: videoInfo.thumbnail
                    });
                }
            }
            
            if (videoList.length > 0) {
                displayModalVideoList(videoList);
            } else {
                modalVideoListContainer.innerHTML = `
                    <div class="text-center text-gray-500 text-sm py-8">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>動画情報の取得に失敗しました</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        modalVideoListContainer.innerHTML = `
            <div class="text-center text-red-500 text-sm py-8">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>エラー: ${error.message}</p>
            </div>
        `;
    }
}

// モーダル内の動画リストを表示
function displayModalVideoList(videos) {
    const modalVideoListContainer = document.getElementById('modalVideoListContainer');
    
    const videoListHTML = videos.map((video, index) => `
        <div class="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors duration-200">
            <input type="checkbox" id="modal-video-${index}" value="${video.url}" checked class="text-purple-600 w-4 h-4 rounded focus:ring-purple-500">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">${index + 1}</span>
                    <span class="text-sm font-medium text-gray-800 truncate">${video.title}</span>
                </div>
                <div class="text-xs text-gray-500 flex items-center gap-2">
                    <span>${video.duration || '不明'}</span>
                    <span>•</span>
                    <span>${video.upload_date || '不明'}</span>
                </div>
            </div>
        </div>
    `).join('');

    modalVideoListContainer.innerHTML = `
        <div class="space-y-1">
            ${videoListHTML}
        </div>
    `;

    // チェックボックスのイベントリスナーを追加
    const checkboxes = modalVideoListContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateModalSelectedCount);
    });

    updateModalSelectedCount();
}

// モーダル内の選択された動画数を更新
function updateModalSelectedCount() {
    const checkboxes = document.querySelectorAll('#modalVideoListContainer input[type="checkbox"]:checked');
    const selectedVideos = Array.from(checkboxes).filter(cb => cb.checked);
    const modalSelectedCount = document.getElementById('modalSelectedCount');
    modalSelectedCount.textContent = `選択済み: ${selectedVideos.length}件`;
}

// ダウンロード開始
async function startDownload(urls, mode) {
    isDownloading = true;
    downloadBtn.disabled = true;
    
    // 進捗モーダルを表示
    progressModal.style.display = 'flex';
    modalProgressFill.style.width = '0%';
    modalProgressText.textContent = '準備中...';
    modalCurrentFile.textContent = '-';
    modalProgressCount.textContent = `0 / ${urls.length}`;
    modalLogOutput.innerHTML = '';
    
    // ステータスバーを表示
    const statusBar = document.getElementById('statusBar');
    statusBar.style.display = 'block';
    
    addLog('🚀 ダウンロードを開始します', 'info');
    addModalLog('🚀 ダウンロードを開始します', 'info');
    
    try {
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            
            // 進捗更新
            const modalProgress = ((i) / urls.length) * 100;
            modalProgressFill.style.width = `${modalProgress}%`;
            modalProgressText.textContent = `${i + 1}/${urls.length} 処理中...`;
            modalProgressCount.textContent = `${i + 1} / ${urls.length}`;
            
            addLog(`📥 ${i + 1}/${urls.length}: ${url}`, 'info');
            addModalLog(`📥 ${i + 1}/${urls.length}: ${url}`, 'info');
            
            // 動画情報を取得
            const videoInfo = await ipcRenderer.invoke('get-video-info', url);
            if (!videoInfo) {
                addLog(`❌ 動画情報の取得に失敗しました: ${url}`, 'error');
                addModalLog(`❌ 動画情報の取得に失敗しました: ${url}`, 'error');
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
            
            // 現在のファイル名を更新
            modalCurrentFile.textContent = targetName;
            
            const saveDir = targetName;
            const createdDir = await ipcRenderer.invoke('create-save-dir', saveDir);
            if (!createdDir) {
                addLog(`❌ 保存ディレクトリの作成に失敗しました: ${targetName}`, 'error');
                addModalLog(`❌ 保存ディレクトリの作成に失敗しました: ${targetName}`, 'error');
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
            addModalLog(`🎥 ${targetName} をダウンロード中...`, 'info');
            const result = await ipcRenderer.invoke('download-video', {
                url,
                mode,
                saveDir,
                rangeOption
            });
            
            if (result.success) {
                addLog(`✅ ${targetName} のダウンロードが完了しました`, 'success');
                addModalLog(`✅ ${targetName} のダウンロードが完了しました`, 'success');
            } else {
                addLog(`❌ ${targetName} のダウンロードに失敗しました: ${result.error}`, 'error');
                addModalLog(`❌ ${targetName} のダウンロードに失敗しました: ${result.error}`, 'error');
            }
            
            // 進捗更新
            const progress = ((i + 1) / urls.length) * 100;
            modalProgressFill.style.width = `${progress}%`;
            modalProgressText.textContent = `${i + 1}/${urls.length} 完了`;
        }
        
        addLog('🎉 すべてのダウンロードが完了しました', 'success');
        addModalLog('🎉 すべてのダウンロードが完了しました', 'success');
        
    } catch (error) {
        addLog(`❌ ダウンロード中にエラーが発生しました: ${error.message}`, 'error');
        addModalLog(`❌ ダウンロード中にエラーが発生しました: ${error.message}`, 'error');
    } finally {
        isDownloading = false;
        downloadBtn.disabled = false;
        
        // 進捗モーダルを非表示
        progressModal.style.display = 'none';
        
        // ステータスバーを非表示
        const statusBar = document.getElementById('statusBar');
        statusBar.style.display = 'none';
    }
}

// ログ追加
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // 一行表示用（最新ログのみ）
    logOutputSingle.textContent = logEntry;
    
    // 展開されたログエリア用（履歴表示）
    const logElement = document.createElement('div');
    logElement.className = `log-entry log-${type} mb-1`;
    logElement.textContent = logEntry;
    
    logOutput.appendChild(logElement);
    logOutput.scrollTop = logOutput.scrollHeight;
}

// モーダルログ追加
function addModalLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    
    modalLogOutput.appendChild(logEntry);
    modalLogOutput.scrollTop = modalLogOutput.scrollHeight;
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
