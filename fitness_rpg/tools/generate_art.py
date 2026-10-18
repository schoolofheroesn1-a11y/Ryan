"""Выгружает весь процедурный пиксель-арт в PNG (assets/).

Запуск:  python tools/generate_art.py
Создаёт оригиналы 1:1 и увеличенные превью (*_x6.png) для просмотра.
"""
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pygame  # noqa: E402

from game import art  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")


def save(surf, name, scale):
    pygame.image.save(surf, os.path.join(OUT, f"{name}.png"))
    big = pygame.transform.scale(surf, (surf.get_width() * scale, surf.get_height() * scale))
    pygame.image.save(big, os.path.join(OUT, f"{name}_x{scale}.png"))


def main():
    pygame.init()
    pygame.display.set_mode((1, 1))
    os.makedirs(OUT, exist_ok=True)
    a = art.Art()

    save(a.title_bg, "title_screen", 4)
    save(a.arena_bg, "arena", 4)
    save(a.hero["idle"][0], "hero_idle", 8)
    save(a.hero["attack"][0], "hero_attack", 8)
    save(a.skeleton["idle"][0], "skeleton_idle", 8)
    save(a.skeleton["attack"][0], "skeleton_attack", 8)
    save(a.bonfire[0], "bonfire", 8)
    save(a.boss["idle"][0], "boss_idle", 6)
    save(a.boss["windup"][1], "boss_windup", 6)
    save(a.boss["attack"][0], "boss_attack", 6)

    # Общий лист персонажей на тёмном фоне
    sheet = pygame.Surface((216, 52))
    sheet.fill((20, 14, 24))
    x = 4
    for s in (a.hero["idle"][0], a.hero["attack"][0], a.skeleton["idle"][0],
              a.skeleton["attack"][0], a.bonfire[0], a.boss["idle"][0]):
        sheet.blit(s, (x, 52 - s.get_height() - 4))
        x += s.get_width() + 4
    save(sheet, "character_sheet", 6)
    print("Готово:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
