mod telemetry;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::Manager;
use telemetry::{start_keyboard_listener, TelemetryState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create shared telemetry state
    let state = Arc::new(Mutex::new(TelemetryState::new()));
    let listener_active = Arc::new(AtomicBool::new(false)); // Off by default (simulation mode)

    // Start the rdev listener thread (it will only record when active flag is true)
    start_keyboard_listener(state.clone(), listener_active.clone());

    tauri::Builder::default()
        .manage(state)
        .manage(listener_active)
        .invoke_handler(tauri::generate_handler![
            telemetry::get_fatigue_data,
            telemetry::set_tracking_mode,
            telemetry::get_tracking_mode,
            telemetry::reset_baseline,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Position window at top-right corner on startup
            let window = app
                .handle()
                .get_webview_window("main")
                .expect("main window not found");

            if let Ok(Some(monitor)) = window.current_monitor() {
                let screen_size = monitor.size();
                let screen_pos = monitor.position();
                let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
                    width: 400,
                    height: 600,
                });
                let scale = window.scale_factor().unwrap_or(1.0);
                let padding = (20.0 * scale) as i32;

                let x = screen_pos.x + screen_size.width as i32 - win_size.width as i32 - padding;
                let y = screen_pos.y + padding;

                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
