# 🦀 Ferrous Scroll - 炼金卷轴

一个使用 Rust + SQLite 构建的现代化 Todo List 管理系统，采用白色、蓝色的优雅配色方案。


### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/ferrous-scroll.git
   cd ferrous-scroll
   ```

2. **构建项目**
   ```bash
   cargo build --release
   ```

3. **运行应用**
   ```bash
   cargo run --release
   ```

4. **访问应用**
   ```
   打开浏览器访问: http://127.0.0.1:3000
   ```

## ⚙️ 配置

### 配置文件
项目支持通过 JSON 配置文件进行自定义配置。

**默认配置文件位置**: `ferrous-scroll.json`

**配置文件示例**:
```json
{
  "database_path": "ferrous-scroll.db",
  "server": {
    "host": "127.0.0.1",
    "port": 3000
  }
}
```

### 配置选项说明
- `database_path`: SQLite 数据库文件路径（相对或绝对路径）
- `server.host`: 服务器监听地址
  - `"127.0.0.1"`: 仅本机访问
  - `"0.0.0.0"`: 允许外部访问
- `server.port`: 服务器端口号

### 自定义配置示例
```json
{
  "database_path": "./data/my-todos.db",
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  }
}
```

## 🎯 使用指南

### 添加待办事项
1. 在顶部表单中输入任务标题（必填）
2. 选择优先级：低、中、高
3. 添加任务描述（可选）
4. 设置截止日期（可选）
5. 点击"添加任务"按钮

### 管理待办事项
- **更改状态**: 勾选复选框标记完成，或使用状态按钮切换"进行中"
- **删除任务**: 点击红色删除按钮（需要确认）
- **查看详情**: 任务卡片显示完整信息，包括创建时间、截止日期等

### 筛选和查看
- **状态筛选**: 使用下拉菜单按状态筛选（全部/待处理/进行中/已完成）
- **优先级筛选**: 按优先级筛选任务
- **统计信息**: 底部面板实时显示各种状态的任务数量

## 🔌 API 接口

### 基础 URL
```
http://127.0.0.1:3000/api/todos
```

### 主要接口

#### 获取所有待办事项
```http
GET /api/todos
```

**响应示例**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "学习 Rust",
    "description": "完成 Rust 基础教程",
    "priority": "High",
    "status": "InProgress",
    "due_date": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-01T09:00:00Z",
    "updated_at": "2024-01-02T14:30:00Z"
  }
]
```

#### 创建待办事项
```http
POST /api/todos
Content-Type: application/json

{
  "title": "新任务",
  "description": "任务描述",
  "priority": "Medium",
  "due_date": "2024-01-20T15:00:00Z"
}
```

#### 更新待办事项
```http
PUT /api/todos/{id}
Content-Type: application/json

{
  "title": "更新后的标题",
  "description": "更新后的描述",
  "priority": "High"
}
```

#### 更新状态
```http
PATCH /api/todos/{id}/status
Content-Type: application/json

{
  "status": "Completed"
}
```

#### 删除待办事项
```http
DELETE /api/todos/{id}
```

### 数据模型

#### 待办事项 (Todo)
```typescript
interface Todo {
  id: string;           // UUID
  title: string;        // 任务标题
  description: string;  // 任务描述
  priority: "Low" | "Medium" | "High";  // 优先级
  status: "Pending" | "InProgress" | "Completed";  // 状态
  due_date?: string;    // 截止日期 (ISO 8601)
  created_at: string;   // 创建时间 (ISO 8601)
  updated_at: string;   // 更新时间 (ISO 8601)
}
```

## 🏗️ 项目结构

```
ferrous-scroll/
├── src/
│   ├── config.rs           # 配置模块
│   ├── handlers/           # API 处理器
│   │   ├── mod.rs
│   │   └── todo_handlers.rs
│   ├── models/             # 数据模型
│   │   ├── mod.rs
│   │   └── todo.rs
│   ├── storage/            # 数据存储
│   │   └── mod.rs
│   ├── utils/              # 工具函数
│   │   └── mod.rs
│   ├── lib.rs              # 库入口
│   └── main.rs             # 应用入口
├── assets/                 # 前端资源
│   ├── index.html          # 主页面
│   ├── style.css           # 样式文件
│   └── script.js           # JavaScript 逻辑
├── target/                 # 编译输出目录
├── Cargo.toml              # Rust 项目配置
├── Cargo.lock              # 依赖版本锁定
├── ferrous-scroll.json     # 配置文件（运行时生成）
└── README.md               # 项目文档
```

## 🏗️ 构建说明

### 快速构建

```bash
# macOS/Linux
chmod +x build.sh

./build.sh macos      # 构建 macOS 应用包
./build.sh windows    # 构建 Windows 安装包（交叉编译）
./build.sh android    # 构建 Android APK
./build.sh dev        # 启动开发模式

# Windows
.\build.ps1 windows   # 构建 Windows 安装包
.\build.ps1 dev       # 启动开发模式
```

### 构建产物

| 平台 | 命令 | 输出文件 |
|------|------|---------|
| **macOS** | `./build.sh macos` | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`<br>`src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app` |
| **Windows** | `.\build.ps1 windows` | `src-tauri/target/release/bundle/msi/*.msi`<br>`src-tauri/target/release/bundle/nsis/*.exe` |
| **Android** | `./build.sh android` | `src-tauri/gen/android/app/build/outputs/apk/release/*.apk` |

### 开发模式

```bash
# 所有平台
./build.sh dev        # macOS/Linux
.\build.ps1 dev       # Windows
```

### 环境要求

- **通用**: Rust 1.70+, Tauri CLI
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio 2019+ (C++ 工具), WebView2
- **Android**: Android Studio, Android SDK (API 24+), Android NDK, Java 17+

## 📝 更新日志

### v0.2 (当前版本)
- ✨ 基础待办事项 CRUD 功能
- 🎨 卷轴风格 UI 设计
- 🗃️ SQLite 数据存储
- ⚙️ JSON 配置文件支持
- 📱 响应式设计
- 🔍 筛选和状态管理
- 🏷️ 标签和分类功能
- 📊 数据导出功能

