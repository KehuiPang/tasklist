<div align="center">

<img src="build/winicon-256.png" width="112" alt="TaskList" />

# TaskList · 任务清单

**一款常驻桌面边缘、随手速记、清爽好用的个人待办清单软件**

轻量 · 本地存储 · 浅色清爽 · 贴边自动收起

[![Release](https://img.shields.io/github/v/release/KehuiPang/tasklist?display_name=tag)](https://github.com/KehuiPang/tasklist/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-274a63.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-274a63.svg)](https://github.com/KehuiPang/tasklist/releases)
[![Built with Electron](https://img.shields.io/badge/Electron-32-1b2530.svg)](https://www.electronjs.org/)

</div>

---

## 这是什么

TaskList 是一款**为个人日常打造的桌面待办清单**。它默认贴在屏幕边缘常驻——鼠标一碰就展开、移开自动收起，不占地方又随时可用。适合放在第二块屏幕上，把脑子里的事随手记下来，按重要/紧急分类，做完打勾划线沉底，一目了然。

- 🪶 **轻**：整个数据存成一个本地 JSON 文件，无需登录、无需联网、无账号、无广告。
- 🎯 **专注**：清爽的浅色界面，只做"个人待办"这一件事，不堆功能。
- 🔒 **私密**：所有数据只存在你本机（`%APPDATA%`），不上传任何服务器。

## 功能特性

### 📝 随手速记
- 顶部输入框，**回车即添加**，想到什么立刻记下，零打断。

### 🗂️ 三种组织方式，随心切换
| 视图 | 说明 |
|------|------|
| **列表** | 最经典的清单视图，一条条排下来 |
| **四象限** | 重要紧急矩阵（重要且紧急 / 重要不紧急 / 紧急不重要 / 不重要不紧急），帮你分清轻重缓急 |
| **项目树** | 用「项目 + 多级目录」分类整理任务，层层归纳 |

### 🔀 多种排序
- 按**优先级**、按**日期**、或**手动**拖拽排序，自由选择。

### ✅ 完成即沉底
- 打勾后自动**划线 + 沉到底部**，已完成和待办清清爽爽分开。

### 💤 暂缓搁置区
- 暂时不想做又不想删的任务，收进**搁置区**折叠起来，眼不见心不烦，需要时再拿出来。

### 📌 贴边自动收起
- 窗口贴到屏幕边缘后**自动收起成一条细边**，鼠标悬停自动展开、移开自动隐藏，常驻不碍事。
- 可选贴边方向、是否置顶。

### 🎨 清爽浅色界面
- 月白青灰底 + 白卡片 + 靛青点缀的柔和配色，久看不累。

### 🔃 导出 / 导入备份
- 一键导出全部数据为 JSON，换机/备份/迁移都方便。

### 🖱️ 系统托盘
- 最小化到托盘常驻，左键单击唤出、右键弹出精致菜单（显示主窗口 / 窗口置顶 / 贴边收起 / 退出）。

## 截图

> 主界面（列表 / 四象限 / 项目树）、贴边收起效果、托盘菜单。
>
> _（可在此处放置截图）_

## 下载安装

前往 [**Releases 页面**](https://github.com/KehuiPang/tasklist/releases) 下载最新的 `TaskList-Setup-x.x.x.exe`，双击安装即可。

> 目前提供 **Windows x64** 安装包。安装时可自定义安装目录、自动创建桌面与开始菜单快捷方式。

## 从源码运行 / 构建

需要 [Node.js](https://nodejs.org/)（建议 18+）。

```bash
# 克隆
git clone https://github.com/KehuiPang/tasklist.git
cd tasklist

# 安装依赖
npm install

# 开发运行
npm start

# 生成图标（可选，改了图标 SVG 后运行）
node scripts/gen-tray.js

# 打包 Windows 安装包（输出到 dist/）
npm run dist
```

## 数据存储

所有任务数据保存在本机用户目录下的单个 JSON 文件：

```
%APPDATA%\tasklist\tasklist-data.json
```

想备份或迁移，直接复制这个文件即可；也可以用软件内的「导出 / 导入」功能。

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面应用框架
- 原生 HTML / CSS / JavaScript — 无重型前端框架，轻量直接
- 本地 JSON 文件存储 — 零后端、零依赖服务
- [electron-builder](https://www.electron.build/) — 打包 NSIS 安装包
- GitHub Actions — 打 tag 自动构建并发布 Release

## 版本

**当前版本：v1.0.0**（首个公开版本）

- ✅ 列表 / 四象限 / 项目树 三视图
- ✅ 快速速记、优先级/日期/手动排序
- ✅ 完成打勾划线沉底、暂缓搁置区
- ✅ 贴边自动收起 + 悬停展开
- ✅ 浅色清爽界面、系统托盘、导入导出
- ✅ 本地 JSON 存储

版本更新记录见 [Releases](https://github.com/KehuiPang/tasklist/releases)。

## 参与 & 反馈

欢迎提 [Issue](https://github.com/KehuiPang/tasklist/issues) 反馈 bug、提功能建议，也欢迎 PR 一起完善。如果这个小工具帮到了你，点个 ⭐ Star 就是最好的鼓励 😊

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改、分发（含商用）。
