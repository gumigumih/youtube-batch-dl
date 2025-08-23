# ビルド手順

このプロジェクトは、Mac と Windows の両方でアプリケーションをビルドできます。

## 前提条件

### Windows

- Node.js (v16 以上)
- npm または yarn
- Windows 10/11

### Mac

- Node.js (v16 以上)
- npm または yarn
- macOS 10.15 以上
- Xcode Command Line Tools (Mac 用ビルドの場合)

## インストール

```bash
npm install
```

## ビルドコマンド

### Windows 用ビルド

```bash
# Windows用インストーラー（NSIS）
npm run build:win-installer

# Windows用ポータブル版
npm run build:win-portable

# Windows用（両方）
npm run build:win
```

### Mac 用ビルド

```bash
# Mac用（現在のアーキテクチャ）
npm run build:mac

# Mac用（Universal Binary - Intel + Apple Silicon）
npm run build:mac-universal
```

### 全プラットフォーム用ビルド

```bash
# Mac、Windows、Linuxの全てをビルド
npm run build:all
```

## ビルド成果物

ビルドが完了すると、`dist`フォルダに以下のファイルが生成されます：

### Windows

- `YouTube Downloader-1.0.0-x64.exe` - インストーラー
- `YouTube Downloader-1.0.0-x64.exe` - ポータブル版

### Mac

- `YouTube Downloader-1.0.0-x64.dmg` - Intel Mac 用
- `YouTube Downloader-1.0.0-arm64.dmg` - Apple Silicon Mac 用
- `YouTube Downloader-1.0.0-x64.zip` - Intel Mac 用 ZIP
- `YouTube Downloader-1.0.0-arm64.zip` - Apple Silicon Mac 用 ZIP

## 注意事項

### Mac 用ビルド

- Mac 用ビルドには、Apple Developer ID での署名が必要な場合があります
- 初回実行時に「不明な開発元」の警告が表示される場合があります
- システム環境設定 > セキュリティとプライバシーで許可してください

### Windows 用ビルド

- Windows Defender や他のセキュリティソフトが誤検知する場合があります
- 必要に応じて除外設定を行ってください

## トラブルシューティング

### ビルドエラーが発生する場合

1. `node_modules`を削除して再インストール

```bash
rm -rf node_modules
npm install
```

2. キャッシュをクリア

```bash
npm run build:vite
npm run build
```

### Mac で「不明な開発元」エラーが発生する場合

```bash
# ターミナルで以下を実行
sudo xattr -rd com.apple.quarantine /path/to/your/app
```

### Windows でセキュリティ警告が表示される場合

- Windows Defender の除外設定に追加
- 他のセキュリティソフトの除外設定に追加

