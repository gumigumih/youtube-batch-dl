#!/bin/bash

# -------------------------------
# YouTube動画をバッチでダウンロードするスクリプト
# - 範囲指定ダウンロード対応
# - チャンネル / 再生リスト / 単体動画 すべてに対応
# - Cookie認証に対応
# - 通常動画 / MP3抽出切り替え可能
# - ファイル名は playlist_index または "000" で連番化
# - 動画タイトルとURLをExcel（.xlsx）形式で保存
# -------------------------------

trap 'on_interrupt' INT

on_interrupt() {
  echo ""
  echo "🛑 中断を検知しました。スクリプトを終了します。"
  rm -f "$METADATA_LOG"  # もし一時ファイルがあれば削除する
  exit 1
}

URL_FILE="_last_url.txt"
COOKIES_OPT="--cookies _cookies.txt"
ARCHIVE_FILE="_downloaded.txt"
METADATA_LOG="_metadata.jsonl"
EXCEL="_video_list.xlsx"
BATCH_SIZE=30

# URL入力（履歴あり）
if [ -f "$URL_FILE" ]; then
  LAST_URL=$(cat "$URL_FILE")
    SELECT=$(printf "%s\n" "前回のURLを使う" "新しいURLを入力する" | fzf --prompt="▶ " --header="前回入力したURL（${LAST_URL}）があります。どうしますか？" --height=30% --border --layout=reverse)
  if [[ "$SELECT" == "前回のURLを使う" ]]; then
    URL="$LAST_URL"
    echo "🔗 前回のURL（${LAST_URL}）を使います"
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

# URL判定と対象名取得
if [[ "$URL" == *"list="* ]]; then
  TYPE="playlist"
elif [[ "$URL" == *"/@"* ]] || [[ "$URL" == *"/channel/"* ]]; then
  TYPE="channel"
else
  TYPE="single"
fi

# タイトル取得
case "$TYPE" in
  "playlist")
    i=1
    while true; do
      TARGET_NAME=$(yt-dlp --skip-download --print-json --playlist-items $i $COOKIES_OPT "$URL" 2>/dev/null | jq -r '.playlist_title // empty')
      if [ -n "$TARGET_NAME" ]; then
        break
      fi
      i=$((i + 1))
      if [ "$i" -ge 50 ]; then
        echo "⚠️ playlist_titleが見つかりませんでした。50件試行しても失敗。"
        TARGET_NAME="unknown_playlist"
        break
      fi
    done
    ;;
  "channel")
    i=1
    while true; do
      TARGET_NAME=$(yt-dlp --skip-download --print-json --playlist-items $i $COOKIES_OPT "$URL" 2>/dev/null | jq -r '.channel // empty')
      if [ -n "$TARGET_NAME" ]; then
        break
      fi
      i=$((i + 1))
      if [ "$i" -ge 50 ]; then
        echo "⚠️ channel名が見つかりませんでした。50件試行しても失敗。"
        TARGET_NAME="unknown_channel"
        break
      fi
    done
    ;;
  "single")
    TARGET_NAME=$(yt-dlp --skip-download --print-json $COOKIES_OPT "$URL" 2>/dev/null | jq -r '.title // "unknown_video"')
    ;;
esac

# 保存先ディレクトリ設定
SAVE_DIR=$(echo "$TARGET_NAME" | sed 's/[\\/:*?"<>|]/_/g')
mkdir -p "$SAVE_DIR"
cd "$SAVE_DIR" || exit

# ダウンロードモード選択
SELECT=$(printf "%s\n" "通常モード（動画）" "MP3音声のみ" | fzf --prompt="▶ " --header="ダウンロードオプションを選択してください" --height=30% --border --layout=reverse)

if [[ "$SELECT" == "MP3音声のみ" ]]; then
  MODE="2"
  DOWNLOAD_OPT="-x --audio-format mp3 --audio-quality 0"
  OUTPUT_TEMPLATE="%(playlist_index,0)03d - %(title)s.%(ext)s"
  echo "🎵 MP3音声のみダウンロードを選びました"
else
  MODE="1"
  DOWNLOAD_OPT="-f bv*[vcodec^=avc][ext=mp4]+ba[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best --merge-output-format mp4 --embed-thumbnail"
  OUTPUT_TEMPLATE="%(playlist_index,0)03d - %(title)s.%(ext)s"
  echo "🎬 通常モード（動画）ダウンロードを選びました"
fi

# 最初の動画リスト取得
echo "📄 動画リスト情報を取得中..."
VIDEO_INFO=$(yt-dlp --flat-playlist --print-json $COOKIES_OPT "$URL")
VIDEO_COUNT=$(echo "$VIDEO_INFO" | jq -s 'length')

# ダウンロード対象表示
echo "🎯 ダウンロード対象: $TARGET_NAME"

# 範囲指定
if [[ "$TYPE" == "playlist" || "$TYPE" == "channel" ]]; then
    SELECT=$(printf "%s\n" "すべてダウンロード" "範囲を指定する" | fzf --prompt="▶ " --header="ダウンロード範囲を選択してください" --height=30% --border --layout=reverse)
  if [[ "$SELECT" == "範囲を指定する" ]]; then
    echo "📄 プレイリスト情報を取得中..."
    VIDEO_LIST=()
    while IFS= read -r line; do
      VIDEO_LIST+=("$line")
    done < <(yt-dlp --flat-playlist --print "%(playlist_index)s: %(title)s" $COOKIES_OPT "$URL")

    while true; do
      START_VIDEO=$(printf "%s\n" "${VIDEO_LIST[@]}" | fzf --prompt="▶ " --header="開始動画を選んでください" --height=30% --border --layout=reverse)
      START_INDEX=$(echo "$START_VIDEO" | cut -d: -f1)

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

# メタデータ収集
yt-dlp --skip-download --print-json $RANGE_OPT --yes-playlist $COOKIES_OPT "$URL" >> "$METADATA_LOG"

# 実ダウンロード
COUNT=0

while IFS= read -r LINE; do
  ID=$(echo "$LINE" | jq -r '.id')
  TITLE=$(echo "$LINE" | jq -r '.title')
  COUNT=$((COUNT + 1))

  echo "🎬 [$COUNT/$VIDEO_COUNT] $TITLE をダウンロード中..."

  yt-dlp \
    $DOWNLOAD_OPT \
    -o "$OUTPUT_TEMPLATE" \
    --write-thumbnail \
    --convert-thumbnails png \
    --compat-options filename-sanitization \
    --download-archive "$ARCHIVE_FILE" \
    $COOKIES_OPT "https://youtu.be/$ID" > /dev/null 2>&1

  echo "✅ [$COUNT/$VIDEO_COUNT] $TITLE ダウンロード完了！"
done <<< "$VIDEO_INFO"

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
