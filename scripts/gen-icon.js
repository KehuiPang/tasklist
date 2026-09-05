// 用 Electron/Chromium 渲染 SVG → 多尺寸 PNG → 合成 ICO。单窗口单次加载，避免连续 loadFile 失败。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SVG = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.svg'), 'utf-8');
const OUT_DIR = path.join(__dirname, '..', 'build');
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const MAX = 256;

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

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: MAX + 4, height: MAX + 4, show: false });
  // 一个页面放最大尺寸的 svg，居左上
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    #box{position:absolute;left:0;top:0}
    </style></head><body><div id="box">${svgAt(MAX)}</div></body></html>`;
  const tmp = path.join(OUT_DIR, '_tmp_icon.html');
  fs.writeFileSync(tmp, html, 'utf-8');
  await win.loadFile(tmp);
  await new Promise(r => setTimeout(r, 500));

  const pngs = [];
  for (const s of SIZES) {
    // 截取左上 256x256 区域，再 resize 到目标尺寸（capturePage 支持 rect）
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: MAX, height: MAX });
    const buf = img.resize({ width: s, height: s, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(OUT_DIR, `icon-${s}.png`), buf);
    pngs.push({ size: s, buf });
    console.log('rendered', s);
  }
  const ico = buildIco(pngs);
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);
  console.log('ICO written:', ico.length, 'bytes');
  win.destroy();
  try { fs.unlinkSync(tmp); } catch (e) {}
  app.quit();
});
