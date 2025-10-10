// src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ==================== 模块声明 ====================
mod config;
mod models;
mod storage;

// ==================== 导入 ====================
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;

// 使用本地模块
use config::Config;
use models::todo::{TodoPriority, TodoStatus};
use storage::{TodoStorage, TodoDto, TagDto, CategoryDto, SubtaskDto};

// ==================== 应用状态 ====================
struct AppState {
    storage: Arc<Mutex<TodoStorage>>,
    config: Arc<Mutex<Config>>,
    config_path: std::path::PathBuf,
}

// ==================== Todo 命令 ====================

#[tauri::command]
async fn get_all_todos(state: State<'_, AppState>) -> Result<Vec<TodoDto>, String> {
    let storage = state.storage.lock().await;
    storage.get_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_todo(state: State<'_, AppState>, id: String) -> Result<Option<TodoDto>, String> {
    let storage = state.storage.lock().await;
    storage.get_by_id(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_todo(
    state: State<'_, AppState>,
    title: String,
    description: Option<String>,
    priority: String,
    due_date: Option<String>,
    tag_ids: Vec<String>,
) -> Result<TodoDto, String> {
    let priority = priority.parse::<TodoPriority>().map_err(|e| e.to_string())?;
    let storage = state.storage.lock().await;
    storage
        .create(title, description, priority, due_date, tag_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_todo_status(
    state: State<'_, AppState>,
    id: String,
    status: String,
) -> Result<Option<TodoDto>, String> {
    let status = status.parse::<TodoStatus>().map_err(|e| e.to_string())?;
    let storage = state.storage.lock().await;
    storage.update_status(&id, status).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_todo(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let storage = state.storage.lock().await;
    storage.delete(&id).await.map_err(|e| e.to_string())
}

// ==================== 子任务命令 ====================

#[tauri::command]
async fn create_subtask(
    state: State<'_, AppState>,
    parent_id: String,
    title: String,
    description: Option<String>,
) -> Result<SubtaskDto, String> {
    let storage = state.storage.lock().await;
    storage.create_subtask(parent_id, title, description).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_subtask(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
) -> Result<Option<SubtaskDto>, String> {
    let status = match status {
        Some(s) => Some(s.parse::<TodoStatus>().map_err(|e| e.to_string())?),
        None => None,
    };
    let storage = state.storage.lock().await;
    storage.update_subtask(&id, title, description, status).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_subtask(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let storage = state.storage.lock().await;
    storage.delete_subtask(&id).await.map_err(|e| e.to_string())
}

// ==================== 标签命令 ====================

#[tauri::command]
async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<TagDto>, String> {
    let storage = state.storage.lock().await;
    storage.get_all_tags().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: String,
) -> Result<TagDto, String> {
    let storage = state.storage.lock().await;
    storage.create_tag(name, color).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_tag(state: State<'_, AppState>, tag_id: String) -> Result<(), String> {
    let storage = state.storage.lock().await;
    storage.delete_tag(&tag_id).await.map_err(|e| e.to_string())
}

// ==================== 分类命令 ====================

#[tauri::command]
async fn get_all_categories(state: State<'_, AppState>) -> Result<Vec<CategoryDto>, String> {
    let storage = state.storage.lock().await;
    storage.get_all_categories().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_category(
    state: State<'_, AppState>,
    name: String,
    description: String,
    color: String,
    tag_ids: Vec<String>,
) -> Result<CategoryDto, String> {
    let storage = state.storage.lock().await;
    storage.create_category(name, description, color, tag_ids).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_category(state: State<'_, AppState>, category_id: String) -> Result<(), String> {
    let storage = state.storage.lock().await;
    storage.delete_category(&category_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_category_tags(
    state: State<'_, AppState>,
    category_id: String,
    tag_ids: Vec<String>,
) -> Result<(), String> {
    let storage = state.storage.lock().await;
    
    // 清除现有标签
    let existing_tags = storage.get_tags_for_category(&category_id).await.map_err(|e| e.to_string())?;
    for tag in existing_tags {
        storage.remove_tag_from_category(&category_id, &tag.id).await.map_err(|e| e.to_string())?;
    }
    
    // 添加新标签
    for tag_id in tag_ids {
        storage.add_tag_to_category(&category_id, &tag_id).await.map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// ==================== 待办事项更新命令 ====================
#[tauri::command]
async fn update_todo(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    description: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
) -> Result<Option<TodoDto>, String> {
    let priority = match priority {
        Some(p) => Some(p.parse::<TodoPriority>().map_err(|e| e.to_string())?),
        None => None,
    };
    let storage = state.storage.lock().await;
    storage.update(&id, title, description, priority, None, Some(due_date)).await.map_err(|e| e.to_string())
}

// ==================== 标签更新命令 ====================
#[tauri::command]
async fn update_tag(
    state: State<'_, AppState>,
    tag_id: String,
    name: String,
    color: String,
) -> Result<TagDto, String> {
    let storage = state.storage.lock().await;
    storage.update_tag(&tag_id, name, color).await.map_err(|e| e.to_string())
}

// ==================== 分类更新命令 ====================
#[tauri::command]
async fn update_category(
    state: State<'_, AppState>,
    category_id: String,
    name: Option<String>,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let storage = state.storage.lock().await;
    let req = storage::UpdateCategoryRequest { name, description, color };
    storage.update_category(&category_id, req).await.map_err(|e| e.to_string())
}

// ==================== 标签-待办关联命令 ====================
#[tauri::command]
async fn add_tag_to_todo(
    state: State<'_, AppState>,
    todo_id: String,
    tag_id: String,
) -> Result<(), String> {
    let storage = state.storage.lock().await;
    storage.add_tag_to_todo(&todo_id, &tag_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_tag_from_todo(
    state: State<'_, AppState>,
    todo_id: String,
    tag_id: String,
) -> Result<(), String> {
    let storage = state.storage.lock().await;
    storage.remove_tag_from_todo(&todo_id, &tag_id).await.map_err(|e| e.to_string())
}

// ==================== 搜索和筛选命令 ====================
#[tauri::command]
async fn search_todos(
    state: State<'_, AppState>,
    keyword: String,
) -> Result<Vec<TodoDto>, String> {
    let storage = state.storage.lock().await;
    storage.search_todos(&keyword).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_todos_by_category(
    state: State<'_, AppState>,
    category_id: String,
) -> Result<Vec<TodoDto>, String> {
    let storage = state.storage.lock().await;
    storage.get_todos_by_category(&category_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_todos_by_tag(
    state: State<'_, AppState>,
    tag_id: String,
) -> Result<Vec<TodoDto>, String> {
    let storage = state.storage.lock().await;
    storage.get_todos_by_tag(&tag_id).await.map_err(|e| e.to_string())
}

// ==================== 配置命令 ====================

#[tauri::command]
async fn get_config(state: State<'_, AppState>) -> Result<Config, String> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
async fn save_config(
    state: State<'_, AppState>,
    new_config: Config,
) -> Result<(), String> {
    // 更新内存中的配置
    let mut config = state.config.lock().await;
    *config = new_config.clone();
    
    // 保存到文件
    let json = new_config.to_json().map_err(|e| e.to_string())?;
    std::fs::write(&state.config_path, json).map_err(|e| e.to_string())?;
    
    println!("💾 配置已保存到: {}", state.config_path.display());
    Ok(())
}

#[tauri::command]
async fn reset_config(state: State<'_, AppState>) -> Result<Config, String> {
    let default_config = Config::default();
    
    // 更新内存中的配置
    let mut config = state.config.lock().await;
    *config = default_config.clone();
    
    // 删除配置文件（如果存在）
    if state.config_path.exists() {
        std::fs::remove_file(&state.config_path).map_err(|e| e.to_string())?;
        println!("🗑️  配置文件已删除，恢复默认设置");
    }
    
    Ok(default_config)
}

// ==================== 主函数 ====================

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 获取 Tauri 应用数据目录
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            // 确保应用数据目录存在
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");
            
            println!("📁 应用数据目录: {}", app_data_dir.display());
            
            // 配置文件路径（在应用数据目录下）
            let config_path = app_data_dir.join("config.json");
            
            // 数据库文件路径（在应用数据目录下）
            let db_path = app_data_dir.join("ferrous-scroll.db");
            
            // 加载配置（如果配置文件存在）
            let mut config = if config_path.exists() {
                match std::fs::read_to_string(&config_path) {
                    Ok(json) => match Config::from_json(&json) {
                        Ok(cfg) => {
                            println!("📄 已加载配置文件: {}", config_path.display());
                            cfg
                        }
                        Err(e) => {
                            eprintln!("⚠️  配置文件格式错误: {}, 使用默认配置", e);
                            Config::default()
                        }
                    },
                    Err(e) => {
                        eprintln!("⚠️  无法读取配置文件: {}, 使用默认配置", e);
                        Config::default()
                    }
                }
            } else {
                println!("📄 配置文件不存在，使用默认配置");
                Config::default()
            };
            
            // 强制使用应用数据目录的数据库路径
            config.database_path = db_path.clone();
            
            println!("📁 数据库路径: {}", config.database_path.display());
            println!("🎨 主题: {:?}", config.app_settings.theme);
            println!("🌍 语言: {}", config.app_settings.language);

            // 初始化存储（使用 spawn_blocking）
            let config_clone = config.clone();
            let storage = std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    TodoStorage::new_with_config(&config_clone)
                        .await
                        .expect("Failed to initialize storage")
                })
            }).join().expect("Failed to join storage thread");

            let app_state = AppState {
                storage: Arc::new(Mutex::new(storage)),
                config: Arc::new(Mutex::new(config)),
                config_path,
            };

            app.manage(app_state);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Todo
            get_all_todos,
            get_todo,
            create_todo,
            update_todo,
            update_todo_status,
            delete_todo,
            search_todos,
            get_todos_by_category,
            get_todos_by_tag,
            // 子任务
            create_subtask,
            update_subtask,
            delete_subtask,
            // 标签
            get_all_tags,
            create_tag,
            update_tag,
            delete_tag,
            add_tag_to_todo,
            remove_tag_from_todo,
            // 分类
            get_all_categories,
            create_category,
            update_category,
            delete_category,
            update_category_tags,
            // 配置
            get_config,
            save_config,
            reset_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
