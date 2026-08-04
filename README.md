# ICHIGOMusic

ICHIGOMusic 是一款基于 Electron 的网易云音乐桌面播放器，提供经典布局和现代布局两套界面，并重点优化沉浸式歌词、桌面歌词、音频可视化、缓存和多人一起听体验。

## 主要功能

- 网易云音乐登录、搜索、歌单、收藏、最近播放和排行榜
- 经典布局 / 现代布局切换
- 沉浸式歌词：常规滚动、逐字、混乱、气泡、云阶、空间画布、黑胶等模式
- 桌面歌词：三行歌词、翻译歌词、逐字动画、辉光和窗口锁定
- 自动匹配逐字歌词、翻译歌词和罗马音，并支持歌词源切换
- 专辑封面缓存、歌词缓存、音频缓存和最近播放封面缓存
- 音频可视化：波形、律动条等样式，可按歌词模式分别配置
- 自适应暖色 / 冷色主题，根据专辑封面提取配色
- 播放进度预览：悬停进度条查看歌词序号、歌词内容和时间范围
- 一起听：房间创建、邀请链接、播放进度同步、实时聊天和 WebSocket 更新
- 网易云听歌记录上报，支持播放时长和播放记录同步
- 桌面端剪切板监听，识别一起听邀请链接并弹出加入提示

## 技术栈

- Electron
- React 18
- Vite
- JavaScript / JSX
- Express
- WebSocket (`ws`)
- Lucide React
- Framer Motion

项目内置网易云 API 服务目录位于 `server/`，一起听房间后端位于同级目录的 `ichigomusicserver/`。

## 项目结构

```text
ichigomusic/
├─ src/
│  ├─ components/       UI 组件、播放器、歌词组件
│  ├─ context/           全局播放和用户状态
│  ├─ hooks/             歌词、一起听等业务逻辑
│  ├─ utils/             API、缓存和配置工具
│  └─ views/             页面视图
├─ server/               网易云 API 服务和本地模块
├─ static/               静态资源
├─ main-electron.js      Electron 主进程
├─ preload-electron.cjs  Electron preload 脚本
├─ index.css             全局主题和布局样式
└─ release/              Windows 打包输出目录
```

## 开发运行

环境要求：Node.js 18+，推荐使用 npm。

```bash
cd ichigomusic
npm install
npm run dev
```

启动 Electron 开发窗口：

```bash
npm run dev
npm run electron
```

## 生产构建

构建前端：

```bash
npm run build
```

构建 Windows 安装包和免安装版本：

```bash
npm run electron:build
```

输出文件：

```text
release/ICHIGOMusic Setup 1.6.9.exe
release/win-unpacked/
```

## 一起听后端

一起听后端项目：

```text
D:/程序/wyyyy播放器/ichigomusicserver
```

默认配置：

```text
HOST=0.0.0.0
PORT=16666
```

使用 PM2 启动：

```bash
cd ichigomusicserver
npm install --omit=dev
npm run pm2:start
npm run pm2:save
```

服务健康检查：

```text
http://8.137.169.120:16666/health
```

前端一起听服务地址可通过构建环境变量修改：

```text
VITE_LISTEN_SERVER_URL=http://8.137.169.120:16666
```

一起听播放源同步仍受播放地址有效期、账号权限和网络环境影响；成员端会优先使用房主同步的当前播放源，失效时回退到自己的账号解析。

## 缓存

缓存设置位于播放器设置页面，支持：

- 自定义缓存目录
- 音频、封面和歌词缓存
- 缓存大小限制
- 清理缓存
- 最近播放封面优先从缓存恢复

缓存目录建议放在有足够空间的本地磁盘，不建议放在临时目录或网络盘。

## 版本

当前版本：**1.6.9**

### 1.6.9 更新内容

- 一起听房间增加房主播放源同步，成员端优先使用房主当前播放源
- 增加网易云 `/scrobble/v1` 听歌记录和播放时长上报
- 播放达到有效时长后自动上报，歌曲结束时补报
- 一起听页面改为响应式固定画布布局
- 页面和成员栏隐藏外层滚动条，仅聊天内容保留内部滚动
- 优化窗口放大和缩小时的字体、封面、卡片间距比例
- 强化 NOW PLAYING 区域的视觉重心
- 增加当前歌词随播放进度更新
- 改进一起听房间的播放状态、播放地址和 WebSocket 同步

## 注意事项

- 网易云接口需要有效登录状态，部分歌曲会受到版权、会员、地区和播放地址有效期限制。
- 一起听服务需要开放服务器 TCP `16666` 端口。
- 请不要把登录 Cookie、账号密码或私有播放地址提交到代码仓库。
- 本项目仅用于个人学习和本地音乐播放场景，请遵守相关服务条款和版权规定。
