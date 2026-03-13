// src/main.rs - 桌面入口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ferrous_scroll_lib::run();
}
