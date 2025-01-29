# SimMusic 2024 (Linux)
高颜值插件化音频播放器。

本仓库为 SimMusic 的 Linux 移植版，若需要 Windows 版本，请访问 [原仓库](https://github.com/Simsv-Software/SimMusic2024)。

## 🚩 安装
### Arch Linux
对于使用 Arch Linux 及其分支发行版的用户，我们维护了一个 [AUR 软件包 (simmusic-git)](https://aur.archlinux.org/packages/simmusic-git)，可以直接使用 AUR 工具进行安装。

### 其它发行版
对于其它 Linux 发行版的用户，您需要：
1. 下载并解压最新源码包，并放在一个目录中（注意，此目录将会成为程序目录）
2. 检查 Electron 状态，若您未安装 Electron，请先使用软件包管理器进行安装
3. 进入目录中的 `src` 文件夹，打开终端，运行 `npm i`（注意，依赖列表中不包含 `electron`）

至此您已可以通过运行 `electron /path/to/src` 来启动 SimMusic 了，但如果您想要配置 desktop 文件，请继续阅读：
1. 从 [此位置](https://aur.archlinux.org/cgit/aur.git/tree/SimMusic.desktop?h=simmusic-git) 复制内容，并保存到一个 desktop 文件中
2. 更改其中的 `Exec` 为 `electron /path/to/src`
3. 更改其中的 `Icon` 为 `src/assets/icon-blue.png` 的绝对路径

至此，SimMusic 的安装已完全完成。

## ✏️ 说明
我们不保证原版的所有功能在 Linux 下都可用，若您发现任何 Bug，请提出 Issue。

### 🚫 Weaknesses / TODOs
 - 桌面歌词: **完全不可用**
 - 原生操作按钮: **可自定义性趋近于零**

## 🔗 帮助文档
- <a href="https://docs.simsv.com/sim-music/user-guide.html">📄 SimMusic 用户指南</a>
- <a href="https://docs.simsv.com/sim-music/ext-index.html">🧩 SimMusic 扩展索引</a>
- <a href="https://docs.simsv.com/sim-music/dev-docs.html">🧑‍💻 SimMusic 开发者参考</a>

## ✨ 特色介绍
![Features](https://github.com/user-attachments/assets/2285413f-51d9-406f-a473-65eab79fa794)
![Features](https://github.com/user-attachments/assets/57a55928-ced3-482d-bb02-6a5fd5eb3698)
![Features](https://github.com/user-attachments/assets/b5ea101e-07f9-464c-aff3-c677ecdf1a69)
![Features](https://github.com/user-attachments/assets/5066b893-9884-4ba8-9a38-20abe568d61d)

