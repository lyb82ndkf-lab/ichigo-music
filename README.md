# 🍓 ICHIGOMusic

> 简洁、美观、功能丰富的第三方网易云音乐桌面播放器

ICHIGOMusic 是一款基于 **Electron + React + Vite** 构建的跨平台桌面音乐播放器，内置 [网易云音乐 API Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 服务端，无需额外配置即可畅听音乐。

---

## ✨ 功能特性

### 🎵 音乐播放
- 完整的网易云音乐曲库访问
- 高品质试听（支持标准/高品/无损音源选择）
- 播放队列管理、随机播放、单曲循环等播放模式
- 全局快捷键支持（播放/暂停、上一曲/下一曲、音量调节）

### 🎨 精美界面
- 现代化毛玻璃（Glassmorphism）设计风格
- 支持 **多种 UI 布局**：经典布局 / 现代精简布局
- 动态专辑封面取色，自动匹配主题色调
- 粒子可视化动画（Visualizer）
- 专辑封面旋转、模糊背景等视觉效果

### 📝 桌面歌词
- 独立桌面歌词窗口（可拖拽定位、置顶）
- **多种歌词主题引擎**：
  - **Monet 歌词引擎** — 海报布局 / 铁轨滚动 / 单词扫光
  - **CloudStep 云步歌词** — 逐字高亮
  - **Streamer 弹幕歌词** — 弹幕风格
  - **Tilt 倾斜歌词** — 3D 倾斜效果
- 音频叠加可视化 + 浮动装饰粒子
- 可自定义字体、字号、颜色、对齐方式等

### 🔍 发现音乐
- 个性推荐、新歌速递、热门歌单
- 排行榜（飙升榜、新歌榜、原创榜、热歌榜等）
- 歌手详情页（热门歌曲、专辑、MV）
- 专辑详情页
- 全局搜索（歌曲/歌手/专辑/歌单/MV）

### 🎬 MV 播放
- 支持 MV 在线播放
- 相关 MV 推荐

### 👤 账号系统
- 支持手机号登录 / 二维码扫码登录
- 我喜欢的音乐
- 最近播放记录
- 个人歌单管理

### ⚙️ 深度可定制
- 丰富的设置面板（播放、界面、歌词、快捷键等）
- API 服务器自定义代理配置
- 性能模式切换（GPU 加速开关）
- 系统托盘常驻，支持托盘快捷操作

---

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| **Electron** | 桌面应用框架，系统托盘、桌面歌词窗口 |
| **React 18** | 前端 UI 框架 |
| **Vite 5** | 构建工具，HMR 热更新 |
| **Lucide React** | 图标库 |
| **Express** | 内置 API 代理服务端 |
| **NeteaseCloudMusicApi Enhanced** | 网易云音乐 API 封装 |
| **electron-builder** | 打包发布（NSIS 安装包） |

---

## 📦 项目结构

```
ichigomusic/
├── src/                    # React 前端源码
│   ├── components/         # 通用组件（播放栏、侧边栏、可视化等）
│   │   └── lyrics/         # 歌词引擎组件（Monet/CloudStep/Streamer/Tilt）
│   ├── views/              # 页面视图（发现、搜索、歌单、设置等）
│   ├── context/            # React Context 全局状态管理
│   ├── hooks/              # 自定义 Hooks
│   └── utils/              # 工具函数（API 请求、歌词解析、取色等）
├── server/                 # 网易云音乐 API 服务端
│   ├── module/             # API 接口模块
│   ├── util/               # 工具函数（加密、请求等）
│   └── server.js           # Express 服务入口
├── main-electron.js        # Electron 主进程
├── preload-electron.cjs    # Electron 预加载脚本
├── static/                 # 静态资源
├── build/                  # 构建图标
├── dist/                   # Vite 构建输出
└── vite.config.js          # Vite 配置
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装服务端依赖
cd server && npm install && cd ..
```

### 开发模式

```bash
# 启动 Vite 开发服务器（前端）
npm run dev

# 另开终端，启动 Electron
npm run electron
```

### 构建打包

```bash
# 构建前端 + 打包 Electron 应用
npm run electron:build
```

构建产物输出到 `release/` 目录（NSIS 安装包及免安装版）。

---

## ⚠️ 免责声明

本项目仅供学习和研究使用，请勿用于商业用途。使用本项目产生的任何后果由使用者自行承担。

音乐版权归网易云音乐及版权方所有，请支持正版音乐。

---

## 📄 License

MIT License

---

## 🙏 致谢

- [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) — 网易云音乐 API 增强版
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Lucide](https://lucide.dev/) — 精美图标库
