import React from 'react'

const StatusBar = ({ logOutput, logOutputSingle }) => {
  return (
    <div className="bg-white/10 backdrop-blur-sm border-t border-white/20">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between text-white/80 text-sm">
          <div className="flex items-center space-x-4">
            <span>
              <i className="fas fa-info-circle mr-1"></i>
              準備完了
            </span>
            {logOutput && (
              <span className="text-green-400">
                <i className="fas fa-check-circle mr-1"></i>
                ログ出力あり
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span>YouTube Batch Downloader v1.0</span>
            <span>•</span>
            <span>Electron</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusBar
