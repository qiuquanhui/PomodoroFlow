# PomodoroFlow 🍅

轻量、离线优先的 Windows 桌面番茄钟。需求文档见 [docs/需求文档.md](docs/需求文档.md)。

## 功能（M1 + M2）

- 三阶段计时：专注 / 短休息 / 长休息（默认 25 / 5 / 15 分钟，可自定义 1–120）
- 番茄循环轮次指示，每 N 个番茄自动进入长休息（N 可配置）
- 开始 / 暂停 / 跳过 / 重置；空格键快速开始或暂停；底部三标签（1/2/3 切换）
- 基于单调时钟计时，系统休眠、修改系统时间都不会让倒计时错乱
- **任务管理**：增删改、预估番茄数、双击重命名、标记完成；专注自动关联当前任务
- **长期时间统计**：每次专注记录为会话（含任务名快照，任务删除后历史仍在）；近 7/30 天每日柱状图、任务时间占比、累计番茄/时长、连续天数
- **系统通知**：阶段结束右下角 Toast（可在设置中开关）
- **系统托盘**：关闭窗口最小化到托盘，托盘菜单（显示/开始暂停/跳过/退出），托盘提示实时显示倒计时
- 阶段结束提示音（WebAudio 实时合成），音量可调可试听
- 浅色 / 深色 / 跟随系统主题
- 设置与统计持久化（临时文件 + 原子替换，异常退出不损坏数据）

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
scripts\build.cmd    # 本机一键构建（见下方"本机构建环境说明"）
```

## 本机构建环境说明（重要）

本机没有安装 Visual Studio Build Tools，采用的是 Rust GNU 工具链 + llvm-mingw 链接器组合，全部依赖位于 `D:\myself\envrionment\`：

- **Rust 工具链**（GNU 宿主）：`D:\myself\envrionment\rustup`、`D:\myself\envrionment\cargo`（通过 `RUSTUP_HOME` / `CARGO_HOME` 环境变量指向，已写入用户环境变量）
- **llvm-mingw**：`D:\myself\envrionment\llvm-mingw\llvm-mingw-20261104-ucrt-x86_64`，作为链接器（见 `src-tauri\.cargo\config.toml`）。rustup 自带的精简 mingw 运行时在本机构建大体积二进制存在启动崩溃问题，故改用完整 llvm-mingw 运行时
- **rustc 重试器**：`D:\myself\envrionment\retry-rustc.exe`（源码 `retry-rustc.c`）。GNU 版 rustc 在空闲内存不足时可能启动即崩（STATUS_ACCESS_VIOLATION），重试器自动重试；构建时需保证空闲内存 ≥ 2.5GB
- **历史坑位记录**（供排查参考）：
  - 中文用户名路径会导致 GNU ld 链接失败 → 工具链必须放在纯 ASCII 路径（已按 D 盘布局解决）
  - GNU 工具链的 build.rs 需要 `dlltool` → 已用 llvm-dlltool 放在 `D:\myself\envrionment\cargo\bin`
  - cargo 的 jobserver 信号量曾疑似触发崩溃（已在重试器中过滤 `CARGO_MAKEFLAGS`，最终确认主因是内存压力）

一键构建：`scripts\build.cmd`（自动设置以上全部环境变量）。

> 真正的根因复盘：rustc 在加载**坏链接器时代产出的旧 proc-macro DLL**（tauri_macros / serde_repr）时必崩。删除 `target\debug\deps\` 下这两个 DLL 让 cargo 重编即可治愈（换链接器后首次全量构建时如遇同样症状，`cargo clean` 后重编）。

## 数据位置

所有数据仅保存在本机：`%APPDATA%\com.pomodoroflow.app\`：

- `settings.json` 设置
- `tasks.json` 任务列表
- `sessions.json` 专注会话记录（长期统计的数据源）

## 路线图

- [x] M1 计时核心 + 基础界面 + 设置持久化（已完成并通过运行自测）
- [x] M2 任务管理、系统通知、系统托盘、长期时间统计（已完成并通过运行自测）
- [x] M4(提前) NSIS 安装包（1.34 MB）+ 正式发布版构建，已安装验证
- [ ] M3 全局热键、开机自启、数据导出（CSV/JSON）、单实例、历史热力图
