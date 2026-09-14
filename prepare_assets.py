from PIL import Image
from pathlib import Path
src=Path(r'C:\Users\Admin\.codex\generated_images\01a0a009-015e-70e1-a90a-09a7149bb9d7')
files=sorted(src.glob('*.png'),key=lambda p:p.stat().st_mtime)
role=Path(__file__).parent/'characters'; gfx=Path(__file__).parent/'assets'; role.mkdir(exist_ok=True); gfx.mkdir(exist_ok=True)
names=['rabbit-idle.png','rabbit-blink.png','rabbit-close.png']
for p,n in zip(files[:3],names):
    im=Image.open(p).convert('RGBA'); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if r+g+b<180: px[x,y]=(r,g,b,0)
    im.save(role/n)
for p,n in zip(files[3:],['scissors.png','rock.png','paper.png']): Image.open(p).convert('RGBA').save(gfx/n)
