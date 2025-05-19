#!/bin/bash

# -------------------------------
# YouTube動画をバッチでダウンロードするスクリプト（関数ベース・インラインコメント付き）
# - 範囲指定ダウンロード、チャンネル/再生リスト/単体動画対応
# - Cookie認証対応、動画 or MP3切替、Excel出力対応
# -------------------------------

trap 'on_interrupt' INT  # Ctrl+Cで中断時の処理を登録

on_interrupt() {
  echo ""
  echo "🛑 中断を検知しました。スクリプトを終了します。"
  rm -f "$METADATA_LOG"  # 中間ファイルがあれば削除
  exit 1
}

# 各種ファイル・変数設定
URL_FILE="_last_urls.txt"
COOKIES_OPT="--cookies _cookies.txt"
ARCHIVE_FILE="_downloaded.txt"
METADATA_LOG="_metadata.jsonl"
EXCEL="_video_list.xlsx"

# 必要コマンドの存在確認
check_dependencies() {
  for cmd in jq fzf yt-dlp python3 xclip; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "❌ 必要なコマンド '$cmd' が見つかりません。README.md を参照してください。"
      exit 1
    fi
  done
}

# クリップボードのURLを取得（xclip対応）
get_clipboard_url_list() {
  local urls=""
  if command -v xclip &>/dev/null; then
    urls=$(xclip -selection clipboard -o 2>/dev/null)
  fi

  # 改行区切りで複数行を処理し、http(s)のみに絞る
  echo "$urls" | grep -E '^https?://' | sed 's/\r//'  # Windows改行除去
}


# URL選択画面（fzfで選択）
# 複数URL選択画面（fzfで選択、複数入力にも対応）
select_urls() {
  local clipboard_url_list=("$@")
  local options="新しいURLを入力する\n新しいURLを複数入力する"

  # 前回のURL
  if [ -f "$URL_FILE" ]; then
    mapfile -t last_urls < "$URL_FILE"
    [ "${#last_urls[@]}" -gt 0 ] && options="前回のURLを使う (${#last_urls[@]}件)\n$options"
  fi

  # クリップボードに1件以上あれば表示に追加
  if [ "${#clipboard_url_list[@]}" -gt 0 ]; then
    options="クリップボードのURLを使う (${#clipboard_url_list[@]}件)\n$options"
  fi

  local selection=$(printf "%b" "$options" | fzf --prompt="▶ " --header="使用するURLを選んでください" --height=30% --border --layout=reverse)

  if [ -z "$selection" ]; then
    echo "⚠️  URLの選択がキャンセルされました。" >&2
    return 1
  fi

  if [[ "$selection" == "前回のURLを使う"* ]]; then
    echo "📋 前回のURL（${#last_urls[@]}件）を使います。" >&2
    for url in "${last_urls[@]}"; do
      echo "$url"
    done
  elif [[ "$selection" == "クリップボードのURLを使う"* ]]; then
    echo "📋 クリップボードのURLを使います（${#clipboard_url_list[@]}件）" >&2
    for url in "${clipboard_url_list[@]}"; do
      echo "$url"
    done
  elif [[ "$selection" == "新しいURLを複数入力する" ]]; then
    echo "📋 複数のYouTube URLを1行ずつ入力してください。" >&2
    echo "💡 入力が終わったら Ctrl+D（または Ctrl+Z + Enter）で確定します。" >&2
    mapfile -t lines
    for line in "${lines[@]}"; do
      echo "$line"
    done
  else
    read -p "🔗 新しいURLを入力してください: " input_url
    echo "$input_url"
  fi
}

# 複数のURLを順に処理（1件ずつ保存・DL・Excel出力）
process_urls() {
  local -n urls=$1  # 引数を参照として受け取る

  # URL保存（複数行）
  printf "%s\n" "${URLS[@]}" > "$URL_FILE"

  for URL in "${urls[@]}"; do
    echo "🌐 現在処理中のURL: $URL"

    TARGET_NAME=$(get_target_name "$URL")
    echo "🎯 ダウンロード対象: $TARGET_NAME"

    SAVE_DIR=$(echo "$TARGET_NAME" | sed 's/[\\/:*?"<>|]/_/g')
    mkdir -p "$SAVE_DIR"
    cd "$SAVE_DIR" || continue

    DOWNLOAD_OPT=$(select_download_mode)
    RANGE_OPT=$(get_range_option "$URL")

    run_download "$URL" "$RANGE_OPT"
    write_excel

    cd - >/dev/null
  done
}

# ダウンロードモード選択（動画 or 音声のみ）
select_download_mode() {
  local selection=$(printf "%s\n" "通常モード（動画）" "MP3音声のみ" | fzf --prompt="▶ " --header="ダウンロードオプションを選択してください" --height=30% --border --layout=reverse)
  if [[ "$selection" == "MP3音声のみ" ]]; then
    echo "📋 MP3音声のみモードです。" >&2
    echo "-x --audio-format mp3 --audio-quality 0"
  else
    echo "📋 通常モード（動画）です。" >&2
    echo "-f bv*[vcodec^=avc][ext=mp4]+ba[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best --merge-output-format mp4 --embed-thumbnail"
  fi
}

# 保存フォルダ名（チャンネル名・プレイリスト名・動画タイトル）を取得
get_target_name() {
  local url="$1"

  if [[ "$url" == *"list="* ]]; then
    type="playlist"
  elif [[ "$url" == *"/@"* || "$url" == *"/channel/"* ]]; then
    type="channel"
  else
    type="single"
  fi

  for i in {1..50}; do
    case "$type" in
      playlist)
        name=$(yt-dlp --skip-download --print-json --playlist-items "$i" $COOKIES_OPT "$url" 2>/dev/null | jq -r '.playlist_title // empty')
        ;;
      channel)
        name=$(yt-dlp --skip-download --print-json --playlist-items "$i" $COOKIES_OPT "$url" 2>/dev/null | jq -r '.channel // empty')
        ;;
      single)
        name=$(yt-dlp --skip-download --print-json $COOKIES_OPT "$url" 2>/dev/null | jq -r '.title // "unknown_video"')
        echo "$name"
        return
        ;;
    esac
    [ -n "$name" ] && echo "$name" && return
  done
  echo "unknown_${type}"
}

# ダウンロード範囲をfzfで指定（プレイリスト・チャンネル用）
get_range_option() {
  local url="$1"
  if [[ "$url" == *"list="* || "$url" == *"/@"* || "$url" == *"/channel/"* ]]; then
    local selection=$(printf "%s\n" "すべてダウンロード" "範囲を指定する" | fzf --prompt="▶ " --header="ダウンロード範囲を選択してください" --height=30% --border --layout=reverse)
    if [[ "$selection" == "範囲を指定する" ]]; then
      local video_list=()
      while IFS= read -r line; do
        video_list+=("$line")
      done < <(yt-dlp --flat-playlist --print "%(playlist_index)s: %(title)s" $COOKIES_OPT "$url")

      local start=$(printf "%s\n" "${video_list[@]}" | fzf --prompt="▶ " --header="開始動画を選んでください" --height=30%)
      local end=$(printf "%s\n" "${video_list[@]}" | fzf --prompt="▶ " --header="終了動画を選んでください" --height=30%)
      local start_index=$(echo "$start" | cut -d: -f1)
      local end_index=$(echo "$end" | cut -d: -f1)

      if [ "$start_index" -le "$end_index" ]; then
        echo "--playlist-items ${start_index}-${end_index}"
      else
        echo ""
      fi
    fi
  fi
}

# ダウンロード実行関数
run_download() {
  local url="$1"
  local range_opt="$2"

  echo "📅 メタデータ取得中..."
  local video_info=$(yt-dlp --skip-download --print-json $range_opt --yes-playlist $COOKIES_OPT "$url" | tee "$METADATA_LOG")
  local video_count=$(echo "$video_info" | jq -s 'length')
  local count=0

  while IFS= read -r line; do
    local id=$(echo "$line" | jq -r '.id')
    local title=$(echo "$line" | jq -r '.title')
    count=$((count + 1))
    local pad=$(printf "%03d" "$count")
    echo "🎥 [$count/$video_count] $title をダウンロード中..."

    yt-dlp \
      $DOWNLOAD_OPT \
      -o "$pad - %(title)s.%(ext)s" \
      --write-thumbnail \
      --convert-thumbnails png \
      --compat-options filename-sanitization \
      --download-archive "$ARCHIVE_FILE" \
      $COOKIES_OPT "https://youtu.be/$id" > /dev/null 2>&1

    echo "✅ [$count/$video_count] $title ダウンロード完了！"
  done <<< "$video_info"
}

# Excelファイルを書き出す関数（Python使用）
write_excel() {
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
}

# ==========================
# 実行開始
# ==========================

echo "🚀 スクリプトを開始します"
check_dependencies

mapfile -t CLIPBOARD_URLS < <(get_clipboard_url_list)
if ! mapfile -t URLS < <(select_urls "${CLIPBOARD_URLS[@]}"); then
  echo "❌ URLが選択されなかったため、処理を中止します。" >&2
  exit 1
fi

process_urls URLS

echo ""
echo "✅ すべての処理が完了しました！"

