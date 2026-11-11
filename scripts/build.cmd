@echo off
rem PomodoroFlow 构建脚本（本机无 MSVC，使用 D 盘 llvm-mingw + GNU 工具链）
rem 依赖位置：
rem   Rust(GNU)     D:\myself\envrionment\rustup / cargo
rem   llvm-mingw    D:\myself\envrionment\llvm-mingw\llvm-mingw-20261104-ucrt-x86_64
rem   rustc 重试器  D:\myself\envrionment\retry-rustc.exe（规避偶发启动崩溃）
rem 注意：空闲内存最好 >= 2.5GB，不足时 rustc 可能崩溃（会自动重试，但很慢）

set RUSTUP_HOME=D:\myself\envrionment\rustup
set CARGO_HOME=D:\myself\envrionment\cargo
set TMP=D:\myself\envrionment\temp
set TEMP=D:\myself\envrionment\temp
set CARGO_INCREMENTAL=0
set RUSTC_WRAPPER=D:\myself\envrionment\retry-rustc.exe
set PATH=D:\myself\envrionment\llvm-mingw\llvm-mingw-20261104-ucrt-x86_64\bin;%CARGO_HOME%\bin;%PATH%

cd /d "%~dp0"
cargo build --manifest-path src-tauri\Cargo.toml -j 1
if exist src-tauri\target\debug\pomodoroflow.exe (
    echo BUILD OK: src-tauri\target\debug\pomodoroflow.exe
) else (
    echo BUILD FAILED
    exit /b 1
)
