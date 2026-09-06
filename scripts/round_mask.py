# 给 winicon/tray 的方形 PNG 套精确对称圆角，并可选内缩留透明边距（避免深色任务栏上贴边露白）。
# 用法: round_mask.py [--pad=0.0] [--radius=0.22] file1.png file2.png ...
#   --pad     内缩比例：把整幅图标缩小并居中，四周留出透明边距（0=铺满，0.1=每边留5%）
#   --radius  圆角半径 / 图标边长 的比例
import sys
from PIL import Image, ImageDraw, ImageChops


def round_png(path, radius_ratio=0.22, pad_ratio=0.0):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    ss = 4  # 超采样抗锯齿

    # 内容实际占用的方框（留出 padding）
    pad = int(round(min(w, h) * pad_ratio))
    cw, ch = w - 2 * pad, h - 2 * pad
    if cw < 1 or ch < 1:
        cw, ch, pad = w, h, 0

    # 若需要 padding，把原图缩小到内容框大小
    if pad > 0:
        content = im.resize((cw, ch), Image.LANCZOS)
    else:
        content = im

    r = int(min(cw, ch) * radius_ratio)

    # 在内容框尺寸上画圆角 mask
    mask = Image.new("L", (cw * ss, ch * ss), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, cw * ss - 1, ch * ss - 1], radius=r * ss, fill=255
    )
    mask = mask.resize((cw, ch), Image.BILINEAR)  # 不用 LANCZOS：高对比边缘会 overshoot 冲出浅色亮边

    # 圆角作用到内容（与内容自身 alpha 取交集）
    content_a = ImageChops.multiply(content.getchannel("A"), mask)
    content.putalpha(content_a)

    # 贴回全透明画布居中
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(content, (pad, pad), content)
    out.save(path)
    print(f"rounded: {path} ({w}x{h}, content={cw}x{ch}, pad={pad}, r={r})")


if __name__ == "__main__":
    radius_ratio = 0.22
    pad_ratio = 0.0
    files = []
    for a in sys.argv[1:]:
        if a.startswith("--pad="):
            pad_ratio = float(a.split("=", 1)[1])
        elif a.startswith("--radius="):
            radius_ratio = float(a.split("=", 1)[1])
        else:
            files.append(a)
    for p in files:
        round_png(p, radius_ratio=radius_ratio, pad_ratio=pad_ratio)
