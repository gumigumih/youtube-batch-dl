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
      
      // 動作確認
      const { exec } = require('child_process');
      const { execSync } = require('child_process');
      try {
        const version = execSync(`"${ytDlpPath}" --version`, { encoding: 'utf8' });
        console.log(`✅ yt-dlp動作確認成功: ${version.trim()}`);
      } catch (error) {
        console.error(`❌ yt-dlp動作確認失敗: ${error.message}`);
      }
    } catch (error) {
      console.error(`❌ yt-dlpの実行権限付与に失敗しました: ${error.message}`);
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
