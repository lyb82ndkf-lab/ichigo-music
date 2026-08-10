# ICHIGOMusic

ICHIGOMusic 是一款基于 Electron 的网易云音乐桌面播放器，提供经典布局和现代布局两套界面，并重点优化沉浸式歌词、桌面歌词、音频可视化、缓存和多人一起听体验。

## 功能特性

- 网易云音乐登录、搜索、歌单、收藏、最近播放和排行榜
- 经典布局与现代布局切换
- 沉浸式歌词模式：常规滚动、逐字、气泡、云阶、空间画布、黑胶等
- 多种沉浸式视觉效果、专辑封面背景运镜和音频可视化
- 桌面歌词窗口：三行歌词、翻译歌词、逐字动画、辉光效果和窗口锁定
- 自动匹配源语言、翻译、罗马音和逐字歌词，并支持切换歌词源
- 专辑封面、歌词、音频和最近播放封面缓存
- 可配置缓存目录、缓存容量和缓存清理
- 播放进度预览：查看歌词序号、歌词内容、翻译和时间范围
- 网易云听歌记录和播放时长上报
- 一起听房间：邀请链接、实时聊天、播放进度同步和 WebSocket 状态更新
- 一起听房主统一控制播放，成员保留音量控制，避免误操作破坏同步
- Windows 任务栏和系统托盘媒体控制
- 剪贴板监听，可识别一起听邀请链接并弹出加入提示
- 内置运行日志，方便定位音频、歌词、缓存和网络问题

## 技术栈

- Electron
- React 18
- Vite
- JavaScript / JSX
- Express
- WebSocket (`ws`)
- Lucide React
- Framer Motion

## 项目结构

```text
ichigomusic/
├─ src/
│  ├─ components/       UI、播放器和歌词组件
│  ├─ context/           全局播放和用户状态
│  ├─ hooks/             歌词、缓存和一起听业务逻辑
│  ├─ utils/             API、缓存和配置工具
│  └─ views/             页面视图
├─ server/               网易云 API 服务和本地模块
├─ static/               静态资源
├─ scripts/              构建和回归检查脚本
├─ main-electron.js      Electron 主进程
├─ preload-electron.cjs  Electron preload 脚本
├─ index.css             全局主题和布局样式
└─ release/              Windows 构建输出目录
```

一起听服务端位于同级目录：

```text
../ichigomusicserver/
```

## 开发运行

环境要求：Node.js 18 或更高，推荐使用 npm。

```bash
npm install
npm run dev
```

另开一个终端启动 Electron：

```bash
npm run electron
```

## 构建发布包

构建前端：

```bash
npm run build
```

构建 Windows 安装包和免安装目录：

```bash
npm run electron:build
```

构建结果位于：

```text
release/
release/win-unpacked/
```

## 一起听服务端

服务端默认监听：

```text
HOST=0.0.0.0
PORT=16666
```

使用 PM2 启动：

```bash
cd ../ichigomusicserver
npm install --omit=dev
npm run pm2:start
npm run pm2:save
```

健康检查：

```text
http://HOST:16666/health
```

前端服务地址可以通过构建环境变量配置：

```text
VITE_LISTEN_SERVER_URL=http://HOST:16666
```

未配置时，前端使用项目内置的一起听服务地址。

## 缓存

缓存设置位于播放器设置页面，支持：

- 自定义缓存目录
- 音频、歌词、专辑封面和最近播放封面缓存
- 缓存容量限制
- 清理缓存
- 优先从本地恢复最近播放封面和音频

建议将缓存目录放在空间充足的本地磁盘，避免使用临时目录或不稳定的网络盘。

## 检查与测试

运行前端构建、歌词配置、封面、播放启动、运行日志和一起听检查：

```bash
npm run check
```

检查一起听服务端语法：

```bash
cd ../ichigomusicserver
npm run check
```

## 配置和隐私

- 网易云相关功能需要有效的登录状态。
- 部分歌曲会受到版权、会员权限、地区或播放地址有效期影响。
- 不要将登录 Cookie、账号密码或私有播放地址提交到代码仓库。
- 一起听服务端需要开放对应的 TCP 端口，并建议配置反向代理或 HTTPS。
- 使用本项目时请遵守相关服务条款和版权规定。
