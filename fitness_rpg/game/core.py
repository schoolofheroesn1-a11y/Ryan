"""Ядро: окно, игровой цикл, отрисовка текста, общие виджеты."""
import random

import pygame

from .art import Art
from .motion import MotionInput
from .player import Player
from .sfx import Sfx

CANVAS_W, CANVAS_H = 320, 180      # мир рисуется в низком разрешении...
SCREEN_W, SCREEN_H = 640, 360      # ...и масштабируется ×2; интерфейс — поверх
WORLD_SCALE = SCREEN_W // CANVAS_W
FPS = 60

COL_TEXT = (226, 214, 190)
COL_DIM = (140, 128, 120)
COL_GOLD = (232, 190, 92)
COL_RED = (200, 40, 36)
COL_GREEN = (70, 160, 70)
COL_SHADOW = (8, 6, 12)


class Particles:
    """Искры/пепел, поднимающиеся над огнём."""

    def __init__(self, x, y, rate=18, spread=5):
        self.x, self.y, self.rate, self.spread = x, y, rate, spread
        self.items = []
        self.acc = 0.0

    def update(self, dt):
        self.acc += dt * self.rate
        while self.acc >= 1:
            self.acc -= 1
            self.items.append([self.x + random.uniform(-self.spread, self.spread), self.y,
                               random.uniform(-6, 6), random.uniform(-26, -12), random.uniform(1.0, 2.2)])
        for p in self.items:
            p[0] += p[2] * dt + random.uniform(-0.3, 0.3)
            p[1] += p[3] * dt
            p[4] -= dt
        self.items = [p for p in self.items if p[4] > 0]

    def draw(self, surf):
        for x, y, _, _, life in self.items:
            col = (255, 200, 90) if life > 1.4 else (230, 110, 40) if life > 0.6 else (120, 50, 30)
            surf.set_at((int(x), int(y)), col)


class Scene:
    def __init__(self, game):
        self.game = game

    def handle(self, keys, moves):
        """keys — KEYDOWN-события, moves — события упражнений."""

    def update(self, dt):
        pass

    def draw(self, canvas):
        pass

    def draw_ui(self, screen):
        pass


class Game:
    def __init__(self, use_camera=True, camera_index=0):
        pygame.init()
        pygame.display.set_caption("Ash & Iron — фитнес-RPG")
        self.screen = pygame.display.set_mode((SCREEN_W, SCREEN_H), pygame.SCALED | pygame.RESIZABLE)
        self.canvas = pygame.Surface((CANVAS_W, CANVAS_H))
        self.clock = pygame.time.Clock()
        self.fonts = {}
        self.art = Art()
        self.sfx = Sfx()
        self.player = Player.load()
        self.motion = MotionInput(use_camera, camera_index)
        self.run = None  # здоровье/эстус между боями (None — полные, после костра)
        self.held = set()  # зажатые клавиши (скан-коды): удержание уворота
        self.toast, self.toast_t = "", 0.0
        self.shake = 0.0
        self.time = 0.0
        self.running = True
        self.scene = None

    # --- Текст: шрифт без сглаживания => «пиксельные» буквы после масштабирования
    def font(self, size):
        if size not in self.fonts:
            self.fonts[size] = pygame.font.Font(None, size)
        return self.fonts[size]

    def text(self, surf, s, pos, size=18, color=COL_TEXT, center=False, right=False, shadow=True):
        aa = size < 20  # мелкий текст сглаживаем ради читаемости, крупный — «пиксельный»
        img = self.font(size).render(s, aa, color)
        x, y = pos
        if center:
            x -= img.get_width() // 2
        elif right:
            x -= img.get_width()
        if shadow:
            surf.blit(self.font(size).render(s, aa, COL_SHADOW), (x + 1, y + 1))
        surf.blit(img, (x, y))
        return img.get_width()

    def bar(self, surf, rect, frac, color, back=(30, 20, 26)):
        x, y, w, h = rect
        pygame.draw.rect(surf, COL_SHADOW, (x - 1, y - 1, w + 2, h + 2))
        pygame.draw.rect(surf, back, (x, y, w, h))
        pygame.draw.rect(surf, color, (x, y, int(w * max(0.0, min(1.0, frac))), h))
        pygame.draw.line(surf, tuple(min(255, c + 50) for c in color), (x, y), (x + int(w * max(0, frac)) - 1, y))

    def gem(self, surf, x, y, kind):
        """Пиксельный камень 8×10: алый или синий."""
        dark, mid, light = ((110, 14, 24), (210, 40, 50), (255, 150, 150)) if kind == "red" else \
            ((20, 40, 120), (60, 110, 230), (170, 210, 255))
        pts = [(x + 4, y), (x + 8, y + 4), (x + 4, y + 10), (x, y + 4)]
        pygame.draw.polygon(surf, COL_SHADOW, [(px + 1, py + 1) for px, py in pts])
        pygame.draw.polygon(surf, mid, pts)
        pygame.draw.polygon(surf, dark, [(x + 4, y + 10), (x + 8, y + 4), (x + 4, y + 5)])
        pygame.draw.line(surf, light, (x + 2, y + 4), (x + 4, y + 1))

    def gems(self, surf, pos, player, right=False):
        """Счётчик камней «◆ 12  ◆ 1». right=True — выравнивание по правому краю."""
        red, blue = f"{player.red_gems}", f"{player.blue_gems}"
        width = 12 + self.font(18).size(red)[0] + 16 + 12 + self.font(18).size(blue)[0]
        x, y = pos
        if right:
            x -= width
        self.gem(surf, x, y + 2, "red")
        x += 12 + self.text(surf, red, (x + 12, y), 18, (240, 110, 110)) + 16
        self.gem(surf, x, y + 2, "blue")
        self.text(surf, blue, (x + 12, y), 18, (130, 170, 255))

    def camera_widget(self, surf, rect):
        """Мини-превью камеры со скелетом позы, либо подсказка про клавиши."""
        x, y, w, h = rect
        pygame.draw.rect(surf, COL_SHADOW, (x - 2, y - 2, w + 4, h + 4))
        pygame.draw.rect(surf, (60, 46, 50), (x - 2, y - 2, w + 4, h + 4), 1)
        prev = self.motion.preview_surface((w, h))
        if prev:
            surf.blit(prev, (x, y))
            det = self.motion.detector()
            if det:
                self.text(surf, det.posture, (x + 3, y + h - 12), 14, COL_GOLD)
        else:
            self.text(surf, "КАМЕРА", (x + w // 2, y + 6), 16, COL_DIM, center=True)
            for i, line in enumerate(self._wrap(self.motion.status, 20)):
                self.text(surf, line, (x + w // 2, y + 24 + i * 11), 13, COL_DIM, center=True)
            self.text(surf, "клавиши: J K L", (x + w // 2, y + h - 14), 14, COL_GOLD, center=True)

    @staticmethod
    def _wrap(s, n):
        words, lines, cur = s.split(), [], ""
        for wd in words:
            if len(cur) + len(wd) + 1 > n and cur:
                lines.append(cur)
                cur = wd
            else:
                cur = f"{cur} {wd}".strip()
        if cur:
            lines.append(cur)
        return lines[:4]

    def change(self, scene):
        self.scene = scene

    @property
    def manual_low(self):
        """Зажата клавиша уворота (K или 2) — герой остаётся внизу."""
        from .motion import HOLD_LOW_KEYS
        return bool(self.held & HOLD_LOW_KEYS)

    def test_keys(self, keys):
        """Клавиши тестировщика: F2 — камни и пепел, F3 — следующий бой с боссом, F4 — к замку."""
        from .gear import BOSS_EVERY
        for e in keys:
            if e.key == pygame.K_F2:
                self.player.red_gems += 10
                self.player.blue_gems += 1
                self.player.souls += 300
                self.say("Тест: +10 алых, +1 синий, +300 пепла")
            elif e.key == pygame.K_F4:
                from .gear import CASTLE_FROM_WAVE
                self.player.wave = max(self.player.wave, CASTLE_FROM_WAVE)
                self.say(f"Тест: подступы к замку (#{self.player.wave})")
            elif e.key == pygame.K_F3:
                self.player.wave = -(-self.player.wave // BOSS_EVERY) * BOSS_EVERY
                self.say(f"Тест: следующий бой — босс (#{self.player.wave})")
            else:
                continue
            self.player.save()

    def say(self, text, t=2.5):
        self.toast, self.toast_t = text, t

    def frame(self, dt, raw_events):
        keys = [e for e in raw_events if e.type == pygame.KEYDOWN]
        for e in raw_events:
            if e.type == pygame.KEYDOWN:
                self.held.add(getattr(e, "scancode", None))
            elif e.type == pygame.KEYUP:
                self.held.discard(getattr(e, "scancode", None))
        self.test_keys(keys)
        moves = self.motion.poll(keys)
        for m in moves:
            self.player.add_rep(m)
        self.time += dt
        self.scene.handle(keys, moves)
        self.scene.update(dt)
        self.canvas.fill((0, 0, 0))
        self.scene.draw(self.canvas)
        ox = oy = 0
        if self.shake > 0:
            self.shake = max(0.0, self.shake - dt)
            ox, oy = random.randint(-2, 2), random.randint(-2, 2)
        self.screen.fill((0, 0, 0))
        self.screen.blit(pygame.transform.scale(self.canvas, (SCREEN_W, SCREEN_H)), (ox * 2, oy * 2))
        self.scene.draw_ui(self.screen)
        if self.toast_t > 0:
            self.toast_t -= dt
            self.text(self.screen, self.toast, (SCREEN_W // 2, 4), 16, (120, 220, 255), center=True)

    def run(self):
        from .scenes import TitleScene
        self.change(TitleScene(self))
        while self.running:
            dt = min(self.clock.tick(FPS) / 1000.0, 0.05)
            events = pygame.event.get()
            if any(e.type == pygame.QUIT for e in events):
                break
            self.frame(dt, events)
            pygame.display.flip()
        self.player.save()
        self.motion.shutdown()
        pygame.quit()
