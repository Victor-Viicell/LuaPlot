// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    disable_broken_dmabuf_renderer();

    neonlife_lib::run()
}

/// WebKitGTK's DMA-BUF renderer tears down the Wayland connection on NVIDIA
/// (`Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display`).
/// Fall back to the shared-memory renderer when that combination is detected.
#[cfg(target_os = "linux")]
fn disable_broken_dmabuf_renderer() {
    use std::{env, path::Path};

    let nvidia = Path::new("/proc/driver/nvidia/version").exists();
    let wayland = env::var_os("WAYLAND_DISPLAY").is_some();
    if nvidia && wayland && env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // SAFETY: this runs before GTK/WebKit or any other thread is started.
        unsafe { env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
}

#[cfg(not(target_os = "linux"))]
fn disable_broken_dmabuf_renderer() {}
