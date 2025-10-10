use crate::models::todo::{TodoPriority, TodoStatus};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::path::Path;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TagDto {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

// TagDto 不需要构造函数，从数据库查询结果创建

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub tag_ids: Vec<String>, // 包含的标签ID
    pub tags: Vec<TagDto>,    // 包含的标签详情
    pub todo_count: i64,      // 该分类下的任务数量
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TodoDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: TodoPriority,
    pub status: TodoStatus,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub subtasks: Vec<SubtaskDto>,
    pub tag_ids: Vec<String>,
    pub tags: Vec<TagDto>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SubtaskDto {
    pub id: String,
    pub parent_id: String,
    pub title: String,
    pub description: String,
    pub status: TodoStatus,
    pub created_at: String,
    pub updated_at: String,
}

// 添加这个新的结构体
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

pub struct TodoStorage {
    pool: SqlitePool,
}

impl TodoStorage {
    /// 使用指定的数据库路径创建存储实例
    pub async fn new_with_path(db_path: &Path) -> Result<Self, sqlx::Error> {
        println!("📁 数据库路径: {}", db_path.display());

        // 确保目录存在
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                sqlx::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    format!("无法创建数据库目录 {}: {}", parent.display(), e),
                ))
            })?;
        }

        // 创建数据库连接
        let database_url = format!("sqlite://{}?mode=rwc", db_path.display());
        println!("🔗 连接数据库: {}", database_url);

        let pool = SqlitePool::connect(&database_url).await.map_err(|e| {
            eprintln!("   数据库连接失败: {}", e);
            eprintln!("   数据库路径: {}", db_path.display());
            eprintln!("   连接字符串: {}", database_url);
            e
        })?;

        let storage = Self { pool };

        // 初始化数据库表
        storage.init_tables().await?;

        println!("✅ 数据库初始化完成");
        Ok(storage)
    }

    /// 使用配置创建存储实例
    pub async fn new_with_config(config: &crate::config::Config) -> Result<Self, sqlx::Error> {
        Self::new_with_path(&config.database_path).await
    }

    /// 使用默认配置创建存储实例
    #[allow(dead_code)]
    pub async fn new() -> Result<Self, sqlx::Error> {
        let config = crate::config::Config::default();
        Self::new_with_config(&config).await
    }

    // 初始化数据库表（简化版本）
    async fn init_tables(&self) -> Result<(), sqlx::Error> {
        // 创建todos表（移除category_id字段）
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS todos (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description VARCHAR(255) NOT NULL DEFAULT '',
                priority VARCHAR(255) NOT NULL,
                status VARCHAR(255) NOT NULL,
                due_date VARCHAR(255),
                created_at VARCHAR(255) NOT NULL,
                updated_at VARCHAR(255) NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建subtasks表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS subtasks (
                id VARCHAR(255) PRIMARY KEY,
                parent_id VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description VARCHAR(255) NOT NULL DEFAULT '',
                status VARCHAR(255) NOT NULL,
                created_at VARCHAR(255) NOT NULL,
                updated_at VARCHAR(255) NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES todos(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建tags表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tags (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                color VARCHAR(7) NOT NULL DEFAULT '#10b981',
                created_at VARCHAR(255) NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建categories表（基于标签的逻辑分组）
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS categories (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                description VARCHAR(255) NOT NULL DEFAULT '',
                color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
                created_at VARCHAR(255) NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建category_tags关联表（分类包含哪些标签）
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS category_tags (
                category_id VARCHAR(255) NOT NULL,
                tag_id VARCHAR(255) NOT NULL,
                created_at VARCHAR(255) NOT NULL,
                PRIMARY KEY (category_id, tag_id),
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建todo_tags关联表（任务的标签）
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS todo_tags (
                todo_id VARCHAR(255) NOT NULL,
                tag_id VARCHAR(255) NOT NULL,
                created_at VARCHAR(255) NOT NULL,
                PRIMARY KEY (todo_id, tag_id),
                FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建默认标签和分类
        self.create_default_tags_and_categories().await?;

        Ok(())
    }

    // 创建默认标签和分类
    async fn create_default_tags_and_categories(&self) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();

        // 创建默认标签
        let default_tags = vec![
            ("工作", "#3b82f6"),
            ("紧急", "#ef4444"),
            ("个人", "#10b981"),
            ("学习", "#f59e0b"),
            ("购物", "#8b5cf6"),
            ("健康", "#06d6a0"),
            ("娱乐", "#ec4899"),
            ("家务", "#6b7280"),
            ("会议", "#0891b2"),
            ("项目", "#7c3aed"),
        ];

        let mut tag_ids = Vec::new();
        for (name, color) in &default_tags {
            let id = Uuid::new_v4().to_string();

            sqlx::query(
                r#"
                INSERT OR IGNORE INTO tags (id, name, color, created_at)
                VALUES (?, ?, ?, ?)
                "#,
            )
            .bind(&id)
            .bind(name)
            .bind(color)
            .bind(&now)
            .execute(&self.pool)
            .await?;

            tag_ids.push((name.to_string(), id));
        }

        // 创建默认分类（基于标签）
        let default_categories = vec![
            (
                "工作任务",
                "工作相关的所有任务",
                "#3b82f6",
                vec!["工作", "会议", "项目"],
            ),
            (
                "生活事务",
                "日常生活相关的任务",
                "#10b981",
                vec!["个人", "购物", "家务"],
            ),
            (
                "紧急事项",
                "需要优先处理的紧急任务",
                "#ef4444",
                vec!["紧急"],
            ),
            ("学习计划", "学习和自我提升相关", "#f59e0b", vec!["学习"]),
            ("健康生活", "健康和锻炼相关", "#06d6a0", vec!["健康"]),
        ];

        for (name, description, color, tag_names) in &default_categories {
            // 查找对应的标签ID
            let category_tag_ids: Vec<String> = tag_ids
                .iter()
                .filter(|(tag_name, _)| tag_names.contains(&tag_name.as_str()))
                .map(|(_, id)| id.clone())
                .collect();

            if !category_tag_ids.is_empty() {
                let _ = self
                    .create_category(
                        name.to_string(),
                        description.to_string(),
                        color.to_string(),
                        category_tag_ids,
                    )
                    .await;
            }
        }

        Ok(())
    }

    // 更新 get_all 方法
    pub async fn get_all(&self) -> Result<Vec<TodoDto>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM todos ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let mut todos = Vec::new();
        for row in rows {
            let todo_id: String = row.get("id");

            // 获取子任务和标签
            let subtasks = self.get_subtasks_by_parent_id(&todo_id).await?;
            let tags = self.get_tags_for_todo(&todo_id).await?;
            let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();
            todos.push(TodoDto {
                id: todo_id,
                title: row.get("title"),
                description: row.get("description"),
                priority: TodoPriority::from_str(&row.get::<String, _>("priority"))
                    .unwrap_or(TodoPriority::Medium),
                status: TodoStatus::from_str(&row.get::<String, _>("status"))
                    .unwrap_or(TodoStatus::Pending),
                due_date: row.get("due_date"),
                tag_ids,
                tags,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                subtasks,
            });
        }

        Ok(todos)
    }

    // 根据父任务ID获取子任务列表
    pub async fn get_subtasks_by_parent_id(
        &self,
        parent_id: &str,
    ) -> Result<Vec<SubtaskDto>, sqlx::Error> {
        let rows =
            sqlx::query("SELECT * FROM subtasks WHERE parent_id = ? ORDER BY created_at ASC")
                .bind(parent_id)
                .fetch_all(&self.pool)
                .await?;

        let subtasks = rows
            .into_iter()
            .map(|row| SubtaskDto {
                id: row.get("id"),
                parent_id: row.get("parent_id"),
                title: row.get("title"),
                description: row.get("description"),
                status: TodoStatus::from_str(&row.get::<String, _>("status"))
                    .unwrap_or(TodoStatus::Pending),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();
        Ok(subtasks)
    }

    // 根据 ID 获取单个 todo
    pub async fn get_by_id(&self, id: &str) -> Result<Option<TodoDto>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM todos WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => {
                // 获取子任务
                let subtasks = self.get_subtasks_by_parent_id(id).await?;
                let tags = self.get_tags_for_todo(id).await?;
                let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();

                Ok(Some(TodoDto {
                    id: row.get("id"),
                    title: row.get("title"),
                    description: row.get("description"),
                    priority: TodoPriority::from_str(&row.get::<String, _>("priority"))
                        .unwrap_or(TodoPriority::Medium),
                    status: TodoStatus::from_str(&row.get::<String, _>("status"))
                        .unwrap_or(TodoStatus::Pending),
                    due_date: row.get("due_date"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                    subtasks,
                    tag_ids,
                    tags,
                }))
            }
            None => Ok(None),
        }
    }

    // 创建新的 todo
    pub async fn create(
        &self,
        title: String,
        description: Option<String>,
        priority: TodoPriority,
        due_date: Option<String>,
        tag_ids: Vec<String>,
    ) -> Result<TodoDto, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let description = description.unwrap_or_default();

        // 创建todo（不包含tag_ids）
        sqlx::query(
            r#"
            INSERT INTO todos (id, title, description, priority, status, due_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&title)
        .bind(&description)
        .bind(priority.to_string())
        .bind(TodoStatus::Pending.to_string())
        .bind(&due_date)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        // 为todo添加标签关联
        for tag_id in &tag_ids {
            self.add_tag_to_todo(&id, tag_id).await?;
        }

        // 获取标签详情
        let tags = self.get_tags_for_todo(&id).await?;

        Ok(TodoDto {
            id,
            title,
            description,
            priority,
            status: TodoStatus::Pending,
            due_date,
            tag_ids,
            tags,
            created_at: now.clone(),
            updated_at: now,
            subtasks: vec![],
        })
    }

    // 创建新的子任务
    pub async fn create_subtask(
        &self,
        parent_id: String,
        title: String,
        description: Option<String>,
    ) -> Result<SubtaskDto, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let description = description.unwrap_or_default();
        if parent_id.is_empty() {
            return Err(sqlx::Error::RowNotFound);
        }

        sqlx::query(
            r#"
            INSERT INTO subtasks (id, parent_id, title, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&parent_id)
        .bind(&title)
        .bind(&description)
        .bind(TodoStatus::Pending.to_string())
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        // 更新父任务的更新时间
        sqlx::query("UPDATE todos SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(&parent_id)
            .execute(&self.pool)
            .await?;

        Ok(SubtaskDto {
            id,
            parent_id,
            title,
            description,
            status: TodoStatus::Pending,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    // 更新子任务
    pub async fn update_subtask(
        &self,
        id: &str,
        title: Option<String>,
        description: Option<String>,
        status: Option<TodoStatus>,
    ) -> Result<Option<SubtaskDto>, sqlx::Error> {
        // 首先检查子任务是否存在
        let existing = sqlx::query("SELECT * FROM subtasks WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        if existing.is_none() {
            return Ok(None);
        }

        let existing = existing.unwrap();
        let now = Utc::now().to_rfc3339();

        // 获取当前值或使用新值
        let new_title = title.unwrap_or_else(|| existing.get("title"));
        let new_description = description.unwrap_or_else(|| existing.get("description"));
        let new_status = status
            .map(|s| s.to_string())
            .unwrap_or_else(|| existing.get("status"));

        // 更新数据库
        sqlx::query(
            r#"
            UPDATE subtasks 
            SET title = ?, description = ?, status = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&new_title)
        .bind(&new_description)
        .bind(&new_status)
        .bind(&now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(Some(SubtaskDto {
            id: existing.get("id"),
            parent_id: existing.get("parent_id"),
            title: new_title,
            description: new_description,
            status: TodoStatus::from_str(&new_status).unwrap_or(TodoStatus::Pending),
            created_at: existing.get("created_at"),
            updated_at: now,
        }))
    }

    // 删除子任务
    pub async fn delete_subtask(&self, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM subtasks WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    // 更新 todo
    pub async fn update(
        &self,
        id: &str,
        title: Option<String>,
        description: Option<String>,
        priority: Option<TodoPriority>,
        status: Option<TodoStatus>,
        due_date: Option<Option<String>>,
    ) -> Result<Option<TodoDto>, sqlx::Error> {
        // 首先检查 todo 是否存在
        let existing = self.get_by_id(id).await?;
        if existing.is_none() {
            return Ok(None);
        }

        let mut existing = existing.unwrap();
        let now = Utc::now().to_rfc3339();

        // 更新字段
        if let Some(t) = title {
            existing.title = t;
        }
        if let Some(d) = description {
            existing.description = d;
        }
        if let Some(p) = priority {
            existing.priority = p;
        }
        if let Some(s) = status {
            existing.status = s;
        }
        if let Some(d) = due_date {
            existing.due_date = d;
        }
        existing.updated_at = now;

        // 保存到数据库
        sqlx::query(
            r#"
            UPDATE todos 
            SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&existing.title)
        .bind(&existing.description)
        .bind(existing.priority.to_string())
        .bind(existing.status.to_string())
        .bind(&existing.due_date)
        .bind(&existing.updated_at)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(Some(existing))
    }

    // 删除 todo
    pub async fn delete(&self, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM todos WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    // 更新状态
    pub async fn update_status(
        &self,
        id: &str,
        status: TodoStatus,
    ) -> Result<Option<TodoDto>, sqlx::Error> {
        self.update(id, None, None, None, Some(status), None).await
    }

    // 分类管理方

    // 获取所有标签
    pub async fn get_all_tags(&self) -> Result<Vec<TagDto>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM tags ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;
        let tags = rows
            .into_iter()
            .map(|row| TagDto {
                id: row.get("id"),
                name: row.get("name"),
                color: row.get("color"),
                created_at: row.get("created_at"),
            })
            .collect();
        Ok(tags)
    }

    // 创建新标签
    pub async fn create_tag(&self, name: String, color: String) -> Result<TagDto, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO tags (id, name, color, created_at)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&name)
        .bind(&color)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(TagDto {
            id,
            name,
            color,
            created_at: now,
        })
    }

    // 为任务添加标签
    pub async fn add_tag_to_todo(&self, todo_id: &str, tag_id: &str) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT OR IGNORE INTO todo_tags (todo_id, tag_id, created_at)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(todo_id)
        .bind(tag_id)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // 从任务移除标签
    pub async fn remove_tag_from_todo(
        &self,
        todo_id: &str,
        tag_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?")
            .bind(todo_id)
            .bind(tag_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // 删除标签
    pub async fn delete_tag(&self, tag_id: &str) -> Result<(), sqlx::Error> {
        // 首先删除所有相关的关联记录
        sqlx::query("DELETE FROM todo_tags WHERE tag_id = ?")
            .bind(tag_id)
            .execute(&self.pool)
            .await?;

        sqlx::query("DELETE FROM category_tags WHERE tag_id = ?")
            .bind(tag_id)
            .execute(&self.pool)
            .await?;

        // 删除标签本身
        sqlx::query("DELETE FROM tags WHERE id = ?")
            .bind(tag_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // 获取单个分类
    #[allow(dead_code)]
    pub async fn get_category(
        &self,
        category_id: &str,
    ) -> Result<Option<CategoryDto>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM categories WHERE id = ?")
            .bind(category_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            // 获取分类的标签
            let tags = self.get_tags_for_category(category_id).await?;
            let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();

            // 计算任务数量
            let todo_count = self.count_todos_by_category(category_id).await?;

            Ok(Some(CategoryDto {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                color: row.get("color"),
                tag_ids,
                tags,
                todo_count,
                created_at: row.get("created_at"),
            }))
        } else {
            Ok(None)
        }
    }

    // 更新分类
    pub async fn update_category(
        &self,
        category_id: &str,
        req: UpdateCategoryRequest,
    ) -> Result<(), sqlx::Error> {
        let mut query_parts = Vec::new();
        let mut binds: Vec<&str> = Vec::new();

        if let Some(name) = &req.name {
            query_parts.push("name = ?");
            binds.push(name.as_str());
        }

        if let Some(description) = &req.description {
            query_parts.push("description = ?");
            binds.push(description.as_str());
        }

        if let Some(color) = &req.color {
            query_parts.push("color = ?");
            binds.push(color.as_str());
        }

        if query_parts.is_empty() {
            return Ok(()); // 没有需要更新的字段
        }

        let query_str = format!(
            "UPDATE categories SET {} WHERE id = ?",
            query_parts.join(", ")
        );

        let mut query = sqlx::query(&query_str);
        for bind in binds {
            query = query.bind(bind);
        }
        query = query.bind(category_id);

        query.execute(&self.pool).await?;

        Ok(())
    }

    // 删除分类
    pub async fn delete_category(&self, category_id: &str) -> Result<(), sqlx::Error> {
        // 删除分类标签关联
        sqlx::query("DELETE FROM category_tags WHERE category_id = ?")
            .bind(category_id)
            .execute(&self.pool)
            .await?;

        // 删除分类本身
        sqlx::query("DELETE FROM categories WHERE id = ?")
            .bind(category_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // 统计分类下的任务数量 (被 get_category 内部调用)
    #[allow(dead_code)]
    pub async fn count_todos_by_category(&self, category_id: &str) -> Result<i64, sqlx::Error> {
        // 获取分类包含的标签
        let category_tag_ids = self
            .get_tags_for_category(category_id)
            .await?
            .into_iter()
            .map(|tag| tag.id)
            .collect::<Vec<String>>();

        if category_tag_ids.is_empty() {
            return Ok(0);
        }

        // 构建查询
        let placeholders = category_tag_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let query_str = format!(
            r#"
            SELECT COUNT(DISTINCT t.id) as count FROM todos t
            INNER JOIN todo_tags tt ON t.id = tt.todo_id
            WHERE tt.tag_id IN ({})
            "#,
            placeholders
        );

        let mut query = sqlx::query(&query_str);
        for tag_id in &category_tag_ids {
            query = query.bind(tag_id);
        }

        let row = query.fetch_one(&self.pool).await?;
        Ok(row.get("count"))
    }

    // 搜索任务
    pub async fn search_todos(&self, keyword: &str) -> Result<Vec<TodoDto>, sqlx::Error> {
        let search_pattern = format!("%{}%", keyword);

        let rows = sqlx::query(
            r#"
            SELECT * FROM todos 
            WHERE title LIKE ? OR description LIKE ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await?;

        let mut todos = Vec::new();
        for row in rows {
            let todo_id: String = row.get("id");

            // 获取子任务和标签
            let subtasks = self.get_subtasks_by_parent_id(&todo_id).await?;
            let tags = self.get_tags_for_todo(&todo_id).await?;
            let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();

            todos.push(TodoDto {
                id: todo_id,
                title: row.get("title"),
                description: row.get("description"),
                priority: TodoPriority::from_str(&row.get::<String, _>("priority"))
                    .unwrap_or(TodoPriority::Medium),
                status: TodoStatus::from_str(&row.get::<String, _>("status"))
                    .unwrap_or(TodoStatus::Pending),
                due_date: row.get("due_date"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                subtasks,
                tag_ids,
                tags,
            });
        }

        Ok(todos)
    }

    // 过滤任务 (预留的高级功能)
    #[allow(dead_code)]
    pub async fn filter_todos(
        &self,
        filters: &std::collections::HashMap<String, String>,
    ) -> Result<Vec<TodoDto>, sqlx::Error> {
        let mut base_query = "SELECT DISTINCT t.* FROM todos t".to_string();
        let mut joins = Vec::new();
        let mut where_clauses = Vec::new();
        let mut binds: Vec<String> = Vec::new();

        // 处理标签过滤
        if let Some(tags_str) = filters.get("tags") {
            let tag_ids: Vec<&str> = tags_str.split(',').map(|s| s.trim()).collect();
            if !tag_ids.is_empty() {
                joins.push("INNER JOIN todo_tags tt ON t.id = tt.todo_id");
                let placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                where_clauses.push(format!("tt.tag_id IN ({})", placeholders));
                for tag_id in tag_ids {
                    binds.push(tag_id.to_string());
                }
            }
        }

        // 处理分类过滤
        if let Some(category_id) = filters.get("category") {
            // 获取分类包含的标签
            if let Ok(category_tags) = self.get_tags_for_category(category_id).await {
                if !category_tags.is_empty() {
                    if !joins.iter().any(|j| j.contains("todo_tags")) {
                        joins.push("INNER JOIN todo_tags tt ON t.id = tt.todo_id");
                    }
                    let placeholders = category_tags
                        .iter()
                        .map(|_| "?")
                        .collect::<Vec<_>>()
                        .join(",");
                    where_clauses.push(format!("tt.tag_id IN ({})", placeholders));
                    for tag in category_tags {
                        binds.push(tag.id.clone());
                    }
                }
            }
        }

        // 处理状态过滤
        if let Some(status) = filters.get("status") {
            where_clauses.push("t.status = ?".to_string());
            binds.push(status.to_string());
        }

        // 构建完整查询
        if !joins.is_empty() {
            base_query.push(' ');
            base_query.push_str(&joins.join(" "));
        }

        if !where_clauses.is_empty() {
            base_query.push_str(" WHERE ");
            base_query.push_str(&where_clauses.join(" AND "));
        }

        base_query.push_str(" ORDER BY t.created_at DESC");

        let mut query = sqlx::query(&base_query);
        for bind in binds {
            query = query.bind(bind);
        }

        let rows = query.fetch_all(&self.pool).await?;

        let mut todos = Vec::new();
        for row in rows {
            let todo_id: String = row.get("id");

            // 获取子任务和标签
            let subtasks = self.get_subtasks_by_parent_id(&todo_id).await?;
            let tags = self.get_tags_for_todo(&todo_id).await?;
            let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();

            todos.push(TodoDto {
                id: todo_id,
                title: row.get("title"),
                description: row.get("description"),
                priority: TodoPriority::from_str(&row.get::<String, _>("priority"))
                    .unwrap_or(TodoPriority::Medium),
                status: TodoStatus::from_str(&row.get::<String, _>("status"))
                    .unwrap_or(TodoStatus::Pending),
                due_date: row.get("due_date"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                subtasks,
                tag_ids,
                tags,
            });
        }

        Ok(todos)
    }

    // 获取任务的标签
    pub async fn get_tags_for_todo(&self, todo_id: &str) -> Result<Vec<TagDto>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT t.* FROM tags t
            INNER JOIN todo_tags tt ON t.id = tt.tag_id
            WHERE tt.todo_id = ?
            ORDER BY t.name
            "#,
        )
        .bind(todo_id)
        .fetch_all(&self.pool)
        .await?;

        let tags = rows
            .into_iter()
            .map(|row| TagDto {
                id: row.get("id"),
                name: row.get("name"),
                color: row.get("color"),
                created_at: row.get("created_at"),
            })
            .collect();

        Ok(tags)
    }

    // 获取所有分类（包含标签信息和任务统计）
    pub async fn get_all_categories(&self) -> Result<Vec<CategoryDto>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM categories ORDER BY name")
            .fetch_all(&self.pool)
            .await?;

        let mut categories = Vec::new();
        for row in rows {
            let category_id: String = row.get("id");

            // 获取分类包含的标签
            let tag_rows = sqlx::query(
                r#"
                SELECT t.* FROM tags t
                INNER JOIN category_tags ct ON t.id = ct.tag_id
                WHERE ct.category_id = ?
                ORDER BY t.name
                "#,
            )
            .bind(&category_id)
            .fetch_all(&self.pool)
            .await?;

            let tags: Vec<TagDto> = tag_rows
                .into_iter()
                .map(|row| TagDto {
                    id: row.get("id"),
                    name: row.get("name"),
                    color: row.get("color"),
                    created_at: row.get("created_at"),
                })
                .collect();

            let tag_ids: Vec<String> = tags.iter().map(|t| t.id.clone()).collect();

            // 计算该分类下的任务数量（有任何分类标签的任务）
            let todo_count = if !tag_ids.is_empty() {
                let placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                let query_str = format!(
                    r#"
                    SELECT COUNT(DISTINCT t.id) as count
                    FROM todos t
                    INNER JOIN todo_tags tt ON t.id = tt.todo_id
                    WHERE tt.tag_id IN ({})
                    "#,
                    placeholders
                );

                let mut query = sqlx::query(&query_str);
                for tag_id in &tag_ids {
                    query = query.bind(tag_id);
                }

                let result = query.fetch_one(&self.pool).await?;
                result.get::<i64, _>("count")
            } else {
                0
            };

            categories.push(CategoryDto {
                id: category_id,
                name: row.get("name"),
                description: row.get("description"),
                color: row.get("color"),
                tag_ids,
                tags,
                todo_count,
                created_at: row.get("created_at"),
            });
        }

        Ok(categories)
    }

    // 创建新分类
    pub async fn create_category(
        &self,
        name: String,
        description: String,
        color: String,
        tag_ids: Vec<String>,
    ) -> Result<CategoryDto, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        // 创建分类
        sqlx::query(
            r#"
            INSERT INTO categories (id, name, description, color,created_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&name)
        .bind(&description)
        .bind(&color)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        // 关联标签
        for tag_id in &tag_ids {
            self.add_tag_to_category(&id, tag_id).await?;
        }

        // 获取标签详情
        let tags = self.get_tags_for_category(&id).await?;

        Ok(CategoryDto {
            id,
            name,
            description,
            color,
            tag_ids,
            tags,
            todo_count: 0,
            created_at: now,
        })
    }

    // 为分类添加标签
    pub async fn add_tag_to_category(
        &self,
        category_id: &str,
        tag_id: &str,
    ) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT OR IGNORE INTO category_tags (category_id, tag_id, created_at)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(category_id)
        .bind(tag_id)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // 从分类移除标签
    pub async fn remove_tag_from_category(
        &self,
        category_id: &str,
        tag_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM category_tags WHERE category_id = ? AND tag_id = ?")
            .bind(category_id)
            .bind(tag_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // 获取分类的标签
    pub async fn get_tags_for_category(
        &self,
        category_id: &str,
    ) -> Result<Vec<TagDto>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT t.* FROM tags t
            INNER JOIN category_tags ct ON t.id = ct.tag_id
            WHERE ct.category_id = ?
            ORDER BY t.name
            "#,
        )
        .bind(category_id)
        .fetch_all(&self.pool)
        .await?;

        let tags = rows
            .into_iter()
            .map(|row| TagDto {
                id: row.get("id"),
                name: row.get("name"),
                color: row.get("color"),
                created_at: row.get("created_at"),
            })
            .collect();

        Ok(tags)
    }

    // 根据分类获取任务（通过标签查询）
    pub async fn get_todos_by_category(
        &self,
        category_id: &str,
    ) -> Result<Vec<TodoDto>, sqlx::Error> {
        // 获取分类包含的标签
        let category_tag_ids = self
            .get_tags_for_category(category_id)
            .await?
            .into_iter()
            .map(|tag| tag.id)
            .collect::<Vec<String>>();

        if category_tag_ids.is_empty() {
            return Ok(vec![]);
        }

        // 查询有任何分类标签的任务
        let placeholders = category_tag_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let query_str = format!(
            r#"
            SELECT DISTINCT t.* FROM todos t
            INNER JOIN todo_tags tt ON t.id = tt.todo_id
            WHERE tt.tag_id IN ({})
            ORDER BY t.created_at DESC
            "#,
            placeholders
        );

        let mut query = sqlx::query(&query_str);
        for tag_id in &category_tag_ids {
            query = query.bind(tag_id);
        }

        let rows = query.fetch_all(&self.pool).await?;

        let mut todos = Vec::new();
        for row in rows {
            let todo_id: String = row.get("id");

            // 获取子任务和标签
            let subtasks = self.get_subtasks_by_parent_id(&todo_id).await?;
            // 获取标签,todoDto 本身就存了标签
            let tags = self.get_tags_for_todo(&todo_id).await?;
            let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();

            todos.push(TodoDto {
                id: todo_id,
                title: row.get("title"),
                description: row.get("description"),
                priority: TodoPriority::from_str(&row.get::<String, _>("priority"))
                    .unwrap_or(TodoPriority::Medium),
                status: TodoStatus::from_str(&row.get::<String, _>("status"))
                    .unwrap_or(TodoStatus::Pending),
                due_date: row.get("due_date"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                subtasks,
                tag_ids,
                tags,
            });
        }

        Ok(todos)
    }

    // 根据标签获取任务
    pub async fn get_todos_by_tag(&self, tag_id: &str) -> Result<Vec<TodoDto>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT t.* FROM todos t
            INNER JOIN todo_tags tt ON t.id = tt.todo_id
            WHERE tt.tag_id = ?
            ORDER BY t.created_at DESC
            "#,
        )
        .bind(tag_id)
        .fetch_all(&self.pool)
        .await?;

        let mut todos = Vec::new();
        for row in rows {
            let todo_id: String = row.get("id");

            // 获取子任务和标签
            let subtasks = self.get_subtasks_by_parent_id(&todo_id).await?;
            let tags = self.get_tags_for_todo(&todo_id).await?;
            let tag_ids = tags.iter().map(|tag| tag.id.clone()).collect();

            todos.push(TodoDto {
                id: todo_id,
                title: row.get("title"),
                description: row.get("description"),
                priority: TodoPriority::from_str(&row.get::<String, _>("priority"))
                    .unwrap_or(TodoPriority::Medium),
                status: TodoStatus::from_str(&row.get::<String, _>("status"))
                    .unwrap_or(TodoStatus::Pending),
                due_date: row.get("due_date"),
                tag_ids,
                tags,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                subtasks,
            });
        }

        Ok(todos)
    }

    pub async fn update_tag(
        &self,
        tag_id: &str,
        name: String,
        color: String,
    ) -> Result<TagDto, sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE tags SET name = ?, color = ? WHERE id = ?
            "#,
        )
        .bind(&name)
        .bind(&color)
        .bind(tag_id)
        .execute(&self.pool)
        .await?;

        Ok(TagDto {
            id: tag_id.to_string(),
            name,
            color,
            created_at: Utc::now().to_rfc3339(),
        })
    }
}
