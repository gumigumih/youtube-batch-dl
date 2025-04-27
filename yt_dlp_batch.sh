#!/bin/bash

# -------------------------------
# YouTube動画をバッチでダウンロードするスクリプト
# - 30件ずつ分割して処理（YouTube制限対策）
# - チャンネル / 再生リスト / 単体動画 すべてに対応
# - Cookie認証に対応
# - ファイル名は playlist_index または "000" で連番化
# - 動画タイトルとURLをExcel（.xlsx）形式で保存
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
  read -p "👉 このURLを使いますか？ (Y/n): " USE_LAST
  if [[ "$USE_LAST" =~ ^[Nn]$ ]]; then
    read -p "🔗 新しいURLを入力してください: " URL
    echo "$URL" > "$URL_FILE"
  else
    URL="$LAST_URL"
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

# 最初の動画メタ取得
METADATA=$(yt-dlp --skip-download --print-json --playlist-items 1 $COOKIES_OPT "$URL")
CHANNEL_TITLE=$(echo "$METADATA" | jq -r '.channel | select(. != null)')
PLAYLIST_TITLE=$(echo "$METADATA" | jq -r '.playlist_title | select(. != null)')
PLAYLIST_COUNT=$(echo "$METADATA" | jq -r '.playlist_count // 0')

if [ "$PLAYLIST_COUNT" -gt 1 ]; then
  IS_PLAYLIST=true
else
  IS_PLAYLIST=false
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

# 処理分岐：プレイリスト or 単体
if [ "$IS_PLAYLIST" = true ]; then
  echo "📄 プレイリストとして処理します"

  VIDEO_COUNT=$(yt-dlp --flat-playlist --print "%(id)s" $COOKIES_OPT "$URL" | wc -l)
  echo "📄 総動画数: $VIDEO_COUNT 件"

  for ((i=1; i<=$VIDEO_COUNT; i+=BATCH_SIZE)); do
    END=$((i + BATCH_SIZE - 1))
    echo "🔁 処理中: $i〜$END"

    yt-dlp --skip-download --print-json \
      --playlist-items "$i-$END" --yes-playlist $COOKIES_OPT "$URL" >> "$METADATA_LOG"

    yt-dlp \
      -f "bv*[vcodec^=avc][ext=mp4]+ba[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" \
      -o "%(playlist_index,0)03d - %(title)s.%(ext)s" \
      --write-thumbnail \
      --convert-thumbnails png \
      --merge-output-format mp4 \
      --embed-thumbnail \
      --compat-options filename-sanitization \
      --download-archive "$ARCHIVE_FILE" \
      --playlist-items "$i-$END" --yes-playlist \
      $COOKIES_OPT "$URL"

    sleep_time=$((RANDOM % 3 + 3))
    echo "😴 スリープ中... (${sleep_time}s)"
    sleep $sleep_time
  done
else
  echo "📄 単体動画として処理します"

  yt-dlp --skip-download --print-json $COOKIES_OPT "$URL" >> "$METADATA_LOG"

  yt-dlp \
    -f "bv*[vcodec^=avc][ext=mp4]+ba[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=mp4]/best[ext=mp4]/best" \
    -o "%(title)s.%(ext)s" \
    --write-thumbnail \
    --convert-thumbnails png \
    --merge-output-format mp4 \
    --embed-thumbnail \
    --compat-options filename-sanitization \
    --download-archive "$ARCHIVE_FILE" \
    $COOKIES_OPT "$URL"
fi

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

# Excel出力（Unicode対応）
df_out.to_excel("$EXCEL", index=False, engine="openpyxl")
EOF

rm -f "$METADATA_LOG"
echo "✅ 完了！保存先: $SAVE_DIR"
