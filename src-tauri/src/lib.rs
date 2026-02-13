use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn pick_vault_folder(app: tauri::AppHandle) -> Result<String, String> {
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder {
        Some(path) => Ok(path.to_string()),
        None => Err("No folder selected".into()),
    }
}

#[tauri::command]
fn read_vault_file(folder: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&folder).join("vault.json");
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Failed to read vault.json: {}", e))
}

#[tauri::command]
fn write_vault_file(folder: String, data: String) -> Result<(), String> {
    let dir = PathBuf::from(&folder);
    let path = dir.join("vault.json");
    let tmp_path = dir.join("vault.json.tmp");

    // Atomic write: write to temp file then rename
    fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

#[tauri::command]
fn vault_file_exists(folder: String) -> Result<bool, String> {
    let path = PathBuf::from(&folder).join("vault.json");
    Ok(path.exists())
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance launches, focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                // If launched with a file argument, emit to frontend
                if args.len() > 1 {
                    let path = args[1].clone();
                    if path.ends_with(".md") || path.ends_with(".markdown") {
                        let _ = window.emit("open-file", path);
                    }
                }
            }
        }))
        .setup(|app| {
            // ── System Tray ──
            let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
            let new_note = MenuItem::with_id(app, "new_note", "New Note", true, None::<&str>)?;
            let daily_note = MenuItem::with_id(app, "daily_note", "Daily Note", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_hide, &new_note, &daily_note, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("MDNotebook")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "new_note" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("tray-new-note", ());
                            }
                        }
                        "daily_note" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("tray-daily-note", ());
                            }
                        }
                        "quit" => {
                            // Emit flush-save so the frontend can persist pending changes
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("flush-save", ());
                            }
                            let app_handle = app.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(std::time::Duration::from_millis(600));
                                app_handle.exit(0);
                            });
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Close-to-tray: hide window instead of quitting ──
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            // ── File association: check CLI args for .md file ──
            let args: Vec<String> = env::args().collect();
            if args.len() > 1 {
                let file_path = args[1].clone();
                if file_path.ends_with(".md") || file_path.ends_with(".markdown") {
                    if let Some(window) = app.get_webview_window("main") {
                        let window_clone = window.clone();
                        // Emit after a short delay so the webview is ready
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(1500));
                            let _ = window_clone.emit("open-file", file_path);
                        });
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_vault_folder,
            read_vault_file,
            write_vault_file,
            vault_file_exists,
            read_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
