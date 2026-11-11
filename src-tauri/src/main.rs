#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{Menu, MenuEvent, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

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
    estimate: u32,
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

/* ---------- 本地 JSON 存储（原子写） ---------- */

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
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

fn read_json<T: for<'de> Deserialize<'de>>(path: PathBuf, default: T) -> Result<T, String> {
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(_) => Ok(default),
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

/* ---------- 会话记录命令（M2） ---------- */

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

fn load_sessions(app: &AppHandle) -> SessionsState {
    let path = data_dir(app)
        .map(|d| d.join("sessions.json"))
        .unwrap_or_else(|_| PathBuf::from("sessions.json"));
    let sessions = read_json(path, Vec::new()).unwrap_or_default();
    SessionsState {
        sessions: Mutex::new(sessions),
    }
}

/* ---------- 托盘（M2） ---------- */

struct TrayState {
    toggle_item: MenuItem<tauri::Wry>,
}

#[tauri::command]
fn set_tray_state(app: AppHandle, tooltip: String, toggle_label: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
    if let Some(state) = app.try_state::<TrayState>() {
        state
            .toggle_item
            .set_text(toggle_label)
            .map_err(|e| e.to_string())?;
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
        .plugin(tauri_plugin_notification::init())
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
            set_tray_state
        ])
        .setup(|app| {
            // 系统托盘：显示 / 开始|暂停 / 跳过 / 退出（FR-401）
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

            app.manage(TrayState { toggle_item: toggle });
            app.manage(load_sessions(app.handle()));
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
