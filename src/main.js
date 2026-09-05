const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = app.getPath('userData');
const DATA_FILE = path.join(DATA_DIR, 'tasklist-data.json');

let win = null;
let tray = null;

// 贴边收起状态
let collapsed = false;
let hideTimer = null;
const COLLAPSE_STRIP = 6;   // 收起后露出的小条宽度(px)
const EDGE_THRESHOLD = 12;  // 距屏幕边缘多少 px 视为贴边

// ---------- 数据读写 ----------
const DEFAULT_DATA = {
  settings: {
    edge: 'right',
    autoHide: true,
    viewMode: 'list',
    sortBy: 'priority',
    theme: 'light',
    alwaysOnTop: true,
    windowBounds: null
  },
  folders: [],
  tasks: []
};

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const d = JSON.parse(raw);
      d.settings = Object.assign({}, DEFAULT_DATA.settings, d.settings || {});
      d.folders = d.folders || [];
      d.tasks = d.tasks || [];
      return d;
    }
  } catch (e) {
    console.error('readData error', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('writeData error', e);
    return false;
  }
}

// ---------- 窗口 ----------
function createWindow() {
  const data = readData();
  const s = data.settings;
  const display = screen.getPrimaryDisplay();
  const allDisplays = screen.getAllDisplays();
  // 优先放到第二块屏幕
  const secondary = allDisplays.find(d => d.id !== display.id) || display;
  const area = secondary.workArea;

  const defaultW = 340;
  const defaultH = 640;

  let bounds = s.windowBounds;
  if (!bounds) {
    bounds = {
      width: defaultW,
      height: defaultH,
      x: area.x + area.width - defaultW,   // 默认贴第二屏右边
      y: area.y + Math.round((area.height - defaultH) / 2)
    };
  }

  win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 260,
    minHeight: 300,
    icon: (() => { try { return nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'winicon-256.png')); } catch (e) { return undefined; } })(),
    frame: false,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: s.alwaysOnTop !== false,
    backgroundColor: '#f7f8fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (s.alwaysOnTop !== false) {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.loadFile(path.join(__dirname, 'index.html'));

  win.on('moved', saveBounds);
  win.on('resized', saveBounds);

  // 鼠标进出：处理贴边展开/收起
  win.on('blur', () => scheduleCollapse());
  win.on('focus', () => expandIfCollapsed());
}

let saveTimer = null;
function saveBounds() {
  if (!win || collapsed) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = readData();
    data.settings.windowBounds = win.getBounds();
    writeData(data);
  }, 400);
}

// ---------- 贴边收起 ----------
function getEdgeInfo() {
  if (!win) return null;
  const b = win.getBounds();
  const disp = screen.getDisplayMatching(b);
  const area = disp.workArea;
  const nearRight = Math.abs((b.x + b.width) - (area.x + area.width)) <= EDGE_THRESHOLD;
  const nearLeft = Math.abs(b.x - area.x) <= EDGE_THRESHOLD;
  const nearTop = Math.abs(b.y - area.y) <= EDGE_THRESHOLD;
  let edge = null;
  if (nearRight) edge = 'right';
  else if (nearLeft) edge = 'left';
  else if (nearTop) edge = 'top';
  return { edge, area, bounds: b };
}

let expandedBounds = null; // 收起前的完整位置

function scheduleCollapse() {
  const data = readData();
  if (!data.settings.autoHide) return;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => doCollapse(), 500);
}

function doCollapse() {
  if (!win || collapsed) return;
  const info = getEdgeInfo();
  if (!info || !info.edge) return;
  expandedBounds = win.getBounds();
  const b = { ...expandedBounds };
  const area = info.area;
  if (info.edge === 'right') {
    b.x = area.x + area.width - COLLAPSE_STRIP;
  } else if (info.edge === 'left') {
    b.x = area.x - (b.width - COLLAPSE_STRIP);
  } else if (info.edge === 'top') {
    b.y = area.y - (b.height - COLLAPSE_STRIP);
  }
  collapsed = true;
  win.setBounds(b, false);
  win.webContents.send('collapsed-change', { collapsed: true, edge: info.edge });
  startEdgeWatch(info.edge, area);
}

// 收起后监听鼠标是否靠近露出的小条
let edgeWatchTimer = null;
function startEdgeWatch(edge, area) {
  stopEdgeWatch();
  edgeWatchTimer = setInterval(() => {
    if (!collapsed || !win) { stopEdgeWatch(); return; }
    const pt = screen.getCursorScreenPoint();
    let near = false;
    const HOT = 4; // 触发区厚度
    if (edge === 'right') {
      near = pt.x >= area.x + area.width - HOT &&
             pt.y >= expandedBounds.y - 20 && pt.y <= expandedBounds.y + expandedBounds.height + 20;
    } else if (edge === 'left') {
      near = pt.x <= area.x + HOT &&
             pt.y >= expandedBounds.y - 20 && pt.y <= expandedBounds.y + expandedBounds.height + 20;
    } else if (edge === 'top') {
      near = pt.y <= area.y + HOT &&
             pt.x >= expandedBounds.x - 20 && pt.x <= expandedBounds.x + expandedBounds.width + 20;
    }
    if (near) doExpand();
  }, 120);
}
function stopEdgeWatch() {
  if (edgeWatchTimer) { clearInterval(edgeWatchTimer); edgeWatchTimer = null; }
}

function doExpand() {
  if (!win || !collapsed || !expandedBounds) return;
  collapsed = false;
  stopEdgeWatch();
  win.setBounds(expandedBounds, false);
  win.webContents.send('collapsed-change', { collapsed: false });
  win.show();
  win.focus();
}

function expandIfCollapsed() {
  if (collapsed) doExpand();
}

// ---------- 托盘 ----------
function loadTrayIcon() {
  // 优先用生成的 32/16 png；打包后在 resources 或 __dirname 附近
  const candidates = [
    path.join(__dirname, '..', 'build', 'tray-24.png'),
    path.join(__dirname, '..', 'build', 'tray-32.png'),
    path.join(__dirname, '..', 'build', 'tray-16.png'),
    path.join(process.resourcesPath || '', 'build', 'tray-24.png'),
    path.join(__dirname, 'tray-24.png')
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) { const im = nativeImage.createFromPath(p); if (!im.isEmpty()) return im; } } catch (e) {}
  }
  return nativeImage.createEmpty();
}

function toggleTop() {
  const on = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(on, 'screen-saver');
  const d = readData(); d.settings.alwaysOnTop = on; writeData(d);
  if (win) win.webContents.send('top-change', on);
}

// ---------- 自绘托盘右键菜单（移植无为 VI 风格：无框透明弹窗，圆角/hover 高亮/退出朱红） ----------
let trayMenu = null;

function trayMenuItems() {
  const onTop = win && win.isAlwaysOnTop();
  return [
    { id: 'show', label: '显示主窗口',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>' },
    { id: 'top', label: onTop ? '取消置顶' : '窗口置顶',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>' },
    { id: 'collapse', label: '贴边收起',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' },
    { id: 'sep' },
    { id: 'quit', label: '退出', danger: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v8"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/></svg>' }
  ];
}

const TM_CARD_W = 176;
const TM_SHADOW = 16;
const TM_ITEM_H = 38;
const TM_SEP_H = 9;
const TM_PAD_V = 6;

function trayMenuSize() {
  const items = trayMenuItems();
  const cardH = TM_PAD_V * 2 + items.reduce((h, it) => h + (it.id === 'sep' ? TM_SEP_H : TM_ITEM_H), 0);
  return { cardH, winW: TM_CARD_W + TM_SHADOW * 2, winH: cardH + TM_SHADOW * 2 };
}

function trayMenuHtml(cardH) {
  const dark = nativeTheme.shouldUseDarkColors;
  // tasklist 浅色 VI（对齐无为亮色降级）：默认亮卡片，跟随系统暗色则玄墨底
  const c = dark
    ? { bg: '#1B1F26', border: 'rgba(255,255,255,.08)', text: '#E6E8EC', sub: '#9AA0AA', hover: 'rgba(255,255,255,.07)', sep: 'rgba(255,255,255,.08)', danger: '#F0806B', dangerHover: 'rgba(240,128,107,.12)' }
    : { bg: '#FFFFFF', border: 'rgba(0,0,0,.08)', text: '#16191E', sub: '#6B7280', hover: 'rgba(39,74,99,.07)', sep: 'rgba(0,0,0,.07)', danger: '#C05F3C', dangerHover: 'rgba(192,95,60,.08)' };
  const rows = trayMenuItems().map((it) => {
    if (it.id === 'sep') return '<div class="sep"></div>';
    const cls = it.danger ? 'row danger' : 'row';
    return `<button class="${cls}" data-act="${it.id}"><span class="ico">${it.icon}</span><span class="lbl">${it.label}</span></button>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;-webkit-user-select:none;user-select:none}
    html,body{background:transparent;overflow:hidden;font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif}
    .card{position:fixed;left:${TM_SHADOW}px;top:${TM_SHADOW}px;width:${TM_CARD_W}px;height:${cardH}px;
      background:${c.bg};border:1px solid ${c.border};border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,.24),0 2px 6px rgba(0,0,0,.12);
      padding:${TM_PAD_V}px;display:flex;flex-direction:column;gap:2px;
      animation:pop .12s ease-out}
    @keyframes pop{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}
    .row{display:flex;align-items:center;gap:10px;height:${TM_ITEM_H}px;width:100%;
      margin:0 2px;padding:0 10px;border:0;border-radius:8px;background:transparent;cursor:pointer;
      color:${c.text};font-size:13px;text-align:left;transition:background .1s}
    .row:hover{background:${c.hover}}
    .row.danger{color:${c.danger}}
    .row.danger:hover{background:${c.dangerHover}}
    .ico{display:flex;width:16px;height:16px;color:${c.sub};flex:none}
    .row.danger .ico{color:${c.danger}}
    .row:hover .ico{color:currentColor}
    .ico svg{width:16px;height:16px}
    .lbl{flex:1}
    .sep{height:${TM_SEP_H}px;margin:2px 8px;position:relative}
    .sep::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:${c.sep}}
  </style>
  <div class="card">${rows}</div>
  <script>
    const send=(a)=>{location.href='tl-tray:'+a};
    document.querySelectorAll('.row').forEach(b=>b.addEventListener('click',()=>send(b.dataset.act)));
    window.addEventListener('keydown',e=>{if(e.key==='Escape')send('close')});
  </script>`;
}

function ensureTrayMenu() {
  if (trayMenu && !trayMenu.isDestroyed()) return trayMenu;
  const { winW, winH } = trayMenuSize();
  trayMenu = new BrowserWindow({
    width: winW, height: winH, show: false, frame: false, transparent: true,
    resizable: false, movable: false, minimizable: false, maximizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, fullscreenable: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  trayMenu.setMenu(null);
  trayMenu.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('tl-tray:')) return;
    e.preventDefault();
    const act = url.slice('tl-tray:'.length).replace(/\/+$/, '');
    trayMenu.hide();
    if (act === 'show') { if (collapsed) doExpand(); win.show(); win.focus(); }
    else if (act === 'top') { toggleTop(); }
    else if (act === 'collapse') { doCollapse(); }
    else if (act === 'quit') { app.isQuitting = true; app.quit(); }
  });
  trayMenu.on('blur', () => { if (trayMenu && !trayMenu.isDestroyed()) trayMenu.hide(); });
  return trayMenu;
}

function popupTrayMenu() {
  const menu = ensureTrayMenu();
  const { winW, winH, cardH } = trayMenuSize();
  const cursor = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(cursor).workArea;
  const GAP = 8;
  let x = cursor.x - TM_SHADOW - TM_CARD_W / 2;
  let y = cursor.y - TM_SHADOW - cardH - GAP;
  x = Math.min(Math.max(x, wa.x - TM_SHADOW), wa.x + wa.width - winW + TM_SHADOW);
  y = Math.min(Math.max(y, wa.y - TM_SHADOW), wa.y + wa.height - winH + TM_SHADOW);
  menu.setBounds({ x: Math.round(x), y: Math.round(y), width: winW, height: winH });
  menu.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(trayMenuHtml(cardH)));
  menu.show();
  menu.focus();
}

function createTray() {
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('TaskList · 任务清单');
  // 左键单击：显示/展开；右键：自绘菜单
  tray.on('click', () => { if (collapsed) doExpand(); else { win.show(); win.focus(); } });
  tray.on('double-click', () => { if (collapsed) doExpand(); else { win.show(); win.focus(); } });
  tray.on('right-click', popupTrayMenu);
}

// ---------- IPC ----------
ipcMain.handle('load-data', () => readData());
ipcMain.handle('save-data', (e, data) => writeData(data));

ipcMain.handle('set-always-on-top', (e, on) => {
  if (win) { win.setAlwaysOnTop(!!on, 'screen-saver'); }
  const d = readData(); d.settings.alwaysOnTop = !!on; writeData(d);
  return true;
});

ipcMain.on('win-minimize', () => { if (win) win.minimize(); });
ipcMain.on('win-close', () => { if (win) win.hide(); });
ipcMain.on('win-quit', () => { app.isQuitting = true; app.quit(); });
ipcMain.on('collapse-now', () => doCollapse());

// 导出 / 导入 备份
const { dialog } = require('electron');
ipcMain.handle('export-data', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出备份',
    defaultPath: `tasklist-backup-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };
  fs.copyFileSync(DATA_FILE, filePath);
  return { ok: true, filePath };
});
ipcMain.handle('import-data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '导入备份',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths[0]) return { ok: false };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const d = JSON.parse(raw);
    writeData(d);
    return { ok: true, data: readData() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (collapsed) doExpand(); win.show(); win.focus(); }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });

  app.on('window-all-closed', (e) => {
    // 不退出，留在托盘
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
