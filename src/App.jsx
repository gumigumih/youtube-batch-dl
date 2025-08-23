import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import UrlInput from './components/UrlInput'
import SettingsModal from './components/SettingsModal'
import VideoSelectionPanel from './components/VideoSelectionPanel'
import ProgressPanel from './components/ProgressPanel'

function App() {
  const [currentPanel, setCurrentPanel] = useState('')
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [urls, setUrls] = useState('')
  const [lastUrls, setLastUrls] = useState('')
  const [downloadPath, setDownloadPath] = useState('')
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('')
  const [cookiesFileExists, setCookiesFileExists] = useState(false)
  const [desktopNotificationEnabled, setDesktopNotificationEnabled] = useState(true)
  const [thumbnailOption, setThumbnailOption] = useState(true)
  const [downloadMode, setDownloadMode] = useState('video')
  const [videoList, setVideoList] = useState([])
  const [selectedVideos, setSelectedVideos] = useState([])
  const [playlistTitle, setPlaylistTitle] = useState('')
  const [fileNameTemplate, setFileNameTemplate] = useState('%(number)03d - %(title)s')
  const [isDownloading, setIsDownloading] = useState(false)
  const [isLoadingVideoList, setIsLoadingVideoList] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [currentFileName, setCurrentFileName] = useState('-')
  const [progressText, setProgressText] = useState('準備中...')
  const [progressLog, setProgressLog] = useState([])

  // 初期化処理
  useEffect(() => {
    const init = async () => {
      console.log('App initialization started...');
      console.log('Electron API available:', !!window.electronAPI);
      
      // 少し待ってから初期化を実行
      setTimeout(async () => {
        if (window.electronAPI) {
          console.log('Electron API found, initializing app...');
          await initializeApp()
        } else {
          console.error('Electron API not available, using fallback values');
          setDownloadPath('~/Downloads')
          setDefaultDownloadPath('~/Downloads')
        }
      }, 1000);
    };

    init()
  }, [])

  // IPCリスナーを設定
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.on) {
      // ファイル名更新のリスナー
      window.electronAPI.on('current-filename-updated', (filename) => {
        console.log('Received filename update:', filename);
        setCurrentFileName(filename);
      });
    }
  }, [])

  const initializeApp = async () => {
    try {
      console.log('Initializing app...');
      console.log('Electron API available:', !!window.electronAPI);
      
      // ダウンロードパスを取得
      if (window.electronAPI && window.electronAPI.getDownloadPath) {
        console.log('Getting download path...');
        const result = await window.electronAPI.getDownloadPath()
        console.log('Download path result:', result);
        if (result && result.success) {
          setDownloadPath(result.path)
          console.log('Download path set to:', result.path);
        } else {
          console.warn('Failed to get download path, using default');
          setDownloadPath('~/Downloads')
        }
      } else {
        console.error('getDownloadPath API not available');
        setDownloadPath('~/Downloads')
      }

      // デフォルトダウンロードパスを取得
      if (window.electronAPI && window.electronAPI.getDefaultDownloadPath) {
        console.log('Getting default download path...');
        const result = await window.electronAPI.getDefaultDownloadPath()
        console.log('Default download path result:', result);
        if (result && result.success) {
          setDefaultDownloadPath(result.path)
          console.log('Default download path set to:', result.path);
        } else {
          console.warn('Failed to get default download path, using fallback');
          setDefaultDownloadPath('~/Downloads')
        }
      } else {
        console.error('getDefaultDownloadPath API not available');
        setDefaultDownloadPath('~/Downloads')
      }

      // クッキー状態を確認
      await checkCookiesFile()

      // 前回のURLを読み込み
      if (window.electronAPI && window.electronAPI.getLastUrls) {
        const lastUrls = await window.electronAPI.getLastUrls()
        if (lastUrls && lastUrls.length > 0) {
          setUrls(lastUrls.join('\n'))
        }
      }
      
      console.log('App initialization completed');
    } catch (error) {
      console.error('初期化エラー:', error)
      // エラー時はデフォルト値を設定
      setDownloadPath('~/Downloads')
      setDefaultDownloadPath('~/Downloads')
    }
  }

  const checkCookiesFile = async () => {
    try {
      if (window.electronAPI && window.electronAPI.checkCookiesFile) {
        const result = await window.electronAPI.checkCookiesFile()
        setCookiesFileExists(result.exists)
      }
    } catch (error) {
      console.error('クッキー確認エラー:', error)
      setCookiesFileExists(false)
    }
  }

  const handleOpenCookiesDirectory = async () => {
    try {
      if (window.electronAPI && window.electronAPI.openCookiesDirectory) {
        const result = await window.electronAPI.openCookiesDirectory()
        if (result.success) {
          console.log('クッキーディレクトリを開きました:', result.path)
          await checkCookiesFile()
        }
      }
    } catch (error) {
      console.error('ディレクトリを開くエラー:', error)
    }
  }

  const handleSelectDownloadFolder = async () => {
    try {
      console.log('handleSelectDownloadFolder called');
      console.log('Electron API available:', !!window.electronAPI);
      console.log('selectDownloadFolder method available:', !!window.electronAPI?.selectDownloadFolder);
      
      if (window.electronAPI && window.electronAPI.selectDownloadFolder) {
        console.log('Calling selectDownloadFolder...');
        const result = await window.electronAPI.selectDownloadFolder()
        console.log('selectDownloadFolder result:', result);
        
        if (result && result.success) {
          setDownloadPath(result.path)
          console.log('Download path updated to:', result.path);
        } else {
          console.warn('Folder selection failed or was canceled');
        }
      } else {
        console.error('selectDownloadFolder API not available');
      }
    } catch (error) {
      console.error('フォルダ選択エラー:', error)
    }
  }

  const handleDownloadClick = () => {
    console.log('handleDownloadClick called');
    console.log('URLs:', urls);
    console.log('URLs trimmed:', urls.trim());
    
    if (urls.trim()) {
      console.log('Switching to videoSelection panel');
      setCurrentPanel('videoSelection')
      
      // URLが変更された場合は動画リストをリセット
      if (urls !== lastUrls) {
        console.log('URLs changed, resetting video list...');
        setVideoList([]);
        setSelectedVideos([]);
        console.log('Loading video list...');
        loadVideoList()
      } else if (videoList.length === 0) {
        console.log('Loading video list...');
        loadVideoList()
      } else {
        console.log('Video list already loaded, skipping...');
      }
      
      // URL入力時点でlastUrlsを更新
      setLastUrls(urls);
    } else {
      console.log('No URLs entered');
      alert('YouTubeのURLを入力してください')
    }
  }

  const loadVideoList = async () => {
    setIsLoadingVideoList(true);
    try {
      console.log('loadVideoList called');
      console.log('URLs:', urls);
      
      const urlList = urls.split('\n').filter(url => url.trim())
      console.log('Filtered URLs:', urlList);
      
      if (urlList.length === 0) {
        console.log('No URLs to process');
        setVideoList([]);
        setSelectedVideos([]);
        setPlaylistTitle('');
        return;
      }

      const videos = []
      let playlistName = '';

      for (const url of urlList) {
        console.log('Processing URL:', url);
        
        if (!window.electronAPI) {
          console.error('Electron API not available');
          continue;
        }

        try {
          // URLの種類を判定（より詳細な判定）
          const isPlaylist = url.includes('/playlist?') || 
                           url.includes('/channel/') || 
                           url.includes('/c/') || 
                           url.includes('/user/') || 
                           url.includes('/@') ||
                           url.includes('list=') ||
                           url.includes('/watch?v=') && url.includes('&list=');
          console.log('URL:', url);
          console.log('URL type:', isPlaylist ? 'playlist' : 'single video');
          
          if (isPlaylist) {
            // 再生リストの場合
            if (!window.electronAPI.getPlaylistVideos) {
              console.error('getPlaylistVideos method not available');
              continue;
            }
            
            console.log('Calling getPlaylistVideos for:', url);
            const playlistVideos = await window.electronAPI.getPlaylistVideos(url.trim())
            console.log('Playlist videos received:', playlistVideos);
            
            if (playlistVideos && Array.isArray(playlistVideos) && playlistVideos.length > 0) {
              console.log(`Found ${playlistVideos.length} videos in playlist`);
              
              // 再生リスト名を取得
              if (window.electronAPI && window.electronAPI.getPlaylistTitle) {
                try {
                  const title = await window.electronAPI.getPlaylistTitle(url.trim());
                  playlistName = title || 'プレイリスト';
                  console.log('Playlist title:', playlistName);
                } catch (error) {
                  console.error('Failed to get playlist title:', error);
                  playlistName = 'プレイリスト';
                }
              }
              
              playlistVideos.forEach((video, index) => {
                const videoUrl = video.url || video.webpage_url || video.id;
                if (videoUrl) {
                  videos.push({
                    url: videoUrl,
                    title: video.title || `動画 ${index + 1}`,
                    duration: video.duration_string || '不明',
                    thumbnail: video.thumbnail || null,
                    selected: true
                  })
                  console.log(`Playlist video ${index + 1} added:`, video.title || `動画 ${index + 1}`);
                }
              });
            } else {
              console.log('No playlist videos returned or empty array for:', url);
              // 再生リストが取得できない場合は単体動画として処理
              console.log('Falling back to single video processing');
              if (window.electronAPI.getVideoInfo) {
                const info = await window.electronAPI.getVideoInfo(url.trim())
                if (info) {
                  videos.push({
                    url: url.trim(),
                    title: info.title || 'タイトル不明',
                    duration: info.duration_string || '不明',
                    thumbnail: info.thumbnail || null,
                    selected: true
                  })
                  console.log('Single video added as fallback:', info.title);
                }
              }
            }
          } else {
            // 単体動画の場合
            if (!window.electronAPI.getVideoInfo) {
              console.error('getVideoInfo method not available');
              continue;
            }
            
            console.log('Calling getVideoInfo for:', url);
            const info = await window.electronAPI.getVideoInfo(url.trim())
            console.log('Video info received:', info);
            
            if (info) {
              videos.push({
                url: url.trim(),
                title: info.title || 'タイトル不明',
                duration: info.duration_string || '不明',
                thumbnail: info.thumbnail || null,
                selected: true
              })
              console.log('Single video added:', info.title);
            } else {
              console.log('No video info returned for:', url);
            }
          }
        } catch (urlError) {
          console.error('Error processing URL:', url, urlError);
        }
      }

      console.log('Final video list:', videos);
      setVideoList(videos)
      setSelectedVideos(videos.map(v => v.url))
      setPlaylistTitle(playlistName)
    } catch (error) {
      console.error('動画情報の取得に失敗しました:', error)
      // エラー時は空のリストを設定
      setVideoList([])
      setSelectedVideos([])
    } finally {
      setIsLoadingVideoList(false);
    }
  }

  const handleVideoToggle = (url) => {
    setSelectedVideos(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    )
  }

  const handleSelectAll = () => {
    setSelectedVideos(videoList.map(v => v.url))
  }

  const handleDeselectAll = () => {
    setSelectedVideos([])
  }

  const handleStartDownload = async () => {
    if (selectedVideos.length === 0) {
      alert('ダウンロードする動画を選択してください')
      return
    }

    // 停止フラグをリセット
    if (window.electronAPI && window.electronAPI.resetStopFlag) {
      await window.electronAPI.resetStopFlag()
    }

    setIsDownloading(true)
    setCurrentPanel('progress')
    setDownloadProgress(0)
    setProgressText('準備中...')
    setProgressLog([])

    let saveDir = null; // saveDirを関数スコープで宣言

    try {
      // フォルダ名を生成（再生リスト名または日時を使用）
      let folderName;
      if (playlistTitle && playlistTitle !== 'プレイリスト') {
        // 再生リスト名を使用
        folderName = playlistTitle;
      } else {
        // 日時を使用
        const now = new Date()
        folderName = `YouTube-Download-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      }
      
      setProgressLog(prev => [...prev, `📁 フォルダを作成中: ${folderName}`])
      
      // フォルダを作成
      if (window.electronAPI && window.electronAPI.createSaveDir) {
        saveDir = await window.electronAPI.createSaveDir(folderName)
        if (!saveDir) {
          throw new Error('フォルダの作成に失敗しました')
        }
        setProgressLog(prev => [...prev, `✅ フォルダを作成しました: ${saveDir}`])
      } else {
        throw new Error('フォルダ作成APIが利用できません')
      }

      // 各動画をダウンロード
      for (let i = 0; i < selectedVideos.length; i++) {
        // 停止要求をチェック
        if (window.electronAPI && window.electronAPI.checkDownloadStatus) {
          const status = await window.electronAPI.checkDownloadStatus()
          if (status.isStopRequested) {
            console.log('🛑 ダウンロード停止が要求されました。ループを中断します。')
            setProgressLog(prev => [...prev, '🛑 ダウンロードが停止されました'])
            break
          }
        }
        
        const video = selectedVideos[i]
        const progress = ((i + 1) / selectedVideos.length) * 100
        
        setDownloadProgress(progress)
        setProgressText(`${i + 1}/${selectedVideos.length} 処理中`)
        setCurrentFileName(video)
        
        // ログを追加
        setProgressLog(prev => [...prev, `📥 ${i + 1}/${selectedVideos.length}: ${video}`])
        console.log('🔧 Downloading video:', video);
        console.log('🔧 fileNameTemplate:', fileNameTemplate);
        console.log('🔧 fileNameTemplate type:', typeof fileNameTemplate);
        console.log('🔧 fileNameTemplate length:', fileNameTemplate ? fileNameTemplate.length : 'undefined');

        // 実際のダウンロード処理
        if (window.electronAPI && window.electronAPI.downloadVideo) {
          const downloadParams = {
            url: video,
            mode: downloadMode,
            downloadMode,
            saveDir: saveDir,
            rangeOption: '',
            thumbnailOption,
            fileNameTemplate,
            videoIndex: i + 1 // 動画の順番（1から開始）
          };
          console.log('🔧 downloadVideo params:', downloadParams);
          
          const result = await window.electronAPI.downloadVideo(downloadParams)

          if (result.success) {
            setProgressLog(prev => [...prev, `✅ ${video} のダウンロードが完了しました`])
          } else {
            setProgressLog(prev => [...prev, `❌ ${video} のダウンロードに失敗しました`])
          }
        }

        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      setProgressText('完了')
      setProgressLog(prev => [...prev, '🎉 すべてのダウンロードが完了しました'])
    } catch (error) {
      console.error('ダウンロードエラー:', error)
      setProgressLog(prev => [...prev, `❌ エラーが発生しました: ${error.message}`])
    } finally {
      setIsDownloading(false)
    }
  }

  const handleStopDownload = async () => {
    if (confirm('ダウンロードを停止しますか？')) {
      try {
        if (window.electronAPI && window.electronAPI.stopDownload) {
          const result = await window.electronAPI.stopDownload()
          if (result.success) {
            setIsDownloading(false)
            setProgressLog(prev => [...prev, '🛑 ダウンロードが停止されました'])
            setProgressText('停止されました')
            setDownloadProgress(0)
          }
        }
      } catch (error) {
        console.error('ダウンロード停止エラー:', error)
      }
    }
  }

  const handleOpenSettingsModal = () => {
    setIsSettingsModalOpen(true)
  }

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false)
  }



  return (
    <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 min-h-screen font-inter text-gray-800">
      <Header onOpenSettings={handleOpenSettingsModal} />
      
      <UrlInput 
        urls={urls}
        setUrls={setUrls}
        onDownloadClick={handleDownloadClick}
      />
      
      {/* メインコンテンツ */}
      {currentPanel && (
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* パネルコンテンツ */}
          <div className="transition-all duration-500">
            {/* 動画選択パネル */}
            {currentPanel === 'videoSelection' && (
              <VideoSelectionPanel 
                downloadMode={downloadMode}
                setDownloadMode={setDownloadMode}
                thumbnailOption={thumbnailOption}
                setThumbnailOption={setThumbnailOption}
                videoList={videoList}
                selectedVideos={selectedVideos}
                isLoadingVideoList={isLoadingVideoList}
                onVideoToggle={handleVideoToggle}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onLoadVideoList={loadVideoList}
                onStartDownload={handleStartDownload}
              />
            )}

            {/* 進捗パネル */}
            {currentPanel === 'progress' && (
              <ProgressPanel 
                downloadProgress={downloadProgress}
                progressText={progressText}
                currentFileName={currentFileName}
                progressLog={progressLog}
                onStopDownload={handleStopDownload}
              />
            )}
          </div>
        </div>
      )}

      {/* 設定モーダル */}
              <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={handleCloseSettingsModal}
          downloadPath={downloadPath}
          defaultDownloadPath={defaultDownloadPath}
          cookiesStatus={cookiesFileExists ? '設定済み' : '未設定'}
          desktopNotificationEnabled={desktopNotificationEnabled}
          setDesktopNotificationEnabled={setDesktopNotificationEnabled}
          fileNameTemplate={fileNameTemplate}
          setFileNameTemplate={setFileNameTemplate}
          onSelectDownloadFolder={handleSelectDownloadFolder}
          onCheckCookies={checkCookiesFile}
          onOpenCookiesDirectory={handleOpenCookiesDirectory}
        />
    </div>
  )
}

export default App
