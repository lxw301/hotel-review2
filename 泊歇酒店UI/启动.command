#!/bin/bash
# 房型好评生成器 - 一键启动（Mac / Linux）
cd "$(dirname "$0")"

echo "========================================"
echo "  房型好评生成器 - 启动中..."
echo "========================================"
echo

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装:"
  echo "  macOS:  brew install node"
  echo "  或访问 https://nodejs.org/ 下载"
  echo
  read -p "按回车退出..."
  exit 1
fi

echo "正在启动本地服务器..."
echo "启动成功后会自动打开浏览器，请勿关闭本窗口。"
echo
# 延迟打开浏览器
( sleep 1; open http://localhost:8080/index.html 2>/dev/null || xdg-open http://localhost:8080/index.html 2>/dev/null ) &
node server.js
