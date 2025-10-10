#!/bin/bash

# 🦀 Ferrous Scroll - 统一构建脚本
# 用法: ./build.sh [macos|windows|android|dev]

set -e

TARGET="${1:-help}"

print_usage() {
    echo "🦀 Ferrous Scroll 构建工具"
    echo ""
    echo "用法: ./build.sh [平台] [选项]"
    echo ""
    echo "可用平台:"
    echo "  macos      - 构建 macOS 应用包 (.app/.dmg)"
    echo "  macos-bin  - 只构建 macOS 可执行文件（不打包）"
    echo "  windows    - 构建 Windows 安装包 (.msi/.exe) [需要交叉编译环境]"
    echo "  android    - 构建 Android APK"
    echo "  dev        - 启动开发模式"
    echo "  help       - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./build.sh macos        # 构建 macOS 完整安装包"
    echo "  ./build.sh macos-bin    # 只构建可执行文件（快速）"
    echo "  ./build.sh dev          # 启动开发模式"
}

build_macos() {
    echo "🍎 构建 macOS 版本（完整打包）..."
    
    # 检查并安装必要的编译目标（universal binary 需要两个架构）
    local needs_install=false
    
    if ! rustup target list | grep -q "x86_64-apple-darwin (installed)"; then
        echo "⚠️  正在添加 x86_64-apple-darwin 编译目标..."
        rustup target add x86_64-apple-darwin
        needs_install=true
    fi
    
    if ! rustup target list | grep -q "aarch64-apple-darwin (installed)"; then
        echo "⚠️  正在添加 aarch64-apple-darwin 编译目标..."
        rustup target add aarch64-apple-darwin
        needs_install=true
    fi
    
    if [ "$needs_install" = true ]; then
        echo "✅ 编译目标安装完成"
        echo ""
    fi
    
    cd src-tauri
    
    # 尝试构建 universal binary（会自动打包成 .app 和 .dmg）
    echo "📦 构建 universal binary (Intel + Apple Silicon)..."
    if cargo tauri build --target universal-apple-darwin; then
        cd ..
        echo ""
        echo "✅ macOS Universal 构建完成！"
        echo "📂 输出位置:"
        echo "  - src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg"
        echo "  - src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app"
    else
        echo ""
        echo "⚠️  Universal binary 构建失败，尝试构建当前架构..."
        
        # 检测当前架构
        ARCH=$(uname -m)
        if [ "$ARCH" = "arm64" ]; then
            TARGET_ARCH="aarch64-apple-darwin"
        else
            TARGET_ARCH="x86_64-apple-darwin"
        fi
        
        cargo tauri build --target $TARGET_ARCH
        cd ..
        echo ""
        echo "✅ macOS ($TARGET_ARCH) 构建完成！"
        echo "📂 输出位置:"
        echo "  - src-tauri/target/$TARGET_ARCH/release/bundle/dmg/*.dmg"
        echo "  - src-tauri/target/$TARGET_ARCH/release/bundle/macos/*.app"
    fi
}

build_macos_bin() {
    echo "🍎 构建 macOS 可执行文件（不打包）..."
    
    cd src-tauri
    
    # 只构建可执行文件，不打包
    echo "📦 构建当前架构的可执行文件..."
    cargo build --release
    
    cd ..
    echo ""
    echo "✅ macOS 可执行文件构建完成！"
    echo "📂 输出位置:"
    echo "  - src-tauri/target/release/ferrous-scroll"
    echo ""
    echo "💡 运行命令:"
    echo "  ./src-tauri/target/release/ferrous-scroll"
}

build_windows() {
    echo "🪟 构建 Windows 版本..."
    
    # 检查是否安装了 Windows 目标
    if ! rustup target list | grep -q "x86_64-pc-windows-msvc (installed)"; then
        echo "⚠️  正在添加 Windows 编译目标..."
        rustup target add x86_64-pc-windows-msvc
    fi
    
    cd src-tauri
    cargo tauri build --target x86_64-pc-windows-msvc
    cd ..
    echo ""
    echo "✅ Windows 构建完成！"
    echo "📂 输出位置:"
    echo "  - src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi"
    echo "  - src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe"
}

build_android() {
    echo "📱 构建 Android 版本..."
    
    # 检查 Android 环境
    if ! command -v adb &> /dev/null; then
        echo "❌ 未找到 Android SDK，请先安装 Android Studio"
        exit 1
    fi
    
    cd src-tauri
    
    # 检查是否已初始化 Android 项目
    if [ ! -d "gen/android" ]; then
        echo "⚠️  首次构建需要初始化 Android 项目..."
        cargo tauri android init
    fi
    
    cargo tauri android build
    cd ..
    echo ""
    echo "✅ Android 构建完成！"
    echo "📂 输出位置:"
    echo "  - src-tauri/gen/android/app/build/outputs/apk/release/*.apk"
}

start_dev() {
    echo "🚀 启动开发模式..."
    cd src-tauri
    cargo tauri dev
}

# 主逻辑
case "$TARGET" in
    macos)
        build_macos
        ;;
    macos-bin)
        build_macos_bin
        ;;
    windows)
        build_windows
        ;;
    android)
        build_android
        ;;
    dev)
        start_dev
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        echo "❌ 未知平台: $TARGET"
        echo ""
        print_usage
        exit 1
        ;;
esac