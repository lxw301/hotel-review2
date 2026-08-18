// 简易服务器：静态托管 + 分享数据存取 API
// 用途：让"扫码展示页"能通过短ID获取好评+图片数据（解决二维码无法承载图片的问题）
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname; // 服务器文件所在目录即应用根目录（解压后无需改路径）
const PORT = process.env.PORT || 8080;

// 内存分享存储（进程重启后丢失；演示够用）
const shares = new Map();
let seq = 0;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // 根据请求的 Host 动态生成分享地址（部署到公网后自动指向公网域名/端口）
  const buildShareBase = () => {
    const host = req.headers.host || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${host}`;
  };

  // ---- 分享数据 API ----
  if (p === '/api/share' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data || !data.text) { res.writeHead(400); res.end('bad'); return; }
        const id = 's' + (++seq) + '_' + Date.now().toString(36);
        shares.set(id, data);
        // 基于实际 Host 动态生成可访问的分享 URL
        const shareUrl = `${buildShareBase()}/share.html#${id}`;
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ id, url: shareUrl }));
      } catch(e) {
        res.writeHead(400); res.end('bad json');
      }
    });
    return;
  }

  // ---- 取分享数据 ----
  if (p.startsWith('/api/share/')) {
    const id = p.slice('/api/share/'.length);
    if (shares.has(id)) {
      res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      res.end(JSON.stringify(shares.get(id)));
    } else {
      res.writeHead(404); res.end('not found');
    }
    return;
  }

  // ---- CORS 预检 ----
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type'
    });
    res.end();
    return;
  }

  // ---- 静态文件 ----
  let filePath = path.join(ROOT, p === '/' ? 'index.html' : p);
  // 防目录穿越
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) { res.writeHead(404); res.end('Not Found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
