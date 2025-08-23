import React from 'react'

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  downloadPath, 
  defaultDownloadPath, 
  cookiesStatus, 
  desktopNotificationEnabled, 
  setDesktopNotificationEnabled, 
  fileNameTemplate,
  setFileNameTemplate,
  onSelectDownloadFolder, 
  onCheckCookies, 
  onOpenCookiesDirectory 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm">
                <i className="fas fa-cog text-purple-600 text-xl"></i>
              </div>
              設定
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <div className="space-y-8">
            {/* ダウンロードフォルダ設定 */}
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">ダウンロードフォルダ</label>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-gradient-to-r from-green-100 to-green-200 p-3 rounded-xl shadow-sm">
                    <i className="fas fa-folder text-green-600"></i>
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-800 font-semibold">ダウンロード保存先</span>
                    <p className="text-gray-500 text-sm">動画ファイルの保存先フォルダを指定できます</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={downloadPath}
                    readOnly 
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-mono text-sm" 
                    placeholder="ダウンロードフォルダを選択してください"
                  />
                  <button 
                    onClick={onSelectDownloadFolder}
                    className="group relative bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 text-green-700 font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg border border-green-300/50"
                  >
                    <i className="fas fa-folder-open relative z-10 group-hover:scale-110 transition-transform duration-300"></i>
                    <span className="relative z-10">選択</span>
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  <i className="fas fa-info-circle mr-1"></i>
                  デフォルト: <span>{defaultDownloadPath}</span>
                </div>
              </div>
            </div>
            
            {/* ファイル名テンプレート設定 */}
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">ファイル名テンプレート</label>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-gradient-to-r from-orange-100 to-orange-200 p-3 rounded-xl shadow-sm">
                    <i className="fas fa-file-alt text-orange-600"></i>
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-800 font-semibold">ダウンロードファイル名の形式</span>
                    <p className="text-gray-500 text-sm">動画ファイルのファイル名に使用されるテンプレートを設定できます</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={fileNameTemplate}
                    onChange={(e) => setFileNameTemplate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-mono text-sm" 
                    placeholder="%(number)03d - %(title)s"
                  />
                  
                                      <div className="text-xs text-gray-500 space-y-1">
                      <p><strong>利用可能な変数:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><code>%(number)03d</code> - 連番（03d=001, 2d=01, d=1）</li>
                        <li><code>%(title)s</code> - 動画タイトル</li>
                        <li><code>%(resolution)s</code> - 動画解像度</li>
                        <li><code>%(upload_date)s</code> - アップロード日</li>
                        <li><code>%(duration)s</code> - 動画時間</li>
                        <li><code>%(view_count)s</code> - 視聴回数</li>
                        <li><code>%(uploader)s</code> - アップローダー名</li>
                        <li><code>%(id)s</code> - 動画ID</li>
                        <li><code>%(ext)s</code> - ファイル拡張子</li>
                      </ul>
                      <p className="mt-2"><strong>ファイル名例:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><code>%(number)03d - %(title)s</code> → 001 - 動画タイトル.mp4</li>
                        <li><code>%(number)2d - %(title)s [%(resolution)s]</code> → 01 - 動画タイトル [1920x1080].mp4</li>
                        <li><code>%(uploader)s - %(number)d - %(title)s</code> → チャンネル名 - 1 - 動画タイトル.mp4</li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-400">
                        <i className="fas fa-info-circle mr-1"></i>
                        <code>%(number)</code>は自動的にyt-dlpの<code>%(autonumber)</code>に変換されます
                      </p>
                    </div>
                </div>
              </div>
            </div>
            
            {/* デスクトップ通知設定 */}
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">デスクトップ通知</label>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <input 
                  type="checkbox" 
                  checked={desktopNotificationEnabled}
                  onChange={(e) => setDesktopNotificationEnabled(e.target.checked)}
                  className="text-purple-600 w-5 h-5 rounded focus:ring-purple-500"
                />
                <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-3 rounded-xl shadow-sm">
                  <i className="fas fa-bell text-purple-600"></i>
                </div>
                <div>
                  <span className="text-gray-800 font-semibold">ダウンロード完了時に通知</span>
                  <p className="text-gray-500 text-sm">全てのダウンロードが完了した際にデスクトップ通知を表示します</p>
                </div>
              </div>
            </div>
            
            {/* 認証設定 */}
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-4 uppercase tracking-wide">認証設定</label>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-gradient-to-r from-blue-100 to-blue-200 p-3 rounded-xl shadow-sm">
                    <i className="fas fa-lock text-blue-600"></i>
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-800 font-semibold">YouTube認証</span>
                    <p className="text-gray-500 text-sm">年齢制限動画や限定公開動画をダウンロードするには、YouTubeにログインした状態のクッキーファイルが必要です。</p>
                  </div>
                </div>
                
                {/* 手順 */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <i className="fas fa-list-ul text-blue-600"></i>
                    手順
                  </h5>
                  <ol className="text-blue-700 text-sm space-y-1">
                    <li>1. Chromeで <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">Get cookies.txt LOCALLY</a> をインストール</li>
                    <li>2. ChromeでYouTubeにログイン</li>
                    <li>3. Chromeの拡張機能アイコンをクリックしてクッキーをエクスポート</li>
                    <li>4. ファイル名を「_cookies.txt」に変更</li>
                    <li>5. 「ダウンロードフォルダを開く」ボタンをクリック</li>
                    <li>6. 開いたダウンロードフォルダに「_cookies.txt」ファイルを配置</li>
                    <li>7. 「クッキー確認」ボタンで状態を確認</li>
                  </ol>
                </div>
                
                {/* 操作ボタン */}
                <div className="flex flex-wrap gap-3 items-center mb-3">
                  <button 
                    onClick={onCheckCookies}
                    className="group relative bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg border border-gray-300/50"
                  >
                    <i className="fas fa-lock relative z-10 group-hover:scale-110 transition-transform duration-300"></i>
                    <span className="relative z-10">クッキー確認</span>
                  </button>
                  <button 
                    onClick={onOpenCookiesDirectory}
                    className="group relative bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 text-blue-700 font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg border border-blue-300/50"
                  >
                    <i className="fas fa-folder-open relative z-10 group-hover:scale-110 transition-transform duration-300"></i>
                    <span className="relative z-10">ダウンロードフォルダを開く</span>
                  </button>
                </div>
                
                {/* クッキー状態表示 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">認証状態:</span>
                  <span className={`text-sm ${
                    cookiesStatus === '設定済み' ? 'text-green-600' : 
                    cookiesStatus === '未設定' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {cookiesStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
