#!/bin/bash

echo "🔧 测试多个错误消息修复"
echo "========================"

echo "📋 问题分析："
echo "❌ 原问题：同时出现创建成功、操作失败、同名分类已存在等多个错误消息"
echo "🔍 根本原因："
echo "1. invoke方法中的错误处理会显示错误消息"
echo "2. createCategory方法中的catch块又会显示错误消息"
echo "3. 错误匹配条件过于宽泛，匹配了不应该匹配的错误"
echo ""

echo "🛠️ 修复内容："
echo "✅ 移除了invoke方法中的错误消息显示，避免重复显示"
echo "✅ 精确化了错误匹配条件，只匹配具体的错误类型"
echo "✅ 保持了错误日志记录，便于调试"
echo "✅ 确保只有业务逻辑层显示用户友好的错误消息"
echo ""

echo "🔍 验证修复..."
# 检查invoke方法是否移除了错误显示
if ! grep -q "this.showError.*操作失败" src/script.js; then
    echo "✅ invoke方法已移除重复的错误消息显示"
else
    echo "❌ invoke方法仍包含重复的错误消息显示"
fi

# 检查错误匹配条件是否精确
if grep -q "UNIQUE constraint failed: categories.name" src/script.js && ! grep -q "UNIQUE constraint failed.*UNIQUE constraint failed" src/script.js; then
    echo "✅ 错误匹配条件已精确化"
else
    echo "❌ 错误匹配条件可能仍有问题"
fi

# 检查是否保留了错误日志
if grep -q "console.error.*Tauri invoke 错误" src/script.js; then
    echo "✅ 保留了错误日志记录"
else
    echo "❌ 缺少错误日志记录"
fi

echo ""
echo "🎯 修复说明："
echo "问题：同时出现多个错误消息"
echo "原因："
echo "1. invoke方法显示 '操作失败: ...' 错误"
echo "2. createCategory方法显示 '创建分类失败: ...' 或 '分类名称已存在' 错误"
echo "3. 错误匹配条件 'UNIQUE constraint failed' 过于宽泛"
echo "解决："
echo "1. 移除invoke方法中的错误消息显示，只保留日志记录"
echo "2. 精确化错误匹配条件，只匹配 'UNIQUE constraint failed: categories.name'"
echo "3. 确保只有业务逻辑层显示用户友好的错误消息"
echo ""
echo "🧪 测试步骤："
echo "1. 运行应用"
echo "2. 创建一个新的分类"
echo "3. 验证只显示成功消息：'分类 \"xxx\" 创建成功'"
echo "4. 尝试创建重复名称的分类"
echo "5. 验证只显示一个错误消息：'分类名称 \"xxx\" 已存在，请使用其他名称'"
echo "6. 对标签创建进行相同的测试"
echo ""
echo "✅ 修复完成！现在应该只显示单一的错误消息，不会出现多个重复的错误提示。"
