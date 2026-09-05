// 生成托盘 PNG：读 build/tray.svg → 透明窗口渲染大图 → 泛洪清背景 → 精确裁到内容框 → 铺满 resize。
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const SVG = fs.readFileSync(path.join(__dirname, '..', 'build', 'tray.svg'), 'utf-8');
const OUT_DIR = path.join(__dirname, '..', 'build');
const TRAY_SIZES = [16, 24, 32];
const WIN_SIZES = [256, 128, 64, 48, 32, 16]; // 窗口/任务栏铺满图标 + 合成 ico
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
  const win = new BrowserWindow({
    width: R, height: R, show: false,
    transparent: true, frame: false, backgroundColor: '#00000000'
  });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:rgba(0,0,0,0)}
    #box{position:absolute;left:0;top:0}
    </style></head><body><div id="box">${svgAt(R)}</div></body></html>`;
  const tmp = path.join(OUT_DIR, '_tmp_tray.html');
  fs.writeFileSync(tmp, html, 'utf-8');
  await win.loadFile(tmp);
  await new Promise(r => setTimeout(r, 700));

  const shot = await win.webContents.capturePage({ x: 0, y: 0, width: R, height: R });

  // 取位图，泛洪清背景残影 + 求内容边界框
  const { width: w, height: h } = shot.getSize();
  const bmp = shot.toBitmap(); // BGRA
  const idx = (x, y) => (y * w + x) * 4;
  const isDark = (x, y) => {
    const i = idx(x, y);
    return (0.299 * bmp[i + 2] + 0.587 * bmp[i + 1] + 0.114 * bmp[i]) < 160;
  };
  // 泛洪从四角清亮色背景 → 透明(RGB深墨)
  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push([x, 0]); stack.push([x, h - 1]); }
  for (let y = 0; y < h; y++) { stack.push([0, y]); stack.push([w - 1, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    if (isDark(x, y)) continue;
    const i = idx(x, y);
    bmp[i] = 0x30; bmp[i + 1] = 0x25; bmp[i + 2] = 0x1B; bmp[i + 3] = 0;
    stack.push([x + 1, y]); stack.push([x - 1, y]); stack.push([x, y + 1]); stack.push([x, y - 1]);
  }

  // 求非透明内容边界框
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (bmp[idx(x, y) + 3] > 40) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  console.log(`content box: x[${minX}~${maxX}] y[${minY}~${maxY}] = ${cw}x${ch}`);

  const clean = nativeImage.createFromBuffer(bmp, { width: w, height: h });
  // 精确裁剪到内容框（正方形，取最大边居中）
  const side = Math.max(cw, ch);
  const cropX = Math.max(0, minX - Math.floor((side - cw) / 2));
  const cropY = Math.max(0, minY - Math.floor((side - ch) / 2));
  const cropped = clean.crop({ x: cropX, y: cropY, width: side, height: side });

  // 托盘图标
  for (const s of TRAY_SIZES) {
    const buf = cropped.resize({ width: s, height: s, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(OUT_DIR, `tray-${s}.png`), buf);
    console.log('tray', s);
  }
  // 窗口/任务栏铺满图标 + 合成 ico
  const winPngs = [];
  for (const s of WIN_SIZES) {
    const buf = cropped.resize({ width: s, height: s, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(OUT_DIR, `winicon-${s}.png`), buf);
    winPngs.push({ size: s, buf });
    console.log('winicon', s);
  }
  // 合成 ico（复用 ico 打包逻辑）
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), buildIco(winPngs));
  console.log('icon.ico written');
  win.destroy();
  try { fs.unlinkSync(tmp); } catch (e) {}
  app.quit();
});
