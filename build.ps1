# 🦀 Ferrous Scroll - Windows 构建脚本
# 用法: .\build.ps1 [windows|dev|help]

param(
    [string]$Target = "help"
)

function Print-Usage {
    Write-Host "🦀 Ferrous Scroll 构建工具" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "用法: .\build.ps1 [平台]"
    Write-Host ""
    Write-Host "可用平台:" -ForegroundColor Yellow
    Write-Host "  windows    - 构建 Windows 安装包 (.msi/.exe)"
    Write-Host "  dev        - 启动开发模式"
    Write-Host "  help       - 显示此帮助信息"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\build.ps1 windows    # 构建 Windows 版本"
    Write-Host "  .\build.ps1 dev        # 启动开发模式"
}

function Build-Windows {
    Write-Host "🪟 构建 Windows 版本..." -ForegroundColor Green
    
    Set-Location src-tauri
    cargo tauri build
    Set-Location ..
    
    Write-Host ""
    Write-Host "✅ Windows 构建完成！" -ForegroundColor Green
    Write-Host "📂 输出位置:" -ForegroundColor Cyan
    Write-Host "  - src-tauri\target\release\bundle\msi\*.msi"
    Write-Host "  - src-tauri\target\release\bundle\nsis\*.exe"
}

function Start-Dev {
    Write-Host "🚀 启动开发模式..." -ForegroundColor Green
    Set-Location src-tauri
    cargo tauri dev
}

# 主逻辑
switch ($Target.ToLower()) {
    "windows" {
        Build-Windows
    }
    "dev" {
        Start-Dev
    }
    "help" {
        Print-Usage
    }
    default {
        Write-Host "❌ 未知平台: $Target" -ForegroundColor Red
        Write-Host ""
        Print-Usage
        exit 1
    }
}
