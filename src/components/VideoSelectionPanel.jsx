import React from 'react'

  const VideoSelectionPanel = ({ 
    downloadMode, 
    setDownloadMode, 
    thumbnailOption, 
    setThumbnailOption, 
    videoList, 
    selectedVideos, 
    isLoadingVideoList,
    onVideoToggle, 
    onSelectAll, 
    onDeselectAll, 
    onLoadVideoList, 
    onStartDownload 
  }) => {
    console.log('VideoSelectionPanel rendered');
    console.log('videoList:', videoList);
    console.log('selectedVideos:', selectedVideos);
  return (
    <div className="animate-fade-in">
      <div className="flex gap-8">
        <div className="flex-1">
          <section className="bg-white backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
              <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm">
                <i className="fas fa-video text-purple-600 text-xl"></i>
              </div>
              動画選択
            </h2>
            
            <div className="space-y-8">
              {/* 動画一覧 */}
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">動画一覧</label>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">
                      <span>動画数: {videoList.length}件</span>
                    </div>
                    <button 
                      onClick={onLoadVideoList}
                      disabled={isLoadingVideoList}
                      className={`group bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-600 hover:text-blue-700 font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg border border-blue-400/30 hover:border-blue-400/50 ${
                        isLoadingVideoList ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <i className={`fas fa-sync-alt text-sm transition-transform duration-300 ${
                        isLoadingVideoList ? 'animate-spin' : 'group-hover:rotate-180'
                      }`}></i>
                      <span>{isLoadingVideoList ? '更新中...' : '再取得'}</span>
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                    {isLoadingVideoList ? (
                      <div className="text-center text-gray-500 text-sm py-8">
                        <div className="animate-spin text-2xl mb-2 text-purple-600">
                          <i className="fas fa-spinner"></i>
                        </div>
                        <p>動画リストを取得中...</p>
                        <p className="text-xs mt-1">しばらくお待ちください</p>
                      </div>
                    ) : videoList.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-8">
                        <i className="fas fa-video text-2xl mb-2"></i>
                        <p>動画リストがここに表示されます</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {videoList.map((video, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                            <input 
                              type="checkbox" 
                              checked={selectedVideos.includes(video.url)}
                              onChange={() => onVideoToggle(video.url)}
                              className="text-purple-600 w-4 h-4 rounded focus:ring-purple-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">{index + 1}</span>
                                <span className="text-sm font-medium text-gray-800 truncate">{video.title}</span>
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>{video.duration || '不明'}</span>
                                <span>•</span>
                                <span>{video.upload_date || '不明'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mt-4">
                    <span>選択済み: {selectedVideos.length}件</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={onSelectAll}
                        className="text-purple-600 hover:text-purple-700 font-medium"
                      >
                        すべて選択
                      </button>
                      <button 
                        onClick={onDeselectAll}
                        className="text-gray-600 hover:text-gray-700 font-medium"
                      >
                        選択解除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* ダウンロードモード選択 */}
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">ダウンロードモード</label>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex gap-4">
                    <label className="group flex items-center gap-3 cursor-pointer p-4 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 transition-all duration-300 border border-transparent hover:border-purple-200 flex-1">
                      <input 
                        type="radio" 
                        name="downloadMode" 
                        value="video" 
                        checked={downloadMode === 'video'}
                        onChange={(e) => setDownloadMode(e.target.value)}
                        className="text-purple-600 w-5 h-5"
                      />
                      <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <i className="fas fa-video text-purple-600"></i>
                      </div>
                      <span className="text-gray-800 font-semibold">動画モード</span>
                    </label>
                    <label className="group flex items-center gap-3 cursor-pointer p-4 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 transition-all duration-300 border border-transparent hover:border-purple-200 flex-1">
                      <input 
                        type="radio" 
                        name="downloadMode" 
                        value="audio" 
                        checked={downloadMode === 'audio'}
                        onChange={(e) => setDownloadMode(e.target.value)}
                        className="text-purple-600 w-5 h-5"
                      />
                      <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <i className="fas fa-music text-purple-600"></i>
                      </div>
                      <span className="text-gray-800 font-semibold">音声モード</span>
                    </label>
                  </div>
                </div>
              </div>
              
              {/* サムネイル取得オプション */}
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">サムネイル取得</label>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <input 
                    type="checkbox" 
                    checked={thumbnailOption}
                    onChange={(e) => setThumbnailOption(e.target.checked)}
                    className="text-purple-600 w-5 h-5 rounded focus:ring-purple-500"
                  />
                  <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm">
                    <i className="fas fa-image text-purple-600"></i>
                  </div>
                  <div>
                    <span className="text-gray-800 font-semibold">サムネイル画像をダウンロード</span>
                    <p className="text-gray-500 text-sm">動画のサムネイル画像を同時に取得します</p>
                  </div>
                </div>
              </div>
              
              {/* ダウンロード開始ボタン */}
              <div className="flex justify-center gap-4 pt-6">
                <button 
                  onClick={onStartDownload}
                  disabled={selectedVideos.length === 0}
                  className={`group relative font-medium py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg ${
                    selectedVideos.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white hover:shadow-purple-500/25'
                  }`}
                >
                  <i className="fas fa-download relative z-10"></i>
                  <span className="relative z-10">ダウンロード開始</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default VideoSelectionPanel
