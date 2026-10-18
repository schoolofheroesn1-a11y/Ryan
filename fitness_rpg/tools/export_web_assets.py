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


def main():
    pygame.init()
    pygame.display.set_mode((1, 1))
    os.makedirs(OUT, exist_ok=True)
    a = art.Art()

    def save(surf, name):
        pygame.image.save(surf, os.path.join(OUT, name + ".png"))

    for who, frames in (("hero", a.hero), ("skeleton", a.skeleton)):
        for anim_name, surfs in frames.items():
            for i, s in enumerate(surfs):
                save(s, f"{who}_{anim_name}_{i}")
    for i, s in enumerate(a.bonfire):
        save(s, f"bonfire_{i}")
    for i, s in enumerate(a.torch):
        save(s, f"torch_{i}")
    # фон меню (menu_bg.png) делает tools/make_menu_bg.py из assets/menu_source.jpg
    save(a.arena_bg, "arena_bg")
    save(art.tinted(a.skeleton["idle"][0], (20, 10, 24), 0.55), "skeleton_dark_0")
    save(art.tinted(a.hero["dodge"][0], (40, 10, 10), 0.6), "hero_dead_0")

    # Иконки приложения: рыцарь у костра на тёмном фоне
    icon = pygame.Surface((48, 48))
    icon.fill((20, 12, 24))
    pygame.draw.circle(icon, (90, 30, 30), (24, 30), 20)
    icon.blit(a.hero["idle"][0], (4, 12))
    icon.blit(a.bonfire[1], (28, 22))
    for size in (180, 192, 512):
        pygame.image.save(pygame.transform.scale(icon, (size, size)), os.path.join(OUT, f"icon_{size}.png"))
    print("Готово:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
