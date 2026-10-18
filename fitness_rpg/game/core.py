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

    def draw_backdrop(self, screen):
        """Фон в разрешении экрана под пиксельным миром (по умолчанию нет)."""

    def draw(self, canvas):
        pass

    def draw_ui(self, screen):
        pass


class Game:
    def __init__(self, use_camera=True, camera_index=0):
        pygame.init()
        pygame.display.set_caption("Ash & Iron — фитнес-RPG")
        self.screen = pygame.display.set_mode((SCREEN_W, SCREEN_H), pygame.SCALED | pygame.RESIZABLE)
        # Прозрачный холст: сцена может подложить под пиксельный мир фон в полном разрешении
        self.canvas = pygame.Surface((CANVAS_W, CANVAS_H), pygame.SRCALPHA)
        self.clock = pygame.time.Clock()
        self.fonts = {}
        self.art = Art()
        self.sfx = Sfx()
        self.player = Player.load()
        self.motion = MotionInput(use_camera, camera_index)
        self.run = None  # здоровье/эстус между боями (None — полные, после костра)
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
            self.text(surf, "клавиши: 1 2 3", (x + w // 2, y + h - 14), 14, COL_GOLD, center=True)

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

    def frame(self, dt, raw_events):
        keys = [e for e in raw_events if e.type == pygame.KEYDOWN]
        moves = self.motion.poll(keys)
        for m in moves:
            self.player.add_rep(m)
        self.time += dt
        self.scene.handle(keys, moves)
        self.scene.update(dt)
        self.canvas.fill((0, 0, 0, 0))
        self.scene.draw(self.canvas)
        ox = oy = 0
        if self.shake > 0:
            self.shake = max(0.0, self.shake - dt)
            ox, oy = random.randint(-2, 2), random.randint(-2, 2)
        self.screen.fill((0, 0, 0))
        self.scene.draw_backdrop(self.screen)
        self.screen.blit(pygame.transform.scale(self.canvas, (SCREEN_W, SCREEN_H)), (ox * 2, oy * 2))
        self.scene.draw_ui(self.screen)

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
