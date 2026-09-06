// 生成托盘 PNG：读 build/tray.svg → 透明窗口渲染大图 → 泛洪清背景 → 精确裁到内容框 → 铺满 resize。
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const SVG = fs.readFileSync(path.join(__dirname, '..', 'build', 'tray.svg'), 'utf-8');
const OUT_DIR = path.join(__dirname, '..', 'build');
const TRAY_SIZES = [16, 24, 32];
const WIN_SIZES = [512, 256, 128, 64, 48, 32, 16]; // 窗口/任务栏铺满图标 + 合成 ico（512 供 mac/linux）
const R = 512; // 渲染画布（大一点更清晰）

function svgAt(size) {
  return SVG.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
}

function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const bodies = [];
  pngs.forEach((p, i) => {
    const b = 16 * i;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, b + 0);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, b + 1);
    dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(p.buf.length, b + 8); dir.writeUInt32LE(offset, b + 12);
    offset += p.buf.length; bodies.push(p.buf);
  });
  return Buffer.concat([header, dir, ...bodies]);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  // 直角实心方块铺满画布，不透明背景截图最稳；圆角由 round_mask.py 精确套上
  const win = new BrowserWindow({ width: R, height: R, show: false });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#1B2530;width:${R}px;height:${R}px;overflow:hidden}
    svg{display:block;width:${R}px;height:${R}px}
    </style></head><body>${svgAt(R)}</body></html>`;
  const tmp = path.join(OUT_DIR, '_tmp_tray.html');
  fs.writeFileSync(tmp, html, 'utf-8');
  await win.loadFile(tmp);
  await new Promise(r => setTimeout(r, 500));

  // 方块铺满整幅，直接截整幅（内容 = 整张画布）
  const cropped = await win.webContents.capturePage({ x: 0, y: 0, width: R, height: R });

  // 先输出直角方块 png（托盘 + 窗口）
  const allFiles = [];
  for (const s of TRAY_SIZES) {
    const p = path.join(OUT_DIR, `tray-${s}.png`);
    fs.writeFileSync(p, cropped.resize({ width: s, height: s, quality: 'best' }).toPNG());
    allFiles.push(p); console.log('tray', s);
  }
  for (const s of WIN_SIZES) {
    const p = path.join(OUT_DIR, `winicon-${s}.png`);
    fs.writeFileSync(p, cropped.resize({ width: s, height: s, quality: 'best' }).toPNG());
    allFiles.push(p); console.log('winicon', s);
  }
  win.destroy();
  try { fs.unlinkSync(tmp); } catch (e) {}

  // 用 Python 精确套圆角 mask（保证四角对称 + 留透明边距防深色任务栏贴边露白）
  const { spawnSync } = require('child_process');
  const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
  const mask = path.join(__dirname, 'round_mask.py');
  const trayFiles = TRAY_SIZES.map((s) => path.join(OUT_DIR, `tray-${s}.png`));
  const winFiles = WIN_SIZES.map((s) => path.join(OUT_DIR, `winicon-${s}.png`));
  // 托盘 + 窗口图标：统一标准圆角(0.2)，铺满无白边，好看
  const r1 = spawnSync(pyCmd, [mask, '--pad=0', '--radius=0.2', ...trayFiles], { encoding: 'utf-8' });
  const r2 = spawnSync(pyCmd, [mask, '--pad=0', '--radius=0.2', ...winFiles], { encoding: 'utf-8' });
  for (const [tag, r] of [['tray', r1], ['winicon', r2]]) {
    if (r.status === 0) console.log(`圆角 mask 已套用(${tag})\n` + (r.stdout || ''));
    else console.log(`⚠ 圆角 mask 失败(${tag}, 保持直角):`, (r.stderr || r.error || '').toString());
  }

  // 用套好圆角的 winicon 重新合成 ico（ico 规范最大 256，排除 512）
  const winPngs = WIN_SIZES.filter((s) => s <= 256).map((s) => ({ size: s, buf: fs.readFileSync(path.join(OUT_DIR, `winicon-${s}.png`)) }));
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), buildIco(winPngs));
  console.log('icon.ico written (圆角)');
  // mac/linux 用的通用大图标：icon.png（512，electron-builder 自动转 icns / 图标集）
  fs.copyFileSync(path.join(OUT_DIR, 'winicon-512.png'), path.join(OUT_DIR, 'icon.png'));
  console.log('icon.png (512) written');
  app.quit();
});
