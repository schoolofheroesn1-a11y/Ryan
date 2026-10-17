"""Пепел и Железо — фитнес-RPG в стиле тёмного фэнтези.

Запуск:
    python main.py                 # с веб-камерой
    python main.py --no-camera     # без камеры, упражнения — клавишами 1/2/3
    python main.py --camera 1      # выбрать другую камеру
    python main.py --screenshots shots   # отрисовать сцены в PNG и выйти
"""
import argparse
import os
import sys


def take_screenshots(out_dir):
    os.environ["SDL_VIDEODRIVER"] = "dummy"
    import pygame

    from game.core import Game
    from game.player import Player
    from game import scenes

    os.makedirs(out_dir, exist_ok=True)
    g = Game(use_camera=False)
    g.player = Player(strength=3, vigor=2, endurance=2, souls=340, wave=3)
    g.player.save = lambda *a, **k: None  # не трогаем настоящее сохранение

    def shot(scene, name, seconds=1.0, setup=None):
        g.change(scene)
        if setup:
            setup(scene)
        for _ in range(int(seconds * 60)):
            g.frame(1 / 60, [])
        pygame.image.save(g.screen, os.path.join(out_dir, f"{name}.png"))

    shot(scenes.TitleScene(g), "01_title", 2.0)

    bon = scenes.BonfireScene(g)
    shot(bon, "02_bonfire", 1.0, lambda s: (s.start_ritual("strength"), s.ritual.__setitem__(3, 3)))

    def windup(s):
        s.enemy.set("windup", 99)
        s.enemy.windup_time = 99.6  # кадр «середина замаха»
        s.hp = int(g.player.max_hp * 0.7)
        s.stamina = g.player.max_stamina * 0.55
        s.estus = 2
        s.enemy.hp = int(s.enemy.max_hp * 0.6)
        s.float("24", s.enemy.x + 12, 92, (226, 214, 190))
    shot(scenes.BattleScene(g), "03_battle_windup", 0.5, windup)

    def attack(s):
        s.enemy.set("recover", 99)
        s.act("pushup")
    shot(scenes.BattleScene(g), "04_battle_attack", 0.2, attack)

    def died(s):
        s.hp = 1
        s.enemy.set("windup", 0.01)
    shot(scenes.BattleScene(g), "05_you_died", 2.0, died)

    shot(scenes.CameraScene(g), "06_camera", 0.3)
    pygame.quit()
    print("Скриншоты сохранены в", os.path.abspath(out_dir))


def main():
    ap = argparse.ArgumentParser(description="Пепел и Железо — фитнес-RPG")
    ap.add_argument("--no-camera", action="store_true", help="играть без камеры (клавиши 1/2/3)")
    ap.add_argument("--camera", type=int, default=0, help="номер веб-камеры")
    ap.add_argument("--screenshots", metavar="DIR", help="сохранить скриншоты сцен и выйти")
    args = ap.parse_args()

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    if args.screenshots:
        take_screenshots(args.screenshots)
        return
    from game.core import Game
    Game(use_camera=not args.no_camera, camera_index=args.camera).run()


if __name__ == "__main__":
    main()
