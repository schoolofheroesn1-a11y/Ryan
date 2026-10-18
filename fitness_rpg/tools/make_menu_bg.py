"""Фон главного меню из картинки assets/menu_source.jpg.

Картинка вертикальная, а экран 16:9, поэтому берём полосу с закатом, замком и
каменным уступом (на нём стоят рыцарь, костёр и скелет) и уменьшаем до 640×360.
Запуск:  python tools/make_menu_bg.py
"""
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
CROP_TOP = 560  # верх полосы в пикселях исходника; уступ оказывается у нижнего края

src = Image.open(os.path.join(ROOT, "assets", "menu_source.jpg")).convert("RGB")
w = src.width
h = round(w * 9 / 16)
bg = src.crop((0, CROP_TOP, w, CROP_TOP + h)).resize((640, 360), Image.LANCZOS)
for out in (os.path.join(ROOT, "assets", "menu_bg.png"), os.path.join(ROOT, "web", "assets", "menu_bg.png")):
    bg.save(out, optimize=True)
    print("Готово:", os.path.abspath(out))
