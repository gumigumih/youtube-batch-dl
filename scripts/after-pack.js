const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const { appOutDir, electronPlatformName } = context;
  
  // yt-dlpのパスを構築
  const ytDlpDir = path.join(appOutDir, 'resources', 'yt-dlp');
  const ytDlpPath = path.join(ytDlpDir, electronPlatformName === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  
  console.log('After-pack script running...');
  console.log('App out dir:', appOutDir);
  console.log('Platform:', electronPlatformName);
  console.log('yt-dlp path:', ytDlpPath);
  
  // ファイルが存在するかチェック
  if (fs.existsSync(ytDlpPath)) {
    try {
      // 実行権限を付与（Unix系システムのみ）
      if (process.platform !== 'win32') {
        fs.chmodSync(ytDlpPath, '755');
        console.log(`✅ yt-dlpに実行権限を付与しました: ${ytDlpPath}`);
      }
      
      // Windows用の追加設定
      if (electronPlatformName === 'win32') {
        console.log('Windows用の設定を適用中...');
        
        // 必要に応じてWindows用の追加ファイルをコピー
        const ffmpegDir = path.join(appOutDir, 'resources', 'ffmpeg');
        if (!fs.existsSync(ffmpegDir)) {
          fs.mkdirSync(ffmpegDir, { recursive: true });
        }
        
        // FFmpegのパスを設定（もし存在する場合）
        const ffmpegPath = path.join(ffmpegDir, 'ffmpeg.exe');
        if (fs.existsSync(ffmpegPath)) {
          console.log(`✅ FFmpeg found: ${ffmpegPath}`);
        }
      }
      
      // Mac用の追加設定
      if (electronPlatformName === 'darwin') {
        console.log('Mac用の設定を適用中...');
        
        // Mac用のyt-dlpに実行権限を付与
        try {
          fs.chmodSync(ytDlpPath, '755');
          console.log(`✅ Mac用yt-dlpに実行権限を付与しました: ${ytDlpPath}`);
        } catch (error) {
          console.error(`❌ Mac用yt-dlpの実行権限付与に失敗しました: ${error.message}`);
        }
        
        // FFmpegのパスを設定（もし存在する場合）
        const ffmpegDir = path.join(appOutDir, 'resources', 'ffmpeg');
        const ffmpegPath = path.join(ffmpegDir, 'ffmpeg');
        if (fs.existsSync(ffmpegPath)) {
          console.log(`✅ FFmpeg found: ${ffmpegPath}`);
          try {
            fs.chmodSync(ffmpegPath, '755');
            console.log(`✅ FFmpegに実行権限を付与しました: ${ffmpegPath}`);
          } catch (error) {
            console.error(`❌ FFmpegの実行権限付与に失敗しました: ${error.message}`);
          }
        }
      }
      
      // 動作確認
      const { execSync } = require('child_process');
      try {
        const version = execSync(`"${ytDlpPath}" --version`, { encoding: 'utf8' });
        console.log(`✅ yt-dlp動作確認成功: ${version.trim()}`);
      } catch (error) {
        console.error(`❌ yt-dlp動作確認失敗: ${error.message}`);
      }
    } catch (error) {
      console.error(`❌ yt-dlpの設定に失敗しました: ${error.message}`);
    }
  } else {
    console.warn(`⚠️ yt-dlpファイルが見つかりません: ${ytDlpPath}`);
    
    // ディレクトリの内容を確認
    if (fs.existsSync(ytDlpDir)) {
      const files = fs.readdirSync(ytDlpDir);
      console.log('yt-dlp directory contents:', files);
    } else {
      console.log('yt-dlp directory does not exist');
    }
  }
};
