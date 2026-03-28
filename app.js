let currentUser = 'user';
let activeWindows = [];
let nextWindowId = 1;
let zIndex = 100;
let isLoggedIn = false;
let autoArrange = true;
let iconGridSize = 90;
let iconMargin = 12;

let browserHistory = {};
let browserBookmarks = {};

let desktop, taskbarApps, windowsContainer, startMenu, startBtn, clock, showDesktopBtn;
let notification, settingsWindow, wallpaper, usernameSpan, loginOverlay, loginContainer;
let selectionRect = null;
let isSelecting = false;
let selectStartX = 0, selectStartY = 0;
let selectedIcons = [];
let dragData = null;

let systemTray = null;
let volumeLevel = 70;
let isMuted = false;
let networkStatus = 'connected';
let batteryLevel = 85;
let isCharging = true;
let inputMethod = '中文';

let cachedConfig = { theme: 'dark', wallpaper: null };
let appsList = [];

const DEFAULT_APPS = [
    { id: '1', name: '记事本', icon: '📝', iconPath: null, executable: 'notepad.exe', args: '', type: 'system', width: null, height: null, x: 12, y: 12 },
    { id: '2', name: '计算器', icon: '🧮', iconPath: null, executable: 'calc.exe', args: '', type: 'system', width: null, height: null, x: 12, y: 97 },
    { id: '3', name: '浏览器', icon: '🌐', iconPath: null, executable: '', args: '', type: 'builtin', width: 1000, height: 700, x: 12, y: 182 }
];

function autoArrangeIcons() {
    const cols = Math.max(1, Math.floor((window.innerWidth - iconMargin) / iconGridSize));
    appsList.forEach((app, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        app.x = iconMargin + col * iconGridSize;
        app.y = iconMargin + row * (iconGridSize - 10);
    });
    renderDesktop();
    saveApps();
}

window.addEventListener('resize', () => {
    if (autoArrange) autoArrangeIcons();
});

document.addEventListener('DOMContentLoaded', () => {
    loginOverlay = document.getElementById('login-overlay');
    loginContainer = document.getElementById('login-container');
    const loginBtn = document.getElementById('login-btn');
    const guestBtn = document.getElementById('guest-login-btn');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    
    if (loginBtn) loginBtn.onclick = () => doLogin(usernameInput, passwordInput);
    if (guestBtn) guestBtn.onclick = () => guestLogin();
    if (passwordInput) passwordInput.onkeypress = (e) => { if (e.key === 'Enter') doLogin(usernameInput, passwordInput); };
    
    const savedBg = localStorage.getItem('HwBOS_login_bg');
    if (savedBg && loginContainer) {
        loginContainer.style.backgroundImage = `url(${savedBg})`;
        loginContainer.style.backgroundSize = 'cover';
        loginContainer.style.backgroundPosition = 'center';
    }
    
    const savedVolume = localStorage.getItem('HwBOS_volume');
    if (savedVolume !== null) volumeLevel = parseInt(savedVolume);
    const savedMuted = localStorage.getItem('HwBOS_muted');
    if (savedMuted !== null) isMuted = savedMuted === 'true';
    const savedInputMethod = localStorage.getItem('HwBOS_inputMethod');
    if (savedInputMethod !== null) inputMethod = savedInputMethod;
    
    const savedApps = localStorage.getItem('HwBOS_apps');
    if (savedApps) {
        appsList = JSON.parse(savedApps);
    } else {
        appsList = JSON.parse(JSON.stringify(DEFAULT_APPS));
        saveApps();
    }
    
    const savedTheme = localStorage.getItem('HwBOS_theme');
    if (savedTheme === 'light') document.body.classList.add('light-theme');
    
    const savedWallpaper = localStorage.getItem('HwBOS_wallpaper');
    if (savedWallpaper) {
        const wallpaperElem = document.getElementById('wallpaper');
        if (wallpaperElem) {
            wallpaperElem.style.backgroundImage = `url(${savedWallpaper})`;
            wallpaperElem.style.backgroundSize = 'cover';
        }
    }
    
    loginOverlay.style.display = 'flex';
});

function doLogin(usernameInput, passwordInput) {
    const username = usernameInput.value.trim();
    if (!username) { showLoginError('请输入用户名'); return; }
    currentUser = username;
    localStorage.setItem('HwBOS_user', username);
    finishLogin();
}

function guestLogin() {
    currentUser = '访客';
    finishLogin();
}

function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
    }
}

function finishLogin() {
    loginOverlay.style.display = 'none';
    document.getElementById('desktop-content').style.display = 'block';
    isLoggedIn = true;
    
    desktop = document.getElementById('desktop');
    taskbarApps = document.getElementById('taskbarApps');
    windowsContainer = document.getElementById('windows');
    startMenu = document.getElementById('startMenu');
    startBtn = document.getElementById('startBtn');
    clock = document.getElementById('clock');
    showDesktopBtn = document.getElementById('showDesktop');
    notification = document.getElementById('notification');
    settingsWindow = document.getElementById('settingsWindow');
    wallpaper = document.getElementById('wallpaper');
    usernameSpan = document.getElementById('username');
    
    const savedTheme = localStorage.getItem('HwBOS_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.body.style.background = '#f0f0f0';
    } else {
        document.body.classList.remove('light-theme');
        document.body.style.background = '#1a2c3e';
    }
    
    const savedWallpaper = localStorage.getItem('HwBOS_wallpaper');
    if (savedWallpaper && wallpaper) {
        wallpaper.style.backgroundImage = `url(${savedWallpaper})`;
        wallpaper.style.backgroundSize = 'cover';
    }
    
    if (usernameSpan) usernameSpan.innerText = currentUser;
    
    if (autoArrange) autoArrangeIcons();
    renderDesktop();
    updateClock();
    setInterval(updateClock, 1000);
    bindEvents();
    initDesktopSelection();
    createSystemTray();
    startSystemTrayUpdates();
    showNotification('欢迎', `欢迎使用 HwBOS\n当前用户：${currentUser}`);
}

function saveApps() {
    localStorage.setItem('HwBOS_apps', JSON.stringify(appsList));
}

function addAppDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
        <div class="dialog">
            <div class="dialog-header">
                <span>添加应用</span>
                <button class="dialog-close">✖</button>
            </div>
            <div class="dialog-content">
                <div class="form-group">
                    <label>应用名称 *</label>
                    <input type="text" id="app-name" placeholder="例如: 微信">
                </div>
                <div class="form-group">
                    <label>可执行文件路径</label>
                    <input type="text" id="app-path" placeholder="例如: C:\\Program Files\\WeChat\\WeChat.exe">
                    <button id="browse-app-btn" class="browse-btn">浏览</button>
                </div>
                <div class="form-group">
                    <label>启动参数（可选）</label>
                    <input type="text" id="app-args" placeholder="例如: --start">
                </div>
                <div class="form-group">
                    <label>图标文件（可选）</label>
                    <input type="text" id="app-icon-path" placeholder="选择图标文件 (.ico, .png, .jpg)">
                    <button id="browse-icon-btn" class="browse-btn">浏览</button>
                </div>
                <div class="form-group">
                    <label>应用类型</label>
                    <select id="app-type">
                        <option value="system">系统应用（调用外部程序）</option>
                        <option value="builtin">内置应用（模拟窗口）</option>
                    </select>
                </div>
                <div class="form-group builtin-options" style="display: none;">
                    <label>窗口宽度</label>
                    <input type="number" id="app-width" value="800">
                    <label>窗口高度</label>
                    <input type="number" id="app-height" value="600">
                </div>
                <div class="form-group">
                    <label>图标预览</label>
                    <div id="icon-preview" class="icon-preview">📄</div>
                </div>
            </div>
            <div class="dialog-footer">
                <button id="confirm-add" class="btn-primary">添加</button>
                <button id="cancel-add" class="btn-secondary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    const appTypeSelect = dialog.querySelector('#app-type');
    const builtinOptions = dialog.querySelector('.builtin-options');
    const iconPreview = dialog.querySelector('#icon-preview');
    const iconPathInput = dialog.querySelector('#app-icon-path');
    const appPathInput = dialog.querySelector('#app-path');
    
    appTypeSelect.onchange = () => {
        builtinOptions.style.display = appTypeSelect.value === 'builtin' ? 'block' : 'none';
    };
    
    iconPathInput.oninput = () => {
        const path = iconPathInput.value;
        if (path && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico'))) {
            iconPreview.innerHTML = `<img src="${path}" style="width: 40px; height: 40px; object-fit: contain;">`;
        } else {
            iconPreview.innerHTML = '📄';
        }
    };
    
    dialog.querySelector('#browse-app-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                appPathInput.value = file.path || file.name;
            }
        };
        input.click();
    };
    
    dialog.querySelector('#browse-icon-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    iconPathInput.value = ev.target.result;
                    iconPreview.innerHTML = `<img src="${ev.target.result}" style="width: 40px; height: 40px; object-fit: contain;">`;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };
    
    dialog.querySelector('#confirm-add').onclick = () => {
        const name = dialog.querySelector('#app-name').value.trim();
        if (!name) {
            showNotification('错误', '请输入应用名称', 2000);
            return;
        }
        
        const newApp = {
            id: Date.now().toString(),
            name: name,
            icon: '📄',
            iconPath: dialog.querySelector('#app-icon-path').value || null,
            executable: dialog.querySelector('#app-path').value || '',
            args: dialog.querySelector('#app-args').value || '',
            type: appTypeSelect.value,
            width: parseInt(dialog.querySelector('#app-width')?.value) || 800,
            height: parseInt(dialog.querySelector('#app-height')?.value) || 600,
            x: 0,
            y: 0
        };
        
        appsList.push(newApp);
        if (autoArrange) {
            autoArrangeIcons();
        } else {
            const lastApp = appsList[appsList.length - 2];
            newApp.x = (lastApp?.x || iconMargin) + iconGridSize;
            newApp.y = lastApp?.y || iconMargin;
            if (newApp.x + iconGridSize > window.innerWidth) {
                newApp.x = iconMargin;
                newApp.y = (lastApp?.y || iconMargin) + iconGridSize;
            }
        }
        
        saveApps();
        renderDesktop();
        renderAppsManager();
        dialog.remove();
        showNotification('成功', `应用 "${name}" 已添加`, 2000);
    };
    
    dialog.querySelector('#cancel-add').onclick = () => dialog.remove();
    dialog.querySelector('.dialog-close').onclick = () => dialog.remove();
}

function editApp(app) {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
        <div class="dialog">
            <div class="dialog-header">
                <span>编辑应用</span>
                <button class="dialog-close">✖</button>
            </div>
            <div class="dialog-content">
                <div class="form-group">
                    <label>应用名称 *</label>
                    <input type="text" id="app-name" value="${app.name.replace(/"/g, '&quot;')}">
                </div>
                <div class="form-group">
                    <label>可执行文件路径</label>
                    <input type="text" id="app-path" value="${(app.executable || '').replace(/"/g, '&quot;')}">
                    <button id="browse-app-btn" class="browse-btn">浏览</button>
                </div>
                <div class="form-group">
                    <label>启动参数</label>
                    <input type="text" id="app-args" value="${(app.args || '').replace(/"/g, '&quot;')}">
                </div>
                <div class="form-group">
                    <label>图标文件</label>
                    <input type="text" id="app-icon-path" value="${(app.iconPath || '').replace(/"/g, '&quot;')}">
                    <button id="browse-icon-btn" class="browse-btn">浏览</button>
                </div>
                <div class="form-group">
                    <label>应用类型</label>
                    <select id="app-type">
                        <option value="system" ${app.type === 'system' ? 'selected' : ''}>系统应用（调用外部程序）</option>
                        <option value="builtin" ${app.type === 'builtin' ? 'selected' : ''}>内置应用（模拟窗口）</option>
                    </select>
                </div>
                <div class="form-group builtin-options" style="display: ${app.type === 'builtin' ? 'block' : 'none'};">
                    <label>窗口宽度</label>
                    <input type="number" id="app-width" value="${app.width || 800}">
                    <label>窗口高度</label>
                    <input type="number" id="app-height" value="${app.height || 600}">
                </div>
                <div class="form-group">
                    <label>图标预览</label>
                    <div id="icon-preview" class="icon-preview">${app.iconPath ? `<img src="${app.iconPath}" style="width: 40px; height: 40px; object-fit: contain;">` : (app.icon || '📄')}</div>
                </div>
            </div>
            <div class="dialog-footer">
                <button id="confirm-edit" class="btn-primary">保存</button>
                <button id="cancel-edit" class="btn-secondary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    const appTypeSelect = dialog.querySelector('#app-type');
    const builtinOptions = dialog.querySelector('.builtin-options');
    const iconPreview = dialog.querySelector('#icon-preview');
    const iconPathInput = dialog.querySelector('#app-icon-path');
    
    appTypeSelect.onchange = () => {
        builtinOptions.style.display = appTypeSelect.value === 'builtin' ? 'block' : 'none';
    };
    
    iconPathInput.oninput = () => {
        const path = iconPathInput.value;
        if (path && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico'))) {
            iconPreview.innerHTML = `<img src="${path}" style="width: 40px; height: 40px; object-fit: contain;">`;
        } else {
            iconPreview.innerHTML = '📄';
        }
    };
    
    dialog.querySelector('#browse-app-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                dialog.querySelector('#app-path').value = file.path || file.name;
            }
        };
        input.click();
    };
    
    dialog.querySelector('#browse-icon-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    iconPathInput.value = ev.target.result;
                    iconPreview.innerHTML = `<img src="${ev.target.result}" style="width: 40px; height: 40px; object-fit: contain;">`;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };
    
    dialog.querySelector('#confirm-edit').onclick = () => {
        const name = dialog.querySelector('#app-name').value.trim();
        if (!name) {
            showNotification('错误', '请输入应用名称', 2000);
            return;
        }
        
        app.name = name;
        app.iconPath = dialog.querySelector('#app-icon-path').value || null;
        app.executable = dialog.querySelector('#app-path').value || '';
        app.args = dialog.querySelector('#app-args').value || '';
        app.type = appTypeSelect.value;
        app.width = parseInt(dialog.querySelector('#app-width')?.value) || 800;
        app.height = parseInt(dialog.querySelector('#app-height')?.value) || 600;
        
        saveApps();
        renderDesktop();
        renderAppsManager();
        dialog.remove();
        showNotification('成功', `应用 "${name}" 已更新`, 2000);
    };
    
    dialog.querySelector('#cancel-edit').onclick = () => dialog.remove();
    dialog.querySelector('.dialog-close').onclick = () => dialog.remove();
}

function deleteApp(app) {
    if (confirm(`确定要删除应用 "${app.name}" 吗？`)) {
        const index = appsList.findIndex(a => a.id === app.id);
        if (index !== -1) appsList.splice(index, 1);
        saveApps();
        if (autoArrange) autoArrangeIcons();
        renderDesktop();
        renderAppsManager();
        showNotification('成功', `应用 "${app.name}" 已删除`, 2000);
    }
}

function renderAppsManager() {
    const container = document.getElementById('apps-manager-list');
    if (!container) return;
    
    container.innerHTML = '';
    appsList.forEach(app => {
        const item = document.createElement('div');
        item.className = 'app-manager-item';
        item.innerHTML = `
            <div class="app-manager-icon">${app.iconPath ? `<img src="${app.iconPath}" style="width: 32px; height: 32px;">` : (app.icon || '📄')}</div>
            <div class="app-manager-info">
                <div class="app-manager-name">${app.name}</div>
                <div class="app-manager-path">${app.executable || '内置应用'}</div>
            </div>
            <div class="app-manager-actions">
                <button class="edit-app-btn" data-id="${app.id}">编辑</button>
                <button class="delete-app-btn" data-id="${app.id}">删除</button>
            </div>
        `;
        item.querySelector('.edit-app-btn').onclick = () => editApp(app);
        item.querySelector('.delete-app-btn').onclick = () => deleteApp(app);
        container.appendChild(item);
    });
}

function launchApp(app) {
    if (app.type === 'system' && app.executable) {
        try {
            if (window.nw) {
                const { exec } = require('child_process');
                exec(`"${app.executable}" ${app.args}`);
                showNotification('启动成功', `${app.name} 已启动`, 2000);
            } else {
                showNotification('提示', '请在 NW.js 环境中运行以启动外部程序', 2000);
            }
        } catch(e) {
            showNotification('启动失败', `无法启动 ${app.name}`, 2000);
        }
    } else if (app.type === 'builtin') {
        if (app.name === '浏览器') {
            createBrowserWindow();
        } else {
            createWindow(app);
        }
    } else {
        createWindow(app);
    }
}

function createWindow(app) {
    const winId = nextWindowId++;
    const win = document.createElement('div');
    win.className = 'window';
    win.id = `win-${winId}`;
    win.style.width = `${app.width || 500}px`;
    win.style.height = `${app.height || 400}px`;
    win.style.left = `${(window.innerWidth - (app.width || 500)) / 2}px`;
    win.style.top = `${(window.innerHeight - (app.height || 400) - 48) / 2}px`;
    win.style.zIndex = zIndex++;
    win.innerHTML = `
        <div class="window-header">
            <div class="window-title">
                <span>${app.iconPath ? `<img src="${app.iconPath}" style="width: 16px; height: 16px;">` : (app.icon || '📄')}</span>
                <span>${app.name}</span>
            </div>
            <div class="window-controls">
                <span class="minimize-btn">🗕</span>
                <span class="maximize-btn">🗖</span>
                <span class="close-btn">✖</span>
            </div>
        </div>
        <div class="window-content">
            <div style="text-align:center; padding:40px;">
                <h2>欢迎使用 ${app.name}</h2>
                <p>这是一个内置应用</p>
            </div>
        </div>
    `;
    setupWindow(win, winId, app);
}

function setupWindow(win, winId, app) {
    windowsContainer.appendChild(win);
    win.style.opacity = '0';
    win.style.transform = 'scale(0.7) translateY(50px)';
    win.style.transition = 'all 0.3s ease';
    requestAnimationFrame(() => {
        win.style.opacity = '1';
        win.style.transform = 'scale(1) translateY(0)';
    });
    
    const taskBtn = document.createElement('div');
    taskBtn.className = 'taskbar-app';
    taskBtn.setAttribute('data-window', winId);
    taskBtn.innerHTML = `${app.iconPath ? `<img src="${app.iconPath}" style="width: 14px; height: 14px;">` : (app.icon || '📄')} ${app.name}`;
    taskBtn.onclick = () => {
        win.style.zIndex = zIndex++;
        updateTaskbarActive(winId);
        if (win.style.display === 'none') win.style.display = 'flex';
    };
    taskbarApps.appendChild(taskBtn);
    
    let isMaximized = false, savedRect = {};
    win.querySelector('.close-btn').onclick = () => {
        win.remove();
        taskBtn.remove();
        activeWindows = activeWindows.filter(w => w.id !== winId);
    };
    win.querySelector('.minimize-btn').onclick = () => { win.style.display = 'none'; };
    win.querySelector('.maximize-btn').onclick = () => {
        if (isMaximized) {
            win.style.left = `${savedRect.left}px`;
            win.style.top = `${savedRect.top}px`;
            win.style.width = `${savedRect.width}px`;
            win.style.height = `${savedRect.height}px`;
        } else {
            savedRect = { left: win.offsetLeft, top: win.offsetTop, width: win.offsetWidth, height: win.offsetHeight };
            win.style.left = '0px';
            win.style.top = '0px';
            win.style.width = `${window.innerWidth}px`;
            win.style.height = `${window.innerHeight - 48}px`;
        }
        isMaximized = !isMaximized;
    };
    
    const header = win.querySelector('.window-header');
    let isDragging = false, dragX, dragY;
    header.onmousedown = (e) => {
        if (e.target.closest('.window-controls')) return;
        isDragging = true;
        dragX = e.clientX - win.offsetLeft;
        dragY = e.clientY - win.offsetTop;
        win.style.zIndex = zIndex++;
    };
    document.onmousemove = (e) => {
        if (!isDragging) return;
        let left = e.clientX - dragX;
        let top = e.clientY - dragY;
        left = Math.max(0, Math.min(left, window.innerWidth - win.offsetWidth));
        top = Math.max(0, Math.min(top, window.innerHeight - win.offsetHeight - 48));
        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
    };
    document.onmouseup = () => { isDragging = false; };
    
    let isResizing = false, startX, startY, startW, startH;
    win.onmousemove = (e) => {
        const rect = win.getBoundingClientRect();
        win.style.cursor = (e.clientX >= rect.right - 10 && e.clientY >= rect.bottom - 10) ? 'se-resize' : 'default';
    };
    win.onmousedown = (e) => {
        const rect = win.getBoundingClientRect();
        if (e.clientX >= rect.right - 10 && e.clientY >= rect.bottom - 10) {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = parseInt(win.style.width);
            startH = parseInt(win.style.height);
        }
    };
    document.onmousemove = (e) => {
        if (!isResizing) return;
        win.style.width = `${Math.max(300, startW + e.clientX - startX)}px`;
        win.style.height = `${Math.max(200, startH + e.clientY - startY)}px`;
    };
    document.onmouseup = () => { isResizing = false; };
    win.onclick = () => {
        win.style.zIndex = zIndex++;
        updateTaskbarActive(winId);
    };
    activeWindows.push({ id: winId, element: win, taskBtn });
    updateTaskbarActive(winId);
}

function createBrowserWindow() {
    const winId = nextWindowId++;
    const win = document.createElement('div');
    win.className = 'window';
    win.id = `win-${winId}`;
    win.style.width = '1000px';
    win.style.height = '700px';
    win.style.left = `${(window.innerWidth - 1000) / 2}px`;
    win.style.top = `${(window.innerHeight - 700 - 48) / 2}px`;
    win.style.zIndex = zIndex++;
    win.innerHTML = `
        <div class="window-header">
            <div class="window-title"><span>🌐</span><span>浏览器</span></div>
            <div class="window-controls">
                <span class="minimize-btn">🗕</span>
                <span class="maximize-btn">🗖</span>
                <span class="close-btn">✖</span>
            </div>
        </div>
        <div class="window-content" style="padding:0;display:flex;flex-direction:column;height:100%;">
            <div class="browser-toolbar">
                <div class="browser-nav-buttons">
                    <button class="browser-nav-back">←</button>
                    <button class="browser-nav-forward">→</button>
                    <button class="browser-nav-refresh">↻</button>
                    <button class="browser-nav-home">🏠</button>
                </div>
                <div class="browser-address-bar">
                    <input type="text" class="browser-url" placeholder="输入网址...">
                    <button class="browser-go">前往</button>
                </div>
                <div class="browser-menu-buttons">
                    <button class="browser-bookmark-btn">⭐</button>
                    <button class="browser-history-btn">📜</button>
                </div>
            </div>
            <div class="browser-bookmarks-bar">
                <span class="bookmarks-label">📑 书签栏</span>
                <div class="bookmarks-list"></div>
            </div>
            <iframe class="browser-frame" style="flex:1;border:none;"></iframe>
        </div>
    `;
    setupWindow(win, winId, { name: '浏览器', icon: '🌐' });
    
    const iframe = win.querySelector('.browser-frame');
    const urlInput = win.querySelector('.browser-url');
    const backBtn = win.querySelector('.browser-nav-back');
    const forwardBtn = win.querySelector('.browser-nav-forward');
    const refreshBtn = win.querySelector('.browser-nav-refresh');
    const homeBtn = win.querySelector('.browser-nav-home');
    const goBtn = win.querySelector('.browser-go');
    const bookmarkBtn = win.querySelector('.browser-bookmark-btn');
    const historyBtn = win.querySelector('.browser-history-btn');
    const bookmarksList = win.querySelector('.bookmarks-list');
    
    let currentUrl = 'https://www.bing.com';
    let historyList = [currentUrl];
    let historyIndex = 0;
    
    if (!browserHistory[winId]) browserHistory[winId] = [];
    if (browserHistory[winId].length > 0) {
        historyList = browserHistory[winId];
        historyIndex = historyList.length - 1;
        currentUrl = historyList[historyIndex];
    }
    urlInput.value = currentUrl;
    iframe.src = currentUrl;
    
    function loadBookmarks() {
        bookmarksList.innerHTML = '';
        const bookmarks = browserBookmarks[winId] || [];
        bookmarks.forEach((bookmark, idx) => {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.innerHTML = `<span>🔖</span><span>${bookmark.title || bookmark.url}</span><span class="bookmark-remove">✖</span>`;
            item.onclick = (e) => {
                if (e.target.classList.contains('bookmark-remove')) return;
                currentUrl = bookmark.url;
                urlInput.value = currentUrl;
                iframe.src = currentUrl;
                addToHistory(currentUrl);
            };
            item.querySelector('.bookmark-remove').onclick = (e) => {
                e.stopPropagation();
                bookmarks.splice(idx, 1);
                browserBookmarks[winId] = bookmarks;
                saveBrowserData();
                loadBookmarks();
            };
            bookmarksList.appendChild(item);
        });
    }
    
    function addToHistory(url) {
        if (historyList[historyList.length - 1] !== url) {
            historyList.push(url);
            historyIndex = historyList.length - 1;
            if (historyList.length > 50) historyList.shift();
            browserHistory[winId] = historyList;
            saveBrowserData();
        }
    }
    
    function loadUrl(url) {
        if (!url.startsWith('http')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = 'https://www.bing.com/search?q=' + encodeURIComponent(url);
            }
        }
        currentUrl = url;
        urlInput.value = url;
        iframe.src = url;
        addToHistory(url);
        backBtn.disabled = historyIndex <= 0;
        forwardBtn.disabled = historyIndex >= historyList.length - 1;
    }
    
    goBtn.onclick = () => { let url = urlInput.value.trim(); if (url) loadUrl(url); };
    urlInput.onkeypress = (e) => { if (e.key === 'Enter') { let url = urlInput.value.trim(); if (url) loadUrl(url); } };
    backBtn.onclick = () => { if (historyIndex > 0) { historyIndex--; currentUrl = historyList[historyIndex]; urlInput.value = currentUrl; iframe.src = currentUrl; } };
    forwardBtn.onclick = () => { if (historyIndex < historyList.length - 1) { historyIndex++; currentUrl = historyList[historyIndex]; urlInput.value = currentUrl; iframe.src = currentUrl; } };
    refreshBtn.onclick = () => { iframe.src = currentUrl; };
    homeBtn.onclick = () => loadUrl('https://www.bing.com');
    bookmarkBtn.onclick = () => {
        let title = prompt('书签名称', currentUrl);
        if (title) {
            if (!browserBookmarks[winId]) browserBookmarks[winId] = [];
            browserBookmarks[winId].push({ title, url: currentUrl });
            saveBrowserData();
            loadBookmarks();
            showNotification('书签已添加', `已添加到收藏夹: ${title}`);
        }
    };
    historyBtn.onclick = () => {
        const hist = browserHistory[winId] || [];
        if (hist.length === 0) { showNotification('历史记录', '暂无浏览记录'); return; }
        let msg = '📜 浏览历史:\n';
        hist.slice().reverse().forEach((url, i) => { msg += `${i + 1}. ${url}\n`; });
        alert(msg);
    };
    iframe.onload = () => {
        try {
            const url = iframe.contentWindow.location.href;
            if (url !== currentUrl && url !== 'about:blank') {
                currentUrl = url;
                urlInput.value = url;
                addToHistory(url);
            }
        } catch (e) {}
    };
    loadBookmarks();
    backBtn.disabled = historyIndex <= 0;
    forwardBtn.disabled = historyIndex >= historyList.length - 1;
}

function saveBrowserData() {
    localStorage.setItem('HwBOS_browserHistory', JSON.stringify(browserHistory));
    localStorage.setItem('HwBOS_browserBookmarks', JSON.stringify(browserBookmarks));
}

function renderDesktop() {
    if (!desktop) return;
    desktop.innerHTML = '';
    appsList.forEach((app, i) => {
        const icon = document.createElement('div');
        icon.className = 'desktop-icon';
        icon.style.left = `${app.x || (12 + (i % 4) * 90)}px`;
        icon.style.top = `${app.y || (12 + Math.floor(i / 4) * 85)}px`;
        if (app.iconPath) {
            icon.innerHTML = `<div class="icon"><img src="${app.iconPath}" style="width: 40px; height: 40px; object-fit: contain;"></div><div class="label">${app.name}</div>`;
        } else {
            icon.innerHTML = `<div class="icon">${app.icon || '📄'}</div><div class="label">${app.name}</div>`;
        }
        icon.onclick = (e) => {
            e.stopPropagation();
            clearSelection();
            launchApp(app);
        };
        icon.oncontextmenu = (e) => showAppContextMenu(e, app, icon);
        
        // 添加拖拽功能
        icon.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (autoArrange) return;
            dragData = {
                app: app,
                icon: icon,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: parseInt(icon.style.left),
                startTop: parseInt(icon.style.top)
            };
            icon.style.cursor = 'grabbing';
            icon.style.zIndex = 1000;
        };
        
        desktop.appendChild(icon);
    });
    desktop.oncontextmenu = showDesktopContextMenu;
}

document.onmousemove = (e) => {
    if (dragData && !autoArrange) {
        const dx = e.clientX - dragData.startX;
        const dy = e.clientY - dragData.startY;
        dragData.icon.style.left = `${dragData.startLeft + dx}px`;
        dragData.icon.style.top = `${dragData.startTop + dy}px`;
    }
};

document.onmouseup = () => {
    if (dragData && !autoArrange) {
        dragData.app.x = parseInt(dragData.icon.style.left);
        dragData.app.y = parseInt(dragData.icon.style.top);
        saveApps();
        dragData.icon.style.cursor = '';
        dragData.icon.style.zIndex = '';
        dragData = null;
    }
};

function renderStartMenu() {
    const appsListDiv = document.getElementById('appsList');
    if (!appsListDiv) return;
    appsListDiv.innerHTML = '';
    appsList.forEach(app => {
        const item = document.createElement('div');
        item.className = 'app-item';
        if (app.iconPath) {
            item.innerHTML = `<span><img src="${app.iconPath}" style="width: 20px; height: 20px;"></span><span>${app.name}</span>`;
        } else {
            item.innerHTML = `<span>${app.icon || '📄'}</span><span>${app.name}</span>`;
        }
        item.onclick = () => {
            launchApp(app);
            startMenu.classList.remove('show');
        };
        appsListDiv.appendChild(item);
    });
}

function showAppContextMenu(e, app, iconEl) {
    e.preventDefault();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" data-action="open">打开</div>
        <div class="context-menu-item" data-action="edit">编辑</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" data-action="delete">删除</div>
        <div class="context-menu-item" data-action="properties">属性</div>
    `;
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.display = 'block';
    document.body.appendChild(menu);
    menu.addEventListener('click', (ev) => {
        const action = ev.target.dataset.action;
        if (action === 'open') launchApp(app);
        if (action === 'edit') editApp(app);
        if (action === 'delete') deleteApp(app);
        if (action === 'properties') {
            alert(`名称: ${app.name}\n类型: ${app.type === 'system' ? '系统应用' : '内置应用'}\n路径: ${app.executable || '无'}\n图标: ${app.iconPath || app.icon || '默认'}`);
        }
        menu.remove();
    });
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
}

function showDesktopContextMenu(e) {
    e.preventDefault();
    let menu = document.getElementById('desktop-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'desktop-context-menu';
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="refresh">刷新桌面</div>
            <div class="context-menu-item" data-action="add-software">添加应用</div>
            <div class="context-menu-item" data-action="auto-arrange">${autoArrange ? '✓ 自动排序' : '自动排序'}</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="personalization">个性化</div>
            <div class="context-menu-item" data-action="resolution">屏幕分辨率</div>
        `;
        document.body.appendChild(menu);
        menu.addEventListener('click', (ev) => {
            const action = ev.target.dataset.action;
            if (action === 'refresh') renderDesktop();
            if (action === 'add-software') addAppDialog();
            if (action === 'auto-arrange') {
                autoArrange = !autoArrange;
                if (autoArrange) autoArrangeIcons();
                showNotification('桌面', autoArrange ? '已开启自动排序' : '已关闭自动排序', 1500);
                const menuItem = menu.querySelector('[data-action="auto-arrange"]');
                if (menuItem) menuItem.textContent = autoArrange ? '✓ 自动排序' : '自动排序';
            }
            if (action === 'personalization') {
                settingsWindow.classList.remove('hidden');
                document.querySelector('[data-tab="personal"]').click();
            }
            if (action === 'resolution') showResolutionDialog();
            menu.style.display = 'none';
        });
        document.addEventListener('click', () => menu.style.display = 'none');
    } else {
        const menuItem = menu.querySelector('[data-action="auto-arrange"]');
        if (menuItem) menuItem.textContent = autoArrange ? '✓ 自动排序' : '自动排序';
    }
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.display = 'block';
}

function showResolutionDialog() {
    const res = prompt('选择分辨率:\n1920x1080\n1366x768\n1280x720\n1024x768', '1920x1080');
    if (res) {
        const [w, h] = res.split('x');
        if (window.nw) window.nw.Window.get().resizeTo(parseInt(w), parseInt(h));
        showNotification('分辨率已切换', `${w}x${h}`);
    }
}

function createSystemTray() {
    const taskbarRight = document.querySelector('.taskbar-right');
    if (!taskbarRight) return;
    
    systemTray = document.getElementById('system-tray');
    if (!systemTray) {
        systemTray = document.createElement('div');
        systemTray.id = 'system-tray';
        systemTray.className = 'system-tray';
    }
    systemTray.innerHTML = '';
    
    const volumeIcon = document.createElement('div');
    volumeIcon.className = 'tray-icon';
    volumeIcon.innerHTML = getVolumeIcon();
    volumeIcon.title = `音量: ${volumeLevel}%${isMuted ? ' (静音)' : ''}`;
    volumeIcon.style.cursor = 'pointer';
    volumeIcon.onclick = () => showVolumeMenu(volumeIcon);
    
    const networkIcon = document.createElement('div');
    networkIcon.className = 'tray-icon';
    networkIcon.innerHTML = getNetworkIcon();
    networkIcon.title = getNetworkStatusText();
    networkIcon.style.cursor = 'pointer';
    networkIcon.onclick = () => showNetworkMenu(networkIcon);
    
    const batteryIcon = document.createElement('div');
    batteryIcon.className = 'tray-icon';
    batteryIcon.innerHTML = getBatteryIcon();
    batteryIcon.title = getBatteryStatusText();
    batteryIcon.style.cursor = 'pointer';
    batteryIcon.onclick = () => showBatteryMenu(batteryIcon);
    
    const inputIcon = document.createElement('div');
    inputIcon.className = 'tray-icon';
    inputIcon.innerHTML = getInputIcon();
    inputIcon.title = `输入法: ${inputMethod}`;
    inputIcon.style.cursor = 'pointer';
    inputIcon.onclick = () => showInputMenu(inputIcon);
    
    systemTray.appendChild(volumeIcon);
    systemTray.appendChild(networkIcon);
    systemTray.appendChild(batteryIcon);
    systemTray.appendChild(inputIcon);
    
    const clockElement = document.querySelector('.clock');
    if (clockElement) {
        taskbarRight.insertBefore(systemTray, clockElement);
    } else {
        taskbarRight.appendChild(systemTray);
    }
    
    systemTray.volumeIcon = volumeIcon;
    systemTray.networkIcon = networkIcon;
    systemTray.batteryIcon = batteryIcon;
    systemTray.inputIcon = inputIcon;
}

function getVolumeIcon() {
    if (isMuted) return '🔇';
    if (volumeLevel === 0) return '🔇';
    if (volumeLevel < 33) return '🔈';
    if (volumeLevel < 66) return '🔉';
    return '🔊';
}

function getNetworkIcon() {
    switch (networkStatus) {
        case 'connected': return '📶';
        case 'limited': return '⚠️';
        case 'disconnected': return '❌';
        default: return '📶';
    }
}

function getNetworkStatusText() {
    switch (networkStatus) {
        case 'connected': return '已连接';
        case 'limited': return '有限访问';
        case 'disconnected': return '未连接';
        default: return '网络';
    }
}

function getBatteryIcon() {
    if (isCharging) {
        if (batteryLevel >= 90) return '🔋⚡';
        return `🔋⚡${batteryLevel}%`;
    }
    if (batteryLevel >= 90) return '🔋';
    if (batteryLevel >= 70) return '🪫';
    if (batteryLevel >= 40) return '🪫';
    if (batteryLevel >= 20) return '⚠️';
    return '❗';
}

function getBatteryStatusText() {
    return `电池: ${batteryLevel}%${isCharging ? ' (充电中)' : ''}`;
}

function getInputIcon() {
    return inputMethod === '中文' ? '中' : inputMethod === '英文' ? 'A' : inputMethod === '日文' ? 'あ' : '한';
}

function showVolumeMenu(target) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'tray-menu';
    menu.style.position = 'fixed';
    menu.style.bottom = '48px';
    menu.style.right = `${window.innerWidth - target.getBoundingClientRect().right + 10}px`;
    menu.innerHTML = `
        <div style="padding: 8px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 20px;">${getVolumeIcon()}</span>
                <input type="range" id="volume-slider" min="0" max="100" value="${isMuted ? 0 : volumeLevel}" style="flex:1;">
                <span id="volume-value" style="min-width: 40px;">${volumeLevel}%</span>
            </div>
            <button id="volume-mute-btn" style="width:100%; padding: 6px; background: #3c3f4a; border: none; border-radius: 6px; color: white; cursor: pointer;">${isMuted ? '取消静音' : '静音'}</button>
        </div>
    `;
    document.body.appendChild(menu);
    const slider = menu.querySelector('#volume-slider');
    const valueSpan = menu.querySelector('#volume-value');
    const muteBtn = menu.querySelector('#volume-mute-btn');
    slider.addEventListener('input', (e) => {
        volumeLevel = parseInt(e.target.value);
        isMuted = false;
        valueSpan.textContent = `${volumeLevel}%`;
        updateVolumeIcon();
        localStorage.setItem('HwBOS_volume', volumeLevel);
        localStorage.setItem('HwBOS_muted', false);
    });
    muteBtn.onclick = () => {
        isMuted = !isMuted;
        if (isMuted) {
            slider.value = 0;
            valueSpan.textContent = '0%';
            muteBtn.textContent = '取消静音';
        } else {
            slider.value = volumeLevel;
            valueSpan.textContent = `${volumeLevel}%`;
            muteBtn.textContent = '静音';
        }
        updateVolumeIcon();
        localStorage.setItem('HwBOS_muted', isMuted);
    };
    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    }
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function showNetworkMenu(target) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'tray-menu';
    menu.style.position = 'fixed';
    menu.style.bottom = '48px';
    menu.style.right = `${window.innerWidth - target.getBoundingClientRect().right + 10}px`;
    menu.innerHTML = `
        <div style="padding: 8px;">
            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="font-weight: bold;">网络连接</span>
            </div>
            <div class="network-item" data-status="connected" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 8px; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 8px;"><span>📶</span><span>Wi-Fi (演示)</span></div>
                <span style="font-size: 11px;">已连接</span>
            </div>
            <div class="network-item" data-status="disconnected" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 8px; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 8px;"><span>❌</span><span>手机热点</span></div>
                <span style="font-size: 11px;">未连接</span>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button id="network-settings-btn" style="width:100%; padding: 6px; background: #3c3f4a; border: none; border-radius: 6px; color: white; cursor: pointer;">网络设置</button>
            </div>
        </div>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll('.network-item').forEach(item => {
        item.onclick = () => {
            networkStatus = item.dataset.status === 'connected' ? 'connected' : 'disconnected';
            updateNetworkIcon();
            showNotification('网络', `已切换到${item.querySelector('span:last-child')?.innerText || '网络'}`, 1500);
            menu.remove();
        };
    });
    menu.querySelector('#network-settings-btn').onclick = () => {
        showNotification('网络设置', '网络设置面板开发中', 1500);
        menu.remove();
    };
    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    }
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function showBatteryMenu(target) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'tray-menu';
    menu.style.position = 'fixed';
    menu.style.bottom = '48px';
    menu.style.right = `${window.innerWidth - target.getBoundingClientRect().right + 10}px`;
    menu.innerHTML = `
        <div style="padding: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 32px;">${getBatteryIcon()}</span>
                <div>
                    <div style="font-weight: bold;">${batteryLevel}%</div>
                    <div style="font-size: 11px; color: #9e9e9e;">${isCharging ? '充电中' : '使用电池'}</div>
                </div>
            </div>
            <div style="height: 8px; background: #3c3f4a; border-radius: 4px; overflow: hidden;">
                <div style="width: ${batteryLevel}%; height: 100%; background: ${batteryLevel < 20 ? '#d9534f' : '#5cb85c'}; border-radius: 4px;"></div>
            </div>
            <div style="margin-top: 12px;">
                <button id="battery-settings-btn" style="width:100%; padding: 6px; background: #3c3f4a; border: none; border-radius: 6px; color: white; cursor: pointer;">电源设置</button>
            </div>
        </div>
    `;
    document.body.appendChild(menu);
    menu.querySelector('#battery-settings-btn').onclick = () => {
        showNotification('电源设置', '电源设置面板开发中', 1500);
        menu.remove();
    };
    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    }
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function showInputMenu(target) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'tray-menu';
    menu.style.position = 'fixed';
    menu.style.bottom = '48px';
    menu.style.right = `${window.innerWidth - target.getBoundingClientRect().right + 10}px`;
    const inputMethods = ['中文', '英文', '日文', '韩文'];
    menu.innerHTML = `
        <div style="padding: 4px;">
            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="font-weight: bold;">输入法</span>
            </div>
            ${inputMethods.map(method => `
                <div class="input-method-item" data-method="${method}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 8px; cursor: pointer; margin-bottom: 2px; ${method === inputMethod ? 'background: #0078d4;' : ''}">
                    <span>${method === '中文' ? '中' : method === '英文' ? 'A' : method === '日文' ? 'あ' : '한'}</span>
                    <span>${method}</span>
                    ${method === inputMethod ? '<span>✓</span>' : ''}
                </div>
            `).join('')}
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button id="input-settings-btn" style="width:100%; padding: 6px; background: #3c3f4a; border: none; border-radius: 6px; color: white; cursor: pointer;">键盘设置</button>
            </div>
        </div>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll('.input-method-item').forEach(item => {
        item.onclick = () => {
            inputMethod = item.dataset.method;
            updateInputIcon();
            localStorage.setItem('HwBOS_inputMethod', inputMethod);
            showNotification('输入法', `已切换到 ${inputMethod} 输入法`, 1500);
            menu.remove();
        };
    });
    menu.querySelector('#input-settings-btn').onclick = () => {
        showNotification('键盘设置', '键盘设置面板开发中', 1500);
        menu.remove();
    };
    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    }
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function updateVolumeIcon() {
    if (systemTray && systemTray.volumeIcon) {
        systemTray.volumeIcon.innerHTML = getVolumeIcon();
        systemTray.volumeIcon.title = `音量: ${volumeLevel}%${isMuted ? ' (静音)' : ''}`;
    }
}

function updateNetworkIcon() {
    if (systemTray && systemTray.networkIcon) {
        systemTray.networkIcon.innerHTML = getNetworkIcon();
        systemTray.networkIcon.title = getNetworkStatusText();
    }
}

function updateBatteryIcon() {
    if (systemTray && systemTray.batteryIcon) {
        systemTray.batteryIcon.innerHTML = getBatteryIcon();
        systemTray.batteryIcon.title = getBatteryStatusText();
    }
}

function updateInputIcon() {
    if (systemTray && systemTray.inputIcon) {
        systemTray.inputIcon.innerHTML = getInputIcon();
        systemTray.inputIcon.title = `输入法: ${inputMethod}`;
    }
}

function closeAllMenus() {
    document.querySelectorAll('.tray-menu').forEach(menu => menu.remove());
}

function startSystemTrayUpdates() {
    setInterval(() => {
        if (Math.random() > 0.95) {
            networkStatus = networkStatus === 'connected' ? 'limited' : 'connected';
            updateNetworkIcon();
        }
    }, 30000);
    setInterval(() => {
        if (!isCharging && batteryLevel > 0) {
            batteryLevel = Math.max(0, batteryLevel - 1);
            updateBatteryIcon();
            if (batteryLevel <= 10) {
                showNotification('电池电量低', `剩余电量 ${batteryLevel}%，请连接充电器`, 3000);
            }
        }
    }, 60000);
    setInterval(() => {
        if (Math.random() > 0.7) {
            isCharging = !isCharging;
            if (isCharging && batteryLevel < 100) {
                batteryLevel = Math.min(100, batteryLevel + 5);
                showNotification('电源已接通', `正在充电，当前电量 ${batteryLevel}%`, 2000);
            }
            updateBatteryIcon();
        }
    }, 300000);
}

function initDesktopSelection() {
    if (!desktop) return;
    desktop.addEventListener('mousedown', (e) => {
        if (e.target === desktop || e.target.classList.contains('desktop')) {
            isSelecting = true;
            selectStartX = e.clientX;
            selectStartY = e.clientY;
            if (!selectionRect) {
                selectionRect = document.createElement('div');
                selectionRect.className = 'selection-rect';
                document.body.appendChild(selectionRect);
            }
            selectionRect.style.left = `${selectStartX}px`;
            selectionRect.style.top = `${selectStartY}px`;
            selectionRect.style.width = '0px';
            selectionRect.style.height = '0px';
            selectionRect.style.display = 'block';
            clearSelection();
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        const width = Math.abs(e.clientX - selectStartX);
        const height = Math.abs(e.clientY - selectStartY);
        const left = Math.min(selectStartX, e.clientX);
        const top = Math.min(selectStartY, e.clientY);
        selectionRect.style.left = `${left}px`;
        selectionRect.style.top = `${top}px`;
        selectionRect.style.width = `${width}px`;
        selectionRect.style.height = `${height}px`;
        const icons = document.querySelectorAll('.desktop-icon');
        selectedIcons = [];
        icons.forEach(icon => {
            const rect = icon.getBoundingClientRect();
            if (rect.right > left && rect.left < left + width && rect.bottom > top && rect.top < top + height) {
                selectedIcons.push(icon);
                icon.classList.add('selected');
            } else {
                icon.classList.remove('selected');
            }
        });
    });
    document.addEventListener('mouseup', () => {
        if (isSelecting) {
            isSelecting = false;
            if (selectionRect) selectionRect.style.display = 'none';
        }
    });
    desktop.addEventListener('click', () => clearSelection());
}

function clearSelection() {
    document.querySelectorAll('.desktop-icon').forEach(icon => icon.classList.remove('selected'));
    selectedIcons = [];
}

function updateTaskbarActive(activeWinId) {
    document.querySelectorAll('.taskbar-app').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.taskbar-app[data-window="${activeWinId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

function showDesktop() {
    activeWindows.forEach(win => {
        if (win.element.style.display !== 'none') win.element.style.display = 'none';
    });
    showNotification('桌面', '已显示桌面');
}

function showNotification(title, message, duration = 3000) {
    if (!notification) return;
    notification.innerHTML = `<div class="notification-title">${title}</div><div class="notification-message">${message}</div>`;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), duration);
}

function updateClock() {
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function bindEvents() {
    if (!startBtn) return;
    startBtn.onclick = () => {
        renderStartMenu();
        startMenu.classList.toggle('show');
    };
    if (showDesktopBtn) showDesktopBtn.onclick = showDesktop;
    document.addEventListener('click', (e) => {
        if (startMenu && startBtn && !startMenu.contains(e.target) && e.target !== startBtn) {
            startMenu.classList.remove('show');
        }
    });
    document.getElementById('settingsBtn').onclick = () => {
        settingsWindow.classList.remove('hidden');
        startMenu.classList.remove('show');
    };
    document.getElementById('closeSettings').onclick = () => settingsWindow.classList.add('hidden');
    document.getElementById('addAppBtn').onclick = addAppDialog;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'apps') renderAppsManager();
        };
    });
    document.getElementById('windowedMode').onclick = () => {
        if (window.nw) {
            window.nw.Window.get().leaveFullscreen();
            window.nw.Window.get().resizeTo(1024, 768);
        }
        showNotification('窗口模式', '已切换到窗口模式');
    };
    document.getElementById('fullscreenMode').onclick = () => {
        if (window.nw) window.nw.Window.get().enterFullscreen();
        showNotification('全屏模式', '已切换到全屏模式');
    };
    document.getElementById('themeSelect').onchange = (e) => {
        const theme = e.target.value;
        if (theme === 'dark') {
            document.body.classList.remove('light-theme');
            document.body.style.background = '#1a2c3e';
            localStorage.setItem('HwBOS_theme', 'dark');
        } else {
            document.body.classList.add('light-theme');
            document.body.style.background = '#f0f0f0';
            localStorage.setItem('HwBOS_theme', 'light');
        }
    };
    document.getElementById('chooseWallpaper').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                wallpaper.style.backgroundImage = `url(${ev.target.result})`;
                wallpaper.style.backgroundSize = 'cover';
                localStorage.setItem('HwBOS_wallpaper', ev.target.result);
                showNotification('壁纸已设置', '桌面壁纸已更新');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };
    document.getElementById('chooseLoginBg').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const bgUrl = ev.target.result;
                localStorage.setItem('HwBOS_login_bg', bgUrl);
                loginContainer.style.backgroundImage = `url(${bgUrl})`;
                loginContainer.style.backgroundSize = 'cover';
                loginContainer.style.backgroundPosition = 'center';
                showNotification('登录背景已设置', '下次启动将使用此背景');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };
    document.getElementById('clearLoginBg').onclick = () => {
        localStorage.removeItem('HwBOS_login_bg');
        loginContainer.style.backgroundImage = 'none';
        showNotification('登录背景已清除', '已恢复默认背景');
    };
    document.getElementById('clearWallpaper').onclick = () => {
        wallpaper.style.backgroundImage = 'none';
        localStorage.removeItem('HwBOS_wallpaper');
        showNotification('壁纸已清除', '已恢复默认背景');
    };
    document.getElementById('powerBtn').onclick = () => {
        if (confirm('关机？\n确定=关机，取消=重启')) {
            if (window.nw) {
                window.nw.Window.get().close();
            } else {
                window.close();
            }
        } else {
            location.reload();
        }
    };
    document.getElementById('accountBtn').onclick = () => {
        const newUser = prompt('切换用户', currentUser);
        if (newUser) {
            currentUser = newUser;
            usernameSpan.innerText = currentUser;
            localStorage.setItem('HwBOS_user', newUser);
            showNotification('用户切换', `当前用户: ${currentUser}`);
        }
    };
}