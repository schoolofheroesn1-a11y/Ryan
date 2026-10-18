"""Иконка App Store (1024×1024, без прозрачности) и заставка iOS из того же пиксельного арта.

Запуск:  python tools/make_ios_icons.py
Пишет в mobile/ios/App/App/Assets.xcassets (AppIcon и Splash). Рисунок — как у иконок сайта
(tools/export_web_assets.py), но с целым масштабом, чтобы пиксели оставались ровными.
"""
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pygame  # noqa: E402

from game import art  # noqa: E402

ASSETS = os.path.join(ROOT, "mobile", "ios", "App", "App", "Assets.xcassets")
BG = (20, 12, 24)        # фон иконки (как у иконок сайта)
SPLASH_BG = (10, 6, 12)  # фон игры (#0a060c)


def knight_icon(a):
    """Рыцарь у костра, 48×48 — тот же рисунок, что и в иконках сайта."""
    icon = pygame.Surface((48, 48))
    icon.fill(BG)
    pygame.draw.circle(icon, (90, 30, 30), (24, 30), 20)
    icon.blit(a.heroes[("steel", "base")]["idle"][0], (4, 12))
    icon.blit(a.bonfire[1], (28, 22))
    return icon


def on_canvas(icon, size, scale, bg):
    """Иконка с целым масштабом по центру квадрата size×size, без альфа-канала."""
    out = pygame.Surface((size, size))
    out.fill(bg)
    big = pygame.transform.scale(icon, (icon.get_width() * scale, icon.get_height() * scale))
    out.blit(big, ((size - big.get_width()) // 2, (size - big.get_height()) // 2))
    return out


def main():
    pygame.init()
    pygame.display.set_mode((1, 1))
    a = art.Art()
    icon = knight_icon(a)
    # 48 × 21 = 1008: целый масштаб, по 8 px фона с краёв
    pygame.image.save(on_canvas(icon, 1024, 21, BG), os.path.join(ASSETS, "AppIcon.appiconset", "AppIcon-512@2x.png"))
    splash = on_canvas(icon, 2732, 12, SPLASH_BG)
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        pygame.image.save(splash, os.path.join(ASSETS, "Splash.imageset", name))
    print("Готово:", os.path.abspath(ASSETS))


if __name__ == "__main__":
    main()
