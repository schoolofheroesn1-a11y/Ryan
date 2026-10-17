"""Сцены игры: главный экран, костёр (прокачка), бой, калибровка камеры."""
import math
import random

import pygame

from .art import tinted
from .core import (COL_DIM, COL_GOLD, COL_GREEN, COL_RED, COL_SHADOW, COL_TEXT,
                   SCREEN_H, SCREEN_W, Particles, Scene)
from .exercises import NAMES
from .player import ESTUS_MAX, STATS, Player

GROUND_TITLE = 150
GROUND_ARENA = 140

MOVE_HINTS = [
    ("ОТЖИМАНИЕ", "удар мечом", "1"),
    ("ПРИСЕД", "уворот", "2"),
    ("ЗВЁЗДОЧКА", "глоток эстуса", "3"),
]


def anim(frames, t, fps=2):
    return frames[int(t * fps) % len(frames)]


class Menu:
    def __init__(self, items):
        self.items = items  # [(label, callback)]
        self.index = 0

    def handle(self, keys):
        for e in keys:
            if e.key in (pygame.K_UP, pygame.K_w):
                self.index = (self.index - 1) % len(self.items)
            elif e.key in (pygame.K_DOWN, pygame.K_s):
                self.index = (self.index + 1) % len(self.items)
            elif e.key in (pygame.K_RETURN, pygame.K_SPACE, pygame.K_KP_ENTER):
                self.items[self.index][1]()
                return True
        return False

    def draw(self, game, surf, x, y, step=22, size=20):
        for i, (label, _) in enumerate(self.items):
            sel = i == self.index
            col = COL_GOLD if sel else COL_TEXT
            if sel:
                pulse = int(abs(math.sin(game.time * 3)) * 3)
                game.text(surf, ">", (x - 14 - pulse, y + i * step), size, COL_GOLD)
            game.text(surf, label, (x, y + i * step), size, col)


# ---------------------------------------------------------------- Главный экран
class TitleScene(Scene):
    def __init__(self, game):
        super().__init__(game)
        g = game
        self.embers = Particles(208, 132, rate=22)
        self.skel_dark = tinted(g.art.skeleton["idle"][0], (20, 10, 24), 0.55)
        self.menu = Menu([
            ("Продолжить путь", lambda: g.change(BattleScene(g))),
            ("Костёр — прокачка", lambda: g.change(BonfireScene(g))),
            ("Камера и калибровка", lambda: g.change(CameraScene(g))),
            ("Новая игра", self.new_game),
            ("Выход", self.quit),
        ])

    def new_game(self):
        self.game.player = Player()
        self.game.player.save()
        self.game.change(BonfireScene(self.game))

    def quit(self):
        self.game.running = False

    def handle(self, keys, moves):
        self.menu.handle(keys)

    def update(self, dt):
        self.embers.update(dt)

    def draw(self, c):
        a, t = self.game.art, self.game.time
        c.blit(a.title_bg, (0, 0))
        # отблеск костра на земле
        glow = pygame.Surface((80, 20), pygame.SRCALPHA)
        r = 34 + int(math.sin(t * 6) * 2)
        pygame.draw.ellipse(glow, (255, 120, 40, 40), (40 - r, 2, r * 2, 16))
        c.blit(glow, (168, GROUND_TITLE - 10))
        c.blit(anim(a.bonfire, t, 8), (200, GROUND_TITLE - 22))
        c.blit(anim(a.hero["idle"], t, 1.5), (172, GROUND_TITLE - 32))
        # скелет крадётся из тьмы — глаза мерцают
        sx, sy = 270, GROUND_TITLE - 32
        c.blit(self.skel_dark, (sx, sy))
        if int(t * 1.3) % 5 != 0:
            for ex in (9, 14):
                c.set_at((sx + ex, sy + 6), (255, 70, 40))
        self.embers.draw(c)

    def draw_ui(self, s):
        g = self.game
        g.text(s, "ПЕПЕЛ И ЖЕЛЕЗО", (SCREEN_W // 2, 18), 56, (120, 30, 26), center=True, shadow=False)
        g.text(s, "ПЕПЕЛ И ЖЕЛЕЗО", (SCREEN_W // 2 - 2, 16), 56, (232, 206, 160), center=True, shadow=False)
        g.text(s, "фитнес-RPG: тренируй тело, чтобы выжить во тьме", (SCREEN_W // 2, 62), 18, COL_DIM, center=True)
        self.menu.draw(g, s, 60, 150)
        p = g.player
        g.text(s, f"Уровень {p.level}   Души: {p.souls}   Следующий враг: скелет #{p.wave}",
               (12, SCREEN_H - 20), 16, COL_DIM)
        g.text(s, "Стрелки — выбор, Enter — подтвердить", (SCREEN_W - 12, SCREEN_H - 20), 16, COL_DIM, right=True)


# ---------------------------------------------------------------- Костёр
class BonfireScene(Scene):
    """Прокачка: выбери характеристику и выполни нужное упражнение."""

    def __init__(self, game):
        super().__init__(game)
        g = game
        self.embers = Particles(216, 116, rate=26)
        self.ritual = None      # (stat, exercise, need, done)
        self.message, self.msg_t = "Костёр зажжён. Здоровье и эстус восстановлены.", 3.0
        items = [(None, (lambda st=st: self.start_ritual(st))) for st in STATS]
        items.append(("В бой", lambda: g.change(BattleScene(g))))
        items.append(("В главное меню", lambda: g.change(TitleScene(g))))
        self.menu = Menu(items)

    def start_ritual(self, stat):
        p = self.game.player
        if not p.can_level():
            self.say(f"Нужно {p.level_cost()} душ, у вас {p.souls}. Победите скелетов!")
            return
        self.ritual = [stat, STATS[stat][1], p.reps_needed(stat), 0]

    def say(self, msg, t=3.0):
        self.message, self.msg_t = msg, t

    def handle(self, keys, moves):
        if self.ritual:
            stat, ex, need, _ = self.ritual
            for e in keys:
                if e.key == pygame.K_ESCAPE:
                    self.ritual = None
                    self.say("Ритуал прерван. Души не потрачены.")
                    return
            for m in moves:
                if m == ex:
                    self.ritual[3] += 1
            if self.ritual[3] >= need:
                p = self.game.player
                p.level_up(stat)
                p.save()
                self.ritual = None
                self.say(f"{STATS[stat][0]} повышена до {getattr(p, stat)}!", 4.0)
                self.embers.rate = 120
            return
        for e in keys:
            if e.key == pygame.K_ESCAPE:
                self.game.change(TitleScene(self.game))
                return
        self.menu.handle(keys)

    def update(self, dt):
        self.embers.update(dt)
        self.embers.rate += (26 - self.embers.rate) * min(1.0, dt * 1.5)
        self.msg_t -= dt

    def draw(self, c):
        a, t = self.game.art, self.game.time
        c.blit(a.title_bg, (0, 0))
        dark = pygame.Surface(c.get_size(), pygame.SRCALPHA)
        dark.fill((0, 0, 0, 120))
        c.blit(dark, (0, 0))
        glow = pygame.Surface((120, 40), pygame.SRCALPHA)
        r = 46 + int(math.sin(t * 5) * 3)
        pygame.draw.ellipse(glow, (255, 120, 40, 50), (60 - r, 6, r * 2, 28))
        c.blit(glow, (156, GROUND_TITLE - 24))
        fire = pygame.transform.scale(anim(a.bonfire, t, 8), (32, 44))
        c.blit(fire, (200, GROUND_TITLE - 44))
        hero = a.hero["attack"][0] if self.ritual and self.ritual[3] % 2 else a.hero["idle"][0]
        c.blit(hero, (168, GROUND_TITLE - 32))
        self.embers.draw(c)

    def draw_ui(self, s):
        g, p = self.game, self.game.player
        panel = pygame.Surface((300, 260), pygame.SRCALPHA)
        panel.fill((10, 6, 14, 200))
        s.blit(panel, (16, 16))
        pygame.draw.rect(s, (90, 64, 50), (16, 16, 300, 260), 1)
        g.text(s, "КОСТЁР", (30, 26), 30, COL_GOLD)
        g.text(s, f"Уровень {p.level}", (30, 54), 18)
        g.text(s, f"Души: {p.souls}", (150, 54), 18, COL_GOLD)
        g.text(s, f"Цена уровня: {p.level_cost()} душ", (30, 72), 16, COL_DIM)

        y = 98
        for i, st in enumerate(STATS):
            name, ex, desc = STATS[st]
            sel = self.menu.index == i
            col = COL_GOLD if sel else COL_TEXT
            if sel:
                g.text(s, ">", (24, y), 20, COL_GOLD)
            g.text(s, f"{name} {getattr(p, st)}", (38, y), 20, col)
            g.text(s, f"{NAMES[ex]} ×{p.reps_needed(st)} — {desc}", (38, y + 16), 14, COL_DIM)
            y += 36
        for j, (label, _) in enumerate(self.menu.items[len(STATS):]):
            idx = len(STATS) + j
            sel = self.menu.index == idx
            if sel:
                g.text(s, ">", (24, y), 20, COL_GOLD)
            g.text(s, label, (38, y), 20, COL_GOLD if sel else COL_TEXT)
            y += 22

        stats = (f"Урон {p.damage}   Здоровье {p.max_hp}   Силы {p.max_stamina} (+{p.stamina_regen}/с)")
        g.text(s, stats, (30, 254), 14, COL_DIM)

        tr = p.total_reps
        g.text(s, "Всего за всё время:", (SCREEN_W - 16, 20), 16, COL_DIM, right=True)
        g.text(s, f"отжиманий {tr['pushup']}  приседаний {tr['squat']}  прыжков {tr['jack']}",
               (SCREEN_W - 16, 36), 16, COL_TEXT, right=True)
        g.camera_widget(s, (SCREEN_W - 144, 60, 128, 96))

        if self.ritual:
            stat, ex, need, done = self.ritual
            box = pygame.Surface((SCREEN_W, 78), pygame.SRCALPHA)
            box.fill((0, 0, 0, 210))
            s.blit(box, (0, SCREEN_H - 78))
            g.text(s, f"Ритуал: {STATS[stat][0]}   (Esc — прервать)", (SCREEN_W // 2, SCREEN_H - 72), 16, COL_DIM, center=True)
            g.text(s, f"{NAMES[ex]}: {done} / {need}", (SCREEN_W // 2, SCREEN_H - 54), 36, COL_GOLD, center=True)
            g.bar(s, (SCREEN_W // 2 - 150, SCREEN_H - 18, 300, 8), done / need, (230, 140, 50))
        elif self.msg_t > 0:
            g.text(s, self.message, (SCREEN_W // 2, SCREEN_H - 30), 18, COL_GOLD, center=True)


# ---------------------------------------------------------------- Бой
class FloatText:
    def __init__(self, text, x, y, color, size=22, ttl=1.0):
        self.text, self.x, self.y, self.color, self.size, self.ttl = text, x, y, color, size, ttl


class Skeleton:
    def __init__(self, wave):
        self.wave = wave
        self.max_hp = 60 + 25 * (wave - 1)
        self.hp = self.max_hp
        self.damage = 18 + 6 * (wave - 1)
        self.windup_time = max(1.25, 1.8 - 0.05 * wave)  # время на реакцию (присед)
        self.max_poise = 2
        self.poise = self.max_poise
        self.state = "idle"
        self.timer = random.uniform(2.0, 3.0)
        self.flash = 0.0
        self.x = 200.0
        self.home_x = 200.0

    def set(self, state, timer):
        self.state, self.timer = state, timer


class BattleScene(Scene):
    HERO_X = 86

    def __init__(self, game):
        super().__init__(game)
        p = game.player
        self.enemy = Skeleton(p.wave)
        self.hp = p.max_hp
        self.stamina = float(p.max_stamina)
        self.estus = ESTUS_MAX
        self.action, self.action_t = "idle", 0.0
        self.invuln = 0.0
        self.regen_pause = 0.0
        self.hurt_t = 0.0
        self.texts = []
        self.result = None      # "won" / "dead"
        self.result_t = 0.0
        self.reward = 0
        self.torch_l = Particles(64, 58, rate=8, spread=2)
        self.torch_r = Particles(256, 58, rate=8, spread=2)

    # --- действия игрока (по упражнениям)
    def act(self, move):
        p, en = self.game.player, self.enemy
        if move == "pushup":
            if self.stamina < 20:
                return self.float("Нет сил!", self.HERO_X + 10, 90, COL_GREEN, 18)
            self.stamina -= 20
            self.regen_pause = 0.6
            self.action, self.action_t = "attack", 0.35
            dmg, crit = p.damage, en.state == "recover"
            if crit:
                dmg = int(dmg * 1.5)
            en.hp -= dmg
            en.flash = 0.15
            self.game.shake = 0.12
            self.float(f"{dmg}{' КРИТ!' if crit else ''}", en.x + 12, 90, COL_GOLD if crit else COL_TEXT)
            if en.state == "windup":
                en.poise -= 1
                if en.poise <= 0:
                    en.set("recover", 1.2)
                    self.float("ПРЕРВАН!", en.x + 12, 74, COL_GOLD, 20)
            if en.hp <= 0:
                self.win()
        elif move == "squat_down":
            if self.stamina < 15:
                return self.float("Нет сил!", self.HERO_X + 10, 90, COL_GREEN, 18)
            self.stamina -= 15
            self.regen_pause = 0.5
            self.action, self.action_t = "dodge", 0.9
            self.invuln = 0.9
        elif move == "jack":
            if self.estus <= 0:
                return self.float("Эстус пуст", self.HERO_X + 10, 90, COL_DIM, 18)
            if self.hp >= p.max_hp:
                return self.float("Здоровье полное", self.HERO_X + 10, 90, COL_DIM, 16)
            self.estus -= 1
            heal = int(p.max_hp * 0.45)
            self.hp = min(p.max_hp, self.hp + heal)
            self.action, self.action_t = "heal", 0.8
            self.float(f"+{heal}", self.HERO_X + 10, 90, (255, 170, 60))

    def float(self, text, x, y, color, size=22):
        self.texts.append(FloatText(text, x, y, color, size))

    def win(self):
        p, en = self.game.player, self.enemy
        en.set("dead", 0)
        self.result, self.result_t = "won", 0.0
        self.reward = 80 + 40 * en.wave
        p.souls += self.reward
        if p.lost_souls and p.lost_at_wave == en.wave:
            self.reward += p.lost_souls
            p.souls += p.lost_souls
            p.lost_souls = 0
        p.wave += 1
        p.save()

    def die(self):
        p = self.game.player
        self.result, self.result_t = "dead", 0.0
        p.lost_souls, p.lost_at_wave = p.souls, p.wave
        p.souls = 0
        p.save()

    def handle(self, keys, moves):
        g = self.game
        if self.result:
            if self.result_t > 1.0 and any(e.key in (pygame.K_RETURN, pygame.K_SPACE, pygame.K_ESCAPE) for e in keys):
                g.change(BonfireScene(g))
            return
        for e in keys:
            if e.key == pygame.K_ESCAPE:
                g.change(BonfireScene(g))
                return
        for m in moves:
            if m != "squat":  # полный присед уже учтён в статистике, в бою важен момент приседа
                self.act(m)

    def update(self, dt):
        p, en = self.game.player, self.enemy
        self.torch_l.update(dt)
        self.torch_r.update(dt)
        for ft in self.texts:
            ft.y -= 18 * dt
            ft.ttl -= dt
        self.texts = [ft for ft in self.texts if ft.ttl > 0]
        en.flash = max(0.0, en.flash - dt)
        self.hurt_t = max(0.0, self.hurt_t - dt)
        if self.result:
            self.result_t += dt
            return

        self.action_t -= dt
        if self.action_t <= 0:
            self.action = "idle"
        self.invuln = max(0.0, self.invuln - dt)
        self.regen_pause -= dt
        if self.regen_pause <= 0:
            self.stamina = min(p.max_stamina, self.stamina + p.stamina_regen * dt)

        # ИИ скелета: ожидание -> замах (окно для приседа) -> удар -> уязвимость
        en.timer -= dt
        if en.state == "idle" and en.timer <= 0:
            en.poise = en.max_poise
            en.set("windup", en.windup_time)
        elif en.state == "windup" and en.timer <= 0:
            en.set("attack", 0.35)
            self.resolve_hit()
        elif en.state == "attack" and en.timer <= 0:
            en.set("recover", 1.0)
        elif en.state == "recover" and en.timer <= 0:
            en.set("idle", random.uniform(1.6, 3.0))
        target = self.HERO_X + 30 if en.state == "attack" else en.home_x
        en.x += (target - en.x) * min(1.0, dt * (18 if en.state == "attack" else 5))

    def resolve_hit(self):
        en = self.enemy
        if self.invuln > 0:
            self.float("УВОРОТ!", self.HERO_X + 10, 80, (140, 200, 255), 20)
            return
        self.hp -= en.damage
        self.hurt_t = 0.3
        self.game.shake = 0.3
        self.float(f"-{en.damage}", self.HERO_X + 10, 86, COL_RED)
        if self.hp <= 0:
            self.hp = 0
            self.die()

    def draw(self, c):
        a, t, en = self.game.art, self.game.time, self.enemy
        c.blit(a.arena_bg, (0, 0))
        for tx in (60, 252):
            c.blit(anim(a.torch, t, 8), (tx, 56))
        self.torch_l.draw(c)
        self.torch_r.draw(c)

        # Скелет
        if en.state == "dead":
            spr = a.skeleton["dead"][0]
        elif en.flash > 0:
            spr = a.skeleton["hurt"][0]
        elif en.state == "windup":
            spr = anim(a.skeleton["windup"], t, 8)
        elif en.state == "attack":
            spr = a.skeleton["attack"][0]
        else:
            spr = anim(a.skeleton["idle"], t, 1.5)
        ex = int(en.x) - (8 if en.state == "attack" else 0)
        c.blit(spr, (ex, GROUND_ARENA - spr.get_height()))

        # Герой
        if self.result == "dead":
            spr = a.hero["dodge"][0]
            spr = tinted(spr, (40, 10, 10), 0.6)
        elif self.hurt_t > 0:
            spr = a.hero["hurt"][0]
        else:
            spr = anim(a.hero.get(self.action, a.hero["idle"]), t, 1.5)
        hx = self.HERO_X + (10 if self.action == "attack" else -6 if self.action == "dodge" else 0)
        if self.action == "dodge":  # шлейф уворота
            ghost = spr.copy()
            ghost.set_alpha(70)
            c.blit(ghost, (hx + 8, GROUND_ARENA - spr.get_height()))
        c.blit(spr, (hx, GROUND_ARENA - spr.get_height()))

        if en.state == "windup":  # красная виньетка-предупреждение
            k = max(0.0, min(1.0, 1 - en.timer / en.windup_time))
            warn = pygame.Surface(c.get_size(), pygame.SRCALPHA)
            pygame.draw.rect(warn, (200, 20, 20, int(40 + 80 * k)), warn.get_rect(), 6)
            c.blit(warn, (0, 0))

    def draw_ui(self, s):
        g, p, en = self.game, self.game.player, self.enemy
        # полоски игрока (ширина растёт с прокачкой — как в Dark Souls)
        g.bar(s, (16, 16, int(p.max_hp * 1.4), 8), self.hp / p.max_hp, COL_RED)
        g.bar(s, (16, 28, int(p.max_stamina * 1.6), 6), self.stamina / p.max_stamina, COL_GREEN)
        for i in range(ESTUS_MAX):
            col = (240, 150, 50) if i < self.estus else (60, 50, 50)
            pygame.draw.rect(s, COL_SHADOW, (15 + i * 12, 39, 10, 14))
            pygame.draw.rect(s, col, (16 + i * 12, 42, 8, 10))
            pygame.draw.rect(s, (140, 120, 100), (18 + i * 12, 40, 4, 2))
        g.camera_widget(s, (SCREEN_W - 136, 12, 120, 90))

        # полоска врага внизу экрана
        g.text(s, f"Скелет-страж  #{en.wave}", (120, SCREEN_H - 52), 18)
        g.bar(s, (120, SCREEN_H - 34, 400, 8), max(0, en.hp) / en.max_hp, (150, 20, 20))
        g.text(s, f"Души: {p.souls}", (SCREEN_W - 16, SCREEN_H - 20), 18, COL_GOLD, right=True)

        y = 66
        for name, desc, key in MOVE_HINTS:
            g.text(s, f"{name} — {desc}", (16, y), 14, COL_DIM)
            y += 13
        g.text(s, "(без камеры: клавиши 1 / 2 / 3)", (16, y), 12, (100, 90, 90))

        if en.state == "windup" and not self.result:
            k = max(0.0, min(1.0, en.timer / en.windup_time))
            pulse = 0.5 + 0.5 * math.sin(g.time * 14)
            g.text(s, "ПРИСЕДАЙ!", (SCREEN_W // 2, 62), 44, (255, int(60 + 120 * pulse), 40), center=True)
            g.bar(s, (SCREEN_W // 2 - 80, 106, 160, 5), k, (255, 90, 50))
            g.text(s, "!", (int(en.x + 12) * 2, 2 * (GROUND_ARENA - 44)), 36, (255, 200, 60), center=True)
        elif en.state == "recover" and not self.result:
            g.text(s, "Окно для удара — ОТЖИМАЙСЯ!", (SCREEN_W // 2, 76), 22, COL_GOLD, center=True)

        for ft in self.texts:
            g.text(s, ft.text, (int(ft.x * 2), int(ft.y * 2)), ft.size, ft.color, center=True)

        if self.result:
            band = pygame.Surface((SCREEN_W, 90), pygame.SRCALPHA)
            band.fill((0, 0, 0, min(200, int(self.result_t * 300))))
            s.blit(band, (0, SCREEN_H // 2 - 45))
            if self.result == "dead":
                g.text(s, "ВЫ ПОГИБЛИ", (SCREEN_W // 2, SCREEN_H // 2 - 28), 64, (170, 20, 20), center=True)
                g.text(s, "Души остались на месте гибели. Победите этого скелета, чтобы вернуть их.",
                       (SCREEN_W // 2, SCREEN_H // 2 + 22), 16, COL_DIM, center=True)
            else:
                g.text(s, "ВРАГ ПОВЕРЖЕН", (SCREEN_W // 2, SCREEN_H // 2 - 28), 56, COL_GOLD, center=True)
                g.text(s, f"+{self.reward} душ.  Enter — к костру",
                       (SCREEN_W // 2, SCREEN_H // 2 + 20), 18, COL_TEXT, center=True)


# ---------------------------------------------------------------- Калибровка камеры
class CameraScene(Scene):
    TIPS = [
        "Поставьте камеру на уровне пояса, в 2–3 м от себя.",
        "Отжимания и приседания: встаньте к камере БОКОМ.",
        "Звёздочка: встаньте к камере ЛИЦОМ, руки — над головой.",
        "Тело целиком должно быть в кадре.",
        "Без камеры: 1 — отжимание, 2 — присед, 3 — звёздочка.",
    ]

    def handle(self, keys, moves):
        for e in keys:
            if e.key in (pygame.K_ESCAPE, pygame.K_RETURN):
                self.game.change(TitleScene(self.game))

    def draw(self, c):
        c.blit(self.game.art.arena_bg, (0, 0))
        dark = pygame.Surface(c.get_size(), pygame.SRCALPHA)
        dark.fill((0, 0, 0, 150))
        c.blit(dark, (0, 0))

    def draw_ui(self, s):
        g = self.game
        g.text(s, "КАМЕРА И КАЛИБРОВКА", (SCREEN_W // 2, 12), 30, COL_GOLD, center=True)
        g.camera_widget(s, (20, 50, 320, 240))
        x = 360
        g.text(s, f"Статус: {g.motion.status}", (x, 52), 16)
        det = g.motion.detector()
        counts = det.counts if det else g.motion.key_counts
        if det:
            fmt = (lambda v: "—" if v is None else f"{v:.0f}°")
            g.text(s, f"Поза: {det.posture}", (x, 72), 16)
            g.text(s, f"Колени {fmt(det.knee)}   Локти {fmt(det.elbow)}   Наклон {fmt(det.tilt)}", (x, 90), 14, COL_DIM)
        y = 116
        g.text(s, "Засчитано за сеанс:", (x, y), 16, COL_DIM)
        for ex in ("pushup", "squat", "jack"):
            y += 20
            g.text(s, f"{NAMES[ex]}: {counts[ex]}", (x, y), 20, COL_TEXT)
        y = 210
        for tip in self.TIPS:
            for line in g._wrap(tip, 40):
                g.text(s, line, (x, y), 14, COL_DIM)
                y += 13
            y += 3
        g.text(s, "Esc — назад", (SCREEN_W // 2, SCREEN_H - 22), 16, COL_DIM, center=True)
