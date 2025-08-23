import React from 'react'

const ProgressPanel = ({ 
  downloadProgress, 
  progressText, 
  currentFileName, 
  progressLog, 
  onStopDownload 
}) => {
  return (
    <div className="animate-fade-in">
      <div className="flex gap-8">
        <div className="flex-1">
          <section className="bg-white backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
              <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm">
                <i className="fas fa-download text-purple-600 text-xl"></i>
              </div>
              ダウンロード進捗
            </h2>
            
            <div className="space-y-6">
              {/* プログレスバー */}
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 h-4 rounded-full transition-all duration-500 ease-out shadow-lg relative"
                    style={{ width: `${downloadProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-gray-600 font-medium">{progressText}</div>
                  <div className="text-sm text-gray-600 font-medium">{currentFileName}</div>
                </div>
              </div>
              
              {/* ログ出力 */}
              <div className="bg-gray-50 rounded-xl p-4 max-h-40 overflow-y-auto border border-gray-200">
                <div className="text-sm font-mono text-gray-700 space-y-1">
                  {progressLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              </div>
              
              {/* キャンセルボタン */}
              <div className="flex justify-center">
                <button 
                  onClick={onStopDownload}
                  className="group relative bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium py-3 px-8 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25"
                >
                  <i className="fas fa-stop relative z-10"></i>
                  <span className="relative z-10">ダウンロードを停止</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ProgressPanel
