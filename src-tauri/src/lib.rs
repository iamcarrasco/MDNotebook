use std::collections::HashSet;
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
fn set_window_theme(app: tauri::AppHandle, dark: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let theme = if dark {
            tauri::Theme::Dark
        } else {
            tauri::Theme::Light
        };
        window.set_theme(Some(theme)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pick_vault_folder(app: tauri::AppHandle) -> Result<String, String> {
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
    if let Err(e) = fs::rename(&tmp_path, &path) {
        // Clean up temp file on rename failure
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to rename temp file: {}", e));
    }

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

    // Validate file extension to prevent reading arbitrary files
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "md" && ext != "markdown" && ext != "txt" {
        return Err("Only .md, .markdown, and .txt files can be opened".into());
    }

    // Canonicalize to resolve symlinks and prevent traversal
    let canonical = file_path
        .canonicalize()
        .map_err(|_| format!("File not found: {}", path))?;

    if !canonical.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::read_to_string(&canonical)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// ── Vault asset commands ──

fn validate_asset_id(asset_id: &str) -> Result<(), String> {
    if asset_id.is_empty() || asset_id.len() > 64 {
        return Err("Invalid asset ID length".into());
    }
    if !asset_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid asset ID characters".into());
    }
    Ok(())
}

#[tauri::command]
fn write_vault_asset(folder: String, asset_id: String, data: String) -> Result<(), String> {
    validate_asset_id(&asset_id)?;
    let assets_dir = PathBuf::from(&folder).join("vault-assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create vault-assets directory: {}", e))?;

    let path = assets_dir.join(format!("{}.enc", asset_id));
    let tmp_path = assets_dir.join(format!("{}.enc.tmp", asset_id));

    fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write asset temp file: {}", e))?;
    if let Err(e) = fs::rename(&tmp_path, &path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to rename asset temp file: {}", e));
    }
    Ok(())
}

#[tauri::command]
fn read_vault_asset(folder: String, asset_id: String) -> Result<String, String> {
    validate_asset_id(&asset_id)?;
    let path = PathBuf::from(&folder).join("vault-assets").join(format!("{}.enc", asset_id));
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read asset {}: {}", asset_id, e))
}

#[tauri::command]
fn delete_vault_asset(folder: String, asset_id: String) -> Result<(), String> {
    validate_asset_id(&asset_id)?;
    let path = PathBuf::from(&folder).join("vault-assets").join(format!("{}.enc", asset_id));
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete asset {}: {}", asset_id, e))?;
    }
    Ok(())
}

#[tauri::command]
fn list_vault_assets(folder: String) -> Result<Vec<String>, String> {
    let assets_dir = PathBuf::from(&folder).join("vault-assets");
    if !assets_dir.exists() {
        return Ok(Vec::new());
    }
    let mut ids = Vec::new();
    let entries = fs::read_dir(&assets_dir)
        .map_err(|e| format!("Failed to read vault-assets: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("enc") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                ids.push(stem.to_string());
            }
        }
    }
    Ok(ids)
}

#[tauri::command]
fn save_file(
    app: tauri::AppHandle,
    default_name: String,
    content: String,
    filter_name: String,
    filter_extensions: Vec<String>,
) -> Result<bool, String> {
    let ext_refs: Vec<&str> = filter_extensions.iter().map(|s| s.as_str()).collect();
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(&filter_name, &ext_refs)
        .blocking_save_file();

    match path {
        Some(file_path) => {
            fs::write(file_path.as_path().unwrap(), &content)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(true)
        }
        None => Ok(false), // User cancelled
    }
}

#[derive(serde::Deserialize)]
struct ExportNote {
    name: String,
    content: String,
}

#[tauri::command]
fn export_notes_to_folder(folder: String, notes: Vec<ExportNote>) -> Result<(), String> {
    let dir = PathBuf::from(&folder);
    if !dir.is_dir() {
        return Err("Not a valid directory".into());
    }

    // Track used stems to avoid overwriting existing files or collisions in this batch.
    let mut used_stems: HashSet<String> = HashSet::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read export directory: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to inspect export directory: {}", e))?;
        let path = entry.path();
        let is_md = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("md"))
            .unwrap_or(false);
        if !is_md {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
            used_stems.insert(stem.to_lowercase());
        }
    }

    for note in notes {
        let safe_name: String = note
            .name
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == ' ')
            .collect();
        let base_name = if safe_name.trim().is_empty() {
            "Untitled"
        } else {
            safe_name.trim()
        };

        let mut file_name = base_name.to_string();
        let mut suffix = 2;
        while used_stems.contains(&file_name.to_lowercase()) {
            file_name = format!("{} ({})", base_name, suffix);
            suffix += 1;
        }
        used_stems.insert(file_name.to_lowercase());

        let file_path = dir.join(format!("{}.md", file_name));
        fs::write(&file_path, &note.content)
            .map_err(|e| format!("Failed to write {}: {}", file_name, e))?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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

                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None);
                }

                #[cfg(target_os = "windows")]
                {
                    let _ = window_vibrancy::apply_mica(&window, Some(true));
                }
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
            set_window_theme,
            pick_vault_folder,
            read_vault_file,
            write_vault_file,
            vault_file_exists,
            export_notes_to_folder,
            save_file,
            read_markdown_file,
            write_vault_asset,
            read_vault_asset,
            delete_vault_asset,
            list_vault_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
