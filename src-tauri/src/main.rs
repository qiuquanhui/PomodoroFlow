#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, collections::HashSet, fs, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{Menu, MenuEvent, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{
    Builder as GlobalShortcutBuilder, GlobalShortcutExt, Shortcut, ShortcutState,
};

/// 全局热键（M3）：任意应用下 开始/暂停
const HOTKEY: &str = "Control+Alt+Space";

/* ---------- 设置 ---------- */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct AppSettings {
    focus_min: u32,
    short_break_min: u32,
    long_break_min: u32,
    long_break_interval: u32,
    auto_start_breaks: bool,
    auto_start_focus: bool,
    sound_enabled: bool,
    volume: u32,
    theme: String,
    notify_enabled: bool,
    locale: String,
    hotkey_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            focus_min: 25,
            short_break_min: 5,
            long_break_min: 15,
            long_break_interval: 4,
            auto_start_breaks: false,
            auto_start_focus: false,
            sound_enabled: true,
            volume: 70,
            theme: "system".into(),
            notify_enabled: true,
            locale: "zh-CN".into(),
            hotkey_enabled: true,
        }
    }
}

/* ---------- 统计（旧日聚合，保留兼容） ---------- */

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct DayStats {
    focus_ms: u64,
    completed: u32,
    skipped: u32,
}

type StatsMap = BTreeMap<String, DayStats>;

/* ---------- 任务（M2） ---------- */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Task {
    id: String,
    name: String,
    created_at: u64,
    done_at: Option<u64>,
}

type TaskMap = BTreeMap<String, Task>;

/* ---------- 专注会话记录（M2，长期统计） ---------- */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionRecord {
    id: String,
    task_id: Option<String>,
    task_name: String,
    start: u64,
    duration_ms: u64,
    completed: bool,
}

/* ---------- 本地 JSON 存储（原子写 + 损坏自愈） ---------- */

/// 数据目录解析（优先级从高到低）：
/// 1. exe 旁的 `data-location.txt`（首行为自定义路径）——显式指定
/// 2. exe 安装目录的同级 `data` 文件夹——便携模式（如 E:\...\番茄钟\data）
/// 3. %APPDATA%\com.pomodoroflow.app——默认
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            // 1) 显式覆盖标记
            let marker = exe_dir.join("data-location.txt");
            if let Ok(text) = fs::read_to_string(&marker) {
                let line = text.lines().next().unwrap_or("").trim();
                if !line.is_empty() {
                    let p = PathBuf::from(line);
                    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                    return Ok(p);
                }
            }
            // 2) 便携模式：安装目录旁的 data 文件夹
            if let Some(parent) = exe_dir.parent() {
                let portable = parent.join("data");
                if portable.is_dir() {
                    return Ok(portable);
                }
            }
        }
    }
    // 3) 默认：系统应用数据目录
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// 先写临时文件再替换，异常退出不会损坏已有数据（FR-703）。
fn write_json_atomic(path: PathBuf, value: &impl Serialize) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// 读数据文件；解析失败（文件损坏）时改名留存后返回默认值，
/// 保证应用始终可启动、可继续写入（FR-704 异常恢复）。
fn read_json<T: for<'de> Deserialize<'de>>(path: PathBuf, default: T) -> Result<T, String> {
    let Ok(text) = fs::read_to_string(&path) else {
        return Ok(default);
    };
    match serde_json::from_str(&text) {
        Ok(v) => Ok(v),
        Err(e) => {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            let secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let backup = path.with_file_name(format!("{name}.corrupt-{secs}"));
            let _ = fs::rename(&path, &backup);
            eprintln!("数据文件解析失败，已备份为 {backup:?} 并使用默认值：{e}");
            Ok(default)
        }
    }
}

/* ---------- 设置命令 ---------- */

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    read_json(data_dir(&app)?.join("settings.json"), AppSettings::default())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = data_dir(&app)?.join("settings.json");
    write_json_atomic(path, &settings)
}

/* ---------- 统计命令（兼容保留） ---------- */

#[tauri::command]
fn get_stats(app: AppHandle) -> Result<StatsMap, String> {
    read_json(data_dir(&app)?.join("stats.json"), StatsMap::default())
}

#[tauri::command]
fn record_focus(app: AppHandle, date: String, focus_ms: u64, completed: bool) -> Result<(), String> {
    let path = data_dir(&app)?.join("stats.json");
    let mut map: StatsMap = read_json(path.clone(), StatsMap::default())?;
    let day = map.entry(date).or_default();
    day.focus_ms += focus_ms;
    if completed {
        day.completed += 1;
    } else {
        day.skipped += 1;
    }
    write_json_atomic(path, &map)
}

/* ---------- 任务命令（M2） ---------- */

#[tauri::command]
fn get_tasks(app: AppHandle) -> Result<Vec<Task>, String> {
    let map: TaskMap = read_json(data_dir(&app)?.join("tasks.json"), TaskMap::default())?;
    let mut list: Vec<Task> = map.into_values().collect();
    list.sort_by_key(|t| t.created_at);
    Ok(list)
}

#[tauri::command]
fn upsert_task(app: AppHandle, task: Task) -> Result<(), String> {
    let path = data_dir(&app)?.join("tasks.json");
    let mut map: TaskMap = read_json(path.clone(), TaskMap::default())?;
    map.insert(task.id.clone(), task);
    write_json_atomic(path, &map)
}

#[tauri::command]
fn delete_task(app: AppHandle, id: String) -> Result<(), String> {
    let path = data_dir(&app)?.join("tasks.json");
    let mut map: TaskMap = read_json(path.clone(), TaskMap::default())?;
    map.remove(&id);
    write_json_atomic(path, &map)
}

/* ---------- 会话记录命令（M2 + M3 导入合并） ---------- */

struct SessionsState {
    sessions: Mutex<Vec<SessionRecord>>,
}

#[tauri::command]
fn get_sessions(app: AppHandle) -> Result<Vec<SessionRecord>, String> {
    let state = app.state::<SessionsState>();
    let guard = state.sessions.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
fn append_session(app: AppHandle, session: SessionRecord) -> Result<(), String> {
    {
        let state = app.state::<SessionsState>();
        let mut guard = state.sessions.lock().map_err(|e| e.to_string())?;
        guard.push(session.clone());
    }
    let path = data_dir(&app)?.join("sessions.json");
    let state = app.state::<SessionsState>();
    let guard = state.sessions.lock().map_err(|e| e.to_string())?;
    write_json_atomic(path, &*guard)
}

/// 导入恢复（M3）：按 id 去重合并会话记录，返回导入/跳过条数
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MergeCounts {
    imported: u32,
    skipped: u32,
}

#[tauri::command]
fn merge_sessions(app: AppHandle, incoming: Vec<SessionRecord>) -> Result<MergeCounts, String> {
    let path = data_dir(&app)?.join("sessions.json");
    let state = app.state::<SessionsState>();
    let mut guard = state.sessions.lock().map_err(|e| e.to_string())?;
    let existing: HashSet<String> = guard.iter().map(|s| s.id.clone()).collect();
    let mut counts = MergeCounts { imported: 0, skipped: 0 };
    for s in incoming {
        if existing.contains(&s.id) {
            counts.skipped += 1;
        } else {
            guard.push(s);
            counts.imported += 1;
        }
    }
    guard.sort_by_key(|s| s.start);
    write_json_atomic(path, &*guard)?;
    Ok(counts)
}

fn load_sessions(app: &AppHandle) -> SessionsState {
    let path = data_dir(app)
        .map(|d| d.join("sessions.json"))
        .unwrap_or_else(|_| PathBuf::from("sessions.json"));
    let sessions = read_json(path, Vec::new()).unwrap_or_default();
    SessionsState {
        sessions: Mutex::new(sessions),
    }
}

/* ---------- 导出 / 导入（M3）：原生文件对话框 + 落盘 ---------- */

/// 内容由前端按当前语言拼好（本地时区时间在 JS 侧更可靠），Rust 只负责对话框与写文件。
#[tauri::command]
async fn save_export(
    default_name: String,
    filter_name: String,
    filter_ext: String,
    content: String,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        let Some(path) = rfd::FileDialog::new()
            .set_file_name(&default_name)
            .add_filter(&filter_name, &[&filter_ext])
            .save_file()
        else {
            return Ok(None); // 用户取消
        };
        fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 选择并读取导入文件（JSON 备份），解析校验放前端做
#[tauri::command]
async fn pick_import_file() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        let Some(path) = rfd::FileDialog::new().add_filter("JSON", &["json"]).pick_file() else {
            return Ok(None);
        };
        let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<serde_json::Value>(&text).map_err(|e| e.to_string())?;
        Ok(Some(text))
    })
    .await
    .map_err(|e| e.to_string())?
}

/* ---------- 开机自启 / 全局热键（M3） ---------- */

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn set_hotkey_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let gs = app.global_shortcut();
    let combo: Shortcut = HOTKEY.parse().map_err(|e| tauri_plugin_global_shortcut::Error::from(e).to_string())?;
    if enabled {
        // 已注册视为成功，保证设置开关幂等
        if gs.is_registered(combo.clone()) {
            return Ok(());
        }
        gs.register(combo).map_err(|e| e.to_string())
    } else {
        if !gs.is_registered(combo.clone()) {
            return Ok(());
        }
        gs.unregister(combo).map_err(|e| e.to_string())
    }
}

/* ---------- 托盘（M2 + M3 菜单文案国际化） ---------- */

struct TrayState {
    show_item: MenuItem<tauri::Wry>,
    toggle_item: MenuItem<tauri::Wry>,
    skip_item: MenuItem<tauri::Wry>,
    quit_item: MenuItem<tauri::Wry>,
}

#[tauri::command]
fn set_tray_state(
    app: AppHandle,
    tooltip: String,
    toggle_label: String,
    show_label: String,
    skip_label: String,
    quit_label: String,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
    if let Some(state) = app.try_state::<TrayState>() {
        state.show_item.set_text(show_label).map_err(|e| e.to_string())?;
        state
            .toggle_item
            .set_text(toggle_label)
            .map_err(|e| e.to_string())?;
        state.skip_item.set_text(skip_label).map_err(|e| e.to_string())?;
        state.quit_item.set_text(quit_label).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/* ---------- 应用入口 ---------- */

fn main() {
    tauri::Builder::default()
        // 单实例（M3）：重复启动时唤起已有窗口后退出，避免托盘出现重复图标
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            GlobalShortcutBuilder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = app.emit("global-hotkey", "toggle");
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_stats,
            record_focus,
            get_tasks,
            upsert_task,
            delete_task,
            get_sessions,
            append_session,
            merge_sessions,
            save_export,
            pick_import_file,
            get_autostart,
            set_autostart,
            set_hotkey_enabled,
            set_tray_state
        ])
        .setup(|app| {
            // 系统托盘：显示 / 开始|暂停 / 跳过 / 退出（FR-401），文案由前端按语言同步
            let show = MenuItem::with_id(app, "show", "显示 PomodoroFlow", true, None::<&str>)?;
            let toggle = MenuItem::with_id(app, "toggle", "开始", true, None::<&str>)?;
            let skip = MenuItem::with_id(app, "skip", "跳过当前阶段", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &toggle, &skip, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("PomodoroFlow")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event: MenuEvent| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "toggle" => {
                        let _ = app.emit("tray-action", "toggle");
                    }
                    "skip" => {
                        let _ = app.emit("tray-action", "skip");
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            app.manage(TrayState {
                show_item: show,
                toggle_item: toggle,
                skip_item: skip,
                quit_item: quit,
            });
            app.manage(load_sessions(app.handle()));

            // 全局热键（M3）：按持久化设置决定是否注册
            let settings: AppSettings = read_json(
                data_dir(app.handle())?.join("settings.json"),
                AppSettings::default(),
            )
            .unwrap_or_default();
            if settings.hotkey_enabled {
                if let Err(e) = set_hotkey_enabled(app.handle().clone(), true) {
                    eprintln!("注册全局热键失败：{e}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭窗口 = 最小化到托盘（FR-401），退出走托盘菜单
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running PomodoroFlow");
}
