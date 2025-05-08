# YouTube バッチダウンロードスクリプトの使い方

このスクリプトは、YouTube のチャンネル・再生リスト・単体動画をまとめてダウンロードできるツールです。
以下の特徴と使い方をまとめます。

---

## ✨ 特徴

- **30 件ずつ**に分割してダウンロード（YouTube 側制限回避）
- **チャンネル / 再生リスト / 単体動画** すべてに対応
- **Cookie 認証**対応（年齢制限・限定公開動画にも対応）
- **ファイル名に連番付与**（プレイリスト順で保存）
- **Excel(.xlsx)形式で一覧出力**（Unicode 文字対応）
- **サムネイル画像を取得・動画に埋め込み**

---

## 📥 必要な準備

### 1. 必要なソフトウェアをインストール

- `yt-dlp`
- `ffmpeg`
- `jq`
- `python3-pip`
- `pandas` と `openpyxl`

インストール例（Ubuntu/WSL の場合）:

```bash
sudo apt update
sudo apt install yt-dlp ffmpeg jq python3-pip fzf
pip3 install pandas openpyxl
```

インストール例（Ubuntu/WSL の場合）:

```bash
# Homebrewがインストールされていない場合は、まずこちらを実行
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Homebrew経由で必要パッケージをインストール
brew update
brew install yt-dlp ffmpeg jq python3 fzf

# pip3でPythonパッケージをインストール
pip3 install pandas openpyxl
```

### 2. Cookie ファイル (`_cookies.txt`) を準備

YouTube へのログイン状態を使うため、Cookie をエクスポートします。

#### 手順

1. Chrome に拡張機能「[Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)」をインストール
2. YouTube にログイン
3. YouTube ページを開いた状態で拡張機能アイコンをクリックして Cookie をエクスポート
4. ダウンロードしたファイルを `_cookies.txt` にリネーム
5. スクリプト (`yt_dlp_batch.sh`) と同じディレクトリに置く

> ⚠️ Cookie にはアカウント情報が含まれます。第三者に渡さないよう注意してください！

---

## 🚀 使い方

1. ターミナル（bash）でスクリプトを実行：

```bash
chmod +x yt_dlp_batch.sh
./yt_dlp_batch.sh
```

2. 最初に YouTube の URL を聞かれます。

   - チャンネル URL
   - 再生リスト URL
   - 単体動画 URL

   いずれも OK です！

3. 過去にダウンロードした動画はスキップされます（`_downloaded.txt`で管理）。

4. ダウンロード後、
   - `保存フォルダ` に動画ファイルとサムネイル画像（PNG）が保存されます。
   - ダウンロード内容をまとめた `video_list.xlsx` が作成されます。

---

## 📂 出力ファイル一覧

| ファイル名                | 内容                                    |
| ------------------------- | --------------------------------------- |
| `000 - タイトル名.mp4` 等 | 動画本体（H.264 形式）                  |
| `000 - タイトル名.png`    | サムネイル画像                          |
| `_video_list.xlsx`        | ダウンロード一覧（番号・タイトル・URL） |

---

## ❓ よくあるエラーと対処

| エラー内容                            | 対処方法                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `Sign in to confirm you're not a bot` | Cookie ファイルが必要です。手順に従って`_cookies.txt`を用意してください           |
| `ValueError: No engine for filetype`  | `openpyxl`がインストールされていません。`pip3 install openpyxl`を実行してください |

---

これで、チャンネル・再生リスト全体の高画質ダウンロードと一覧管理が簡単にできます！🎉

何か不具合や追加機能の希望があれば、気軽にご連絡ください。
