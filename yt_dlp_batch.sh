#!/bin/bash

# -------------------------------
# YouTube動画をバッチでダウンロードするスクリプト
# - 30件ずつ分割して処理（YouTube制限対策）
# - チャンネル / 再生リスト / 単体動画 すべてに対応
# - Cookie認証に対応
# - ファイル名は playlist_index または "000" で連番化
# - 動画タイトルとURLをExcel（.xlsx）形式で保存
# - 範囲指定ダウンロード対応（例：10〜30番だけ）
# - MP3抽出対応（音声のみ保存モード）
# -------------------------------

URL_FILE="_last_url.txt"
COOKIES_OPT="--cookies _cookies.txt"
ARCHIVE_FILE="_downloaded.txt"
METADATA_LOG="_metadata.jsonl"
EXCEL="_video_list.xlsx"
BATCH_SIZE=30

# URL入力（履歴あり）
if [ -f "$URL_FILE" ]; then
  LAST_URL=$(cat "$URL_FILE")
  echo "📄 前回のURL: $LAST_URL"
  echo ""
  SELECT=$(printf "%s\n" "前回のURLを使う" "新しいURLを入力する" | fzf --prompt="▶ " --header="前回入力したURLがあります。どうしますか？" --height=30% --border --layout=reverse)
  if [[ "$SELECT" == "前回のURLを使う" ]]; then
    URL="$LAST_URL"
  else
    read -p "🔗 新しいURLを入力してください: " URL
    echo "$URL" > "$URL_FILE"
  fi
else
  read -p "🔗 YouTubeのURLを入力してください: " URL
  echo "$URL" > "$URL_FILE"
fi

# jq 必須
if ! command -v jq &>/dev/null; then
  echo "❌ jq が必要です（sudo apt install jq）"
  exit 1
fi

# ダウンロードモード選択
echo ""
SELECT=$(printf "%s\n" "通常モード（動画）" "MP3音声のみ" | fzf --prompt="▶ " --header="ダウンロードオプションを選択してください" --height=30% --border --layout=reverse)

if [[ "$SELECT" == "MP3音声のみ" ]]; then
  MODE="2"
  DOWNLOAD_OPT="-x --audio-format mp3 --audio-quality 0"
  OUTPUT_TEMPLATE="%(playlist_index,0)03d - %(title)s.%(ext)s"
  echo "🎵 MP3音声のみダウンロードを選びました"
else
  MODE="1"
  DOWNLOAD_OPT="-f bv*[vcodec^=avc][ext=mp4]+ba[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=mp4]/best[ext=mp4]/best --merge-output-format mp4 --embed-thumbnail"
  OUTPUT_TEMPLATE="%(playlist_index,0)03d - %(title)s.%(ext)s"
  echo "🎬 通常モード（動画）ダウンロードを選びました"
fi

# 最初の動画リスト取得（チャンネル/プレイリスト両対応）
echo "📄 動画リスト情報を取得中..."
VIDEO_INFO=$(yt-dlp --flat-playlist --print-json $COOKIES_OPT "$URL")
VIDEO_COUNT=$(echo "$VIDEO_INFO" | jq -s 'length')

# チャンネル名やプレイリスト名は個別取得
METADATA=$(yt-dlp --skip-download --print-json --playlist-items 1 $COOKIES_OPT "$URL")
CHANNEL_TITLE=$(echo "$METADATA" | jq -r '.channel | select(. != null)')
PLAYLIST_TITLE=$(echo "$METADATA" | jq -r '.playlist_title | select(. != null)')

if [ "$VIDEO_COUNT" -gt 1 ]; then
  IS_LIST=true
else
  IS_LIST=false
fi

# ダウンロード対象表示
echo ""
echo "🎯 ダウンロード対象:"
if [ -n "$PLAYLIST_TITLE" ] && [ "$PLAYLIST_TITLE" != "null" ]; then
  echo "📂 プレイリスト: $PLAYLIST_TITLE"
elif [ -n "$CHANNEL_TITLE" ] && [ "$CHANNEL_TITLE" != "null" ]; then
  echo "📺 チャンネル: $CHANNEL_TITLE"
else
  echo "🎥 単体動画"
fi

# 範囲指定（開始と終了をfzfで選択）
if [ "$IS_LIST" = true ]; then
  echo ""
  SELECT=$(printf "%s\n" "すべてダウンロード" "範囲を指定する" | fzf --prompt="▶ " --header="ダウンロード範囲を選択してください" --height=30% --border --layout=reverse)
  if [[ "$SELECT" == "範囲を指定する" ]]; then
    echo "📄 プレイリスト情報を取得中..."
    VIDEO_LIST=()
    while IFS= read -r line; do
      VIDEO_LIST+=("$line")
    done < <(yt-dlp --flat-playlist --print "%(playlist_index)s: %(title)s" $COOKIES_OPT "$URL")

    while true; do
      echo ""
      START_VIDEO=$(printf "%s\n" "${VIDEO_LIST[@]}" | fzf --prompt="▶ " --header="開始動画を選んでください" --height=30% --border --layout=reverse)
      START_INDEX=$(echo "$START_VIDEO" | cut -d: -f1)

      echo ""
      END_VIDEO=$(printf "%s\n" "${VIDEO_LIST[@]}" | fzf --prompt="▶ " --header="終了動画を選んでください" --height=30% --border --layout=reverse)
      END_INDEX=$(echo "$END_VIDEO" | cut -d: -f1)

      if [ "$START_INDEX" -gt "$END_INDEX" ]; then
        echo "❌ 開始番号が終了番号より大きくなっています。もう一度選択してください。"
      else
        RANGE_OPT="--playlist-items ${START_INDEX}-${END_INDEX}"
        echo "🗂 選択した範囲: ${START_INDEX}-${END_INDEX}"
        break
      fi
    done
  else
    RANGE_OPT=""
    echo "🗂 全動画ダウンロードを選びました"
  fi
else
  RANGE_OPT=""
fi

# 保存フォルダ名決定
if [ -n "$PLAYLIST_TITLE" ]; then
  RAW_NAME="$PLAYLIST_TITLE"
elif [ -n "$CHANNEL_TITLE" ]; then
  RAW_NAME="$CHANNEL_TITLE"
else
  RAW_NAME="downloaded_videos"
fi
SAVE_DIR=$(echo "$RAW_NAME" | sed 's/[\\/:*?"<>|]/_/g')
mkdir -p "$SAVE_DIR"
cd "$SAVE_DIR" || exit

# 処理実行
if [ "$IS_PLAYLIST" = true ]; then
  echo "📄 プレイリストとして処理します"
else
  echo "📄 単体動画として処理します"
fi

# メタデータ収集
yt-dlp --skip-download --print-json $RANGE_OPT --yes-playlist $COOKIES_OPT "$URL" >> "$METADATA_LOG"

# 実ダウンロード
yt-dlp \
  $DOWNLOAD_OPT \
  -o "$OUTPUT_TEMPLATE" \
  --write-thumbnail \
  --convert-thumbnails png \
  --compat-options filename-sanitization \
  --download-archive "$ARCHIVE_FILE" \
  $RANGE_OPT --yes-playlist \
  $COOKIES_OPT "$URL"

# PythonでExcel出力
echo "📘 Excelファイルを保存中..."
python3 - <<EOF
import pandas as pd, json
with open("$METADATA_LOG", encoding="utf-8") as f:
    data = [json.loads(l) for l in f]
df = pd.DataFrame(data)
df["index"] = df.get("playlist_index", 0).fillna(0).astype(int).map(lambda x: f"{x:03}")
df["url"] = "https://youtu.be/" + df["id"]
df_out = df[["index", "title", "url"]]
df_out.columns = ["番号", "タイトル", "URL"]
df_out.to_excel("$EXCEL", index=False, engine="openpyxl")
EOF

rm -f "$METADATA_LOG"
echo "✅ 完了！保存先: $SAVE_DIR"
