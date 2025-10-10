use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database_path: PathBuf,
    pub app_settings: AppSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: Theme,
    pub language: String,
    pub auto_backup: bool,
    pub backup_interval_days: u32,
    pub show_completed_tasks: bool,
    pub default_priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    Auto,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database_path: default_database_path(),
            app_settings: AppSettings::default(),
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Auto,
            language: "zh-CN".to_string(),
            auto_backup: false,
            backup_interval_days: 7,
            show_completed_tasks: true,
            default_priority: "Medium".to_string(),
        }
    }
}

// 默认数据库路径函数 - 使用可执行文件目录
fn default_database_path() -> PathBuf {
    // 对于 Tauri 应用，数据库存储在可执行文件目录
    // 未来可以改进为使用 Tauri 的应用数据目录 API
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("ferrous-scroll.db")
}

impl Config {
    /// 使用自定义数据库路径创建配置
    #[allow(dead_code)]
    pub fn with_database_path(path: PathBuf) -> Self {
        Self {
            database_path: path,
            app_settings: AppSettings::default(),
        }
    }

    /// 从 JSON 字符串加载配置
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// 转换为 JSON 字符串
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
}
