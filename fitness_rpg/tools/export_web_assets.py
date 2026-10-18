"""Выгружает кадры спрайтов и иконки приложения для мобильной (веб) версии.

Запуск:  python tools/export_web_assets.py
Источник арта один — game/art.py, так что ПК- и мобильная версии выглядят одинаково.
"""
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pygame  # noqa: E402

from game import art  # noqa: E402

OUT = os.path.join(ROOT, "web", "assets")


ATLAS_W = 1024


def write_atlas(sprites):
    """Полочная упаковка: спрайты по убыванию высоты, ряд за рядом, с отступом 1 px."""
    import json
    order = sorted(sprites, key=lambda k: (-sprites[k].get_height(), k))
    x = y = shelf = 0
    rects = {}
    for name in order:
        w, h = sprites[name].get_size()
        if x + w > ATLAS_W:
            x, y, shelf = 0, y + shelf + 1, 0
        rects[name] = (x, y, w, h)
        x += w + 1
        shelf = max(shelf, h)
    atlas = pygame.Surface((ATLAS_W, y + shelf), pygame.SRCALPHA)
    for name, (x, y, w, h) in rects.items():
        atlas.blit(sprites[name], (x, y))
    pygame.image.save(atlas, os.path.join(OUT, "atlas.png"))
    with open(os.path.join(OUT, "atlas.json"), "w", encoding="utf-8") as f:
        json.dump(rects, f, separators=(",", ":"), sort_keys=True)
    print(f"Атлас: {len(rects)} спрайтов, {ATLAS_W}x{y + shelf}")


def main():
    pygame.init()
    pygame.display.set_mode((1, 1))
    os.makedirs(OUT, exist_ok=True)
    a = art.Art()

    # Все спрайты и фоны пакуются в один атлас (assets/atlas.png + atlas.json):
    # так в репозитории и на телефоне пара файлов вместо двух сотен.
    sprites = {}
    sets = [("skeleton", a.skeleton), ("boss", a.boss), ("bandit", a.bandit), ("chief", a.chief)]
    sets += [(f"hero_{sword}_{look}", frames) for (sword, look), frames in a.heroes.items()]
    for who, frames in sets:
        for anim_name, surfs in frames.items():
            for i, surf in enumerate(surfs):
                sprites[f"{who}_{anim_name}_{i}"] = surf
    for i, surf in enumerate(a.bonfire):
        sprites[f"bonfire_{i}"] = surf
    for i, surf in enumerate(a.torch):
        sprites[f"torch_{i}"] = surf
    sprites["title_bg"] = a.title_bg
    sprites["arena_bg"] = a.arena_bg
    sprites["castle_bg"] = a.castle_bg
    sprites["skeleton_dark_0"] = art.tinted(a.skeleton["idle"][0], (20, 10, 24), 0.55)
    write_atlas(sprites)

    # Иконки приложения: рыцарь у костра на тёмном фоне
    icon = pygame.Surface((48, 48))
    icon.fill((20, 12, 24))
    pygame.draw.circle(icon, (90, 30, 30), (24, 30), 20)
    icon.blit(a.heroes[("steel", "base")]["idle"][0], (4, 12))
    icon.blit(a.bonfire[1], (28, 22))
    for size in (180, 192, 512):
        pygame.image.save(pygame.transform.scale(icon, (size, size)), os.path.join(OUT, f"icon_{size}.png"))
    print("Готово:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
