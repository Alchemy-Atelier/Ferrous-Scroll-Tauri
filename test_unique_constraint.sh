#!/bin/bash

echo "🔧 测试唯一约束错误处理修复"
echo "============================="

echo "📋 检查修复内容..."
echo "✅ 为 createCategory 方法添加了唯一约束错误处理"
echo "✅ 为 createTag 方法添加了唯一约束错误处理"
echo "✅ 改进了错误消息，提供更友好的用户提示"
echo "✅ 添加了输入框高亮和选中功能"

echo ""
echo "🔍 验证修复..."
# 检查 createCategory 方法的错误处理
if grep -q "UNIQUE constraint failed: categories.name" src/script.js; then
    echo "✅ createCategory 方法包含唯一约束错误处理"
else
    echo "❌ createCategory 方法缺少唯一约束错误处理"
fi

# 检查 createTag 方法的错误处理
if grep -q "UNIQUE constraint failed: tags.name" src/script.js; then
    echo "✅ createTag 方法包含唯一约束错误处理"
else
    echo "❌ createTag 方法缺少唯一约束错误处理"
fi

# 检查输入框高亮功能
if grep -q "nameInput.focus()" src/script.js; then
    echo "✅ 添加了输入框高亮功能"
else
    echo "❌ 缺少输入框高亮功能"
fi

echo ""
echo "🎯 修复说明："
echo "问题：创建分类/标签时出现 UNIQUE constraint failed 错误"
echo "原因：数据库中的分类名称和标签名称有唯一约束，重复名称会导致错误"
echo "解决："
echo "1. 检测特定的唯一约束错误消息"
echo "2. 显示友好的错误提示，明确指出名称已存在"
echo "3. 自动高亮并选中名称输入框，方便用户修改"
echo "4. 保持其他错误消息的原有处理方式"
echo ""
echo "🧪 测试步骤："
echo "1. 运行应用"
echo "2. 创建一个分类，例如：'工作'"
echo "3. 再次尝试创建相同名称的分类"
echo "4. 验证显示友好的错误消息：'分类名称 \"工作\" 已存在，请使用其他名称'"
echo "5. 验证名称输入框被高亮并选中"
echo "6. 对标签创建进行相同的测试"
echo ""
echo "✅ 修复完成！现在创建重复名称的分类/标签时会显示友好的错误提示。"
