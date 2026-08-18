// 云端同步服务器：静态托管 + 共享数据 API（多员工看到同一份内容）
// 数据持久化：DATA_DIR 目录下 data.json + imgs/（Railway 挂载 Volume 后重启不丢）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
// Railway 部署时建议：Settings → Volumes → New Volume（Mount Path 填 /data）
// 挂载后无需设置环境变量，下面会自动识别 /data 并持久化
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(ROOT, 'data'));
const IMG_DIR = path.join(DATA_DIR, 'imgs');
const DB_FILE = path.join(DATA_DIR, 'data.json');

fs.mkdirSync(IMG_DIR, { recursive: true });

/* ===================== 共享数据库（内存 + 文件持久化） ===================== */
let DB = {
  rooms:   { qingju: [], nuanyu: [], zhenxuan: [], nuanyang: [] }, // 各房型图片URL列表
  library: [],   // 评价库 [{id,time,text,room,roomId,images:[url],used,shareId}]
  used:    {},   // 防重复句库 { roomId: { 句子: 1 } }
  shares:  {},   // 分享数据 { id: {data, viewed} }
  seq:     0,
};
(function loadDB(){
  try{
    if(fs.existsSync(DB_FILE)){
      const d = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      ['rooms','library','used','shares','seq'].forEach(k=>{
        if(d[k] !== undefined) DB[k] = d[k];
      });
    }
  }catch(e){ console.error('data.json 读取失败，使用空库', e.message); }
})();
function saveDB(){
  try{ fs.writeFileSync(DB_FILE, JSON.stringify(DB)); }
  catch(e){ console.error('data.json 写入失败', e.message); }
}

/* ===================== 工具 ===================== */
function readBody(req){
  return new Promise(resolve=>{
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try{ resolve(JSON.parse(body || '{}')); }
      catch(e){ resolve(null); }
    });
  });
}
function json(res, obj){
  res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' });
  res.end(JSON.stringify(obj));
}
// 图片存盘：内容哈希做文件名 → 同图天然幂等（多人重复上传不占空间、不重复入列）
function storeImage(dataUrl){
  const m = /^data:image\/(png|jpeg|jpg|svg\+xml|webp|gif);base64,(.+)$/.exec(dataUrl || '');
  if(!m) return null;
  const extMap = { jpeg:'jpg', jpg:'jpg', png:'png', 'svg+xml':'svg', webp:'webp', gif:'gif' };
  const ext = extMap[m[1]];
  let buf;
  try{ buf = Buffer.from(m[2], 'base64'); }catch(e){ return null; }
  if(!buf || !buf.length) return null;
  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 16);
  const name = hash + '.' + ext;
  const fp = path.join(IMG_DIR, name);
  if(!fs.existsSync(fp)) fs.writeFileSync(fp, buf);
  return '/img/' + name;
}
// 扫码自动归档：被查看过的分享 → 对应评价条目标记"已使用"
function archiveViewed(){
  let changed = false;
  DB.library.forEach(it=>{
    if(it.shareId && DB.shares[it.shareId] && DB.shares[it.shareId].viewed && !it.used){
      it.used = true; changed = true;
    }
  });
  if(changed) saveDB();
}

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type' });
    res.end(); return;
  }

  /* ---------- 全量同步：所有员工共享的同一份数据 ---------- */
  if (p === '/api/data' && req.method === 'GET') {
    archiveViewed();
    // 补全每个房型的已用句结构，避免旧客户端覆盖后丢键
    ['qingju','nuanyu','zhenxuan','nuanyang'].forEach(rid=>{ if(!DB.used[rid]) DB.used[rid] = {}; });
    json(res, { rooms: DB.rooms, library: DB.library, used: DB.used });
    return;
  }

  /* ---------- 图片上传（返回可共享的 URL） ---------- */
  if (p === '/api/img' && req.method === 'POST') {
    const body = await readBody(req);
    const u = body && body.data ? storeImage(body.data) : null;
    if(!u){ res.writeHead(400); res.end('bad image'); return; }
    json(res, { url: u });
    return;
  }

  /* ---------- 图库管理 ---------- */
  if (p === '/api/rooms/add' && req.method === 'POST') {
    const body = await readBody(req);
    const rid = body && body.roomId;
    const urls = Array.isArray(body && body.urls) ? body.urls : [];
    if(!DB.rooms[rid] || !urls.length){ res.writeHead(400); res.end('bad'); return; }
    let added = 0;
    urls.forEach(u=>{
      if(typeof u === 'string' && !DB.rooms[rid].includes(u)){ DB.rooms[rid].push(u); added++; } // 数量无上限（按内容去重）
    });
    saveDB();
    json(res, { ok:true, rooms: DB.rooms, added });
    return;
  }
  if (p === '/api/rooms/remove' && req.method === 'POST') {
    const body = await readBody(req);
    const rid = body && body.roomId;
    if(!DB.rooms[rid]){ res.writeHead(400); res.end('bad'); return; }
    // 优先按 URL 定位（多端并发时索引会漂移，URL 不会）
    let idx = -1;
    if(typeof body.url === 'string') idx = DB.rooms[rid].indexOf(body.url);
    else if(typeof body.idx === 'number') idx = body.idx;
    if(idx < 0 || idx >= DB.rooms[rid].length){ json(res, { ok:true, rooms: DB.rooms }); return; }
    DB.rooms[rid].splice(idx, 1);
    saveDB();
    json(res, { ok:true, rooms: DB.rooms });
    return;
  }

  /* ---------- 评价库管理（按 id 定位，多端并发安全） ---------- */
  if (p === '/api/library/add' && req.method === 'POST') {
    const body = await readBody(req);
    const items = Array.isArray(body && body.items) ? body.items : [];
    if(!items.length){ res.writeHead(400); res.end('bad'); return; }
    const saved = items.map(it=>{
      const one = Object.assign({}, it, { id: 'li' + (++DB.seq) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) });
      return one;
    });
    // 逆序 unshift，保持传入顺序显示在库顶
    for(let i = saved.length - 1; i >= 0; i--) DB.library.unshift(saved[i]);
    saveDB();
    json(res, { ok:true, items: saved });
    return;
  }
  if (p === '/api/library/toggle' && req.method === 'POST') {
    const body = await readBody(req);
    const it = DB.library.find(x=>x.id === (body && body.id));
    if(!it){ res.writeHead(404); res.end('not found'); return; }
    it.used = !it.used;
    saveDB();
    json(res, { ok:true, item: it });
    return;
  }
  if (p === '/api/library/delete' && req.method === 'POST') {
    const body = await readBody(req);
    const i = DB.library.findIndex(x=>x.id === (body && body.id));
    if(i < 0){ res.writeHead(404); res.end('not found'); return; }
    DB.library.splice(i, 1);
    saveDB();
    json(res, { ok:true });
    return;
  }

  /* ---------- 防重复句库 ---------- */
  if (p === '/api/used/add' && req.method === 'POST') {
    const body = await readBody(req);
    const rid = body && body.roomId;
    const sents = Array.isArray(body && body.sentences) ? body.sentences : [];
    if(!rid || !sents.length){ json(res, { ok:true }); return; }
    if(!DB.used[rid]) DB.used[rid] = {};
    sents.forEach(s=>{ const t = String(s).trim(); if(t) DB.used[rid][t] = 1; });
    saveDB();
    json(res, { ok:true });
    return;
  }
  if (p === '/api/used/reset' && req.method === 'POST') {
    const body = await readBody(req);
    const rid = body && body.roomId;
    if(rid){ DB.used[rid] = {}; saveDB(); }
    json(res, { ok:true });
    return;
  }

  /* ---------- 分享数据（持久化；扫码记录 viewed） ---------- */
  if (p === '/api/share' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.text) { res.writeHead(400); res.end('bad'); return; }
    const id = 's' + (++DB.seq) + '_' + Date.now().toString(36);
    DB.shares[id] = { data: body, viewed: false };
    saveDB();
    const host = req.headers.host || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    json(res, { id, url: `${proto}://${host}/share.html#${id}` });
    return;
  }
  if (p === '/api/share/status' && req.method === 'POST') {
    const body = await readBody(req);
    const status = {};
    (Array.isArray(body && body.ids) ? body.ids : []).forEach(id=>{
      if(DB.shares[id]) status[id] = !!DB.shares[id].viewed;
    });
    json(res, status);
    return;
  }
  if (p.startsWith('/api/share/')) {
    const id = p.slice('/api/share/'.length);
    if (DB.shares[id]) {
      DB.shares[id].viewed = true;  // 有人扫码查看 → 记录，评价库据此自动归为"已使用"
      archiveViewed();
      json(res, DB.shares[id].data);
    } else { res.writeHead(404); res.end('not found'); }
    return;
  }

  /* ---------- 静态文件 ---------- */
  if (p.startsWith('/img/')) {
    const name = path.basename(p);
    const fp = path.join(IMG_DIR, name);
    if(!fp.startsWith(IMG_DIR) || !fs.existsSync(fp)){ res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(name).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control':'public, max-age=86400' });
    res.end(fs.readFileSync(fp));
    return;
  }

  let filePath = path.join(ROOT, p === '/' ? 'index.html' : p);
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
  console.log(`Server running at http://localhost:${PORT}  (数据目录: ${DATA_DIR})`);
});
