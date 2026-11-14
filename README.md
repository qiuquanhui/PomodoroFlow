# PomodoroFlow 🍅

轻量、离线优先的 Windows 桌面番茄钟。需求文档见 [docs/需求文档.md](docs/需求文档.md)。

## 下载安装（推荐）

直接从 GitHub Releases 下载安装包，双击即用：

- **下载地址**：https://github.com/qiuquanhui/PomodoroFlow/releases
- 当前版本 **v0.2.0**：[`PomodoroFlow_0.2.0_x64-setup.exe`](https://github.com/qiuquanhui/PomodoroFlow/releases/download/v0.2.0/PomodoroFlow_0.2.0_x64-setup.exe)（约 1.4 MB）
- 按用户安装，无需管理员权限；自带卸载器并自动注册开始菜单
- 支持静默安装：`PomodoroFlow_0.2.0_x64-setup.exe /S`（升级前请先退出运行中的应用，否则文件被占用）
- 环境要求：Windows 10 1809+ / Windows 11（WebView2 运行时一般系统自带）

## 功能（M1 + M2 + M3）

- 三阶段计时：专注 / 短休息 / 长休息（默认 25 / 5 / 15 分钟，可自定义 1–120）
- 番茄循环轮次指示，每 N 个番茄自动进入长休息（N 可配置）
- 开始 / 暂停 / 跳过 / 重置；空格键快速开始或暂停；底部三标签（1/2/3 切换）
- 基于单调时钟计时，系统休眠、修改系统时间都不会让倒计时错乱
- **任务管理**：增删改、双击重命名、标记完成；专注自动关联当前任务
- **长期时间统计**：每次专注记录为会话（含任务名快照，任务删除后历史仍在）；近 7/30 天每日柱状图（网格刻度/零值基点）、**今日/全部任务时间占比**、累计番茄/时长、连续天数
- **系统通知**：阶段结束右下角 Toast（可在设置中开关）
- **系统托盘**：关闭窗口最小化到托盘，托盘菜单（显示/开始暂停/跳过/退出），托盘提示实时显示倒计时
- **单实例保护**：重复启动自动唤起已有窗口，不再出现双托盘图标
- **全局热键**：`Ctrl+Alt+Space` 任意应用下开始/暂停（可开关）
- **开机自启**：设置中一键开关（注册表 Run 键）
- **数据导出/导入**：JSON 全量备份（按 id 去重合并恢复）+ CSV 专注记录（带 BOM，Excel 直接打开）
- **中英双语**：界面/通知/托盘菜单全量 i18n，设置中即时切换
- 阶段结束提示音（WebAudio 实时合成），音量可调可试听
- 浅色 / 深色 / 跟随系统主题
- 设置与统计持久化（临时文件 + 原子替换 + 损坏文件自动备份降级，异常退出不损坏数据）

## 技术栈

Tauri 2 + Vue 3 + TypeScript + Pinia + Vite

## 开发环境

- Node.js ≥ 18
- Rust（MSVC 工具链）+ Visual Studio 生成工具（"使用 C++ 的桌面开发" 工作负载）
- WebView2 运行时（Windows 10/11 一般自带）

## 常用命令

```bash
npm install          # 安装前端依赖
npm run tauri dev    # 开发模式运行桌面应用
npm run tauri build  # 打包 NSIS 安装包
npm run icon:gen     # 重新生成图标源图
npx tauri icon assets/icon-source.png   # 由源图生成全套应用图标
```

## 从源码构建安装包

执行 `npm run tauri build` 成功后，NSIS 安装包生成在：

```
src-tauri\target\release\bundle\nsis\PomodoroFlow_<版本号>_x64-setup.exe
```

文件名中的版本号跟随 `tauri.conf.json` 的 `version` 变化；构建出的安装包同样可双击安装或 `/S` 静默安装。

## 构建环境说明（无 Visual Studio / GNU 工具链方案）

本仓库在没有 Visual Studio Build Tools 的机器上采用 **Rust GNU 工具链 + llvm-mingw 链接器**组合构建（标准 MSVC 环境无需以下内容）：

- Rust GNU 工具链通过 `RUSTUP_HOME` / `CARGO_HOME` 环境变量指定安装位置；工具链必须放在**纯 ASCII 路径**（中文用户名路径会导致 GNU ld 链接失败）
- llvm-mingw 作为链接器（见 `src-tauri\.cargo\config.toml`）。rustup 自带的精简 mingw 运行时构建大体积二进制存在启动崩溃问题（STATUS_ACCESS_VIOLATION），需换用完整 llvm-mingw 运行时，并补齐 llvm-dlltool
- GNU 工具链的 build.rs 需要 `dlltool`（windows-sys 等构建脚本依赖）
- 一键构建：自行编写脚本设置上述环境变量后执行 `npm run tauri build` 即可（本仓库不附带特定机器路径的脚本）

> 完整踩坑实录（中文路径 / 崩溃根因 / cmd 命令行长度上限等）见 [docs/方案设计.md](docs/方案设计.md) §8。若换链接器后首次构建出现 rustc 崩溃，多为旧 proc-macro DLL 缓存中毒，`cargo clean` 后重编即可。

## 数据位置

数据目录按以下优先级解析（便携优先）：

1. exe 旁的 `data-location.txt`（首行为自定义路径）——显式指定
2. 安装目录同级的 `data` 文件夹——便携模式（如安装在 `D:\Tools\番茄钟\PomodoroFlow\`，数据即落在旁边的 `D:\Tools\番茄钟\data`）
3. `%APPDATA%\com.pomodoroflow.app`——默认兜底

数据文件：`settings.json` 设置、`tasks.json` 任务、`sessions.json` 专注会话记录（长期统计唯一数据源）。备份/迁移只需拷贝整个数据目录。

## 路线图

- [x] M1 计时核心 + 基础界面 + 设置持久化（已完成并通过运行自测）
- [x] M2 任务管理、系统通知、系统托盘、长期时间统计（已完成并通过运行自测）
- [x] M4(提前) NSIS 安装包 + 正式发布版构建，已安装验证
- [x] M3 单实例、全局热键、开机自启、导出导入（CSV/JSON）、异常恢复、i18n（中/英）、今日任务占比（v0.2.0）
- [ ] 可选后续：12 周热力图、迷你悬浮窗、热键自定义
