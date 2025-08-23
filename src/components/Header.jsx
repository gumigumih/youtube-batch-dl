import React from 'react'

const Header = ({ onOpenSettings }) => {
  return (
    <header className="relative text-center py-8 px-6 text-white">
      <div className="absolute inset-0"></div>
      
      {/* 設定アイコン */}
      <button
        onClick={onOpenSettings}
        className="absolute top-4 right-6 z-20 text-white/80 hover:text-white transition-colors duration-300 p-2 rounded-full hover:bg-white/10"
        title="設定"
      >
        <i className="fas fa-cog text-2xl"></i>
      </button>
      
      <div className="relative z-10">
        <h1 className="text-4xl font-bold mb-3 flex items-center justify-center gap-4">
          <i className="fab fa-youtube text-3xl animate-pulse"></i>
          YouTube Downloader
        </h1>
        <p className="text-white/90 text-lg font-light">YouTube のチャンネル・再生リスト・単体動画をまとめてダウンロード</p>
      </div>
    </header>
  )
}

export default Header
