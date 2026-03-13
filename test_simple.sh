#!/bin/bash

echo "🔧 简单测试 Tauri v2 API 修复"
echo "=============================="

# 检查文件是否存在
echo "📋 检查修复文件..."
if [ -f "src/tauri-api.js" ]; then
    echo "✅ src/tauri-api.js - 新的API包装器"
else
    echo "❌ src/tauri-api.js - 文件不存在"
fi

if [ -f "src/index.html" ]; then
    echo "✅ src/index.html - 已更新"
else
    echo "❌ src/index.html - 文件不存在"
fi

if [ -f "src/script.js" ]; then
    echo "✅ src/script.js - 已更新"
else
    echo "❌ src/script.js - 文件不存在"
fi

if [ -f "debug.html" ]; then
    echo "✅ debug.html - 调试页面"
else
    echo "❌ debug.html - 文件不存在"
fi

echo ""
echo "🚀 开始构建测试..."

# 进入 src-tauri 目录
cd src-tauri

echo "📦 构建 Rust 后端..."
if cargo build --release; then
    echo "✅ Rust 后端构建成功"
else
    echo "❌ Rust 后端构建失败"
    exit 1
fi

cd ..

echo ""
echo "🎯 构建 Tauri 应用..."
if cargo tauri build; then
    echo "✅ Tauri 应用构建成功"
    echo ""
    echo "🎉 修复完成！"
    echo ""
    echo "📝 本次修复内容："
    echo "1. 创建了独立的 tauri-api.js 包装器"
    echo "2. 简化了API初始化逻辑"
    echo "3. 移除了复杂的等待机制"
    echo "4. 提供了多种API调用备用方案"
    echo ""
    echo "🧪 测试步骤："
    echo "1. 运行编译后的应用"
    echo "2. 打开浏览器开发者工具查看控制台"
    echo "3. 测试添加任务的标签选择功能"
    echo "4. 测试任务卷轴内的操作按钮"
    echo "5. 如果仍有问题，使用 debug.html 进行调试"
    echo ""
    echo "📄 调试信息："
    echo "- 查看控制台中的 '🚀 加载 Tauri API 包装器...' 消息"
    echo "- 查看 '✅ Tauri 已加载' 和 '✅ Tauri API 初始化完成' 消息"
    echo "- 如果看到错误，请检查具体的错误信息"
else
    echo "❌ Tauri 应用构建失败"
    exit 1
fi
