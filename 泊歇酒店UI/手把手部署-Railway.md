# 🚀 手把手：用免费平台(Railway)部署你的酒店好评生成器

> 全程不需要懂代码，跟着点就行。预计 20-30 分钟。
> 你需要准备：一个 **GitHub 账号**（免费注册）+ **邮箱**。

---

## 总览（4 大步）

1. 注册 GitHub，创建仓库
2. 把应用文件上传到 GitHub
3. 用 Railway 连接 GitHub，一键部署
4. 拿到网址，手机扫码测试

---

## 第 1 步：注册 GitHub 并创建仓库

1. 打开浏览器，进入 **https://github.com**
2. 点右上角 **Sign up**，用邮箱注册（如果已有账号直接登录）
3. 登录后，点右上角 **+** 号 → **New repository**
4. 在 **Repository name** 填：`hotel-review`
5. 选 **Public**（公开）或 **Private**（私有）都可以
6. 点底部绿色按钮 **Create repository**，完成创建

---

## 第 2 步：上传应用文件到仓库

你有两种方式上传，**选一种**即可。

### 方式 A：网页直接拖拽上传（最简单，推荐）

1. 打开你刚创建的仓库页面（`https://github.com/你的用户名/hotel-review`）
2. 点 **Add file → Upload files**
3. 在弹出的文件选择窗口里，选中 `泊歇酒店UI` 文件夹内的**这几个文件**（都在同一个文件夹里，别漏）：
   - `index.html`
   - `share.html`
   - `server.js`
   - `package.json`
   - `lib` 文件夹（整个文件夹，里面是 qrcode.min.js）
4. 拖拽或选择后，页面底部 **Commit changes**，点绿色按钮确认上传

> ⚠️ **重要**：`lib` 文件夹一定要整个上传，否则二维码功能会失效。

### 方式 B：用命令行（Git 上传）

如果电脑已装 Git，可在 `泊歇酒店UI` 文件夹里打开终端执行：
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/hotel-review.git
git push -u origin main
```

---

## 第 3 步：用 Railway 部署

1. 打开 **https://railway.app**
2. 点右上角 **Login**，选择 **Continue with GitHub**，授权登录（允许 Railway 访问你的仓库）
3. 登录后点 **New Project**
4. 选择 **Deploy from GitHub repo**
5. 在仓库列表里选 **hotel-review**，点确认
6. Railway 会自动开始构建、部署（看到日志滚动，等 1-3 分钟）
7. 部署完成后，点项目里的 **Settings**（齿轮图标）
8. 找到 **Networking** 区域，点 **Generate Domain**（生成公网域名）
9. 系统会给一个类似 `https://hotel-review-production.up.railway.app` 的网址，**记下这个网址**

---

## 第 4 步：验证 & 手机扫码测试

1. 在浏览器打开 Railway 给你的网址，应该能看到"房型好评生成器"主界面
2. 选中一个房型 → 生成一条好评 → 看到自动二维码
3. **用手机扫码**，能打开分享页、看到文字和图片 → **部署成功！🎉**

---

## 常见问题

**Q：登录 Railway 时没有仓库？**
可能没授权仓库。点 Railway 里的 **Account Settings → GitHub App**，确认已连接，或重新授权。

**Q：部署后打开是 404 或空白？**
- 确认 `package.json` 上传了（Railway 靠它知道怎么启动）
- 确认 `server.js` 和 `package.json` 在仓库**根目录**（不要放在子文件夹里）

**Q：Railway 免费吗？**
新账号有免费额度（每月约 5 美元用量）。个人/小规模用基本够，部署成功后会扣少量额度。不够时可升级或换方案。

**Q：免费域名别人能扫吗？**
能。Railway 生成的 `.up.railway.app` 是公网可访问的，任何手机扫码都能打开。

---

## 记住这些

- ✅ 你的应用网址：`Railway 生成的域名`
- ✅ 以后改代码：更新 GitHub 仓库 → Railway 自动重新部署
- ✅ 分享链接、二维码都会自动指向你的 Railway 域名，无需改代码
