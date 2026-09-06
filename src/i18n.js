// ============ 国际化词典 ============
const I18N = {
  'zh-CN': {
    appTitle: '任务清单',
    tip_pin: '置顶',
    tip_settings: '设置',
    tip_collapse: '贴边收起',
    tip_min: '最小化到托盘',
    quick_ph: '记点什么… 回车添加',
    view_list: '列表',
    view_quadrant: '四象限',
    view_tree: '项目树',
    sort_priority: '优先级',
    sort_date: '日期',
    sort_manual: '手动',
    deferred_bar: '暂缓搁置',
    // 设置
    settings: '设置',
    set_viewmode: '默认组织方式',
    set_sortby: '默认排序',
    set_edge: '贴边方向',
    edge_right: '右边',
    edge_left: '左边',
    edge_top: '顶部',
    set_autohide: '贴边自动收起',
    set_alwaysontop: '窗口置顶',
    set_language: '语言 / Language',
    set_backup: '数据备份',
    btn_export: '导出',
    btn_import: '导入',
    data_hint: '数据保存在本地：userData/tasklist-data.json',
    btn_quit: '退出程序',
    // 任务编辑
    task_edit: '编辑任务',
    task_title: '标题',
    task_quadrant: '四象限',
    task_priority: '优先级',
    task_folder: '所属目录',
    q_none: '无',
    q_IU: '① 重要且紧急',
    q_IN: '② 重要不紧急',
    q_NU: '③ 紧急不重要',
    q_NN: '④ 不重要不紧急',
    prio_3: '紧急',
    prio_2: '高',
    prio_1: '中',
    prio_0: '低',
    btn_defer: '搁置',
    btn_activate: '恢复待办',
    btn_delete: '删除',
    btn_save: '保存',
    // 四象限名（含未分类）
    qname_IU: '重要且紧急',
    qname_IN: '重要不紧急',
    qname_NU: '紧急不重要',
    qname_NN: '不重要不紧急',
    q_uncategorized: '未分类（点开设四象限）',
    // 动态提示
    empty_tasks: '还没有任务，上面记一条吧 ✍️',
    empty_dash: '—',
    all: '全部',
    empty_folder: '这个目录还是空的<br/>上面新建子目录，或在顶部输入框加任务',
    newfolder_ph: '新建子目录/项目…',
    btn_addfolder: '+目录',
    tip_rename: '重命名',
    tip_delfolder: '删除',
    empty_deferred: '没有搁置的事',
    folder_none: '（无 / 全部）',
    prompt_rename: '重命名目录',
    confirm_delfolder: (n) => `该目录（含子目录）下有 ${n} 个任务，删除目录会把这些任务移到「全部」。确定？`,
    alert_exported: (p) => '已导出：' + p,
    confirm_import: '导入会覆盖当前所有数据，确定？',
    alert_imported: '导入成功',
    alert_import_fail: (e) => '导入失败：' + e,
    confirm_quit: '退出程序？',
    confirm_deltask: '删除这个任务？',
  },
  'en': {
    appTitle: 'Tasks',
    tip_pin: 'Pin on top',
    tip_settings: 'Settings',
    tip_collapse: 'Snap to edge',
    tip_min: 'Minimize to tray',
    quick_ph: 'Jot something down… Enter to add',
    view_list: 'List',
    view_quadrant: 'Matrix',
    view_tree: 'Projects',
    sort_priority: 'Priority',
    sort_date: 'Date',
    sort_manual: 'Manual',
    deferred_bar: 'Deferred',
    settings: 'Settings',
    set_viewmode: 'Default view',
    set_sortby: 'Default sort',
    set_edge: 'Snap edge',
    edge_right: 'Right',
    edge_left: 'Left',
    edge_top: 'Top',
    set_autohide: 'Auto-hide on edge',
    set_alwaysontop: 'Always on top',
    set_language: 'Language / 语言',
    set_backup: 'Backup',
    btn_export: 'Export',
    btn_import: 'Import',
    data_hint: 'Data is stored locally: userData/tasklist-data.json',
    btn_quit: 'Quit',
    task_edit: 'Edit task',
    task_title: 'Title',
    task_quadrant: 'Matrix',
    task_priority: 'Priority',
    task_folder: 'Folder',
    q_none: 'None',
    q_IU: '① Important & Urgent',
    q_IN: '② Important, Not Urgent',
    q_NU: '③ Urgent, Not Important',
    q_NN: '④ Neither',
    prio_3: 'Urgent',
    prio_2: 'High',
    prio_1: 'Medium',
    prio_0: 'Low',
    btn_defer: 'Defer',
    btn_activate: 'Reactivate',
    btn_delete: 'Delete',
    btn_save: 'Save',
    qname_IU: 'Important & Urgent',
    qname_IN: 'Important, Not Urgent',
    qname_NU: 'Urgent, Not Important',
    qname_NN: 'Neither',
    q_uncategorized: 'Uncategorized (tap to set matrix)',
    empty_tasks: 'No tasks yet. Add one above ✍️',
    empty_dash: '—',
    all: 'All',
    empty_folder: 'This folder is empty<br/>Create a subfolder above, or add a task from the top',
    newfolder_ph: 'New subfolder / project…',
    btn_addfolder: '+Folder',
    tip_rename: 'Rename',
    tip_delfolder: 'Delete',
    empty_deferred: 'Nothing deferred',
    folder_none: '(None / All)',
    prompt_rename: 'Rename folder',
    confirm_delfolder: (n) => `This folder (incl. subfolders) has ${n} task(s). Deleting will move them to "All". Continue?`,
    alert_exported: (p) => 'Exported: ' + p,
    confirm_import: 'Import will overwrite all current data. Continue?',
    alert_imported: 'Imported successfully',
    alert_import_fail: (e) => 'Import failed: ' + e,
    confirm_quit: 'Quit the app?',
    confirm_deltask: 'Delete this task?',
  },
};

// 按系统语言判定：中文环境→zh-CN，其余→en
function systemLang() {
  try {
    const loc = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    return loc.startsWith('zh') ? 'zh-CN' : 'en';
  } catch (e) { return 'en'; }
}
// 解析 settings.language：'en'/'zh-CN' 用固定值，其余(null/未设)跟随系统
function resolveLang(lang) {
  if (lang === 'en' || lang === 'zh-CN') return lang;
  return systemLang();
}

let CUR_LANG = 'zh-CN';
function setLang(lang) { CUR_LANG = I18N[lang] ? lang : systemLang(); }
function t(key, ...args) {
  const v = (I18N[CUR_LANG] || I18N['zh-CN'])[key];
  if (typeof v === 'function') return v(...args);
  return v != null ? v : key;
}
// 把带 data-i18n / data-i18n-ph / data-i18n-title 的静态元素翻译一遍
function applyI18nDOM() {
  document.documentElement.lang = CUR_LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const html = el.getAttribute('data-i18n-html');
    if (html != null) el.innerHTML = t(el.getAttribute('data-i18n'));
    else el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
}
