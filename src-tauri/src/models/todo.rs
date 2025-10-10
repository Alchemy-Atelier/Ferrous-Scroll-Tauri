use serde::{Deserialize, Serialize};
use std::fmt::{self, Display};
use std::str::FromStr;

// todo 状态的枚举
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub enum TodoStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

impl Display for TodoStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let status_str = match self {
            TodoStatus::Pending => "Pending",
            TodoStatus::InProgress => "InProgress",
            TodoStatus::Completed => "Completed",
            TodoStatus::Cancelled => "Cancelled",
        };
        write!(f, "{}", status_str)
    }
}

impl FromStr for TodoStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Pending" => Ok(TodoStatus::Pending),
            "InProgress" => Ok(TodoStatus::InProgress),
            "Completed" => Ok(TodoStatus::Completed),
            "Cancelled" => Ok(TodoStatus::Cancelled),
            _ => Err(format!("无效的状态: {}", s)),
        }
    }
}

// todo 优先级枚举
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub enum TodoPriority {
    Low,
    Medium,
    High,
}

impl Display for TodoPriority {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let priority_str = match self {
            TodoPriority::Low => "Low",
            TodoPriority::Medium => "Medium",
            TodoPriority::High => "High",
        };
        write!(f, "{}", priority_str)
    }
}

impl FromStr for TodoPriority {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Low" => Ok(TodoPriority::Low),
            "Medium" => Ok(TodoPriority::Medium),
            "High" => Ok(TodoPriority::High),
            _ => Err(format!("无效的优先级: {}", s)),
        }
    }
}

// 标签结构体
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String, // 十六进制颜色代码，如 "#3b82f6"
    pub created_at: String,
}

// Tag 结构体不需要构造函数，从数据库直接反序列化

// 分类结构体
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,        // 十六进制颜色代码
    pub icon: String,         // FontAwesome 图标类名
    pub tag_ids: Vec<String>, // 包含的标签ID列表
    pub created_at: String,
}

// Category 结构体不需要构造函数，从数据库直接反序列化

// todo 主结构体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Todo {
    pub id: String,             // 任务id    uu
    pub title: String,          // 标题
    pub description: String,    // 任务描述
    pub priority: TodoPriority, // 任务优先级
    pub status: TodoStatus,     // 任务状态
    pub due_date: String,       // 截止日期
    pub created_at: String,     // 创建时间
    pub updated_at: String,     // 更新时间
    pub tag_ids: Vec<String>,   // 包含的标签ID列表
}

// Todo 结构体不需要构造函数，从数据库直接反序列化
// 更新操作通过 TodoStorage 的方法完成

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subtask {
    pub id: String,          // 子任务id
    pub parent_id: String,   // 父任务id（只指向Todo）
    pub title: String,       // 子任务标题
    pub description: String, // 子任务描述
    pub status: TodoStatus,  // 子任务状态
    pub created_at: String,  // 创建时间
    pub updated_at: String,  // 更新时间
}

// Subtask 结构体不需要构造函数，从数据库直接反序列化
// 更新操作通过 TodoStorage 的方法完成
