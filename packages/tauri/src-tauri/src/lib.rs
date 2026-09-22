mod menu;

use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

/// Autosave keys are either a bare filename (e.g. "myscript.sutra") or the
/// sentinel "__autosave__" for an untitled doc — never a path — but this
/// still guards against writing outside the autosave directory.
fn sanitize_autosave_key(key: &str) -> String {
    key.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

fn autosave_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("autosave");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Format spec §3.2: autosave goes to IndexedDB on web, disk on desktop.
/// The frontend's local-storage-adapter prefers these commands over IndexedDB
/// whenever window.desktopAPI exposes them.
#[tauri::command]
fn autosave_write(app: tauri::AppHandle, key: String, content: String) -> Result<(), String> {
    let path = autosave_dir(&app)?.join(format!("{}.sutra", sanitize_autosave_key(&key)));
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn autosave_read(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let path = autosave_dir(&app)?.join(format!("{}.sutra", sanitize_autosave_key(&key)));
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Force-closes the main window, bypassing on_window_event's CloseRequested
/// interception (close() would just re-trigger it and loop). Only called by
/// the frontend after it has confirmed it's safe to close (see
/// on_window_event below and DocumentContext's close-requested handler).
#[tauri::command]
fn close_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_open_dialog() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Sutra Screenplay", &["cine"])
        .add_filter("Fountain Screenplay", &["fountain"])
        .pick_file();
    file.map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn show_save_dialog(default_name: String) -> Option<String> {
    let file = rfd::FileDialog::new()
        .set_file_name(&default_name)
        .add_filter("Sutra Screenplay", &["cine"])
        .save_file();
    file.map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn show_save_pdf_dialog(default_name: String) -> Option<String> {
    let file = rfd::FileDialog::new()
        .set_file_name(&default_name)
        .add_filter("PDF Document", &["pdf"])
        .save_file();
    file.map(|p| p.to_string_lossy().into_owned())
}

/// Renders `html` in a hidden webview and writes it to `path` as a real
/// (vector-text, embedded-font) PDF via WebView2's native PrintToPdf, bypassing
/// the Windows print spooler entirely — that path is what was rasterizing pages
/// when users chose "Microsoft Print to PDF" from window.print().
#[cfg(target_os = "windows")]
#[tauri::command]
async fn export_html_to_pdf(app: tauri::AppHandle, html: String, path: String) -> Result<(), String> {
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::Duration;
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let temp_file = std::env::temp_dir().join(format!("sutrata-pdf-export-{stamp}.html"));
    std::fs::write(&temp_file, &html).map_err(|e| e.to_string())?;

    let file_url = tauri::Url::from_file_path(&temp_file)
        .map_err(|_| "Could not build a file:// URL for the export".to_string())?;

    let loaded = Arc::new((Mutex::new(false), Condvar::new()));
    let loaded_for_callback = loaded.clone();

    let print_window = WebviewWindowBuilder::new(&app, format!("pdf-export-{stamp}"), WebviewUrl::External(file_url))
        .title("Sutrata PDF Export")
        .visible(false)
        .inner_size(900.0, 1200.0)
        .on_page_load(move |_window, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                let (done, cvar) = &*loaded_for_callback;
                *done.lock().unwrap() = true;
                cvar.notify_all();
            }
        })
        .build()
        .map_err(|e| e.to_string())?;

    // Wait for the page to finish loading, then give web fonts (Google Fonts
    // for Latin + Indic scripts) a moment to finish downloading and painting —
    // `PageLoadEvent::Finished` doesn't guarantee font-loading has settled.
    {
        let (done, cvar) = &*loaded;
        let mut guard = done.lock().unwrap();
        while !*guard {
            let (next, timeout) = cvar.wait_timeout(guard, Duration::from_secs(15)).unwrap();
            guard = next;
            if timeout.timed_out() {
                break;
            }
        }
    }
    std::thread::sleep(Duration::from_millis(700));

    let print_result = print_window.with_webview(move |webview| {
        let outcome: webview2_com::Result<()> = (|| unsafe {
            let core = webview.controller().CoreWebView2()?;
            let core7: ICoreWebView2_7 = core.cast()?;
            let target = HSTRING::from(path.as_str());
            PrintToPdfCompletedHandler::wait_for_async_operation(
                Box::new(move |handler| Ok(core7.PrintToPdf(&target, None, &handler)?)),
                Box::new(|error_code, is_successful| {
                    error_code?;
                    if is_successful {
                        Ok(())
                    } else {
                        Err(windows::core::Error::from_win32())
                    }
                }),
            )
        })();
        if let Err(e) = &outcome {
            eprintln!("PrintToPdf failed: {e}");
        }
    });

    let _ = print_window.close();
    let _ = std::fs::remove_file(&temp_file);

    print_result.map_err(|e| e.to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
async fn export_html_to_pdf(_app: tauri::AppHandle, _html: String, _path: String) -> Result<(), String> {
    Err("Native PDF export is only available on Windows; use the browser's Print dialog instead.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Build and set the application menu
            let menu = menu::build_menu(app.handle())?;
            app.set_menu(menu)?;

            // Native PDF export is only wired up on Windows (WebView2 PrintToPdf);
            // omitting these bindings elsewhere lets the frontend feature-detect
            // and fall back to window.print().
            #[cfg(target_os = "windows")]
            let pdf_export_bindings = r#"
                    showSavePdfDialog: (defaultName) => window.__TAURI__.core.invoke('show_save_pdf_dialog', { defaultName }),
                    exportScreenplayToPdf: (html, path) => window.__TAURI__.core.invoke('export_html_to_pdf', { html, path }),
            "#;
            #[cfg(not(target_os = "windows"))]
            let pdf_export_bindings = "";

            // Injected JavaScript script mapping desktop API to Tauri APIs
            let webview_script = format!(
                r#"
                window.desktopAPI = {{
                    readFile: (path) => window.__TAURI__.core.invoke('read_file', {{ path }}),
                    writeFile: (path, content) => window.__TAURI__.core.invoke('write_file', {{ path, content }}),
                    showOpenDialog: () => window.__TAURI__.core.invoke('show_open_dialog'),
                    showSaveDialog: (defaultName) => window.__TAURI__.core.invoke('show_save_dialog', {{ defaultName }}),
                    autosaveWrite: (key, content) => window.__TAURI__.core.invoke('autosave_write', {{ key, content }}),
                    autosaveRead: (key) => window.__TAURI__.core.invoke('autosave_read', {{ key }}),
                    closeWindow: () => window.__TAURI__.core.invoke('close_main_window'),
                    {pdf_export_bindings}
                    onMenuCommand: (callback) => {{
                        let unlisten;
                        window.__TAURI__.event.listen('menu-command', (event) => {{
                            callback(event.payload);
                        }}).then(fn => {{ unlisten = fn; }});
                        return () => {{
                            if (unlisten) unlisten();
                        }};
                    }},
                    onCloseRequested: (callback) => {{
                        let unlisten;
                        window.__TAURI__.event.listen('close-requested', () => {{
                            callback();
                        }}).then(fn => {{ unlisten = fn; }});
                        return () => {{
                            if (unlisten) unlisten();
                        }};
                    }}
                }};
            "#
            );

            // Programmatically construct the webview window with our injected shim
            let _window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into())
            )
            .title("Sutrata")
            .inner_size(1400.0, 900.0)
            .initialization_script(webview_script)
            .build()?;

            Ok(())
        })
        // beforeunload alone isn't reliable for a native window close across
        // WRY's backing webviews (WebView2/WebKitGTK/WKWebView), so intercept
        // the OS-level close request here too and let the frontend decide —
        // it re-emits 'close-requested' and only calls close_main_window once
        // it has confirmed (or there was nothing to confirm).
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.emit("close-requested", ());
                }
            }
        })
        .on_menu_event(|app_handle, event| {
            let id = event.id().as_ref();
            match id {
                "help:learn" => {
                    let _ = rfd::MessageDialog::new()
                        .set_title("Sutrata")
                        .set_description("Sutrata Screenplay Editor\nMultilingual editor for Latin and Indic scripts.")
                        .show();
                }
                "view:fullscreen" => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                        let _ = window.set_fullscreen(!is_fullscreen);
                    }
                }
                _ => {
                    // Forward menu clicks to frontend
                    let _ = app_handle.emit("menu-command", id);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            show_open_dialog,
            show_save_dialog,
            show_save_pdf_dialog,
            export_html_to_pdf,
            autosave_write,
            autosave_read,
            close_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
