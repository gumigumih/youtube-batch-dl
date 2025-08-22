const { ipcRenderer } = require('electron');

// DOM要素の取得
let urlInput, checkCookiesBtn, openCookiesDirBtn, cookiesStatus, downloadBtn;
let downloadPathInput, selectDownloadPathBtn;
let settingsPanel, videoSelectionPanel, progressPanel;
       let videoListContainer, loadVideoListBtn, selectAllBtn, selectedCount;
       let startDownloadBtn, progressFill, progressText, currentFile, progressCount;
let progressLogOutput, cancelDownloadBtn, currentFileName;

function getElements() {
    console.log('getElements called');
    urlInput = document.getElementById('urlInput');
    checkCookiesBtn = document.getElementById('checkCookiesBtn');
    openCookiesDirBtn = document.getElementById('openCookiesDirBtn');
    cookiesStatus = document.getElementById('cookiesStatus');
    downloadBtn = document.getElementById('downloadBtn');
    
    // ダウンロードフォルダ設定要素
    downloadPathInput = document.getElementById('downloadPathInput');
    selectDownloadPathBtn = document.getElementById('selectDownloadPathBtn');
    
    console.log('urlInput:', urlInput);
    console.log('downloadBtn:', downloadBtn);
    
    // パネル要素
    settingsPanel = document.getElementById('settingsPanel');
    videoSelectionPanel = document.getElementById('videoSelectionPanel');
    progressPanel = document.getElementById('progressPanel');
    
    // 設定パネル要素
    
    
            // 動画選択パネル要素
        videoListContainer = document.getElementById('videoListContainer');

        loadVideoListBtn = document.getElementById('loadVideoListBtn');
        selectAllBtn = document.getElementById('selectAllBtn');
        selectedCount = document.getElementById('selectedCount');
               startDownloadBtn = document.getElementById('startDownloadBtn');
    
    // 進捗パネル要素
    progressFill = document.getElementById('progressFill');
    progressText = document.getElementById('progressText');
    currentFile = document.getElementById('currentFile');
    progressCount = document.getElementById('progressCount');
    progressLogOutput = document.getElementById('progressLogOutput');
    currentFileName = document.getElementById('currentFileName');
    cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
    


}

// 状態管理
let isDownloading = false;
let currentUrls = [];
let currentPanel = 'settings';



// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM読み込み完了');
    
    // DOM要素を取得
    getElements();
    
    console.log('downloadBtn:', downloadBtn);
    console.log('urlInput:', urlInput);
    
    initializeApp();
    setupEventListeners();
});

// アプリケーションの初期化
async function initializeApp() {
    addLog('アプリケーションを初期化中...', 'info');
    
    // デスクトップ通知の権限を要求
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    
    // クッキーファイルの確認
    await checkCookiesFile();
    
    // ダウンロードパスの初期化
    await initializeDownloadPath();
    
    // デフォルトパスの表示
    await updateDefaultPathDisplay();
    
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

    // クッキー確認
    if (checkCookiesBtn) {
        checkCookiesBtn.addEventListener('click', async () => {
            await checkCookiesFile();
        });
    }

    // ダウンロードフォルダを開く
    if (openCookiesDirBtn) {
        openCookiesDirBtn.addEventListener('click', async () => {
            try {
                addLog('📁 ダウンロードフォルダを開いています...', 'info');
                console.log('Calling open-cookies-directory...');
                const result = await ipcRenderer.invoke('open-cookies-directory');
                console.log('Result:', result);
                
                if (result && result.success) {
                    addLog('✅ ダウンロードフォルダを開きました', 'success');
                    addLog(`📂 フォルダ場所: ${result.path}`, 'info');
                    await checkCookiesFile();
                } else {
                    const errorMsg = result ? result.error : 'Unknown error';
                    addLog(`❌ フォルダを開けませんでした: ${errorMsg}`, 'error');
                }
            } catch (error) {
                console.error('Error in openCookiesDirBtn click handler:', error);
                addLog(`❌ エラーが発生しました: ${error.message}`, 'error');
            }
        });
    }

    // ダウンロードフォルダ選択
    if (selectDownloadPathBtn) {
        selectDownloadPathBtn.addEventListener('click', async () => {
            try {
                addLog('📁 ダウンロードフォルダを選択中...', 'info');
                const result = await ipcRenderer.invoke('select-download-folder');
                
                if (result && result.success) {
                    if (downloadPathInput) {
                        downloadPathInput.value = result.path;
                    }
                    addLog('✅ ダウンロードフォルダを設定しました', 'success');
                    addLog(`📂 保存先: ${result.path}`, 'info');
                } else if (result && result.canceled) {
                    addLog('ℹ️ フォルダ選択をキャンセルしました', 'info');
                } else {
                    const errorMsg = result ? result.error : 'Unknown error';
                    addLog(`❌ フォルダ選択に失敗しました: ${errorMsg}`, 'error');
                }
            } catch (error) {
                console.error('Error in selectDownloadPathBtn click handler:', error);
                addLog(`❌ エラーが発生しました: ${error.message}`, 'error');
            }
        });
    }

        // ダウンロード開始
    console.log('ダウンロードボタンのイベントリスナーを設定中...');
    console.log('downloadBtn:', downloadBtn);
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('ダウンロードボタンがクリックされました');
            console.log('イベント:', e);
            
            const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
            console.log('URLs:', urls);
            console.log('urlInput.value:', urlInput.value);
            
            if (urls.length === 0) {
                addLog('❌ URLが入力されていません', 'error');
                return;
            }

            console.log('動画選択パネルに切り替えます');
            // 動画選択パネルに切り替え
            if (settingsPanel) settingsPanel.classList.add('hidden');
            if (videoSelectionPanel) videoSelectionPanel.classList.remove('hidden');
            if (progressPanel) progressPanel.classList.add('hidden');
            
            // ステータスを初期化
    
            
            // 動画リストを読み込み
            loadVideoList();
            
            // URLを保存
            await ipcRenderer.invoke('save-urls', urls);
            currentUrls = urls;
        });
    } else {
        console.error('downloadBtnが見つかりません');
    }



    
               if (startDownloadBtn) {
               startDownloadBtn.addEventListener('click', async () => {
                   if (isDownloading) {
                       addLog('⚠️ ダウンロードが既に実行中です', 'error');
                       return;
                   }

                   const selectedVideos = getSelectedVideos();
                   const downloadMode = getDownloadMode();
                   const thumbnailOption = getThumbnailOption();
                   
                   if (selectedVideos.length === 0) {
                       addLog('❌ 動画が選択されていません', 'error');
                       return;
                   }

                   console.log('ダウンロードモード:', downloadMode);
                   console.log('選択された動画:', selectedVideos);

                   // 進捗パネルに切り替え
                   if (settingsPanel) settingsPanel.classList.add('hidden');
                   if (videoSelectionPanel) videoSelectionPanel.classList.add('hidden');
                   if (progressPanel) progressPanel.classList.remove('hidden');
                   await startDownload(selectedVideos, 'selected', downloadMode, thumbnailOption);
               });
           }



    // 動画リスト読み込みボタン
    if (loadVideoListBtn) {
        loadVideoListBtn.addEventListener('click', () => {
            loadVideoList();
        });
    }

    // すべて選択ボタン
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = videoListContainer.querySelectorAll('input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            checkboxes.forEach(cb => {
                cb.checked = !allChecked;
            });
            
            updateSelectedCount();
        });
    }



    // 進捗パネルのキャンセルボタン
    if (cancelDownloadBtn) {
        cancelDownloadBtn.addEventListener('click', async () => {
            if (confirm('ダウンロードを停止しますか？')) {
                                try {
                    // まずフロントエンドの停止フラグを設定
                    isDownloading = false;
                    
                    const result = await ipcRenderer.invoke('stop-download');
                    if (result.success) {
                        addLog('⚠️ ダウンロードが停止されました', 'warning');
                        addProgressLog('⚠️ ダウンロードが停止されました', 'warning');
                        
                        // ボタンを有効化
                        downloadBtn.disabled = false;
                        
                        // 設定パネルに戻る
                        if (settingsPanel) settingsPanel.classList.remove('hidden');
                        if (videoSelectionPanel) videoSelectionPanel.classList.add('hidden');
                        if (progressPanel) progressPanel.classList.add('hidden');
                    } else {
                        addLog('❌ ダウンロード停止に失敗しました', 'error');
                        addProgressLog('❌ ダウンロード停止に失敗しました', 'error');
                    }
                } catch (error) {
                    addLog(`❌ ダウンロード停止エラー: ${error.message}`, 'error');
                    addProgressLog(`❌ ダウンロード停止エラー: ${error.message}`, 'error');
                }
            }
        });
    }


}

// クッキーファイルの確認
async function checkCookiesFile() {
    const result = await ipcRenderer.invoke('check-cookies-file');
    if (result.exists) {
        cookiesStatus.innerHTML = '<i class="fas fa-check text-emerald-600"></i> クッキーファイル利用可能';
        cookiesStatus.className = 'text-sm text-emerald-600';
    } else {
        cookiesStatus.innerHTML = '<i class="fas fa-times text-red-600"></i> 未設定';
        cookiesStatus.className = 'text-sm text-red-600';
    }
    return result.exists;
}

// ダウンロードパスの初期化
async function initializeDownloadPath() {
    try {
        const result = await ipcRenderer.invoke('get-download-path');
        if (result.success && downloadPathInput) {
            downloadPathInput.value = result.path;
        }
    } catch (error) {
        console.error('Failed to initialize download path:', error);
    }
}

// デフォルトパスの表示を更新
async function updateDefaultPathDisplay() {
    try {
        const result = await ipcRenderer.invoke('get-default-download-path');
        if (result.success) {
            const defaultPathElement = document.getElementById('defaultDownloadPath');
            if (defaultPathElement) {
                defaultPathElement.textContent = result.path;
            }
        }
    } catch (error) {
        console.error('Failed to update default path display:', error);
    }
}



// 動画リストを読み込む
async function loadVideoList() {
    console.log('loadVideoList called');
    console.log('videoListContainer:', videoListContainer);
    
    const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
    console.log('URLs:', urls);
    
    const playlistUrl = urls.find(url => url.includes('list=') || url.includes('/@') || url.includes('/channel/'));
    console.log('playlistUrl:', playlistUrl);
    
    if (!videoListContainer) {
        console.error('videoListContainer not found');
        return;
    }
    
    if (!playlistUrl) {
        console.log('No playlist URL found, showing single video option');
        // 単体動画の場合
        if (urls.length > 0) {
    
            const singleVideo = {
                title: '入力された動画',
                url: urls[0],
                duration: '不明',
                upload_date: '不明'
            };
            displayVideoList([singleVideo]);
        } else {
    
            videoListContainer.innerHTML = `
                <div class="text-center text-gray-500 text-sm py-8">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>URLが入力されていません</p>
                </div>
            `;
        }
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
    console.log('displayVideoList called with:', videos);
    console.log('videoListContainer:', videoListContainer);
    
    if (!videoListContainer) {
        console.error('videoListContainer not found in displayVideoList');
        return;
    }
    
    // 動画データをグローバルに保存
    window.videoListData = videos;
    
    const videoListHTML = videos.map((video, index) => `
        <div class="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors duration-200">
            <input type="checkbox" id="video-${index}" data-video-index="${index}" value="${video.url}" checked class="text-purple-600 w-4 h-4 rounded focus:ring-purple-500">
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
    if (selectedCount && videoListContainer) {
        const checkboxes = videoListContainer.querySelectorAll('input[type="checkbox"]');
        const selectedVideos = Array.from(checkboxes).filter(cb => cb.checked);
        selectedCount.textContent = `選択済み: ${selectedVideos.length}件`;
    }
}

       // 選択された動画を取得
       function getSelectedVideos() {
           if (!videoListContainer || !window.videoListData) return [];
           
           const checkboxes = videoListContainer.querySelectorAll('input[type="checkbox"]:checked');
           const selectedVideos = [];
           
           checkboxes.forEach(cb => {
               const videoIndex = parseInt(cb.getAttribute('data-video-index'));
               if (!isNaN(videoIndex) && window.videoListData[videoIndex]) {
                   selectedVideos.push(window.videoListData[videoIndex]);
               }
           });
           
           console.log('getSelectedVideos returning:', selectedVideos);
           return selectedVideos;
       }

       // ダウンロードモードを取得
       function getDownloadMode() {
           const downloadModeRadio = document.querySelector('input[name="downloadMode"]:checked');
           return downloadModeRadio ? downloadModeRadio.value : 'video';
       }

       // サムネイル取得オプションを取得
       function getThumbnailOption() {
           const thumbnailCheckbox = document.getElementById('thumbnailOption');
           return thumbnailCheckbox ? thumbnailCheckbox.checked : true;
       }

       // デスクトップ通知オプションを取得
       function getDesktopNotificationOption() {
           const notificationCheckbox = document.getElementById('desktopNotificationOption');
           return notificationCheckbox ? notificationCheckbox.checked : true;
       }

       // デスクトップ通知を表示
       function showDesktopNotification(title, body, icon = null) {
           if (!getDesktopNotificationOption()) return;
           
           // 通知権限をチェック
           if (Notification.permission === 'granted') {
               new Notification(title, { 
                   body, 
                   icon: icon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iIzk5MzNGRiIvPjxwYXRoIGQ9Ik0yMCAyNEgyMC42MjVDMjEuMjQ0IDI0IDIxLjcwNSAyNC4yOTcgMjIuMDA3IDI0Ljg5MUwyMy4xMzMgMjdIMjMuNzMzQzI0LjU5NSAyNyAyNS4zMzMgMjcuNjcyIDI1LjMzMyAyOC41VjM5LjVDMjUuMzMzIDQwLjMyOCAyNC41OTUgNDEgMjMuNzMzIDQxSDIwVjI0WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4='
               });
           } else if (Notification.permission !== 'denied') {
               // 通知権限を要求
               Notification.requestPermission().then(permission => {
                   if (permission === 'granted') {
                       new Notification(title, { body, icon });
                   }
               });
           }
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
            console.log('Loading playlist videos for:', playlistUrl);
            const videoList = await ipcRenderer.invoke('get-playlist-videos', playlistUrl);
            console.log('Received video list:', videoList);
            
            if (videoList && videoList.length > 0) {
                displayModalVideoList(videoList);
            } else {
                modalVideoListContainer.innerHTML = `
                    <div class="text-center text-gray-500 text-sm py-8">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>動画リストの取得に失敗しました</p>
                        <p class="text-xs mt-2">URL: ${playlistUrl}</p>
                    </div>
                `;
            }
        } else {
            // 単体動画の場合
            const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
            const videoList = [];
            
            for (const url of urls) {
                console.log('Loading video info for:', url);
                const videoInfo = await ipcRenderer.invoke('get-video-info', url);
                console.log('Received video info:', videoInfo);
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
async function startDownload(videos, mode, downloadMode = 'video', thumbnailOption = true) {
    isDownloading = true;
    downloadBtn.disabled = true;
    
    console.log('Starting download with videos:', videos);
    
    // 進捗パネルの初期化
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '準備中...';
    if (currentFile) currentFile.textContent = '-';
    if (currentFileName) currentFileName.textContent = '-';
    if (progressCount) progressCount.textContent = `0 / ${videos.length}`;
    if (progressLogOutput) progressLogOutput.innerHTML = '';
    


    
    addLog('🚀 ダウンロードを開始します', 'info');

    try {
        // 再生リストの場合は1つのフォルダを作成
        let saveDir = null;
        const urls = urlInput.value.trim().split('\n').filter(url => url.trim());
        const playlistUrl = urls.find(url => url.includes('list=') || url.includes('/@') || url.includes('/channel/'));
        
        if (playlistUrl) {
            // プレイリストタイトルを取得
            addProgressLog('📁 プレイリストのフォルダを作成中...', 'info');
            const playlistTitle = await ipcRenderer.invoke('get-playlist-title', playlistUrl);
            const createdDir = await ipcRenderer.invoke('create-save-dir', playlistTitle);
            
            if (!createdDir) {
                addLog(`❌ 保存ディレクトリの作成に失敗しました: ${playlistTitle}`, 'error');
                return;
            }
            saveDir = createdDir;
            addProgressLog(`📁 フォルダを作成しました: ${playlistTitle}`, 'success');
        }
        
        for (let i = 0; i < videos.length; i++) {
            // 停止要求をチェック
            if (!isDownloading) {
                addLog('🛑 ダウンロードが停止されました', 'warning');
                addProgressLog('🛑 ダウンロードが停止されました', 'warning');
                break;
            }
            
            const video = videos[i];
            const url = video.url;
            
            // 進捗更新
            const modalProgress = ((i) / videos.length) * 100;
            if (progressFill) progressFill.style.width = `${modalProgress}%`;
            if (progressText) progressText.textContent = `${i + 1}/${videos.length} 処理中`;
            if (progressCount) progressCount.textContent = `${i + 1} / ${videos.length}`;
            
            addLog(`📥 ${i + 1}/${videos.length}: ${video.title}`, 'info');
            addProgressLog(`📥 ${i + 1}/${videos.length}: ${video.title}`, 'info');
            
            // 現在のファイル名を更新
            const targetName = video.title || 'unknown_video';
            if (currentFile) currentFile.textContent = targetName;
            if (currentFileName) currentFileName.textContent = targetName;
            
            // 単体動画の場合は個別フォルダを作成
            if (!saveDir) {
                const createdDir = await ipcRenderer.invoke('create-save-dir', targetName);
                if (!createdDir) {
                    addLog(`❌ 保存ディレクトリの作成に失敗しました: ${targetName}`, 'error');
                    continue;
                }
                saveDir = createdDir;
            }
            
            // ダウンロード実行
            addLog(`🎥 ${targetName} をダウンロード中...`, 'info');
            addProgressLog(`🎥 ${targetName} をダウンロード中...`, 'info');

            const result = await ipcRenderer.invoke('download-video', {
                url,
                mode,
                downloadMode,
                saveDir,
                rangeOption: '',
                thumbnailOption
            });
            
            // ダウンロード後に停止状態をチェック
            const statusResult = await ipcRenderer.invoke('check-download-status');
            if (statusResult.isStopRequested) {
                addLog('🛑 ダウンロードが停止されました', 'warning');
                addProgressLog('🛑 ダウンロードが停止されました', 'warning');
                break;
            }
            
            if (result.success) {
                addLog(`✅ ${targetName} のダウンロードが完了しました`, 'success');
                addProgressLog(`✅ ${targetName} のダウンロードが完了しました`, 'success');
            } else {
                addLog(`❌ ${targetName} のダウンロードに失敗しました: ${result.error}`, 'error');
                addProgressLog(`❌ ${targetName} のダウンロードに失敗しました: ${result.error}`, 'error');
            }
            
            // 進捗更新
            const progress = ((i + 1) / videos.length) * 100;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${i + 1}/${videos.length} 完了`;
        }
        
        addLog('🎉 すべてのダウンロードが完了しました', 'success');
        addProgressLog('🎉 すべてのダウンロードが完了しました', 'success');
        
        // デスクトップ通知を表示
        showDesktopNotification(
            'YouTube Downloader',
            `${videos.length}件のダウンロードが完了しました`
        );
        
    } catch (error) {
        addLog(`❌ ダウンロード中にエラーが発生しました: ${error.message}`, 'error');
    } finally {
        isDownloading = false;
        downloadBtn.disabled = false;
        


        
        // 設定パネルに戻る
        if (settingsPanel) settingsPanel.classList.remove('hidden');
        if (videoSelectionPanel) videoSelectionPanel.classList.add('hidden');
        if (progressPanel) progressPanel.classList.add('hidden');
    }
}

// ログ追加（進捗パネル用のみ）
function addLog(message, type = 'info') {
    // 進捗パネルのログのみを使用
    addProgressLog(message, type);
}

// 進捗パネルログ追加
function addProgressLog(message, type = 'info') {
    if (!progressLogOutput) return;

    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    
    switch (type) {
        case 'error':
            logEntry.className = 'text-red-600';
            break;
        case 'success':
            logEntry.className = 'text-green-600';
            break;
        case 'warning':
            logEntry.className = 'text-yellow-600';
            break;
        default:
            logEntry.className = 'text-gray-700';
    }
    
    progressLogOutput.appendChild(logEntry);
    progressLogOutput.scrollTop = progressLogOutput.scrollHeight;
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
