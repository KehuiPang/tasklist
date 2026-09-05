// ============ 状态 ============
let DATA = { settings: {}, folders: [], tasks: [] };
let currentFolderId = null; // 项目树当前所在目录
let editingTaskId = null;

const $ = (id) => document.getElementById(id);
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const QUAD_INFO = {
  IU: { name: '重要且紧急', cls: 'q-IU', order: 0 },
  IN: { name: '重要不紧急', cls: 'q-IN', order: 1 },
  NU: { name: '紧急不重要', cls: 'q-NU', order: 2 },
  NN: { name: '不重要不紧急', cls: 'q-NN', order: 3 }
};
const PRIO_NAME = { 3: '紧急', 2: '高', 1: '中', 0: '低' };

// ============ 初始化 ============
async function init() {
  DATA = await window.api.loadData();
  applySettingsToUI();
  currentFolderId = null;
  render();
  bindEvents();
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
  if (!list.length) { el.innerHTML = '<div class="empty">还没有任务，上面记一条吧 ✍️</div>'; return; }
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
      </div>`).join('') || '<div class="empty" style="padding:8px;font-size:11px;">—</div>';
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
      <h4><span class="qh-dot q-NN"></span>未分类（点开设四象限）</h4>
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
      <input type="text" id="newFolderName" placeholder="新建子目录/项目…" />
      <button class="mini-btn" id="btnAddFolder">+目录</button>
    </div>`;

  html += subFolders.map(f => {
    const count = countTasksInFolder(f.id);
    return `<div class="tree-item" data-fid="${f.id}">
      <span class="fico">📁</span>
      <span class="fname" data-act="open">${escapeHtml(f.name)}</span>
      <span class="fcount">${count}</span>
      <span class="tree-actions">
        <button class="tb-btn" data-act="rename" title="重命名">✎</button>
        <button class="tb-btn" data-act="delfolder" title="删除">🗑</button>
      </span>
    </div>`;
  }).join('');

  if (tasksHere.length) {
    html += tasksHere.map((t, i) => taskHtml(t, i + 1)).join('');
  }
  if (!subFolders.length && !tasksHere.length) {
    html += '<div class="empty">这个目录还是空的<br/>上面新建子目录，或在顶部输入框加任务</div>';
  }
  el.innerHTML = html;
}

function renderBreadcrumb() {
  const bc = $('breadcrumb');
  const chain = [];
  let f = currentFolderId ? DATA.folders.find(x => x.id === currentFolderId) : null;
  while (f) { chain.unshift(f); f = f.parentId ? DATA.folders.find(x => x.id === f.parentId) : null; }
  let html = `<a data-fid="">🏠 全部</a>`;
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
  if (!deferred.length) { el.innerHTML = '<div class="empty" style="padding:10px;">没有搁置的事</div>'; return; }
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
  const name = prompt('重命名目录', f.name);
  if (name && name.trim()) { f.name = name.trim(); persist(); render(); }
}
function deleteFolder(fid) {
  const count = countTasksInFolder(fid);
  if (count > 0 && !confirm(`该目录（含子目录）下有 ${count} 个任务，删除目录会把这些任务移到「全部」。确定？`)) return;
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
  const t = DATA.tasks.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  $('editTitle').value = t.title;
  $('editQuadrant').value = t.quadrant || '';
  $('editPriority').value = String(t.priority);
  // 目录下拉
  const sel = $('editFolder');
  sel.innerHTML = '<option value="">（无 / 全部）</option>' +
    DATA.folders.map(f => `<option value="${f.id}">${escapeHtml(folderPath(f.id))}</option>`).join('');
  sel.value = t.folderId || '';
  $('taskModal').classList.remove('hidden');
}
function saveTaskEdit() {
  const t = DATA.tasks.find(x => x.id === editingTaskId);
  if (!t) return;
  t.title = $('editTitle').value.trim() || t.title;
  t.quadrant = $('editQuadrant').value;
  t.priority = parseInt($('editPriority').value, 10);
  t.folderId = $('editFolder').value || null;
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
    $('deferredToggle').firstChild.textContent = el.classList.contains('hidden') ? '▸ 暂缓搁置 (' : '▾ 暂缓搁置 (';
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
  $('btnExport').addEventListener('click', async () => { const r = await window.api.exportData(); if (r.ok) alert('已导出：' + r.filePath); });
  $('btnImport').addEventListener('click', async () => {
    if (!confirm('导入会覆盖当前所有数据，确定？')) return;
    const r = await window.api.importData();
    if (r.ok) { DATA = r.data; applySettingsToUI(); render(); alert('导入成功'); }
    else if (r.error) alert('导入失败：' + r.error);
  });
  $('btnQuit').addEventListener('click', () => { if (confirm('退出程序？')) window.api.quit(); });

  // 任务编辑弹层
  $('btnCloseTask').addEventListener('click', () => $('taskModal').classList.add('hidden'));
  $('btnSaveTask').addEventListener('click', saveTaskEdit);
  $('btnDeleteTask').addEventListener('click', () => { if (confirm('删除这个任务？')) { deleteTask(editingTaskId); $('taskModal').classList.add('hidden'); } });
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
