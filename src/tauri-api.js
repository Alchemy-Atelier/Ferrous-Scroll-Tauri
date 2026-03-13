// Tauri v2 API 包装器
console.log('🚀 加载 Tauri API 包装器...');

// 等待 Tauri 加载
const waitForTauri = () => {
  return new Promise((resolve) => {
    const checkTauri = () => {
      if (window.__TAURI_INTERNALS__ || window.__TAURI_IPC__ || window.__TAURI__) {
        console.log('✅ Tauri 已加载');
        resolve();
      } else {
        console.log('⏳ 等待 Tauri 加载...');
        setTimeout(checkTauri, 50);
      }
    };
    checkTauri();
  });
};

// 初始化 API
const initTauriAPI = async () => {
  await waitForTauri();
  
  // 确保 __TAURI__ 对象存在
  if (!window.__TAURI__) {
    window.__TAURI__ = {};
  }
  
  // 创建 invoke 方法
  window.__TAURI__.invoke = async function(cmd, args = {}) {
    console.log(`🔧 调用: ${cmd}`, args);
    
    try {
      // 方法1: __TAURI_INTERNALS__
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return await window.__TAURI_INTERNALS__.invoke(cmd, args);
      }
      // 方法2: __TAURI_IPC__
      else if (window.__TAURI_IPC__ && window.__TAURI_IPC__.invoke) {
        return await window.__TAURI_IPC__.invoke(cmd, args);
      }
      // 方法3: core API
      else if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
        return await window.__TAURI__.core.invoke(cmd, args);
      }
      else {
        throw new Error('Tauri API 不可用');
      }
    } catch (error) {
      console.error(`❌ ${cmd} 失败:`, error);
      throw error;
    }
  };
  
  // 创建 Dialog API
  window.__TAURI__.dialog = {
    confirm: async function(message, options = {}) {
      try {
        // 方法1: __TAURI_INTERNALS__
        if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.dialog && window.__TAURI_INTERNALS__.dialog.confirm) {
          return await window.__TAURI_INTERNALS__.dialog.confirm(message, options);
        }
        // 方法2: invoke
        else {
          return await window.__TAURI__.invoke('plugin:dialog|confirm', {
            message: message,
            title: options.title || '确认'
          });
        }
      } catch (error) {
        console.error('❌ dialog 失败:', error);
        return confirm(message);
      }
    }
  };
  
  console.log('✅ Tauri API 初始化完成');
};

// 立即初始化
initTauriAPI();
