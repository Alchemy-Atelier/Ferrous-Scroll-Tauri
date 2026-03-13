// Ferrous Scroll - 现代化 Todo List 应用 (Tauri 版本)

class TodoApp {
    constructor() {
        this.todos = [];
        this.tags = [];
        this.categories = [];
        this.selectedTags = [];
        this.selectedCategoryTags = [];
        this.editingCategoryId = null;
        this.isEditingCategory = false;
        this.currentFilter = { status: 'all', priority: 'all', category: 'all', search: '' };
        this.currentPage = 'main'; // 添加当前页面跟踪
        this.selectedTodoIds = new Set(); // 跟踪选中的任务ID
        this.init();
    }

    // Tauri invoke 辅助函数
    async invoke(command, args = {}) {
        console.log(`🔧 准备调用命令: ${command}`, args);
        
        // 检查 Tauri API 是否可用
        if (!window.__TAURI__ || !window.__TAURI__.invoke) {
            const error = 'Tauri API 未加载，请确保在 Tauri 环境中运行应用';
            console.error(error);
            this.showError(error);
            throw new Error(error);
        }
        
        try {
            const result = await window.__TAURI__.invoke(command, args);
            console.log(`✅ 命令 ${command} 执行成功:`, result);
            return result;
        } catch (error) {
            console.error(`❌ Tauri invoke 错误 [${command}]:`, error);
            throw new Error(error);
        }
    }

    // 等待 Tauri API 加载
    async waitForTauri() {
        let attempts = 0;
        const maxAttempts = 100; // 最多等待10秒
        
        while (attempts < maxAttempts) {
            if (window.__TAURI__ && window.__TAURI__.invoke) {
                console.log('✅ Tauri API 已加载');
                return true;
            }
            
            console.log(`⏳ 等待 Tauri API 加载... (${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.error('❌ Tauri API 加载超时');
        throw new Error('Tauri API 加载超时，请刷新页面重试');
    }

    // 初始化应用
    async init() {
        console.log('🚀 初始化应用...');
        
        // 检查 Tauri API 是否可用
        if (!window.__TAURI__ || !window.__TAURI__.invoke) {
            console.warn('⚠️ Tauri API 尚未加载，将在稍后重试');
            // 延迟重试
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        console.log('✅ Tauri API 已可用，继续初始化');

        this.bindEvents();
        await Promise.all([
            this.loadTodos(),
            this.loadTags(),
            this.loadCategories()
        ]);
        this.renderTodos();
        this.updateStats();
        this.restoreCollapseState();
        this.renderCategoryFilter();
        console.log('🚀 Ferrous Scroll 已启动');
    }

    // 绑定事件监听器
    bindEvents() {
        // 表单提交
        const form = document.getElementById('todo-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTodo();
        });

        // 绑定所有按钮事件
        this.bindButtonEvents();

        // 筛选器
        const statusFilter = document.getElementById('status-filter');
        const priorityFilter = document.getElementById('priority-filter');
        const categoryFilter = document.getElementById('category-filter');
        const searchInput = document.getElementById('search-input');
        
        statusFilter.addEventListener('change', (e) => {
            this.currentFilter.status = e.target.value;
            this.renderTodos();
        });
        
        priorityFilter.addEventListener('change', (e) => {
            this.currentFilter.priority = e.target.value;
            this.renderTodos();
        });

        categoryFilter.addEventListener('change', (e) => {
            this.currentFilter.category = e.target.value;
            this.renderTodos();
        });

        // 搜索输入 - 使用防抖
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentFilter.search = e.target.value.trim();
                this.renderTodos();
            }, 300);
        });

        // 事件委托：处理动态生成的按钮
        document.addEventListener('click', (e) => {
            // 删除待办事项
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.preventDefault();
                const todoId = deleteBtn.dataset.todoId;
                console.log('🔘 点击删除按钮，待办事项 ID:', todoId);
                console.log('🔘 todoId 类型:', typeof todoId);
                console.log('🔘 deleteBtn.dataset:', deleteBtn.dataset);
                
                if (todoId) {
                    console.log('🔘 准备调用 deleteTodo...');
                    try {
                        this.deleteTodo(todoId);
                        console.log('🔘 deleteTodo 调用完成');
                    } catch (err) {
                        console.error('🔘 调用 deleteTodo 时出错:', err);
                    }
                } else {
                    console.error('🔘 todoId 为空！');
                }
                return;
            }

            // 切换任务收缩状态
            const collapseBtn = e.target.closest('.collapse-todo-btn');
            if (collapseBtn) {
                e.preventDefault();
                const todoId = collapseBtn.dataset.todoId;
                if (todoId) {
                    this.toggleTodoCollapse(todoId);
                }
                return;
            }

            // 收缩标题点击
            const collapsedTitle = e.target.closest('.scroll-title-collapsed');
            if (collapsedTitle) {
                e.preventDefault();
                const todoId = collapsedTitle.dataset.todoId;
                if (todoId) {
                    this.toggleTodoCollapse(todoId);
                }
                return;
            }

            // 添加子任务按钮
            const addSubtaskBtn = e.target.closest('.add-subtask-btn');
            if (addSubtaskBtn) {
                e.preventDefault();
                const todoId = addSubtaskBtn.dataset.todoId;
                if (todoId) {
                    this.toggleSubtaskForm(todoId);
                }
                return;
            }

            // 状态按钮
            const statusBtn = e.target.closest('.status-btn');
            if (statusBtn) {
                e.preventDefault();
                const todoId = statusBtn.dataset.todoId;
                const status = statusBtn.dataset.status;
                if (todoId && status) {
                    this.updateTodoStatus(todoId, status);
                }
                return;
            }

            // 导出单个任务按钮
            const exportTodoBtn = e.target.closest('.export-todo-btn');
            if (exportTodoBtn) {
                e.preventDefault();
                const todoId = exportTodoBtn.dataset.todoId;
                if (todoId) {
                    this.exportSingleTodo(todoId);
                }
                return;
            }

            // 删除子任务
            const subtaskDeleteBtn = e.target.closest('.subtask-delete-btn');
            if (subtaskDeleteBtn) {
                e.preventDefault();
                const subtaskId = subtaskDeleteBtn.dataset.subtaskId;
                if (subtaskId) {
                    console.log('🔘 点击删除按钮，子任务 ID:', subtaskId);
                    this.deleteSubtask(subtaskId);
                }
                return;
            }

            // 切换待办事项状态
            const statusCheckbox = e.target.closest('.todo-checkbox');
            if (statusCheckbox && !statusCheckbox.disabled) {
                const todoId = statusCheckbox.dataset.todoId;
                if (todoId) {
                    console.log('🔘 切换待办事项状态，ID:', todoId);
                    this.toggleTodoStatus(todoId);
                }
                return;
            }

            // 切换子任务状态
            const subtaskCheckbox = e.target.closest('.subtask-checkbox');
            if (subtaskCheckbox && !subtaskCheckbox.disabled) {
                const subtaskId = subtaskCheckbox.dataset.subtaskId;
                if (subtaskId) {
                    console.log('🔘 切换子任务状态，ID:', subtaskId);
                    this.toggleSubtaskStatus(subtaskId);
                }
                return;
            }

            // 删除标签
            const deleteTagBtn = e.target.closest('.delete-tag-btn');
            if (deleteTagBtn) {
                e.preventDefault();
                const tagId = deleteTagBtn.dataset.tagId;
                if (tagId) {
                    console.log('🔘 点击删除标签按钮，ID:', tagId);
                    this.deleteTag(tagId);
                }
                return;
            }

            // 删除分类
            const deleteCategoryBtn = e.target.closest('.delete-btn-small');
            if (deleteCategoryBtn) {
                e.preventDefault();
                const categoryId = deleteCategoryBtn.dataset.categoryId;
                if (categoryId) {
                    console.log('🔘 点击删除分类按钮，ID:', categoryId);
                    this.deleteCategory(categoryId);
                }
                return;
            }

            // 分类编辑按钮
            const editCategoryBtn = e.target.closest('.edit-btn-small');
            if (editCategoryBtn) {
                e.preventDefault();
                const categoryId = editCategoryBtn.dataset.categoryId;
                const action = editCategoryBtn.dataset.action;
                if (categoryId && action === 'edit') {
                    this.editCategory(categoryId);
                } else if (categoryId && action === 'edit-tags') {
                    this.editCategoryTags(categoryId);
                }
                return;
            }

            // 分类标签选择器中的标签项
            const categoryTagSelectorItem = e.target.closest('.category-tag-selector-item');
            if (categoryTagSelectorItem) {
                e.preventDefault();
                const tagId = categoryTagSelectorItem.dataset.tagId;
                if (tagId) {
                    this.toggleCategoryTagSelection(tagId);
                }
                return;
            }

            // 已选分类标签的删除按钮
            const categoryTagRemoveBtn = e.target.closest('.selected-tag .fa-times');
            if (categoryTagRemoveBtn && categoryTagRemoveBtn.dataset.categoryTagId) {
                e.preventDefault();
                const tagId = categoryTagRemoveBtn.dataset.categoryTagId;
                if (tagId) {
                    this.toggleCategoryTagSelection(tagId);
                }
                return;
            }

            // 模态框按钮
            const modalBtn = e.target.closest('[data-action]');
            if (modalBtn) {
                e.preventDefault();
                const action = modalBtn.dataset.action;
                if (action === 'close-modal') {
                    modalBtn.closest('.modal').remove();
                } else if (action === 'save-category') {
                    const categoryId = modalBtn.dataset.categoryId;
                    if (categoryId) {
                        this.saveCategoryInfo(categoryId);
                    }
                }
                return;
            }

            // 设置按钮
            if (e.target.closest('.settings-icon-btn')) {
                e.preventDefault();
                this.toggleSettingsMenu();
                return;
            }

            // 页面切换按钮
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) {
                e.preventDefault();
                const page = tabBtn.textContent.includes('任务卷轴') ? 'main' :
                            tabBtn.textContent.includes('标签管理') ? 'tags' :
                            tabBtn.textContent.includes('分类管理') ? 'categories' :
                            tabBtn.textContent.includes('导出选项') ? 'export' : '';
                if (page) this.switchPage(page);
                return;
            }

            // 保存设置按钮
            if (e.target.closest('.settings-save-btn')) {
                e.preventDefault();
                this.saveSettingsFromMenu();
                return;
            }

            // 重置设置按钮
            if (e.target.closest('.settings-reset-btn')) {
                e.preventDefault();
                this.resetSettings();
                return;
            }

            // 标签选择器按钮
            if (e.target.closest('.tag-selector-btn')) {
                e.preventDefault();
                this.openTagSelector();
                return;
            }

            // 分类标签选择器按钮
            const categoryTagSelector = e.target.closest('.category-tag-selector-btn');
            if (categoryTagSelector) {
                e.preventDefault();
                this.openCategoryTagSelector();
                return;
            }

            // 筛选面板折叠
            if (e.target.closest('.filter-header')) {
                e.preventDefault();
                this.toggleFilterPanel();
                return;
            }

            // 全选按钮
            if (e.target.closest('.select-all-btn')) {
                e.preventDefault();
                this.toggleSelectAll();
                return;
            }

            // 批量完成按钮
            if (e.target.closest('.batch-complete-btn')) {
                e.preventDefault();
                this.batchComplete();
                return;
            }

            // 批量删除按钮
            if (e.target.closest('.batch-delete-btn')) {
                e.preventDefault();
                this.batchDelete();
                return;
            }

            // 标签选择器中的标签项
            const tagSelectorItem = e.target.closest('.tag-selector-item');
            if (tagSelectorItem) {
                e.preventDefault();
                const tagId = tagSelectorItem.dataset.tagId;
                if (tagId) {
                    this.toggleTagSelection(tagId);
                }
                return;
            }

            // 已选标签的删除按钮
            const tagRemoveBtn = e.target.closest('.selected-tag .fa-times');
            if (tagRemoveBtn) {
                e.preventDefault();
                const tagId = tagRemoveBtn.dataset.tagId;
                if (tagId) {
                    this.toggleTagSelection(tagId);
                }
                return;
            }

            // 创建标签按钮 - 检查是否在标签管理页面
            const createTagBtn = e.target.closest('button');
            if (createTagBtn && createTagBtn.textContent.includes('创建标签')) {
                e.preventDefault();
                this.createTag();
                return;
            }

            // 创建分类按钮
            if (createTagBtn && createTagBtn.textContent.includes('创建分类')) {
                e.preventDefault();
                this.createCategory();
                return;
            }

            // 标签选择器弹窗中的按钮
            if (e.target.closest('.close-btn')) {
                e.preventDefault();
                this.closeTagSelector();
                return;
            }

            // 保存分类标签按钮
            if (e.target.closest('#save-category-tags-btn')) {
                e.preventDefault();
                this.saveCategoryTags();
                return;
            }

            // 标签选择器确定按钮
            if (e.target.closest('.btn-secondary') && e.target.closest('#tag-selector-modal')) {
                e.preventDefault();
                this.closeTagSelector();
                return;
            }

            // 标签选择器中的标签项
            if (e.target.closest('.tag-selector-item')) {
                e.preventDefault();
                const tagItem = e.target.closest('.tag-selector-item');
                const tagId = tagItem.getAttribute('data-tag-id');
                if (tagId) {
                    this.toggleCategoryTagSelection(tagId);
                }
                return;
            }

            // 消息提示关闭按钮
            if (e.target.closest('.notification-close-btn')) {
                e.preventDefault();
                const notification = e.target.closest('.error-message, .success-message, .warning-message');
                if (notification) {
                    notification.remove();
                    this.repositionMessages();
                }
                return;
            }

            // 导出按钮
            const exportBtn = e.target.closest('.export-btn-primary, .quick-export-btn');
            if (exportBtn) {
                e.preventDefault();
                const btnText = exportBtn.textContent;
                if (btnText.includes('导出全部')) {
                    this.exportToMarkdown();
                } else if (btnText.includes('按周导出')) {
                    this.exportByWeek();
                } else if (btnText.includes('按日期范围')) {
                    this.exportByDateRange();
                } else if (btnText.includes('导出今日')) {
                    this.exportToday();
                }
                return;
            }
        });
    }

    // 显示加载状态
    showLoading(show = true) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'block' : 'none';
    }

    // 计算消息的top位置（阶梯式排列）
    getMessageTopPosition() {
        const existingMessages = document.querySelectorAll('.error-message, .success-message, .warning-message');
        let topPosition = 20;
        existingMessages.forEach(msg => {
            if (msg.parentElement) {
                topPosition += msg.offsetHeight + 10; // 每个消息间隔10px
            }
        });
        return topPosition;
    }

    // 显示错误消息
    showError(message) {
        // 创建错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
            <button class="notification-close-btn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const topPosition = this.getMessageTopPosition();
        
        // 添加错误样式
        errorDiv.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            right: 20px;
            background: #fee2e2;
            color: #dc2626;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #fecaca;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            transition: top 0.3s ease;
        `;
        
        document.body.appendChild(errorDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
                this.repositionMessages();
            }
        }, 3000);
    }

    // 重新定位所有消息（消息消失后重新排列）
    repositionMessages() {
        const messages = document.querySelectorAll('.error-message, .success-message, .warning-message');
        let topPosition = 20;
        messages.forEach(msg => {
            msg.style.top = `${topPosition}px`;
            topPosition += msg.offsetHeight + 10;
        });
    }

    // 显示成功消息
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        
        const topPosition = this.getMessageTopPosition();
        
        successDiv.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            right: 20px;
            background: #d1fae5;
            color: #065f46;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #a7f3d0;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            transition: top 0.3s ease;
        `;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
                this.repositionMessages();
            }
        }, 2000);
    }

    // 显示警告消息
    showWarning(message) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-message';
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button class="notification-close-btn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const topPosition = this.getMessageTopPosition();
        
        warningDiv.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            right: 20px;
            background: #fef3c7;
            color: #92400e;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #fde68a;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            transition: top 0.3s ease;
        `;
        
        document.body.appendChild(warningDiv);
        
        setTimeout(() => {
            if (warningDiv.parentElement) {
                warningDiv.remove();
                this.repositionMessages();
            }
        }, 2500);
    }

    // 显示确认对话框 (使用 Tauri Dialog API)
    async showConfirm(title, message) {
        try {
            console.log(`🔧 显示确认对话框: ${title} - ${message}`);
            
            // 尝试使用 Tauri v2 的 Dialog API
            if (window.__TAURI__ && window.__TAURI__.dialog && window.__TAURI__.dialog.confirm) {
                console.log('✅ 使用 Tauri Dialog API');
                const result = await window.__TAURI__.dialog.confirm(message, { title: title });
                console.log('✅ 确认对话框结果:', result);
                return result;
            }
            // 备用方案：使用浏览器原生 confirm
            else {
                console.warn('⚠️ Tauri Dialog API 不可用，使用浏览器原生 confirm');
                return confirm(message);
            }
        } catch (error) {
            console.error('❌ Dialog API 调用失败:', error);
            // 备用方案：使用浏览器原生 confirm
            console.warn('⚠️ 使用浏览器原生 confirm 作为备用方案');
            return confirm(message);
        }
    }

    // 从后端加载所有 todos
    async loadTodos() {
        try {
            this.showLoading(true);
            this.todos = await this.invoke('get_all_todos');
            console.log(`📋 加载了 ${this.todos.length} 个待办事项`);
            
        } catch (error) {
            console.error('加载失败:', error);
            this.showError('加载待办事项失败：' + error.message);
            this.todos = [];
        } finally {
            this.showLoading(false);
        }
    }

    // 添加新的待办事项
    async addTodo() {
        const titleInput = document.getElementById('new-todo');
        const descriptionInput = document.getElementById('description');
        const prioritySelect = document.getElementById('priority-select');
        const dueDateInput = document.getElementById('due-date');
        
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();
        const priority = prioritySelect.value;
        const dueDate = dueDateInput.value;
        
        if (!title) {
            this.showError('请输入待办事项标题');
            titleInput.focus();
            return;
        }

        try {
            this.showLoading(true);
            const newTodo = await this.invoke('create_todo', {
                title: title,
                description: description || null,
                priority: priority,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                tagIds: this.selectedTags
            });

            this.todos.unshift(newTodo); // 添加到开头
            
            // 清空表单
            titleInput.value = '';
            descriptionInput.value = '';
            prioritySelect.value = 'Medium';
            dueDateInput.value = '';
            this.selectedTags = [];
            this.renderSelectedTags();
            titleInput.focus();
            
            this.renderTodos();
            this.updateStats();
            this.showSuccess('✨ 待办事项添加成功！');
            
            console.log('✅ 添加待办事项:', newTodo.title);
            
        } catch (error) {
            console.error('添加失败:', error);
            this.showError('添加待办事项失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 显示/隐藏子任务添加表单
    toggleSubtaskForm(parentId) {
        const existingForm = document.getElementById(`subtask-form-${parentId}`);
        if (existingForm) {
            existingForm.remove();
            
            // 检查是否需要重新隐藏容器
            const subtasksContainer = document.querySelector(`[data-id="${parentId}"] .subtasks-container`);
            if (subtasksContainer && subtasksContainer.classList.contains('has-form')) {
                const hasSubtaskList = subtasksContainer.querySelector('.subtasks-list');
                if (!hasSubtaskList) {
                    subtasksContainer.classList.remove('has-form');
                    subtasksContainer.classList.add('no-subtasks');
                }
            }
            return;
        }

        // 关闭其他打开的表单
        document.querySelectorAll('.subtask-form-container').forEach(form => form.remove());

        // 创建表单容器
        const subtasksContainer = document.querySelector(`[data-id="${parentId}"] .subtasks-container`);
        if (!subtasksContainer) return;
        
        // 如果容器是隐藏的（没有子任务），先显示它
        if (subtasksContainer.classList.contains('no-subtasks')) {
            subtasksContainer.classList.remove('no-subtasks');
            subtasksContainer.classList.add('has-form');
        }

        // 创建一个简洁的内联表单
        const formHtml = `
            <div id="subtask-form-${parentId}" class="subtask-form-container">
                <div class="subtask-quick-add">
                    <input type="text" 
                           id="subtask-title-${parentId}" 
                           class="subtask-quick-input" 
                           placeholder="按 Enter 添加子任务，Esc 取消" 
                           autofocus>
                    <button class="subtask-quick-btn" data-parent-id="${parentId}" title="添加">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        `;

        subtasksContainer.insertAdjacentHTML('beforeend', formHtml);

        // 为动态生成的按钮添加事件监听器
        const addBtn = document.querySelector(`[data-parent-id="${parentId}"]`);
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addSubtask(parentId));
        }

        // 聚焦到输入框
        const titleInput = document.getElementById(`subtask-title-${parentId}`);
        titleInput.focus();

        // Enter 键提交
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                e.preventDefault();
                this.addSubtask(parentId);
            }
        });

        // Esc 键取消
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleSubtaskForm(parentId);
            }
        });

        // 点击外部关闭
        setTimeout(() => {
            const clickOutside = (e) => {
                const form = document.getElementById(`subtask-form-${parentId}`);
                if (form && !form.contains(e.target) && !e.target.closest('.add-subtask-btn')) {
                    this.toggleSubtaskForm(parentId);
                    document.removeEventListener('click', clickOutside);
                }
            };
            document.addEventListener('click', clickOutside);
        }, 100);
    }

    // 添加子任务
    async addSubtask(parentId) {
        const titleInput = document.getElementById(`subtask-title-${parentId}`);
        if (!titleInput) return;
        
        const title = titleInput.value.trim();

        if (!title) {
            titleInput.focus();
            titleInput.classList.add('error');
            setTimeout(() => titleInput.classList.remove('error'), 2000);
            return;
        }

        try {
            this.showLoading(true);
            await this.invoke('create_subtask', {
                parentId: parentId,
                title: title,
                description: null
            });

            // 关闭表单
            this.toggleSubtaskForm(parentId);

            // 重新加载todos来获取最新的子任务
            await this.loadTodos();
            this.renderTodos();
            this.updateStats();
            this.showSuccess('✨ 子任务添加成功！');

        } catch (error) {
            console.error('添加子任务失败:', error);
            this.showError('添加子任务失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 删除子任务
    async deleteSubtask(subtaskId) {
        // 使用 Tauri Dialog API 显示确认对话框
        const confirmed = await this.showConfirm('删除子任务', '确定要删除这个子任务吗？');
        if (!confirmed) {
            console.log('📍 用户取消了删除子任务');
            return;
        }
        
        console.log('📍 准备删除子任务，ID:', subtaskId);

        try {
            console.log('🗑️ 删除子任务，ID:', subtaskId);
            this.showLoading(true);
            const result = await this.invoke('delete_subtask', { id: subtaskId });
            console.log('删除子任务结果:', result);

            // 重新加载todos
            await this.loadTodos();
            this.renderTodos();
            this.updateStats();
            this.showSuccess('🗑️ 子任务已删除');

        } catch (error) {
            console.error('❌ 删除子任务失败:', error);
            this.showError('删除子任务失败：' + (error.message || JSON.stringify(error)));
        } finally {
            this.showLoading(false);
        }
    }

    // 更新子任务状态
    async toggleSubtaskStatus(subtaskId, currentStatus) {
        const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';

        try {
            this.showLoading(true);
            await this.invoke('update_subtask', {
                id: subtaskId,
                title: null,
                description: null,
                status: newStatus
            });

            // 重新加载todos
            await this.loadTodos();
            this.renderTodos();
            this.updateStats();

        } catch (error) {
            console.error('更新子任务状态失败:', error);
            this.showError('更新子任务状态失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 删除待办事项
    async deleteTodo(id) {
        console.log('📍 deleteTodo 被调用，ID:', id);
        
        const todo = this.todos.find(t => t.id === id);
        
        if (!todo) {
            console.error('❌ 找不到指定的 todo，ID:', id);
            this.showError('找不到要删除的任务');
            return;
        }
        
        // 使用 Tauri Dialog API 显示确认对话框
        let message = `确定要删除 "${todo.title}" 吗？`;
        if (todo.subtasks && todo.subtasks.length > 0) {
            message += `\n\n这将同时删除 ${todo.subtasks.length} 个子任务。`;
        }
        
        const confirmed = await this.showConfirm('删除待办事项', message);
        if (!confirmed) {
            console.log('📍 用户取消了删除');
            return;
        }
        
        console.log('📍 用户确认删除，继续执行...');

        try {
            console.log('🗑️ 删除待办事项，ID:', id, '标题:', todo.title);
            this.showLoading(true);
            const result = await this.invoke('delete_todo', { id: id });
            console.log('删除待办事项结果:', result);

            this.todos = this.todos.filter(t => t.id !== id);
            this.renderTodos();
            this.updateStats();
            this.showSuccess('🗑️ 待办事项已删除');
            
            console.log('✅ 成功删除待办事项:', todo.title);
            
        } catch (error) {
            console.error('❌ 删除失败:', error);
            console.error('错误详情:', JSON.stringify(error));
            this.showError('删除待办事项失败：' + (error.message || JSON.stringify(error)));
        } finally {
            this.showLoading(false);
        }
    }

    // 切换完成状态
    async toggleTodoStatus(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;
        
        const newStatus = todo.status === 'Completed' ? 'Pending' : 'Completed';
        
        try {
            this.showLoading(true);
            const updatedTodo = await this.invoke('update_todo_status', {
                id: id,
                status: newStatus
            });

            if (updatedTodo) {
                const index = this.todos.findIndex(t => t.id === id);
                this.todos[index] = updatedTodo;
            }
            
            this.renderTodos();
            this.updateStats();
            
            const statusText = newStatus === 'Completed' ? '完成' : '未完成';
            console.log(`🔄 更新状态: ${todo.title} -> ${statusText}`);
            
        } catch (error) {
            console.error('更新状态失败:', error);
            this.showError('更新状态失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 更新待办事项状态（进行中等）
    async updateTodoStatus(id, status) {
        try {
            this.showLoading(true);
            const updatedTodo = await this.invoke('update_todo_status', {
                id: id,
                status: status
            });

            if (updatedTodo) {
                const index = this.todos.findIndex(t => t.id === id);
                this.todos[index] = updatedTodo;
            }
            
            this.renderTodos();
            this.updateStats();
            
            const statusMap = {
                'Pending': '待处理',
                'InProgress': '进行中',
                'Completed': '已完成'
            };
            this.showSuccess(`状态已更新为：${statusMap[status]}`);
            
        } catch (error) {
            console.error('更新状态失败:', error);
            this.showError('更新状态失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 过滤待办事项
    filterTodos() {
        return this.todos.filter(todo => {
            // 状态筛选
            const statusMatch = this.currentFilter.status === 'all' || 
                               todo.status === this.currentFilter.status;
            
            // 优先级筛选
            const priorityMatch = this.currentFilter.priority === 'all' || 
                                 todo.priority === this.currentFilter.priority;
            
            // 分类筛选（基于标签）
            let categoryMatch = true;
            if (this.currentFilter.category !== 'all') {
                const category = this.categories.find(c => c.id === this.currentFilter.category);
                if (category) {
                    const categoryTagIds = category.tags.map(t => t.id);
                    categoryMatch = todo.tag_ids && todo.tag_ids.some(tagId => categoryTagIds.includes(tagId));
                } else {
                    categoryMatch = false;
                }
            }
            
            // 搜索筛选
            let searchMatch = true;
            if (this.currentFilter.search) {
                const searchLower = this.currentFilter.search.toLowerCase();
                searchMatch = todo.title.toLowerCase().includes(searchLower) ||
                            (todo.description && todo.description.toLowerCase().includes(searchLower));
            }
            
            return statusMatch && priorityMatch && categoryMatch && searchMatch;
        });
    }

    // 渲染子任务列表
    renderSubtasks(subtasks, parentId) {
        const hasSubtasks = subtasks && subtasks.length > 0;
        
        // 始终返回容器，但没有子任务时样式不同
        return `
            <div class="subtasks-container ${!hasSubtasks ? 'no-subtasks' : ''}">
                ${hasSubtasks ? `
                    <div class="subtasks-header">
                        <span class="subtasks-title">子任务 (${subtasks.length})</span>
                    </div>
                    <div class="subtasks-list">
                        ${subtasks.map(subtask => {
                            const isCompleted = subtask.status === 'Completed';
                            return `
                                <div class="subtask-item ${isCompleted ? 'completed' : ''}">
                                    <input type="checkbox" 
                                           class="subtask-checkbox" 
                                           data-subtask-id="${subtask.id}"
                                           ${isCompleted ? 'checked' : ''}>
                                    <span class="subtask-text">${this.escapeHtml(subtask.title)}</span>
                                    ${subtask.description ? `<span class="subtask-description">${this.escapeHtml(subtask.description)}</span>` : ''}
                                    <button class="subtask-delete-btn" data-subtask-id="${subtask.id}" title="删除子任务">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 渲染待办事项列表
    renderTodos() {
        const todoList = document.getElementById('todo-list');
        const filteredTodos = this.filterTodos();
        
        if (filteredTodos.length === 0) {
            todoList.innerHTML = '';
            return;
        }

        todoList.innerHTML = filteredTodos.map(todo => {
            const isCompleted = todo.status === 'Completed';
            const createdAt = new Date(todo.created_at).toLocaleString('zh-CN');
            const dueDate = todo.due_date ? new Date(todo.due_date).toLocaleDateString('zh-CN') : null;
            
            // 优先级样式
            const priorityClass = `priority-${todo.priority.toLowerCase()}`;
            const priorityText = {
                'High': '高',
                'Medium': '中', 
                'Low': '低'
            }[todo.priority];
            
            // 状态样式
            const statusClass = `status-${todo.status.toLowerCase().replace('inprogress', 'inprogress')}`;
            const statusText = {
                'Pending': '待处理',
                'InProgress': '进行中',
                'Completed': '已完成'
            }[todo.status];

            // 子任务统计
            const subtaskStats = todo.subtasks ? {
                total: todo.subtasks.length,
                completed: todo.subtasks.filter(s => s.status === 'Completed').length
            } : { total: 0, completed: 0 };
            
            return `
                <div class="scroll-item ${isCompleted ? 'completed' : ''}" data-id="${todo.id}">
                    <div class="scroll-left"></div>
                    <div class="scroll-content">
                        <!-- 收缩后的标题显示 -->
                        <div class="scroll-title-collapsed" data-todo-id="${todo.id}">
                            <span class="collapsed-title">${this.escapeHtml(todo.title)}</span>
                            ${subtaskStats.total > 0 ? `<span class="subtask-indicator">(${subtaskStats.completed}/${subtaskStats.total})</span>` : ''}
                            <span class="priority-indicator priority-${todo.priority.toLowerCase()}"></span>
                            <i class="fas fa-chevron-down collapse-icon"></i>
                        </div>
                        
                        <!-- 完整内容 -->
                        <div class="todo-content">
                            <div class="todo-header-full">
                                <div class="todo-header">
                                    <input type="checkbox" 
                                           class="todo-checkbox" 
                                           data-todo-id="${todo.id}"
                                           ${isCompleted ? 'checked' : ''}>
                                    <span class="todo-text">${this.escapeHtml(todo.title)}</span>
                                    <button class="collapse-todo-btn" data-todo-id="${todo.id}" title="收缩任务">
                                        <i class="fas fa-chevron-up"></i>
                                    </button>
                                </div>
                                ${todo.description ? `<div class="todo-description">${this.escapeHtml(todo.description)}</div>` : ''}
                                
                                <!-- 标签显示 -->
                                ${todo.tags && todo.tags.length > 0 ? `
                                    <div class="todo-tags">
                                        ${todo.tags.map(tag => `
                                            <span class="todo-tag" style="background: ${tag.color}15; border-color: ${tag.color}; color: ${tag.color}">
                                                <span class="tag-dot" style="background: ${tag.color}"></span>
                                                ${tag.name}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>

                            <!-- 子任务部分 -->
                            ${this.renderSubtasks(todo.subtasks, todo.id)}

                            <div class="todo-meta">
                                <span class="priority-badge ${priorityClass}">
                                    ${priorityText}优先级
                                </span>
                                <span class="status-badge ${statusClass}">
                                    ${statusText}
                                </span>
                                ${subtaskStats.total > 0 ? `<span class="subtask-count">📝 ${subtaskStats.completed}/${subtaskStats.total} 子任务</span>` : ''}
                                ${dueDate ? `<span class="todo-date">📅 ${dueDate}</span>` : ''}
                                <span class="todo-date">🕒 ${createdAt}</span>
                            </div>
                            <div class="todo-actions">
                                <button class="action-btn add-subtask-btn" data-todo-id="${todo.id}" title="添加子任务">
                                    <i class="fas fa-plus"></i>
                                </button>
                                ${todo.status !== 'InProgress' ? 
                                    `<button class="action-btn status-btn" data-todo-id="${todo.id}" data-status="InProgress" title="标记为进行中">
                                        <i class="fas fa-play"></i>
                                    </button>` : 
                                    `<button class="action-btn status-btn" data-todo-id="${todo.id}" data-status="Pending" title="标记为待处理">
                                        <i class="fas fa-pause"></i>
                                    </button>`
                                }
                                <button class="action-btn export-todo-btn" data-todo-id="${todo.id}" title="导出此任务">
                                    <i class="fas fa-file-download"></i>
                                </button>
                                <button class="action-btn delete-btn" data-todo-id="${todo.id}" title="删除">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="scroll-right"></div>
                </div>
            `;
        }).join('');
        
        // 恢复选中状态
        this.updateTodoSelection();
    }

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 更新统计信息
    updateStats() {
        const total = this.todos.length;
        const pending = this.todos.filter(todo => todo.status === 'Pending').length;
        const inProgress = this.todos.filter(todo => todo.status === 'InProgress').length;
        const completed = this.todos.filter(todo => todo.status === 'Completed').length;

        document.getElementById('total-count').textContent = total;
        document.getElementById('pending-count').textContent = pending;
        document.getElementById('progress-count').textContent = inProgress;
        document.getElementById('completed-count').textContent = completed;
        
        // 更新浏览器标题
        document.title = `Ferrous Scroll (${pending + inProgress}/${total})`;
    }

    // 切换全选/取消全选
    toggleSelectAll() {
        const filteredTodos = this.filterTodos();
        const selectAllBtn = document.querySelector('.select-all-btn');
        const batchCompleteBtn = document.querySelector('.batch-complete-btn');
        const batchDeleteBtn = document.querySelector('.batch-delete-btn');
        
        // 检查按钮状态来判断是全选还是取消
        const isAllSelected = selectAllBtn.classList.contains('all-selected');
        
        if (isAllSelected) {
            // 取消全选
            console.log('取消全选');
            this.selectedTodoIds.clear();
            selectAllBtn.classList.remove('all-selected');
            selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> 全选';
            batchCompleteBtn.style.display = 'none';
            batchDeleteBtn.style.display = 'none';
        } else {
            // 全选
            console.log('全选', filteredTodos.length, '个任务');
            this.selectedTodoIds.clear();
            filteredTodos.forEach(todo => this.selectedTodoIds.add(todo.id));
            selectAllBtn.classList.add('all-selected');
            selectAllBtn.innerHTML = '<i class="fas fa-times"></i> 取消';
            batchCompleteBtn.style.display = 'flex';
            batchDeleteBtn.style.display = 'flex';
        }
        
        console.log('当前选中数量:', this.selectedTodoIds.size);
        this.updateTodoSelection();
    }

    // 更新任务选中状态的视觉效果
    updateTodoSelection() {
        // 使用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(() => {
            const todoItems = document.querySelectorAll('.scroll-item');
            console.log('更新选中状态，共', todoItems.length, '个任务');
            let selectedCount = 0;
            todoItems.forEach(item => {
                const todoId = item.getAttribute('data-id');
                if (this.selectedTodoIds.has(todoId)) {
                    item.classList.add('selected');
                    selectedCount++;
                } else {
                    item.classList.remove('selected');
                }
            });
            console.log('已选中', selectedCount, '个任务');
        });
    }

    // 批量标记完成
    async batchComplete() {
        if (this.selectedTodoIds.size === 0) {
            this.showWarning('请先选择要标记的任务');
            return;
        }

        const count = this.selectedTodoIds.size;
        const confirmed = await this.confirmDialog(
            `确定要将 ${count} 个任务标记为已完成吗？`,
            '批量完成'
        );
        
        if (!confirmed) return;

        try {
            this.showLoading(true);
            
            // 批量更新
            for (const todoId of this.selectedTodoIds) {
                await this.invoke('update_todo_status', {
                    id: todoId,
                    newStatus: 'Completed'
                });
            }
            
            // 清除选择
            this.selectedTodoIds.clear();
            
            // 重新加载
            await this.loadTodos();
            this.renderTodos();
            this.updateStats();
            
            // 隐藏批量操作按钮
            document.querySelector('.batch-complete-btn').style.display = 'none';
            document.querySelector('.batch-delete-btn').style.display = 'none';
            document.querySelector('.select-all-btn').classList.remove('all-selected');
            document.querySelector('.select-all-btn').innerHTML = '<i class="fas fa-check-double"></i> 全选';
            
            this.showSuccess(`✅ 已标记 ${count} 个任务为完成`);
        } catch (error) {
            this.showError('批量标记失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 批量删除
    async batchDelete() {
        if (this.selectedTodoIds.size === 0) {
            this.showWarning('请先选择要删除的任务');
            return;
        }

        const count = this.selectedTodoIds.size;
        const confirmed = await this.confirmDialog(
            `确定要删除 ${count} 个任务吗？此操作无法撤销。`,
            '批量删除'
        );
        
        if (!confirmed) return;

        try {
            this.showLoading(true);
            
            // 批量删除
            for (const todoId of this.selectedTodoIds) {
                await this.invoke('delete_todo', { id: todoId });
            }
            
            // 清除选择
            this.selectedTodoIds.clear();
            
            // 重新加载
            await this.loadTodos();
            this.renderTodos();
            this.updateStats();
            
            // 隐藏批量操作按钮
            document.querySelector('.batch-complete-btn').style.display = 'none';
            document.querySelector('.batch-delete-btn').style.display = 'none';
            document.querySelector('.select-all-btn').classList.remove('all-selected');
            document.querySelector('.select-all-btn').innerHTML = '<i class="fas fa-check-double"></i> 全选';
            
            this.showSuccess(`🗑️ 已删除 ${count} 个任务`);
        } catch (error) {
            this.showError('批量删除失败：' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 确认对话框（使用 Tauri Dialog API）
    async confirmDialog(message, title = '确认') {
        try {
            const { ask } = window.__TAURI__.dialog;
            return await ask(message, { title, type: 'warning' });
        } catch (error) {
            // 如果 Tauri Dialog 不可用，使用浏览器原生确认框
            return confirm(message);
        }
    }

    // 恢复个别任务收缩状态
    restoreCollapseState() {
        // 恢复个别任务的收缩状态
        this.restoreIndividualCollapseState();
    }

    // 切换单个任务的收缩状态
    toggleTodoCollapse(todoId) {
        const todoItem = document.querySelector(`[data-id="${todoId}"]`);
        if (!todoItem) return;

        const isCollapsed = todoItem.classList.contains('todo-collapsed');
        
        if (isCollapsed) {
            // 展开任务
            todoItem.classList.remove('todo-collapsed');
            console.log(`📖 任务已展开: ${todoId}`);
        } else {
            // 收缩任务
            todoItem.classList.add('todo-collapsed');
            console.log(`📚 任务已收缩: ${todoId}`);
        }
        
        // 保存个别任务的收缩状态
        this.saveIndividualCollapseState();
    }

    // 保存个别任务收缩状态
    saveIndividualCollapseState() {
        const collapsedTodos = [];
        document.querySelectorAll('.scroll-item.todo-collapsed').forEach(item => {
            collapsedTodos.push(item.dataset.id);
        });
        localStorage.setItem('todo-collapsed-items', JSON.stringify(collapsedTodos));
    }

    // 恢复个别任务收缩状态
    restoreIndividualCollapseState() {
        setTimeout(() => {
            const collapsedTodos = JSON.parse(localStorage.getItem('todo-collapsed-items') || '[]');
            collapsedTodos.forEach(todoId => {
                const todoItem = document.querySelector(`[data-id="${todoId}"]`);
                if (todoItem) {
                    todoItem.classList.add('todo-collapsed');
                }
            });
        }, 200);
    }

    // ==================== 标签管理 ====================

    // 加载所有标签
    async loadTags() {
        try {
            this.tags = await this.invoke('get_all_tags');
            console.log(`🏷️ 加载了 ${this.tags.length} 个标签`);
        } catch (e) {
            console.error('加载标签失败:', e);
        }
    }

    // 新增：切换页面
    switchPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.scroll-page').forEach(page => {
            page.classList.remove('active');
        });
        
        // 移除所有tab按钮的active状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 显示目标页面
        const targetPage = document.getElementById(`page-${pageName}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // 激活对应的tab按钮
        const buttons = document.querySelectorAll('.tab-btn');
        const pageIndex = {
            'main': 0,
            'tags': 1,
            'categories': 2,
            'export': 3,
            'settings': 4
        }[pageName] || 0;
        
        if (buttons[pageIndex]) {
            buttons[pageIndex].classList.add('active');
        }
        
        this.currentPage = pageName;
        
        // 如果切换到设置页面，加载当前配置
        if (pageName === 'settings') {
            this.loadSettings();
        }
        
        // 加载对应页面的数据
        if (pageName === 'tags') {
            this.renderTagList();
        } else if (pageName === 'categories') {
            this.renderCategoryList();
        } else if (pageName === 'export') {
            // 初始化导出页面的日期选择器
            this.initExportPage();
        }
        
        console.log(`📖 切换到页面: ${pageName}`);
    }

    // 切换筛选面板
    toggleFilterPanel() {
        const panel = document.querySelector('.filter-panel');
        if (panel) {
            panel.classList.toggle('collapsed');
        }
    }

    // 切换设置菜单
    toggleSettingsMenu() {
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown.style.display === 'none' || !dropdown.style.display) {
            this.showSettingsMenu();
        } else {
            this.hideSettingsMenu();
        }
    }

    // 显示设置菜单
    async showSettingsMenu() {
        const dropdown = document.getElementById('settings-dropdown');
        dropdown.style.display = 'block';
        
        // 加载当前配置
        try {
            const config = await this.invoke('get_config');
            
            const showCompletedToggle = document.getElementById('show-completed-toggle-menu');
            const defaultPrioritySelect = document.getElementById('default-priority-select-menu');
            
            if (showCompletedToggle) showCompletedToggle.checked = config.app_settings.show_completed_tasks;
            if (defaultPrioritySelect) defaultPrioritySelect.value = config.app_settings.default_priority;
        } catch (error) {
            console.error('加载配置失败:', error);
        }
        
        // 点击菜单外部关闭
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }

    // 隐藏设置菜单
    hideSettingsMenu() {
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
        document.removeEventListener('click', this.handleClickOutside);
    }

    // 绑定所有按钮事件
    bindButtonEvents() {
        // 设置按钮
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggleSettingsMenu());
        }

        // 页面切换按钮
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page) this.switchPage(page);
            });
        });

        // 设置菜单按钮
        const settingsSaveBtn = document.getElementById('settings-save-btn');
        if (settingsSaveBtn) {
            settingsSaveBtn.addEventListener('click', () => this.saveSettingsFromMenu());
        }

        const settingsResetBtn = document.getElementById('settings-reset-btn');
        if (settingsResetBtn) {
            settingsResetBtn.addEventListener('click', () => this.resetSettings());
        }

        // 标签选择按钮
        const tagSelectorBtn = document.getElementById('tag-selector-btn');
        if (tagSelectorBtn) {
            tagSelectorBtn.addEventListener('click', () => this.openTagSelector());
        }

        // 筛选面板
        const filterHeader = document.getElementById('filter-header');
        if (filterHeader) {
            filterHeader.addEventListener('click', () => this.toggleFilterPanel());
        }

        // 批量操作按钮
        const selectAllBtn = document.getElementById('select-all-btn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        }

        const batchCompleteBtn = document.getElementById('batch-complete-btn');
        if (batchCompleteBtn) {
            batchCompleteBtn.addEventListener('click', () => this.batchComplete());
        }

        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => this.batchDelete());
        }

        // 标签管理按钮
        const createTagBtn = document.getElementById('create-tag-btn');
        if (createTagBtn) {
            createTagBtn.addEventListener('click', () => this.createTag());
        }

        // 分类管理按钮
        const categoryTagSelectorBtn = document.getElementById('category-tag-selector-btn');
        if (categoryTagSelectorBtn) {
            categoryTagSelectorBtn.addEventListener('click', () => this.openCategoryTagSelector());
        }

        const createCategoryBtn = document.getElementById('create-category-btn');
        if (createCategoryBtn) {
            createCategoryBtn.addEventListener('click', () => this.createCategory());
        }

        // 导出按钮
        const exportAllBtn = document.getElementById('export-all-btn');
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', () => this.exportToMarkdown());
        }

        const exportWeekBtn = document.getElementById('export-week-btn');
        if (exportWeekBtn) {
            exportWeekBtn.addEventListener('click', () => this.exportByWeek());
        }

        const exportRangeBtn = document.getElementById('export-range-btn');
        if (exportRangeBtn) {
            exportRangeBtn.addEventListener('click', () => this.exportByDateRange());
        }

        const exportTodayBtn = document.getElementById('export-today-btn');
        if (exportTodayBtn) {
            exportTodayBtn.addEventListener('click', () => this.exportToday());
        }

        const exportThisWeekBtn = document.getElementById('export-this-week-btn');
        if (exportThisWeekBtn) {
            exportThisWeekBtn.addEventListener('click', () => this.exportThisWeek());
        }

        const exportThisMonthBtn = document.getElementById('export-this-month-btn');
        if (exportThisMonthBtn) {
            exportThisMonthBtn.addEventListener('click', () => this.exportThisMonth());
        }
    }

    // 处理点击外部事件
    handleClickOutside = (event) => {
        const dropdown = document.getElementById('settings-dropdown');
        const settingsBtn = document.querySelector('.settings-icon-btn');
        
        if (dropdown && 
            !dropdown.contains(event.target) && 
            settingsBtn &&
            !settingsBtn.contains(event.target)) {
            this.hideSettingsMenu();
        }
    }

    // 从菜单保存设置
    async saveSettingsFromMenu() {
        try {
            console.log('💾 保存设置...');
            this.showLoading(true);
            
            // 获取当前配置
            const currentConfig = await this.invoke('get_config');
            
            const config = {
                database_path: currentConfig.database_path,
                app_settings: {
                    theme: currentConfig.app_settings.theme, // 保留当前主题
                    language: currentConfig.app_settings.language, // 保留当前语言
                    show_completed_tasks: document.getElementById('show-completed-toggle-menu').checked,
                    default_priority: document.getElementById('default-priority-select-menu').value,
                    auto_backup: currentConfig.app_settings.auto_backup,
                    backup_interval_days: currentConfig.app_settings.backup_interval_days
                }
            };
            
            await this.invoke('save_config', { newConfig: config });
            
            console.log('✅ 配置已保存');
            this.showSuccess('✅ 配置已保存');
            this.hideSettingsMenu();
            
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            this.showError('保存配置失败：' + (error.message || JSON.stringify(error)));
        } finally {
            this.showLoading(false);
        }
    }

    // 添加快速导出方法
    initExportPage() {
        // 设置当前周
        const now = new Date();
        const year = now.getFullYear();
        const week = this.getWeekNumber(now);
        const weekInput = document.getElementById('week-select');
        if (weekInput) {
            weekInput.value = `${year}-W${String(week).padStart(2, '0')}`;
        }
    }

    // 快速导出 - 今日
    exportToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayTodos = this.todos.filter(todo => {
            const createdDate = new Date(todo.created_at);
            return createdDate >= today && createdDate < tomorrow;
        });
        
        if (todayTodos.length === 0) {
            this.showError('今日没有任务记录');
            return;
        }
        
        const markdown = this.generateDateRangeReport(todayTodos, today, today);
        const filename = `Ferrous-Scroll-今日任务-${today.toISOString().split('T')[0]}.md`;
        this.downloadCustomMarkdown(markdown, filename);
        this.showSuccess('✅ 今日任务已导出！');
    }

    // 快速导出 - 本周（不依赖页面上的周选择器，直接按当前周导出）
    exportThisWeek() {
        const now = new Date();
        const year = now.getFullYear();
        const weekNumber = this.getWeekNumber(now);
        const { start, end } = this.getWeekDateRange(year, weekNumber);
        const weekTodos = this.getTodosInWeekRange(this.todos, start, end);
        if (weekTodos.length === 0) {
            this.showError('本周时间范围内没有任务记录');
            return;
        }
        const markdown = this.generateWeeklyReport(weekTodos, start, end, year, weekNumber);
        this.downloadWeeklyMarkdown(markdown, year, weekNumber);
        this.showSuccess(`✅ 第 ${weekNumber} 周的任务已导出！`);
    }

    // 快速导出 - 本月
    exportThisMonth() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const monthTodos = this.todos.filter(todo => {
            const createdDate = new Date(todo.created_at);
            return createdDate >= start && createdDate <= end;
        });
        
        if (monthTodos.length === 0) {
            this.showError('本月没有任务记录');
            return;
        }
        
        const monthName = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
        const markdown = this.generateDateRangeReport(monthTodos, start, end)
            .replace('自定义范围', `${monthName}月报`);
        
        const filename = `Ferrous-Scroll-${now.getFullYear()}年${now.getMonth() + 1}月报告.md`;
        this.downloadCustomMarkdown(markdown, filename);
        this.showSuccess('✅ 本月任务已导出！');
    }

    // 通用下载方法
    downloadCustomMarkdown(content, filename) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`📥 导出文件: ${filename}`);
    }

    // 渲染标签列表
    renderTagList() {
        const container = document.getElementById('tag-list');
        if (!container) return;

        if (this.tags.length === 0) {
            container.innerHTML = '<div class="empty-message">还没有标签，创建第一个吧！</div>';
            return;
        }

        container.innerHTML = this.tags.map(tag => `
            <div class="tag-item" style="border-left: 4px solid ${tag.color}">
                <span class="tag-color-badge" style="background: ${tag.color}"></span>
                <span class="tag-name">${tag.name}</span>
                <button class="delete-tag-btn delete-btn-small" data-tag-id="${tag.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    // 创建新标签
    async createTag() {
        const nameInput = document.getElementById('new-tag-name');
        const colorInput = document.getElementById('new-tag-color');
        
        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            this.showError('请输入标签名称');
            return;
        }

        try {
            await this.invoke('create_tag', { name, color });
            this.showSuccess(`标签 "${name}" 创建成功`);
            nameInput.value = '';
            colorInput.value = '#3b82f6';
            
            // 重新加载标签列表，如果失败也不影响创建成功的结果
            try {
                await this.loadTags();
                this.renderTagList();
                this.renderTagSelector();
            } catch (loadError) {
                console.warn('重新加载标签列表失败:', loadError);
                // 不显示错误，因为标签已经创建成功
            }
        } catch (e) {
            // 检查是否是唯一约束错误（只匹配创建标签时的错误）
            if (e.message.includes('UNIQUE constraint failed: tags.name')) {
                this.showError(`标签名称 "${name}" 已存在，请使用其他名称`);
                // 高亮显示名称输入框
                nameInput.focus();
                nameInput.select();
            } else {
                this.showError(`创建标签失败: ${e.message}`);
            }
        }
    }

    // 删除标签
    async deleteTag(tagId) {
        // 使用 Tauri Dialog API 显示确认对话框
        const confirmed = await this.showConfirm('删除标签', '确定要删除这个标签吗？\n这将从所有任务中移除该标签。');
        if (!confirmed) {
            console.log('📍 用户取消了删除标签');
            return;
        }
        
        console.log('📍 准备删除标签，ID:', tagId);

        try {
            await this.invoke('delete_tag', { tagId });
            this.showSuccess('标签删除成功');
            await this.loadTags();
            await this.loadTodos();
            this.renderTagList();
            this.renderTodos();
        } catch (e) {
            this.showError(`删除标签失败: ${e.message}`);
        }
    }

    // 打开标签选择器
    openTagSelector(todoId = null) {
        this.currentTodoForTags = todoId;
        this.isSelectingForCategory = false;
        const modal = document.getElementById('tag-selector-modal');
        modal.style.display = 'flex';
        this.renderTagSelector();
    }

    // 关闭标签选择器
    closeTagSelector() {
        const modal = document.getElementById('tag-selector-modal');
        modal.style.display = 'none';
        
        if (this.isEditingCategory) {
            // 如果是在编辑分类标签，重置状态
            this.editingCategoryId = null;
            this.isEditingCategory = false;
            this.selectedCategoryTags = [];
            this.renderSelectedCategoryTags();
        } else if (this.isSelectingForCategory) {
            this.renderSelectedCategoryTags();
        } else {
            this.renderSelectedTags();
        }
    }

    // 渲染标签选择器
    renderTagSelector() {
        if (this.isSelectingForCategory) {
            this.renderCategoryTagSelector();
        } else {
            const container = document.getElementById('tag-selector-list');
            if (!container) return;

            if (this.tags.length === 0) {
                container.innerHTML = '<div class="empty-message">还没有标签，请先创建标签</div>';
                return;
            }

            container.innerHTML = this.tags.map(tag => {
                const isSelected = this.selectedTags.includes(tag.id);
                return `
                    <div class="tag-selector-item ${isSelected ? 'selected' : ''}" 
                         style="border-left: 4px solid ${tag.color}"
                         data-tag-id="${tag.id}">
                        <span class="tag-color-badge" style="background: ${tag.color}"></span>
                        <span class="tag-name">${tag.name}</span>
                        ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                `;
            }).join('');
        }
    }

    // 切换标签选择
    toggleTagSelection(tagId) {
        const index = this.selectedTags.indexOf(tagId);
        if (index > -1) {
            this.selectedTags.splice(index, 1);
        } else {
            this.selectedTags.push(tagId);
        }
        this.renderTagSelector();
        this.renderSelectedTags();
    }

    // 渲染已选择的标签
    renderSelectedTags() {
        const container = document.getElementById('selected-tags');
        if (!container) return;

        if (this.selectedTags.length === 0) {
            container.innerHTML = '';
            return;
        }

        const selectedTagObjs = this.tags.filter(t => this.selectedTags.includes(t.id));
        container.innerHTML = selectedTagObjs.map(tag => `
            <span class="selected-tag" style="background: ${tag.color}15; border-color: ${tag.color}">
                <span class="tag-dot" style="background: ${tag.color}"></span>
                ${tag.name}
                <i class="fas fa-times" data-tag-id="${tag.id}"></i>
            </span>
        `).join('');
    }

    // ==================== 分类管理 ====================

    // 加载所有分类
    async loadCategories() {
        try {
            this.categories = await this.invoke('get_all_categories');
            console.log(`📁 加载了 ${this.categories.length} 个分类`);
        } catch (e) {
            console.error('加载分类失败:', e);
        }
    }

    // 渲染分类列表
    renderCategoryList() {
        const container = document.getElementById('category-list');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = '<div class="empty-message">还没有分类，创建第一个吧！</div>';
            return;
        }

        container.innerHTML = this.categories.map(cat => `
            <div class="category-item" style="border-left: 4px solid ${cat.color}">
                <div class="category-info">
                    <div class="category-name">${cat.name}</div>
                    <div class="category-desc">${cat.description}</div>
                    <div class="category-tags">
                        ${cat.tags.map(tag => `
                            <span class="mini-tag" style="background: ${tag.color}15; color: ${tag.color}">
                                ${tag.name}
                            </span>
                        `).join('')}
                    </div>
                    <div class="category-stat">包含 ${cat.todo_count} 个任务</div>
                </div>
                <div class="category-actions">
                    <button class="edit-btn-small" data-category-id="${cat.id}" data-action="edit" title="编辑分类信息">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="edit-btn-small" data-category-id="${cat.id}" data-action="edit-tags" title="编辑标签">
                        <i class="fas fa-tags"></i>
                    </button>
                    <button class="delete-btn-small" data-category-id="${cat.id}" title="删除分类">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 创建新分类
    async createCategory() {
        const nameInput = document.getElementById('new-category-name');
        const descInput = document.getElementById('new-category-desc');
        const colorInput = document.getElementById('new-category-color');
        
        const name = nameInput.value.trim();
        const description = descInput.value.trim() || '';
        const color = colorInput.value;

        if (!name) {
            this.showError('请输入分类名称');
            return;
        }

        if (this.selectedCategoryTags.length === 0) {
            this.showError('请至少选择一个标签');
            return;
        }

        try {
            await this.invoke('create_category', {
                name,
                description,
                color,
                tagIds: this.selectedCategoryTags
            });

            this.showSuccess(`分类 "${name}" 创建成功`);
            nameInput.value = '';
            descInput.value = '';
            colorInput.value = '#10b981';
            this.selectedCategoryTags = [];
            this.renderSelectedCategoryTags();
            
            // 重新加载分类列表，如果失败也不影响创建成功的结果
            try {
                await this.loadCategories();
                this.renderCategoryList();
                this.renderCategoryFilter();
            } catch (loadError) {
                console.warn('重新加载分类列表失败:', loadError);
                // 不显示错误，因为分类已经创建成功
            }
        } catch (e) {
            // 检查是否是唯一约束错误（只匹配创建分类时的错误）
            if (e.message.includes('UNIQUE constraint failed: categories.name')) {
                this.showError(`分类名称 "${name}" 已存在，请使用其他名称`);
                // 高亮显示名称输入框
                nameInput.focus();
                nameInput.select();
            } else {
                this.showError(`创建分类失败: ${e.message}`);
            }
        }
    }

    // 删除分类
    async deleteCategory(categoryId) {
        // 使用 Tauri Dialog API 显示确认对话框
        const confirmed = await this.showConfirm('删除分类', '确定要删除这个分类吗？');
        if (!confirmed) {
            console.log('📍 用户取消了删除分类');
            return;
        }
        
        console.log('📍 准备删除分类，ID:', categoryId);

        try {
            await this.invoke('delete_category', { categoryId });
            this.showSuccess('分类删除成功');
            await this.loadCategories();
            this.renderCategoryList();
            this.renderCategoryFilter();
        } catch (e) {
            this.showError(`删除分类失败: ${e.message}`);
        }
    }

    // 渲染分类筛选器
    renderCategoryFilter() {
        const select = document.getElementById('category-filter');
        if (!select) return;

        const currentValue = select.value;
        
        select.innerHTML = '<option value="all">全部分类</option>' +
            this.categories.map(cat => `
                <option value="${cat.id}">${cat.name}</option>
            `).join('');
        
        select.value = currentValue;
    }

    // 打开分类标签选择器
    openCategoryTagSelector() {
        this.currentTodoForTags = null;
        this.isSelectingForCategory = true;
        this.isEditingCategory = false;
        const modal = document.getElementById('tag-selector-modal');
        
        // 隐藏保存按钮
        const saveBtn = document.getElementById('save-category-tags-btn');
        if (saveBtn) saveBtn.style.display = 'none';
        
        modal.style.display = 'flex';
        this.renderCategoryTagSelector();
    }

    // 渲染分类标签选择器
    renderCategoryTagSelector() {
        const container = document.getElementById('tag-selector-list');
        if (!container) return;

        if (this.tags.length === 0) {
            container.innerHTML = '<div class="empty-message">还没有标签，请先创建标签</div>';
            return;
        }

        container.innerHTML = this.tags.map(tag => {
            const isSelected = this.selectedCategoryTags.includes(tag.id);
            return `
                <div class="tag-selector-item category-tag-selector-item ${isSelected ? 'selected' : ''}" 
                     style="border-left: 4px solid ${tag.color}"
                     data-tag-id="${tag.id}">
                    <span class="tag-color-badge" style="background: ${tag.color}"></span>
                    <span class="tag-name">${tag.name}</span>
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;
        }).join('');
    }

    // 切换分类标签选择
    toggleCategoryTagSelection(tagId) {
        const index = this.selectedCategoryTags.indexOf(tagId);
        if (index > -1) {
            this.selectedCategoryTags.splice(index, 1);
        } else {
            this.selectedCategoryTags.push(tagId);
        }
        this.renderCategoryTagSelector();
        this.renderSelectedCategoryTags();
    }

    // 渲染已选择的分类标签
    renderSelectedCategoryTags() {
        const container = document.getElementById('selected-category-tags');
        if (!container) return;

        if (this.selectedCategoryTags.length === 0) {
            container.innerHTML = '';
            return;
        }

        const selectedTagObjs = this.tags.filter(t => this.selectedCategoryTags.includes(t.id));
        container.innerHTML = selectedTagObjs.map(tag => `
            <span class="selected-tag" style="background: ${tag.color}15; border-color: ${tag.color}">
                <span class="tag-dot" style="background: ${tag.color}"></span>
                ${tag.name}
                <i class="fas fa-times" data-category-tag-id="${tag.id}"></i>
            </span>
        `).join('');
    }

    // 编辑分类标签
    editCategoryTags(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) {
            this.showError('分类不存在');
            return;
        }

        // 设置当前正在编辑的分类
        this.editingCategoryId = categoryId;
        
        // 加载该分类当前的标签
        this.selectedCategoryTags = category.tags.map(t => t.id);
        
        // 打开标签选择器
        this.isSelectingForCategory = true;
        this.isEditingCategory = true;
        const modal = document.getElementById('tag-selector-modal');
        
        // 显示保存按钮
        const saveBtn = document.getElementById('save-category-tags-btn');
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        
        modal.style.display = 'flex';
        this.renderCategoryTagSelector();
    }

    // 保存分类标签修改
    async saveCategoryTags() {
        if (!this.editingCategoryId) return;

        if (this.selectedCategoryTags.length === 0) {
            this.showError('请至少选择一个标签');
            return;
        }

        try {
            await this.invoke('update_category_tags', {
                categoryId: this.editingCategoryId,
                tagIds: this.selectedCategoryTags
            });

            this.showSuccess('分类标签更新成功');
            this.closeTagSelector();
            this.editingCategoryId = null;
            this.isEditingCategory = false;
            this.selectedCategoryTags = [];
            await this.loadCategories();
            this.renderCategoryList();
        } catch (e) {
            this.showError(`更新分类标签失败: ${e.message}`);
        }
    }

    // 编辑分类信息（名称、描述、颜色）
    editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) {
            this.showError('分类不存在');
            return;
        }

        // 创建编辑模态框
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> 编辑分类</h3>
                    <button class="close-btn" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="edit-category-form">
                        <div class="form-group">
                            <label>分类名称</label>
                            <input type="text" id="edit-category-name" value="${this.escapeHtml(category.name)}" maxlength="30">
                        </div>
                        <div class="form-group">
                            <label>分类描述</label>
                            <input type="text" id="edit-category-desc" value="${this.escapeHtml(category.description)}">
                        </div>
                        <div class="form-group">
                            <label>分类颜色</label>
                            <input type="color" id="edit-category-color" value="${category.color}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button data-action="save-category" data-category-id="${categoryId}" class="btn-primary">
                        <i class="fas fa-save"></i> 保存
                    </button>
                    <button data-action="close-modal" class="btn-secondary">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // 保存分类信息修改
    async saveCategoryInfo(categoryId) {
        const nameInput = document.getElementById('edit-category-name');
        const descInput = document.getElementById('edit-category-desc');
        const colorInput = document.getElementById('edit-category-color');

        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            this.showError('请输入分类名称');
            nameInput.focus();
            return;
        }

        try {
            await this.invoke('update_category', {
                categoryId,
                name,
                description,
                color
            });

            this.showSuccess('分类信息更新成功');
            // 关闭模态框
            document.querySelector('.modal').remove();
            // 重新加载分类列表
            await this.loadCategories();
            this.renderCategoryList();
            this.renderCategoryFilter();
        } catch (e) {
            this.showError(`更新分类信息失败: ${e.message}`);
        }
    }

    // ==================== 单个任务导出功能 ====================

    // 导出单个任务为Markdown
    exportSingleTodo(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) {
            this.showError('任务不存在');
            return;
        }

        const now = new Date();
        const timestamp = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const statusIcon = this.getStatusIcon(todo.status);
        const statusText = this.getStatusText(todo.status);
        const priorityIcon = this.getPriorityIcon(todo.priority);
        const priorityText = this.getPriorityText(todo.priority);
        
        let markdown = `# ${statusIcon} ${todo.title}\n\n`;
        markdown += `> 导出时间：${timestamp}\n\n`;
        markdown += `---\n\n`;
        
        // 任务基本信息
        markdown += `## 📝 任务信息\n\n`;
        markdown += `| 属性 | 值 |\n`;
        markdown += `|------|----|\n`;
        markdown += `| 状态 | ${statusText} |\n`;
        markdown += `| 优先级 | ${priorityIcon} ${priorityText} |\n`;
        
        if (todo.created_at) {
            const createdDate = new Date(todo.created_at).toLocaleString('zh-CN');
            markdown += `| 创建时间 | ${createdDate} |\n`;
        }
        
        if (todo.updated_at) {
            const updatedDate = new Date(todo.updated_at).toLocaleString('zh-CN');
            markdown += `| 更新时间 | ${updatedDate} |\n`;
        }
        
        if (todo.due_date) {
            const dueDate = new Date(todo.due_date).toLocaleString('zh-CN');
            markdown += `| 截止时间 | ${dueDate} |\n`;
        }
        
        markdown += `\n`;
        
        // 任务描述
        if (todo.description) {
            markdown += `## 📄 描述\n\n`;
            markdown += `${todo.description}\n\n`;
        }
        
        // 标签
        if (todo.tags && todo.tags.length > 0) {
            markdown += `## 🏷️ 标签\n\n`;
            todo.tags.forEach(tag => {
                markdown += `- **${tag.name}** (${tag.color})\n`;
            });
            markdown += `\n`;
        }
        
        // 子任务
        if (todo.subtasks && todo.subtasks.length > 0) {
            const completedCount = todo.subtasks.filter(s => s.status === 'Completed').length;
            const totalCount = todo.subtasks.length;
            const progress = Math.round((completedCount / totalCount) * 100);
            
            markdown += `## ✅ 子任务 (${completedCount}/${totalCount} - ${progress}%)\n\n`;
            
            todo.subtasks.forEach((subtask, index) => {
                const checkbox = subtask.status === 'Completed' ? 'x' : ' ';
                markdown += `${index + 1}. [${checkbox}] **${subtask.title}**\n`;
                
                if (subtask.description) {
                    markdown += `   > ${subtask.description}\n`;
                }
                
                if (subtask.created_at) {
                    const createdDate = new Date(subtask.created_at).toLocaleDateString('zh-CN');
                    markdown += `   - 创建于: ${createdDate}\n`;
                }
                
                markdown += `\n`;
            });
        }
        
        // 页脚
        markdown += `---\n\n`;
        markdown += `*由 Ferrous Scroll 导出*\n`;
        
        // 下载文件
        this.downloadSingleTodoMarkdown(markdown, todo.title);
        this.showSuccess(`✅ 任务 "${todo.title}" 已导出！`);
    }
    
    // 获取优先级图标
    getPriorityIcon(priority) {
        const icons = {
            'High': '🔴',
            'Medium': '🟡',
            'Low': '🟢'
        };
        return icons[priority] || '⚪';
    }
    
    // 获取优先级文本
    getPriorityText(priority) {
        const texts = {
            'High': '高优先级',
            'Medium': '中优先级',
            'Low': '低优先级'
        };
        return texts[priority] || priority;
    }
    
    // 下载单个任务的Markdown文件
    downloadSingleTodoMarkdown(content, todoTitle) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // 清理文件名，移除特殊字符
        const safeTitle = todoTitle
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '_')
            .substring(0, 50); // 限制长度
        
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const filename = `Task_${safeTitle}_${dateStr}.md`;
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`📥 导出单个任务: ${filename}`);
    }

    // ==================== 导出功能 ====================

    // 导出为Markdown
    exportToMarkdown() {
        const now = new Date();
        const timestamp = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        let markdown = `# 📜 Ferrous Scroll - 任务导出\n\n`;
        markdown += `> 导出时间：${timestamp}\n\n`;
        markdown += `---\n\n`;
        
        // 统计信息
        const stats = {
            total: this.todos.length,
            pending: this.todos.filter(t => t.status === 'Pending').length,
            inProgress: this.todos.filter(t => t.status === 'InProgress').length,
            completed: this.todos.filter(t => t.status === 'Completed').length
        };
        
        markdown += `## 📊 统计信息\n\n`;
        markdown += `| 指标 | 数量 |\n`;
        markdown += `|------|------|\n`;
        markdown += `| 总任务数 | ${stats.total} |\n`;
        markdown += `| 待处理 | ${stats.pending} |\n`;
        markdown += `| 进行中 | ${stats.inProgress} |\n`;
        markdown += `| 已完成 | ${stats.completed} |\n`;
        markdown += `| 完成率 | ${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}% |\n\n`;
        markdown += `---\n\n`;
        
        // 按优先级分组任务
        const priorities = {
            'High': { name: '高优先级', icon: '🔴', todos: [] },
            'Medium': { name: '中优先级', icon: '🟡', todos: [] },
            'Low': { name: '低优先级', icon: '🟢', todos: [] }
        };
        
        this.todos.forEach(todo => {
            priorities[todo.priority].todos.push(todo);
        });
        
        // 输出任务列表
        markdown += `## 📋 任务列表\n\n`;
        
        for (const [priority, data] of Object.entries(priorities)) {
            if (data.todos.length === 0) continue;
            
            markdown += `### ${data.icon} ${data.name} (${data.todos.length}个)\n\n`;
            
            data.todos.forEach(todo => {
                const statusIcon = this.getStatusIcon(todo.status);
                const statusText = this.getStatusText(todo.status);
                
                markdown += `#### ${statusIcon} ${todo.title}\n\n`;  // 这里添加了空格
                markdown += `- **状态**：${statusText}\n`;
                markdown += `- **优先级**：${data.name}\n`;
                
                if (todo.description) {
                    markdown += `- **描述**：${todo.description}\n`;
                }
                
                if (todo.tags && todo.tags.length > 0) {
                    const tagNames = todo.tags.map(t => t.name).join(', ');
                    markdown += `- **标签**：${tagNames}\n`;
                }
                
                if (todo.created_at) {
                    const createdDate = new Date(todo.created_at).toLocaleDateString('zh-CN');
                    markdown += `- **创建时间**：${createdDate}\n`;
                }
                
                if (todo.due_date) {
                    const dueDate = new Date(todo.due_date).toLocaleDateString('zh-CN');
                    markdown += `- **截止时间**：${dueDate}\n`;
                }
                
                // 子任务
                if (todo.subtasks && todo.subtasks.length > 0) {
                    markdown += `\n**子任务：**\n\n`;
                    todo.subtasks.forEach(subtask => {
                        const checkbox = subtask.status === 'Completed' ? 'x' : ' ';
                        markdown += `- [${checkbox}] ${subtask.title}`;
                        if (subtask.description) {
                            markdown += ` - ${subtask.description}`;
                        }
                        markdown += `\n`;
                    });
                }
                
                markdown += `\n---\n\n`;
            });
        }
        
        // 标签列表
        if (this.tags.length > 0) {
            markdown += `## 🏷️ 标签列表\n\n`;
            this.tags.forEach(tag => {
                const tagCount = this.todos.filter(t => 
                    t.tag_ids && t.tag_ids.includes(tag.id)
                ).length;
                markdown += `- **${tag.name}** (${tag.color}) - ${tagCount} 个任务\n`;
            });
            markdown += `\n---\n\n`;
        }
        
        // 分类列表
        if (this.categories.length > 0) {
            markdown += `## 📁 分类列表\n\n`;
            this.categories.forEach(cat => {
                markdown += `### ${cat.name}\n\n`;
                if (cat.description) {
                    markdown += `> ${cat.description}\n\n`;
                }
                if (cat.tags && cat.tags.length > 0) {
                    const tagNames = cat.tags.map(t => t.name).join(', ');
                    markdown += `- **包含标签**：${tagNames}\n`;
                }
                markdown += `- **任务数量**：${cat.todo_count}\n\n`;
            });
        }
        
        // 页脚
        markdown += `---\n\n`;
        markdown += `*由 Ferrous Scroll 生成*\n`;
        
        // 下载文件
        this.downloadMarkdown(markdown);
        this.showSuccess('✅ Markdown 文件已导出！');
    }
    
    // 获取状态图标
    getStatusIcon(status) {
        const icons = {
            'Pending': '⏳',
            'InProgress': '🔄',
            'Completed': '✅',
            'Cancelled': '❌'
        };
        return icons[status] || '📝';
    }
    
    // 获取状态文本
    getStatusText(status) {
        const texts = {
            'Pending': '待处理',
            'InProgress': '进行中',
            'Completed': '已完成',
            'Cancelled': '已取消'
        };
        return texts[status] || status;
    }
    
    // 下载Markdown文件
    downloadMarkdown(content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const now = new Date();
        const filename = `Ferrous-Scroll-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.md`;
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`📥 导出文件: ${filename}`);
    }

    // ==================== 按周导出功能 ====================

    // 判断任务是否在时间跨度上与该周有交集（创建时间或截止时间落在该周内）
    getTodosInWeekRange(todos, start, end) {
        return todos.filter(todo => {
            const created = new Date(todo.created_at);
            const inByCreated = created >= start && created <= end;
            if (!todo.due_date) return inByCreated;
            const due = new Date(todo.due_date);
            due.setHours(23, 59, 59, 999);
            const inByDue = due >= start && due <= end;
            return inByCreated || inByDue;
        });
    }

    // 按周导出
    exportByWeek() {
        const weekInput = document.getElementById('week-select');
        let weekValue = weekInput ? weekInput.value : '';
        
        // 如果没有选择周，使用当前周
        if (!weekValue) {
            const now = new Date();
            const year = now.getFullYear();
            const week = this.getWeekNumber(now);
            weekValue = `${year}-W${String(week).padStart(2, '0')}`;
            if (weekInput) weekInput.value = weekValue;
        }
        
        // 解析周值
        const [year, weekStr] = weekValue.split('-W');
        const weekNumber = parseInt(weekStr);
        
        // 获取该周的开始和结束日期
        const { start, end } = this.getWeekDateRange(parseInt(year), weekNumber);
        
        // 筛选时间跨度上包含该周的任务（创建或截止在本周）
        const weekTodos = this.getTodosInWeekRange(this.todos, start, end);
        
        if (weekTodos.length === 0) {
            this.showError('该周没有任务记录');
            return;
        }
        
        // 生成周报 Markdown
        const markdown = this.generateWeeklyReport(weekTodos, start, end, year, weekNumber);
        
        // 下载文件
        this.downloadWeeklyMarkdown(markdown, year, weekNumber);
        this.showSuccess(`✅ 第 ${weekNumber} 周的任务已导出！`);
    }
    
    // 按日期范围导出
    exportByDateRange() {
        const startInput = document.getElementById('export-start-date');
        const endInput = document.getElementById('export-end-date');
        
        const startDate = startInput.value;
        const endDate = endInput.value;
        
        if (!startDate || !endDate) {
            this.showError('请选择开始和结束日期');
            return;
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // 包含结束日期的全天
        
        if (start > end) {
            this.showError('开始日期不能晚于结束日期');
            return;
        }
        
        // 筛选日期范围内的任务
        const rangeTodos = this.todos.filter(todo => {
            const createdDate = new Date(todo.created_at);
            return createdDate >= start && createdDate <= end;
        });
        
        if (rangeTodos.length === 0) {
            this.showError('该日期范围内没有任务记录');
            return;
        }
        
        // 生成报告
        const markdown = this.generateDateRangeReport(rangeTodos, start, end);
        
        // 下载文件
        this.downloadDateRangeMarkdown(markdown, start, end);
        this.showSuccess(`✅ ${startDate} 至 ${endDate} 的任务已导出！`);
    }
    
    // 获取周数
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    // 获取指定年份和周数的日期范围
    getWeekDateRange(year, week) {
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        const start = new Date(ISOweekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    
    // 生成周报 Markdown
    generateWeeklyReport(todos, startDate, endDate, year, weekNumber) {
        const formatDate = (date) => date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        let markdown = `# 📅 第 ${weekNumber} 周工作报告\n\n`;
        markdown += `> **时间范围**：${formatDate(startDate)} - ${formatDate(endDate)}\n\n`;
        markdown += `> **导出时间**：${new Date().toLocaleString('zh-CN')}\n\n`;
        markdown += `---\n\n`;
        
        // 统计信息
        const stats = {
            total: todos.length,
            completed: todos.filter(t => t.status === 'Completed').length,
            inProgress: todos.filter(t => t.status === 'InProgress').length,
            pending: todos.filter(t => t.status === 'Pending').length,
        };
        
        markdown += `## 📊 本周统计\n\n`;
        markdown += `| 指标 | 数量 | 占比 |\n`;
        markdown += `|------|------|------|\n`;
        markdown += `| 总任务数 | ${stats.total} | 100% |\n`;
        markdown += `| ✅ 已完成 | ${stats.completed} | ${Math.round(stats.completed / stats.total * 100)}% |\n`;
        markdown += `| 🔄 进行中 | ${stats.inProgress} | ${Math.round(stats.inProgress / stats.total * 100)}% |\n`;
        markdown += `| ⏳ 待处理 | ${stats.pending} | ${Math.round(stats.pending / stats.total * 100)}% |\n\n`;
        
        // 按状态分组
        const completed = todos.filter(t => t.status === 'Completed');
        const inProgress = todos.filter(t => t.status === 'InProgress');
        const pending = todos.filter(t => t.status === 'Pending');
        
        // 已完成任务
        if (completed.length > 0) {
            markdown += `## ✅ 已完成任务 (${completed.length})\n\n`;
            completed.forEach((todo, index) => {
                markdown += `${index + 1}. **${todo.title}**\n`;
                if (todo.description) {
                    markdown += `   > ${todo.description}\n`;
                }
                if (todo.tags && todo.tags.length > 0) {
                    const tagNames = todo.tags.map(t => `\`${t.name}\``).join(' ');
                    markdown += `   - 标签：${tagNames}\n`;
                }
                markdown += `\n`;
            });
            markdown += `\n`;
        }
        
        // 进行中任务
        if (inProgress.length > 0) {
            markdown += `## 🔄 进行中任务 (${inProgress.length})\n\n`;
            inProgress.forEach((todo, index) => {
                markdown += `${index + 1}. **${todo.title}**\n`;
                if (todo.description) {
                    markdown += `   > ${todo.description}\n`;
                }
                if (todo.subtasks && todo.subtasks.length > 0) {
                    const completedCount = todo.subtasks.filter(s => s.status === 'Completed').length;
                    markdown += `   - 子任务进度：${completedCount}/${todo.subtasks.length}\n`;
                }
                markdown += `\n`;
            });
            markdown += `\n`;
        }
        
        // 待处理任务
        if (pending.length > 0) {
            markdown += `## ⏳ 待处理任务 (${pending.length})\n\n`;
            pending.forEach((todo, index) => {
                markdown += `${index + 1}. **${todo.title}**\n`;
                if (todo.priority === 'High') {
                    markdown += `   > ⚠️ 高优先级\n`;
                }
                markdown += `\n`;
            });
        }
        
        markdown += `---\n\n`;
        markdown += `*由 Ferrous Scroll 生成*\n`;
        
        return markdown;
    }
    
    // 生成日期范围报告
    generateDateRangeReport(todos, startDate, endDate) {
        const formatDate = (date) => date.toLocaleDateString('zh-CN');
        
        let markdown = `# 📊 任务报告\n\n`;
        markdown += `> **时间范围**：${formatDate(startDate)} - ${formatDate(endDate)}\n\n`;
        markdown += `> **导出时间**：${new Date().toLocaleString('zh-CN')}\n\n`;
        markdown += `---\n\n`;
        
        // 使用与周报相同的结构
        return this.generateWeeklyReport(todos, startDate, endDate, '', '自定义范围').replace('# 📅 第  周工作报告', `# 📊 ${formatDate(startDate)} - ${formatDate(endDate)} 任务报告`);
    }
    
    // 下载周报文件
    downloadWeeklyMarkdown(content, year, weekNumber) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const filename = `Ferrous-Scroll-${year}年第${weekNumber}周报告.md`;
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`📥 导出周报: ${filename}`);
    }
    
    // 下载日期范围报告文件
    downloadDateRangeMarkdown(content, startDate, endDate) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const formatDate = (date) => date.toISOString().split('T')[0];
        const filename = `Ferrous-Scroll-${formatDate(startDate)}_${formatDate(endDate)}.md`;
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`📥 导出报告: ${filename}`);
    }

    // ==================== 配置管理 ====================

    // 加载配置
    async loadSettings() {
        try {
            console.log('📋 加载配置...');
            this.showLoading(true);
            
            const config = await this.invoke('get_config');
            console.log('✅ 配置已加载:', config);
            
            // 更新 UI 元素
            const themeSelect = document.getElementById('theme-select');
            const languageSelect = document.getElementById('language-select');
            const showCompletedToggle = document.getElementById('show-completed-toggle');
            const defaultPrioritySelect = document.getElementById('default-priority-select');
            
            if (themeSelect) themeSelect.value = config.app_settings.theme.toLowerCase();
            if (languageSelect) languageSelect.value = config.app_settings.language;
            if (showCompletedToggle) showCompletedToggle.checked = config.app_settings.show_completed_tasks;
            if (defaultPrioritySelect) defaultPrioritySelect.value = config.app_settings.default_priority;
            
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
            this.showError('加载配置失败：' + (error.message || JSON.stringify(error)));
        } finally {
            this.showLoading(false);
        }
    }

    // 保存配置
    async saveSettings() {
        try {
            console.log('💾 保存配置...');
            this.showLoading(true);
            
            // 从 UI 收集配置数据
            const themeValue = document.getElementById('theme-select').value;
            
            // 先获取当前配置（以保留数据库路径）
            const currentConfig = await this.invoke('get_config');
            
            const config = {
                database_path: currentConfig.database_path, // 保留后端设置的数据库路径
                app_settings: {
                    theme: themeValue, // 保持小写：auto, light, dark
                    language: document.getElementById('language-select').value,
                    show_completed_tasks: document.getElementById('show-completed-toggle').checked,
                    default_priority: document.getElementById('default-priority-select').value,
                    auto_backup: currentConfig.app_settings.auto_backup, // 保留后端设置
                    backup_interval_days: currentConfig.app_settings.backup_interval_days // 保留后端设置
                }
            };
            
            console.log('配置数据:', config);
            
            await this.invoke('save_config', { newConfig: config });
            
            console.log('✅ 配置已保存');
            this.showSuccess('✅ 配置已保存');
            
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            this.showError('保存配置失败：' + (error.message || JSON.stringify(error)));
        } finally {
            this.showLoading(false);
        }
    }

    // 重置配置为默认值
    async resetSettings() {
        try {
            const confirmed = await this.showConfirm(
                '重置配置',
                '确定要恢复默认设置吗？此操作不可撤销。'
            );
            
            if (!confirmed) {
                console.log('用户取消了重置');
                return;
            }
            
            console.log('🔄 重置配置为默认值...');
            this.showLoading(true);
            
            const defaultConfig = await this.invoke('reset_config');
            
            console.log('✅ 配置已重置:', defaultConfig);
            
            // 更新下拉菜单中的设置值（如果菜单是打开的）
            const dropdown = document.getElementById('settings-dropdown');
            if (dropdown && dropdown.style.display !== 'none') {
                const showCompletedToggle = document.getElementById('show-completed-toggle-menu');
                const defaultPrioritySelect = document.getElementById('default-priority-select-menu');
                
                if (showCompletedToggle) showCompletedToggle.checked = defaultConfig.app_settings.show_completed_tasks;
                if (defaultPrioritySelect) defaultPrioritySelect.value = defaultConfig.app_settings.default_priority;
            }
            
            this.showSuccess('✅ 配置已恢复默认值');
            
            // 关闭设置菜单
            this.hideSettingsMenu();
            
        } catch (error) {
            console.error('❌ 重置配置失败:', error);
            this.showError('重置配置失败：' + (error.message || JSON.stringify(error)));
        } finally {
            this.showLoading(false);
        }
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .error-message button, .success-message button {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .error-message button:hover {
        background-color: rgba(220, 38, 38, 0.1);
    }

    /* 子任务样式 */
    .subtasks-container {
        margin: 15px 0 10px 0;
        padding: 10px;
        background: rgba(248, 250, 252, 0.8);
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        min-height: 20px;
    }

    .subtasks-container.no-subtasks {
        display: none;
        margin: 0;
        padding: 0;
        min-height: 0;
        border: none;
    }
    
    .subtasks-container.has-form {
        display: block;
    }

    .subtasks-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .subtasks-title {
        font-weight: 600;
        color: #64748b;
        font-size: 0.9em;
    }

    .subtasks-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .subtask-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: white;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        transition: all 0.2s ease;
    }

    .subtask-item:hover {
        border-color: #cbd5e1;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .subtask-item.completed {
        opacity: 0.7;
        background: #f8fafc;
    }

    .subtask-checkbox {
        width: 16px;
        height: 16px;
        margin: 0;
        cursor: pointer;
    }

    .subtask-text {
        flex: 1;
        font-size: 0.9em;
        color: #1e293b;
        transition: all 0.2s ease;
    }

    .subtask-item.completed .subtask-text {
        text-decoration: line-through;
        color: #94a3b8;
    }

    .subtask-description {
        font-size: 0.8em;
        color: #64748b;
        font-style: italic;
        margin-left: 5px;
    }

    .subtask-delete-btn {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
        opacity: 0.6;
    }

    .subtask-delete-btn:hover {
        opacity: 1;
        background: rgba(239, 68, 68, 0.1);
    }

    /* 子任务表单样式 */
    .subtask-form-container {
        margin-top: 10px;
        animation: slideDown 0.2s ease;
    }

    .subtask-quick-add {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
        background: #f8fafc;
        border-radius: 6px;
        border: 1px dashed #cbd5e1;
    }

    .subtask-quick-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 0.9em;
        background: white;
        transition: all 0.2s ease;
        outline: none;
    }

    .subtask-quick-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .subtask-quick-input.error {
        border-color: #ef4444;
        animation: shake 0.3s ease;
    }

    .subtask-quick-input::placeholder {
        color: #94a3b8;
        font-size: 0.85em;
    }

    .subtask-quick-btn {
        padding: 8px;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        background: #3b82f6;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .subtask-quick-btn:hover {
        background: #2563eb;
        transform: scale(1.05);
    }

    .subtask-quick-btn:active {
        transform: scale(0.95);
    }

    .subtask-quick-btn i {
        font-size: 0.8em;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }

    .add-subtask-btn {
        background: white !important;
        color: #10b981 !important;
        border: 1px solid #10b981 !important;
    }

    .add-subtask-btn:hover {
        background: #f0fdf4 !important;
        border-color: #059669 !important;
        color: #059669 !important;
    }

    .subtask-indicator {
        font-size: 0.8em;
        color: #6b7280;
        margin-left: 5px;
    }

    .subtask-count {
        background: #e0f2fe;
        color: #0369a1;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 500;
    }

    /* 标签和分类管理样式 */
    .header-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }

    .header-btn {
        padding: 8px 16px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .header-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .manager-panel {
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        animation: slideDown 0.3s ease;
    }

    .manager-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e2e8f0;
    }

    .manager-header h3 {
        margin: 0;
        color: #1e293b;
        font-size: 1.3em;
    }

    .close-btn {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 1.5em;
        padding: 5px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .close-btn:hover {
        background: #f1f5f9;
        color: #64748b;
    }

    .create-form {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .create-form input[type="text"],
    .create-form input[type="color"] {
        padding: 10px 15px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.95em;
        transition: all 0.2s ease;
        outline: none;
    }

    .create-form input[type="text"] {
        flex: 1;
        min-width: 200px;
    }

    .create-form input[type="color"] {
        width: 60px;
        height: 42px;
        cursor: pointer;
    }

    .create-form input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .create-form button {
        padding: 10px 20px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.95em;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .create-form button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    .tag-list, .category-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .tag-item, .category-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 15px;
        background: #f8fafc;
        border-radius: 8px;
        border-left: 4px solid;
        transition: all 0.2s ease;
    }

    .tag-item:hover, .category-item:hover {
        background: #f1f5f9;
        transform: translateX(5px);
    }

    .tag-color-badge {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .tag-name {
        flex: 1;
        font-weight: 500;
        color: #1e293b;
    }

    .delete-btn-small {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        opacity: 0.6;
    }

    .delete-btn-small:hover {
        opacity: 1;
        background: rgba(239, 68, 68, 0.1);
    }

    .category-info {
        flex: 1;
    }

    .category-name {
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 4px;
    }

    .category-desc {
        font-size: 0.9em;
        color: #64748b;
        margin-bottom: 8px;
    }

    .category-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 6px;
    }

    .mini-tag {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: 500;
    }

    .category-stat {
        font-size: 0.85em;
        color: #6b7280;
        font-style: italic;
    }

    .category-actions {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .edit-btn-small {
        background: none;
        border: none;
        color: #3b82f6;
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        opacity: 0.6;
    }

    .edit-btn-small:hover {
        opacity: 1;
        background: rgba(59, 130, 246, 0.1);
    }

    .btn-primary {
        padding: 8px 20px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .btn-primary:hover {
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    /* 标签选择器模态框 */
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        align-items: center;
        justify-content: center;
    }

    .modal-content {
        background: white;
        border-radius: 12px;
        padding: 0;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        padding: 20px;
        border-bottom: 2px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .modal-header h3 {
        margin: 0;
        color: #1e293b;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .modal-footer {
        padding: 15px 20px;
        border-top: 2px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
    }

    .btn-secondary {
        padding: 8px 20px;
        background: #64748b;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-secondary:hover {
        background: #475569;
    }

    .notification-close-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
        margin-left: auto;
    }

    .notification-close-btn:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.1);
    }

    .tag-selector-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .tag-selector-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 15px;
        background: #f8fafc;
        border-radius: 8px;
        border-left: 4px solid;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .tag-selector-item:hover {
        background: #f1f5f9;
    }

    .tag-selector-item.selected {
        background: #e0f2fe;
        border-left-color: #0369a1;
    }

    .tag-selector-item i {
        margin-left: auto;
        color: #10b981;
    }

    .selected-tags {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        flex: 1;
    }

    .selected-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 16px;
        border: 1px solid;
        font-size: 0.9em;
        cursor: default;
    }

    .selected-tag .tag-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .selected-tag i {
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .selected-tag i:hover {
        opacity: 1;
    }

    .tag-selector-btn {
        padding: 10px 20px;
        background: white;
        color: #3b82f6;
        border: 2px solid #3b82f6;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.95em;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tag-selector-btn:hover {
        background: #eff6ff;
    }

    /* 任务标签显示 */
    .todo-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 10px;
    }

    .todo-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 12px;
        border: 1px solid;
        font-size: 0.85em;
        font-weight: 500;
    }

    .todo-tag .tag-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    .empty-message {
        text-align: center;
        padding: 40px 20px;
        color: #94a3b8;
        font-size: 0.95em;
    }

    .search-input {
        padding: 8px 15px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.9em;
        width: 200px;
        transition: all 0.2s ease;
        outline: none;
    }

    .search-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    /* 编辑分类表单样式 */
    .edit-category-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .edit-category-form .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .edit-category-form label {
        font-weight: 600;
        color: #1e293b;
        font-size: 0.95em;
    }

    .edit-category-form input[type="text"] {
        padding: 10px 15px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.95em;
        transition: all 0.2s ease;
        outline: none;
    }

    .edit-category-form input[type="color"] {
        width: 80px;
        height: 45px;
        padding: 5px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .edit-category-form input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .category-form {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }

    /* 页面标签页导航 */
    .page-tabs {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid var(--light-gray);
    }

    .tab-btn {
        padding: 12px 28px;
        background: var(--pure-white);
        color: var(--medium-gray);
        border: 2px solid var(--light-gray);
        border-radius: 10px;
        cursor: pointer;
        font-size: 1rem;
        font-family: var(--font-serif);
        font-weight: 500;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-sm);
        position: relative;
        overflow: hidden;
    }

    .tab-btn i {
        margin-right: 8px;
        transition: transform 0.3s ease;
    }

    .tab-btn:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--secondary-blue);
        color: var(--secondary-blue);
    }

    .tab-btn:hover i {
        transform: scale(1.1);
    }

    .tab-btn.active {
        background: linear-gradient(135deg, var(--secondary-blue), var(--primary-blue));
        color: var(--pure-white);
        border-color: var(--primary-blue);
        box-shadow: var(--shadow-blue);
        transform: translateY(-2px);
    }

    .tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--gold);
    }

    /* 页面切换动画 */
    .scroll-page {
        display: none;
        animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .scroll-page.active {
        display: block;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* 管理页面内容区域 */
    .manager-content {
        margin-top: 20px;
    }

    .manager-list-wrapper {
        margin-top: 30px;
        background: var(--pure-white);
        border-radius: 12px;
        padding: 25px;
        box-shadow: var(--shadow-md);
        border: 1px solid var(--light-gray);
        max-height: 600px;
        overflow-y: auto;
    }

    .manager-list-wrapper::-webkit-scrollbar {
        width: 8px;
    }

    .manager-list-wrapper::-webkit-scrollbar-track {
        background: var(--off-white);
        border-radius: 4px;
    }

    .manager-list-wrapper::-webkit-scrollbar-thumb {
        background: var(--light-gray);
        border-radius: 4px;
    }

    .manager-list-wrapper::-webkit-scrollbar-thumb:hover {
        background: var(--medium-gray);
    }

    /* 导出按钮区域 */
    .export-section {
        margin-top: 30px;
        text-align: center;
        padding: 20px;
    }

    .export-btn {
        padding: 14px 32px;
        background: linear-gradient(135deg, var(--gold), var(--dark-gold));
        color: var(--pure-white);
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-size: 1.1rem;
        font-family: var(--font-serif);
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-gold);
        position: relative;
        overflow: hidden;
    }

    .export-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        transition: left 0.5s;
    }

    .export-btn:hover::before {
        left: 100%;
    }

    .export-btn:hover {
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 8px 20px rgba(212, 175, 55, 0.4);
    }

    .export-btn:active {
        transform: translateY(-1px);
    }

    .export-btn i {
        margin-right: 10px;
        font-size: 1.2rem;
    }
`;
document.head.appendChild(style);

// 初始化应用（显式添加到全局作用域以支持内联事件处理器）
window.todoApp = null;
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
});

// 全局错误处理
window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ 未处理的Promise错误:', event.reason);
    console.error('错误堆栈:', event.reason?.stack || '无堆栈信息');
    console.error('完整事件:', event);
    
    if (window.todoApp) {
        const errorMsg = event.reason?.message || event.reason || '未知错误';
        window.todoApp.showError('发生错误: ' + errorMsg);
    }
    
    // 阻止默认的错误处理，这样错误不会在控制台重复显示
    event.preventDefault();
});