import React from 'react'

const UrlInput = ({ urls, setUrls, onDownloadClick }) => {
  return (
    <section className="max-w-3xl mx-auto px-6">
      <div className="flex gap-4 mb-6">
        <div className="flex-1 w-full">
          <textarea 
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            className="w-full p-3 border-2 border-white/20 rounded-xl text-sm font-mono resize-none transition-all duration-300 focus:border-purple-400 focus:outline-none bg-white/95 backdrop-blur-sm shadow-lg" 
            placeholder="YouTubeのURLを入力してください（複数の場合は改行区切り）" 
            style={{ fieldSizing: 'content' }}
          />
        </div>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onDownloadClick}
          className="group relative bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 text-white font-bold py-6 px-16 rounded-2xl transition-all duration-500 flex items-center gap-4 text-xl shadow-2xl hover:shadow-purple-500/40 hover:scale-105 transform hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-purple-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
          <i className="fas fa-download text-2xl relative z-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300"></i>
          <span className="relative z-10">ダウンロードを進める</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
        </button>
      </div>
    </section>
  )
}

export default UrlInput
