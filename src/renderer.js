// ============ 状态 ============
let DATA = { settings: {}, folders: [], tasks: [] };
let currentFolderId = null; // 项目树当前所在目录
let editingTaskId = null;

const $ = (id) => document.getElementById(id);
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// 四象限：名称随语言动态取（t('qname_XX')）
const QUAD_INFO = {
  IU: { get name() { return t('qname_IU'); }, cls: 'q-IU', order: 0 },
  IN: { get name() { return t('qname_IN'); }, cls: 'q-IN', order: 1 },
  NU: { get name() { return t('qname_NU'); }, cls: 'q-NU', order: 2 },
  NN: { get name() { return t('qname_NN'); }, cls: 'q-NN', order: 3 }
};
const PRIO_NAME = { get 3() { return t('prio_3'); }, get 2() { return t('prio_2'); }, get 1() { return t('prio_1'); }, get 0() { return t('prio_0'); } };

// ============ 初始化 ============
async function init() {
  DATA = await window.api.loadData();
  setLang(DATA.settings.language || 'zh-CN');
  applyI18nDOM();
  applySettingsToUI();
  currentFolderId = null;
  render();
  bindEvents();
}

// 切换语言：保存设置 + 重新翻译静态 DOM + 重渲染动态内容
function changeLanguage(lang) {
  setLang(lang);
  DATA.settings.language = CUR_LANG;
  persist();
  if (window.api.setLanguage) window.api.setLanguage(CUR_LANG);
  applyI18nDOM();
  applySettingsToUI();
  render();
}

function applySettingsToUI() {
  const s = DATA.settings;
  // 视图 tab
  document.querySelectorAll('.vtab').forEach(b => b.classList.toggle('active', b.dataset.view === s.viewMode));
  $('sortSelect').value = s.sortBy || 'priority';
  // 设置面板
  $('setViewMode').value = s.viewMode || 'list';
  $('setSortBy').value = s.sortBy || 'priority';
  $('setEdge').value = s.edge || 'right';
  $('setAutoHide').checked = s.autoHide !== false;
  $('setAlwaysOnTop').checked = s.alwaysOnTop !== false;
  $('btnPin').classList.toggle('active', s.alwaysOnTop !== false);
  if ($('setLanguage')) $('setLanguage').value = CUR_LANG;
}

let saveTimer = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.api.saveData(DATA), 250);
}

// ============ 任务操作 ============
function addTask(title) {
  title = (title || '').trim();
  if (!title) return;
  const t = {
    id: uid(),
    title,
    folderId: DATA.settings.viewMode === 'tree' ? currentFolderId : null,
    priority: 1,
    quadrant: '',
    status: 'todo',
    order: Date.now(),
    createdAt: Date.now(),
    doneAt: null
  };
  DATA.tasks.unshift(t);
  persist();
  render();
}

function toggleDone(id) {
  const t = DATA.tasks.find(x => x.id === id);
  if (!t) return;
  if (t.status === 'done') { t.status = 'todo'; t.doneAt = null; }
  else { t.status = 'done'; t.doneAt = Date.now(); }
  persist();
  render();
}

function deleteTask(id) {
  DATA.tasks = DATA.tasks.filter(x => x.id !== id);
  persist();
  render();
}

function setStatus(id, status) {
  const t = DATA.tasks.find(x => x.id === id);
  if (!t) return;
  t.status = status;
  if (status !== 'done') t.doneAt = null;
  persist();
  render();
}

// ============ 排序 ============
function sortTasks(list) {
  const sortBy = DATA.settings.sortBy || 'priority';
  const arr = [...list];
  // done 永远沉底
  arr.sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    if (sortBy === 'priority') return (b.priority - a.priority) || (b.createdAt - a.createdAt);
    if (sortBy === 'date') return b.createdAt - a.createdAt;
    return a.order - b.order; // manual
  });
  return arr;
}

// ============ 渲染 ============
function render() {
  const view = DATA.settings.viewMode || 'list';
  const bc = $('breadcrumb');
  bc.classList.toggle('hidden', view !== 'tree');
  if (view === 'list') renderList();
  else if (view === 'quadrant') renderQuadrant();
  else renderTree();
  renderDeferred();
}

function activeTasks() {
  return DATA.tasks.filter(t => t.status !== 'deferred');
}

function taskHtml(t, idx) {
  const q = t.quadrant ? `<span class="qdot q-${t.quadrant}" title="${QUAD_INFO[t.quadrant].name}"></span>` : '';
  const prioTag = `<span class="tag prio-${t.priority}">${PRIO_NAME[t.priority]}</span>`;
  const d = new Date(t.createdAt);
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  const folder = t.folderId ? folderPath(t.folderId) : '';
  const folderTag = folder ? `<span class="date">📁${folder}</span>` : '';
  return `
    <div class="task ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
      ${q}
      <span class="idx">${idx}</span>
      <span class="check" data-act="toggle">${t.status === 'done' ? '✓' : ''}</span>
      <div class="body">
        <div class="ttl" data-act="edit">${escapeHtml(t.title)}</div>
        <div class="meta">${prioTag}<span class="date">${date}</span>${folderTag}</div>
      </div>
    </div>`;
}

function renderList() {
  const list = sortTasks(activeTasks());
  const el = $('content');
  if (!list.length) { el.innerHTML = `<div class="empty">${t('empty_tasks')}</div>`; return; }
  el.innerHTML = list.map((t, i) => taskHtml(t, i + 1)).join('');
}

function renderQuadrant() {
  const el = $('content');
  const list = activeTasks();
  const cells = ['IU', 'IN', 'NU', 'NN'].map(q => {
    const items = sortTasks(list.filter(t => t.quadrant === q));
    const inner = items.map(t => `
      <div class="qtask ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
        <span class="qcheck" data-act="toggle"></span>
        <span data-act="edit">${escapeHtml(t.title)}</span>
      </div>`).join('') || `<div class="empty" style="padding:8px;font-size:11px;">${t('empty_dash')}</div>`;
    return `<div class="quad-cell">
      <h4><span class="qh-dot ${QUAD_INFO[q].cls}"></span>${QUAD_INFO[q].name}</h4>
      ${inner}
    </div>`;
  }).join('');
  // 未分类
  const unq = sortTasks(list.filter(t => !t.quadrant));
  let unclass = '';
  if (unq.length) {
    unclass = `<div class="quad-cell" style="grid-column:1/3;">
      <h4><span class="qh-dot q-NN"></span>${t('q_uncategorized')}</h4>
      ${unq.map(t => `<div class="qtask ${t.status==='done'?'done':''}" data-id="${t.id}">
        <span class="qcheck" data-act="toggle"></span><span data-act="edit">${escapeHtml(t.title)}</span></div>`).join('')}
    </div>`;
  }
  el.innerHTML = `<div class="quad-grid">${cells}</div>${unclass}`;
}

function renderTree() {
  const el = $('content');
  // 面包屑
  renderBreadcrumb();
  // 子目录
  const subFolders = DATA.folders.filter(f => f.parentId === currentFolderId).sort((a, b) => a.order - b.order);
  const tasksHere = sortTasks(activeTasks().filter(t => t.folderId === currentFolderId));

  let html = `<div class="add-folder-row">
      <input type="text" id="newFolderName" placeholder="${t('newfolder_ph')}" />
      <button class="mini-btn" id="btnAddFolder">${t('btn_addfolder')}</button>
    </div>`;

  html += subFolders.map(f => {
    const count = countTasksInFolder(f.id);
    return `<div class="tree-item" data-fid="${f.id}">
      <span class="fico">📁</span>
      <span class="fname" data-act="open">${escapeHtml(f.name)}</span>
      <span class="fcount">${count}</span>
      <span class="tree-actions">
        <button class="tb-btn" data-act="rename" title="${t('tip_rename')}">✎</button>
        <button class="tb-btn" data-act="delfolder" title="${t('tip_delfolder')}">🗑</button>
      </span>
    </div>`;
  }).join('');

  if (tasksHere.length) {
    html += tasksHere.map((t, i) => taskHtml(t, i + 1)).join('');
  }
  if (!subFolders.length && !tasksHere.length) {
    html += `<div class="empty">${t('empty_folder')}</div>`;
  }
  el.innerHTML = html;
}

function renderBreadcrumb() {
  const bc = $('breadcrumb');
  const chain = [];
  let f = currentFolderId ? DATA.folders.find(x => x.id === currentFolderId) : null;
  while (f) { chain.unshift(f); f = f.parentId ? DATA.folders.find(x => x.id === f.parentId) : null; }
  let html = `<a data-fid="">🏠 ${t('all')}</a>`;
  chain.forEach(c => { html += ` / <a data-fid="${c.id}">${escapeHtml(c.name)}</a>`; });
  bc.innerHTML = html;
}

function folderPath(fid) {
  const names = [];
  let f = DATA.folders.find(x => x.id === fid);
  while (f) { names.unshift(f.name); f = f.parentId ? DATA.folders.find(x => x.id === f.parentId) : null; }
  return names.join('/');
}

function countTasksInFolder(fid) {
  // 含子目录
  const childIds = [fid];
  let changed = true;
  while (changed) {
    changed = false;
    DATA.folders.forEach(f => {
      if (childIds.includes(f.parentId) && !childIds.includes(f.id)) { childIds.push(f.id); changed = true; }
    });
  }
  return DATA.tasks.filter(t => t.status !== 'deferred' && childIds.includes(t.folderId)).length;
}

function renderDeferred() {
  const deferred = DATA.tasks.filter(t => t.status === 'deferred');
  $('deferredCount').textContent = deferred.length;
  const el = $('deferredList');
  if (el.classList.contains('hidden')) return;
  if (!deferred.length) { el.innerHTML = `<div class="empty" style="padding:10px;">${t('empty_deferred')}</div>`; return; }
  el.innerHTML = deferred.map((t, i) => taskHtml(t, i + 1)).join('');
}

// ============ 目录操作 ============
function addFolder(name) {
  name = (name || '').trim();
  if (!name) return;
  DATA.folders.push({ id: 'f' + Date.now().toString(36), name, parentId: currentFolderId, order: DATA.folders.length });
  persist();
  render();
}
function renameFolder(fid) {
  const f = DATA.folders.find(x => x.id === fid);
  if (!f) return;
  const name = prompt(t('prompt_rename'), f.name);
  if (name && name.trim()) { f.name = name.trim(); persist(); render(); }
}
function deleteFolder(fid) {
  const count = countTasksInFolder(fid);
  if (count > 0 && !confirm(t('confirm_delfolder', count))) return;
  // 收集子目录
  const childIds = [fid];
  let changed = true;
  while (changed) { changed = false; DATA.folders.forEach(f => { if (childIds.includes(f.parentId) && !childIds.includes(f.id)) { childIds.push(f.id); changed = true; } }); }
  DATA.tasks.forEach(t => { if (childIds.includes(t.folderId)) t.folderId = null; });
  DATA.folders = DATA.folders.filter(f => !childIds.includes(f.id));
  persist();
  render();
}

// ============ 任务编辑弹层 ============
function openTaskEdit(id) {
  const task = DATA.tasks.find(x => x.id === id);
  if (!task) return;
  editingTaskId = id;
  $('editTitle').value = task.title;
  $('editQuadrant').value = task.quadrant || '';
  $('editPriority').value = String(task.priority);
  // 目录下拉
  const sel = $('editFolder');
  sel.innerHTML = `<option value="">${t('folder_none')}</option>` +
    DATA.folders.map(f => `<option value="${f.id}">${escapeHtml(folderPath(f.id))}</option>`).join('');
  sel.value = task.folderId || '';
  $('taskModal').classList.remove('hidden');
}
function saveTaskEdit() {
  const task = DATA.tasks.find(x => x.id === editingTaskId);
  if (!task) return;
  task.title = $('editTitle').value.trim() || task.title;
  task.quadrant = $('editQuadrant').value;
  task.priority = parseInt($('editPriority').value, 10);
  task.folderId = $('editFolder').value || null;
  persist();
  $('taskModal').classList.add('hidden');
  render();
}

// ============ 事件 ============
function bindEvents() {
  // 快速添加
  $('quickInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { addTask(e.target.value); e.target.value = ''; }
  });

  // 视图切换
  document.querySelectorAll('.vtab').forEach(b => {
    b.addEventListener('click', () => {
      DATA.settings.viewMode = b.dataset.view;
      document.querySelectorAll('.vtab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      persist(); render();
    });
  });

  // 排序
  $('sortSelect').addEventListener('change', e => { DATA.settings.sortBy = e.target.value; persist(); render(); });

  // 内容区事件委托
  $('content').addEventListener('click', handleContentClick);
  $('deferredList').addEventListener('click', handleContentClick);
  $('breadcrumb').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    currentFolderId = a.dataset.fid || null; render();
  });

  // 标题栏按钮
  $('btnMin').addEventListener('click', () => window.api.minimize());
  $('btnCollapse').addEventListener('click', () => window.api.collapseNow());
  $('btnSettings').addEventListener('click', () => $('settingsModal').classList.remove('hidden'));
  $('btnPin').addEventListener('click', async () => {
    const on = !(DATA.settings.alwaysOnTop !== false);
    DATA.settings.alwaysOnTop = on;
    await window.api.setAlwaysOnTop(on);
    $('btnPin').classList.toggle('active', on);
    $('setAlwaysOnTop').checked = on;
  });

  // 搁置区展开
  $('deferredBar').addEventListener('click', () => {
    const el = $('deferredList');
    el.classList.toggle('hidden');
    // 只切换首个箭头符号（▸/▾），中间文案由 data-i18n 管
    $('deferredToggle').firstChild.textContent = el.classList.contains('hidden') ? '▸ ' : '▾ ';
    renderDeferred();
  });

  // 设置面板
  $('btnCloseSettings').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
  $('setViewMode').addEventListener('change', e => { DATA.settings.viewMode = e.target.value; applySettingsToUI(); persist(); render(); });
  $('setSortBy').addEventListener('change', e => { DATA.settings.sortBy = e.target.value; $('sortSelect').value = e.target.value; persist(); render(); });
  $('setEdge').addEventListener('change', e => { DATA.settings.edge = e.target.value; persist(); });
  $('setAutoHide').addEventListener('change', e => { DATA.settings.autoHide = e.target.checked; persist(); });
  $('setAlwaysOnTop').addEventListener('change', async e => {
    DATA.settings.alwaysOnTop = e.target.checked;
    await window.api.setAlwaysOnTop(e.target.checked);
    $('btnPin').classList.toggle('active', e.target.checked);
  });
  $('btnExport').addEventListener('click', async () => { const r = await window.api.exportData(); if (r.ok) alert(t('alert_exported', r.filePath)); });
  $('btnImport').addEventListener('click', async () => {
    if (!confirm(t('confirm_import'))) return;
    const r = await window.api.importData();
    if (r.ok) { DATA = r.data; setLang(DATA.settings.language || CUR_LANG); applyI18nDOM(); applySettingsToUI(); render(); alert(t('alert_imported')); }
    else if (r.error) alert(t('alert_import_fail', r.error));
  });
  $('btnQuit').addEventListener('click', () => { if (confirm(t('confirm_quit'))) window.api.quit(); });
  // 语言切换
  if ($('setLanguage')) $('setLanguage').addEventListener('change', e => changeLanguage(e.target.value));

  // 任务编辑弹层
  $('btnCloseTask').addEventListener('click', () => $('taskModal').classList.add('hidden'));
  $('btnSaveTask').addEventListener('click', saveTaskEdit);
  $('btnDeleteTask').addEventListener('click', () => { if (confirm(t('confirm_deltask'))) { deleteTask(editingTaskId); $('taskModal').classList.add('hidden'); } });
  $('btnDeferTask').addEventListener('click', () => { setStatus(editingTaskId, 'deferred'); $('taskModal').classList.add('hidden'); });
  $('btnActivateTask').addEventListener('click', () => { setStatus(editingTaskId, 'todo'); $('taskModal').classList.add('hidden'); });

  // 收起状态
  window.api.onCollapsedChange(({ collapsed }) => {
    $('collapsedStrip').classList.toggle('hidden', !collapsed);
    $('app').style.visibility = collapsed ? 'hidden' : 'visible';
  });
  $('collapsedStrip').addEventListener('click', () => { /* 主进程靠鼠标触发展开 */ });

  // 点击弹层背景关闭
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
  });
}

function handleContentClick(e) {
  const act = e.target.dataset.act;
  // 目录相关
  if (e.target.id === 'btnAddFolder') { addFolder($('newFolderName').value); return; }
  const treeItem = e.target.closest('.tree-item');
  if (treeItem) {
    const fid = treeItem.dataset.fid;
    if (act === 'open') { currentFolderId = fid; render(); return; }
    if (act === 'rename') { renameFolder(fid); return; }
    if (act === 'delfolder') { deleteFolder(fid); return; }
  }
  // 任务相关
  const taskEl = e.target.closest('[data-id]');
  if (!taskEl) return;
  const id = taskEl.dataset.id;
  if (act === 'toggle') { toggleDone(id); return; }
  if (act === 'edit') { openTaskEdit(id); return; }
}

// newFolderName 回车
document.addEventListener('keydown', e => {
  if (e.target && e.target.id === 'newFolderName' && e.key === 'Enter') addFolder(e.target.value);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
