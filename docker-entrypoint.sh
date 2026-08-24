#!/bin/sh
set -e

DEV_VARS="/app/.dev.vars"

# ── 清空并重建 .dev.vars（wrangler pages dev 从此文件读取 env.*）─────────────
: > "$DEV_VARS"

write_var() {
  _name="$1"
  _value="$2"
  if [ -n "$_value" ]; then
    printf '%s="%s"\n' "$_name" "$_value" >> "$DEV_VARS"
    echo "  [env] $_name = configured"
  fi
}

echo "Configuring environment variables for wrangler..."

# 登录密码（_middleware.ts 读取 env.PASSWORD）
write_var "PASSWORD" "$PASSWORD"

# 音乐 API 地址（functions/proxy.ts 读取 env.API_BASE_URL，未配置时 fallback 到默认节点）
write_var "API_BASE_URL" "$API_BASE_URL"

# i18n 语言设置（_middleware.ts 读取 env.language / env.LANGUAGE）
# 支持两种写法：language=ENG 或 LANGUAGE=ENG
_LANG_VALUE="${language:-${LANGUAGE:-}}"
write_var "language" "$_LANG_VALUE"

# ── 确保 D1 持久化目录存在 ────────────────────────────────────────────────────
mkdir -p /data
chmod 755 /data

# ── 打印启动信息 ───────────────────────────────────────────────────────────────
echo ""
echo "  🌟 Solara  (Cloudflare Pages + Wrangler local dev)"
echo "  ────────────────────────────────────────────────────"
echo "  Port      : 8787"
echo "  Data dir  : /data"
echo "  Password  : ${PASSWORD:+configured}${PASSWORD:-not set (open access)}"
echo "  API URL   : ${API_BASE_URL:-https://music-api.gdstudio.xyz/api.php (default)}"
echo "  Language  : ${_LANG_VALUE:-ZH (default)}"
echo "  ────────────────────────────────────────────────────"
echo ""

# ── 启动 wrangler pages dev 监听本地 8788 端口（静态目录 public） ───────────────────────────────
echo "Starting wrangler pages dev in background on port 8788..."
wrangler pages dev public \
  --ip 127.0.0.1 \
  --port 8788 \
  --d1 DB \
  --persist-to=/data > /tmp/wrangler.log 2>&1 &

sleep 2

# ── 启动 Node.js 独立服务器监听 8787 端口 ──────────────────────────────────────
echo "Starting Node.js standalone server on port 8787..."
export PORT=8787
export HOST=0.0.0.0
export DATA_DIR=/data
export WRANGLER_API_URL=http://127.0.0.1:8788

exec node server/index.js
