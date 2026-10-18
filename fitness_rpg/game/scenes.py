"""Сцены игры: главный экран, костёр (прокачка), бой, калибровка камеры."""
import math
import random

import pygame

from .art import tinted
from .core import (COL_DIM, COL_GOLD, COL_GREEN, COL_RED, COL_SHADOW, COL_TEXT,
                   SCREEN_H, SCREEN_W, Particles, Scene)
from .exercises import NAMES
from .gear import RELICS, SHOP_ORDER, SWORDS, is_boss_wave, item, price_text, rewards
from .player import STATS, Player

GROUND_TITLE = 150
GROUND_ARENA = 140

MOVE_HINTS = [
    ("ОТЖИМАНИЕ", "удар мечом", "J"),
    ("ПРИСЕД / ВНИЗ", "уворот", "K"),
    ("ЗВЁЗДОЧКА", "глоток эстуса", "L"),
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
        self.confirm_t = 0.0

    def new_game(self):
        # Защита от случайного нажатия: прогресс стирается только со второго раза
        if self.confirm_t <= 0:
            self.confirm_t = 3.0
            self.menu.items[3] = ("Стереть прогресс? Ещё раз Enter", self.new_game)
            return
        self.game.player = Player()
        self.game.player.save()
        self.game.run = None
        self.game.change(BonfireScene(self.game))

    def quit(self):
        self.game.running = False

    def handle(self, keys, moves):
        self.menu.handle(keys)

    def update(self, dt):
        self.embers.update(dt)
        if self.confirm_t > 0:
            self.confirm_t -= dt
            if self.confirm_t <= 0:
                self.menu.items[3] = ("Новая игра", self.new_game)

    def draw(self, c):
        a, t = self.game.art, self.game.time
        c.blit(a.title_bg, (0, 0))
        # отблеск костра на земле
        glow = pygame.Surface((80, 20), pygame.SRCALPHA)
        r = 34 + int(math.sin(t * 6) * 2)
        pygame.draw.ellipse(glow, (255, 120, 40, 40), (40 - r, 2, r * 2, 16))
        c.blit(glow, (168, GROUND_TITLE - 10))
        c.blit(anim(a.bonfire, t, 8), (200, GROUND_TITLE - 22))
        c.blit(anim(a.heroes[self.game.player.sword]["idle"], t, 1.5), (172, GROUND_TITLE - 32))
        # скелет крадётся из тьмы — глаза мерцают
        sx, sy = 270, GROUND_TITLE - 32
        c.blit(self.skel_dark, (sx, sy))
        if int(t * 1.3) % 5 != 0:
            for ex in (9, 14):
                c.set_at((sx + ex, sy + 6), (255, 70, 40))
        self.embers.draw(c)

    def draw_ui(self, s):
        g = self.game
        g.text(s, "ASH & IRON", (SCREEN_W // 2, 18), 56, (120, 30, 26), center=True, shadow=False)
        g.text(s, "ASH & IRON", (SCREEN_W // 2 - 2, 16), 56, (232, 206, 160), center=True, shadow=False)
        g.text(s, "фитнес-RPG: тренируй тело, чтобы выжить во тьме", (SCREEN_W // 2, 62), 18, COL_DIM, center=True)
        self.menu.draw(g, s, 60, 150)
        p = g.player
        foe = "БОСС" if is_boss_wave(p.wave) else "скелет"
        g.text(s, f"Уровень {p.level}   Пепел: {p.souls}   Следующий враг: {foe} #{p.wave}",
               (12, SCREEN_H - 20), 16, COL_DIM)
        g.text(s, "↑↓ Enter · тест: F2 камни, F3 босс", (SCREEN_W - 12, SCREEN_H - 20), 16, COL_DIM, right=True)


# ---------------------------------------------------------------- Костёр
class BonfireScene(Scene):
    """Прокачка: выбери характеристику и выполни нужное упражнение."""

    def __init__(self, game):
        super().__init__(game)
        g = game
        self.embers = Particles(216, 116, rate=26)
        self.ritual = None      # (stat, exercise, need, done)
        self.message, self.msg_t = "Костёр зажжён. Здоровье и эстус восстановлены.", 3.0
        game.run = None  # отдых у костра
        items = [(None, (lambda st=st: self.start_ritual(st))) for st in STATS]
        items.append(("В бой", lambda: g.change(BattleScene(g))))
        items.append(("Кузница", lambda: g.change(ShopScene(g))))
        items.append(("В главное меню", lambda: g.change(TitleScene(g))))
        self.menu = Menu(items)

    def start_ritual(self, stat):
        p = self.game.player
        if not p.can_level():
            self.say(f"Нужно {p.level_cost()} пепла, у вас {p.souls}. Победите скелетов!")
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
                    self.say("Ритуал прерван. Пепел не потрачен.")
                    return
            for m in moves:
                if m == ex:
                    self.ritual[3] += 1
                    self.game.sfx.play("rep")
            if self.ritual[3] >= need:
                p = self.game.player
                p.level_up(stat)
                p.save()
                self.ritual = None
                self.say(f"{STATS[stat][0]} повышена до {getattr(p, stat)}!", 4.0)
                self.embers.rate = 120
                self.game.sfx.play("level")
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
        hero_frames = a.heroes[self.game.player.sword]
        hero = hero_frames["attack"][0] if self.ritual and self.ritual[3] % 2 else hero_frames["idle"][0]
        c.blit(hero, (168, GROUND_TITLE - 32))
        self.embers.draw(c)

    def draw_ui(self, s):
        g, p = self.game, self.game.player
        panel = pygame.Surface((300, 300), pygame.SRCALPHA)
        panel.fill((10, 6, 14, 200))
        s.blit(panel, (16, 16))
        pygame.draw.rect(s, (90, 64, 50), (16, 16, 300, 300), 1)
        g.text(s, "КОСТЁР", (30, 26), 30, COL_GOLD)
        g.text(s, f"Уровень {p.level}", (30, 54), 18)
        g.text(s, f"Пепел: {p.souls}", (150, 54), 18, COL_GOLD)
        g.text(s, f"Цена уровня: {p.level_cost()} пепла", (30, 72), 16, COL_DIM)
        g.gems(s, (230, 72), p)

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
        g.text(s, stats, (30, 296), 14, COL_DIM)

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


READY_TIME = 4.0     # секунд на то, чтобы отойти от камеры
RECOVER_TIME = 1.6   # окно для удара после атаки скелета
ABSENT_PAUSE = 1.0   # пауза, если игрока нет в кадре дольше этого


class Skeleton:
    """Скелет-страж; каждый 5-й — босс Костяной Рыцарь."""

    def __init__(self, wave):
        self.wave = wave
        self.boss = is_boss_wave(wave)
        base_hp = 90 + 35 * (wave - 1)
        base_dmg = 16 + 4 * (wave - 1)
        self.windup_time = max(1.3, 1.9 - 0.05 * wave)  # время на реакцию (присед)
        if self.boss:
            self.name = "Костяной Рыцарь"
            self.max_hp = int(base_hp * 2.0)
            self.damage = int(base_dmg * 1.25)
            self.windup_time += 0.3       # тяжёлый двуручник замахивается дольше
            self.max_poise = 5
            self.combo_chance = 0.6       # серии до трёх ударов
            self.max_combo = 2
            self.home_x = 188.0
        else:
            self.name = "Скелет-страж"
            self.max_hp = base_hp
            self.damage = base_dmg
            self.max_poise = 3
            self.combo_chance = 0.35 if wave >= 3 else 0.0  # с 3-го скелета — двойной удар
            self.max_combo = 1
            self.home_x = 200.0
        self.hp = self.max_hp
        self.poise = self.max_poise
        self.state = "idle"
        self.timer = random.uniform(1.5, 2.5)
        self.flash = 0.0
        self.combo_left = 0
        self.enraged = False
        self.x = self.home_x

    def set(self, state, timer):
        self.state, self.timer = state, timer

    def recover_time(self):
        return RECOVER_TIME * (0.8 if self.enraged else 1.0)


class BattleScene(Scene):
    HERO_X = 86

    def __init__(self, game):
        super().__init__(game)
        p = game.player
        self.enemy = Skeleton(p.wave)
        # Здоровье и эстус переносятся между боями до отдыха у костра
        run = game.run or {"hp": p.max_hp, "estus": p.estus_max}
        self.hp = min(run["hp"], p.max_hp)
        self.estus = min(run["estus"], p.estus_max)
        self.stamina = float(p.max_stamina)
        self.action, self.action_t = "idle", 0.0
        self.invuln = 0.0
        self.regen_pause = 0.0
        self.hurt_t = 0.0
        self.texts = []
        self.result = None      # "won" / "dead"
        self.result_t = 0.0
        self.reward = (0, 0, 0)   # пепел, алые, синие
        self.ready = READY_TIME
        self.absent_t = 0.0
        self.paused = False
        self.torch_l = Particles(64, 58, rate=8, spread=2)
        self.torch_r = Particles(256, 58, rate=8, spread=2)

    def save_run(self):
        self.game.run = {"hp": self.hp, "estus": self.estus}

    # --- действия игрока (по упражнениям)
    def act(self, move):
        p, en = self.game.player, self.enemy
        if move == "pushup":
            if self.stamina < p.attack_cost:
                return self.float("Нет сил!", self.HERO_X + 10, 90, COL_GREEN, 18)
            self.stamina -= p.attack_cost
            self.regen_pause = 0.6
            self.action, self.action_t = "attack", 0.35
            dmg, crit = p.damage, en.state == "recover"
            if crit:
                dmg = int(dmg * p.crit_mult)
            elif en.boss:
                dmg //= 2  # латы босса: вне окна уязвимости проходит половина урона
            en.hp -= dmg
            en.flash = 0.15
            self.game.shake = 0.12
            self.game.sfx.play("crit" if crit else "hit")
            label = f"{dmg} КРИТ!" if crit else (f"{dmg} БРОНЯ" if en.boss else f"{dmg}")
            self.float(label, en.x + 12, 90, COL_GOLD if crit else COL_TEXT)
            if p.lifesteal and self.hp < p.max_hp:
                self.hp = min(p.max_hp, self.hp + p.lifesteal)
            if en.state == "windup":
                en.poise -= 1
                if en.poise <= 0:
                    en.combo_left = 0
                    en.set("recover", en.recover_time())
                    self.float("ПРЕРВАН!", en.x + 12, 74, COL_GOLD, 20)
            if en.boss and not en.enraged and 0 < en.hp <= en.max_hp // 2:
                en.enraged = True  # ярость: быстрее замах, короче окно уязвимости
                en.windup_time *= 0.85
                self.float("ЯРОСТЬ!", en.x + 12, 60, (255, 60, 40), 24)
            if en.hp <= 0:
                self.win()
        elif move in ("squat_down", "pushup_down"):
            # Уворот бесплатный. Если уже идёт замах — игрок пригнулся заранее
            # и защищён до самого удара.
            self.action, self.action_t = "dodge", 0.9
            until_strike = en.timer + 0.25 if en.state == "windup" else 0.0
            self.invuln = max(self.invuln, 0.9, until_strike)
            self.game.sfx.play("dodge")
        elif move == "jack":
            if self.estus <= 0:
                return self.float("Эстус пуст", self.HERO_X + 10, 90, COL_DIM, 18)
            if self.hp >= p.max_hp:
                return self.float("Здоровье полное", self.HERO_X + 10, 90, COL_DIM, 16)
            self.estus -= 1
            heal = int(p.max_hp * 0.45)
            self.hp = min(p.max_hp, self.hp + heal)
            self.action, self.action_t = "heal", 0.8
            self.game.sfx.play("heal")
            self.float(f"+{heal}", self.HERO_X + 10, 90, (255, 170, 60))

    def float(self, text, x, y, color, size=22):
        self.texts.append(FloatText(text, x, y, color, size))

    def win(self):
        p, en = self.game.player, self.enemy
        en.set("dead", 0)
        self.result, self.result_t = "won", 0.0
        ash, red, blue = rewards(en.wave)
        if p.lost_souls and p.lost_at_wave == en.wave:
            ash += p.lost_souls
            p.lost_souls = 0
        p.souls += ash
        p.red_gems += red
        p.blue_gems += blue
        self.reward = (ash, red, blue)
        p.wave += 1
        p.save()
        self.save_run()
        self.game.sfx.play("win")

    def die(self):
        p = self.game.player
        self.result, self.result_t = "dead", 0.0
        p.lost_souls, p.lost_at_wave = p.souls, p.wave
        p.souls = 0
        p.save()
        self.game.run = None  # возрождение у костра с полным здоровьем
        self.game.sfx.play("die")

    def handle(self, keys, moves):
        g = self.game
        if self.result:
            if self.result_t < 1.0:
                return
            # Звёздочка — следующий бой без подхода к компьютеру; Enter/Esc — к костру
            if self.result == "won" and "jack" in moves:
                g.change(BattleScene(g))
            elif (any(e.key in (pygame.K_RETURN, pygame.K_SPACE, pygame.K_ESCAPE) for e in keys)
                  or (self.result == "dead" and "jack" in moves)):
                g.change(BonfireScene(g))
            return
        for e in keys:
            if e.key == pygame.K_ESCAPE:
                self.save_run()
                g.change(BonfireScene(g))
                return
        if self.ready > 0 or self.paused:
            return
        for m in moves:
            if m != "squat":  # полный присед уже учтён в статистике, в бою важен момент приседа
                self.act(m)

    def update(self, dt):
        g = self.game
        p, en = g.player, self.enemy
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
        # С камерой: бой ждёт, пока игрок встанет в кадр, и замирает, если он вышел
        det = g.motion.detector() if g.motion.camera_ok else None
        present = det is None or det.posture != "нет человека"
        self.absent_t = 0.0 if present else self.absent_t + dt
        self.paused = det is not None and self.absent_t > ABSENT_PAUSE
        if self.paused:
            return
        if self.ready > 0:
            if present:
                self.ready -= dt
            return

        self.action_t -= dt
        if self.action_t <= 0:
            self.action = "idle"
        self.invuln = max(0.0, self.invuln - dt)
        if (det is not None and det.low) or g.manual_low:  # пока игрок внизу — удар проходит над ним
            self.invuln = max(self.invuln, 0.15)
            self.action, self.action_t = "dodge", max(self.action_t, 0.1)
        self.regen_pause -= dt
        if self.regen_pause <= 0:
            self.stamina = min(p.max_stamina, self.stamina + p.stamina_regen * dt)

        # ИИ скелета: ожидание -> замах (окно для приседа) -> удар -> уязвимость
        en.timer -= dt
        if en.state == "idle" and en.timer <= 0:
            en.poise = en.max_poise
            en.combo_left = sum(random.random() < en.combo_chance for _ in range(en.max_combo))
            en.set("windup", en.windup_time)
            g.sfx.play("warn")
        elif en.state == "windup" and en.timer <= 0:
            en.set("attack", 0.35)
            self.resolve_hit()
        elif en.state == "attack" and en.timer <= 0:
            if en.combo_left > 0:
                en.combo_left -= 1  # следующий, более быстрый замах сразу после удара
                en.set("windup", en.windup_time * 0.75)
                g.sfx.play("warn")
                self.float("ЕЩЁ УДАР!", en.x + 12, 70, (255, 120, 60), 16)
            else:
                en.set("recover", en.recover_time())
        elif en.state == "recover" and en.timer <= 0:
            en.set("idle", random.uniform(1.6, 3.0))
        target = self.HERO_X + 30 if en.state == "attack" else en.home_x
        en.x += (target - en.x) * min(1.0, dt * (18 if en.state == "attack" else 5))

    def resolve_hit(self):
        en = self.enemy
        if self.invuln > 0:
            self.game.sfx.play("dodge")
            self.float("УВОРОТ!", self.HERO_X + 10, 80, (140, 200, 255), 20)
            return
        dmg = round(en.damage * self.game.player.damage_taken_mult)
        self.hp -= dmg
        self.hurt_t = 0.3
        self.game.shake = 0.4 if en.boss else 0.3
        self.game.sfx.play("hurt")
        self.float(f"-{dmg}", self.HERO_X + 10, 86, COL_RED)
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

        # Скелет или босс
        frames = a.boss if en.boss else a.skeleton
        if en.state == "dead":
            spr = frames["dead"][0]
        elif en.flash > 0:
            spr = frames["hurt"][0]
        elif en.state == "windup":
            spr = anim(frames["windup"], t, 8)
        elif en.state == "attack":
            spr = frames["attack"][0]
        elif en.boss and en.enraged:
            spr = anim(frames["enraged"], t, 1.5)
        else:
            spr = anim(frames["idle"], t, 1.5)
        ex = int(en.x) - (8 if en.state == "attack" else 0)
        c.blit(spr, (ex, GROUND_ARENA - spr.get_height()))

        # Герой (с надетым мечом)
        hero = a.heroes[self.game.player.sword]
        if self.result == "dead":
            spr = hero["dead"][0]
        elif self.hurt_t > 0:
            spr = hero["hurt"][0]
        else:
            spr = anim(hero.get(self.action, hero["idle"]), t, 1.5)
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
        for i in range(p.estus_max):
            col = (240, 150, 50) if i < self.estus else (60, 50, 50)
            pygame.draw.rect(s, COL_SHADOW, (15 + i * 12, 39, 10, 14))
            pygame.draw.rect(s, col, (16 + i * 12, 42, 8, 10))
            pygame.draw.rect(s, (140, 120, 100), (18 + i * 12, 40, 4, 2))
        g.camera_widget(s, (SCREEN_W - 136, 12, 120, 90))

        # полоска врага внизу экрана
        if en.boss:  # полоска босса — шире и в золотой рамке
            pygame.draw.rect(s, COL_GOLD, (117, SCREEN_H - 37, 406, 14), 1)
            g.text(s, f"БОСС: {en.name}  #{en.wave}" + ("  — ЯРОСТЬ" if en.enraged else ""),
                   (120, SCREEN_H - 54), 18, (255, 120, 80) if en.enraged else COL_GOLD)
        else:
            g.text(s, f"{en.name}  #{en.wave}", (120, SCREEN_H - 52), 18)
        g.bar(s, (120, SCREEN_H - 34, 400, 8), max(0, en.hp) / en.max_hp, (150, 20, 20))
        g.text(s, f"Пепел: {p.souls}", (SCREEN_W - 16, SCREEN_H - 20), 18, COL_GOLD, right=True)
        g.gems(s, (SCREEN_W - 16, SCREEN_H - 40), p, right=True)

        y = 66
        for name, desc, key in MOVE_HINTS:
            g.text(s, f"[{key}] {name} — {desc}", (16, y), 14, COL_DIM)
            y += 13
        g.text(s, "K держать — остаться внизу, Esc — к костру", (16, y), 12, (110, 100, 100))

        det = g.motion.detector() if g.motion.camera_ok else None
        plank = det is not None and det.posture == "планка"
        if self.paused:
            band = pygame.Surface((SCREEN_W, 60), pygame.SRCALPHA)
            band.fill((0, 0, 0, 190))
            s.blit(band, (0, SCREEN_H // 2 - 30))
            g.text(s, "ПАУЗА: ВСТАНЬТЕ В КАДР", (SCREEN_W // 2, SCREEN_H // 2 - 20), 32, COL_GOLD, center=True)
            g.text(s, "Камера не видит вас, скелет ждёт", (SCREEN_W // 2, SCREEN_H // 2 + 8), 16, COL_DIM, center=True)
        elif self.ready > 0:
            if en.boss:
                g.text(s, "БОСС: КОСТЯНОЙ РЫЦАРЬ", (SCREEN_W // 2, 30), 28, (255, 90, 60), center=True)
                g.text(s, "латы держат удары — бей в окно уязвимости", (SCREEN_W // 2, 150), 16, COL_DIM, center=True)
            g.text(s, "ПРИГОТОВЬТЕСЬ", (SCREEN_W // 2, 56), 36, COL_GOLD, center=True)
            g.text(s, f"{math.ceil(self.ready)}", (SCREEN_W // 2, 84), 56, COL_TEXT, center=True)
            g.text(s, "Отойдите, чтобы тело было в кадре", (SCREEN_W // 2, 128), 16, COL_DIM, center=True)
        elif en.state == "windup" and not self.result:
            k = max(0.0, min(1.0, en.timer / en.windup_time))
            pulse = 0.5 + 0.5 * math.sin(g.time * 14)
            g.text(s, "ОПУСТИСЬ!" if plank else "ПРИСЕДАЙ!", (SCREEN_W // 2, 62), 44, (255, int(60 + 120 * pulse), 40), center=True)
            g.bar(s, (SCREEN_W // 2 - 80, 106, 160, 5), k, (255, 90, 50))
            top = GROUND_ARENA - (56 if en.boss else 44)
            g.text(s, "!", (int(en.x + (30 if en.boss else 12)) * 2, 2 * top), 36, (255, 200, 60), center=True)
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
                g.text(s, "Пепел остался на месте гибели. Победите этого скелета, чтобы вернуть его.",
                       (SCREEN_W // 2, SCREEN_H // 2 + 20), 16, COL_DIM, center=True)
                g.text(s, "Enter или звёздочка — к костру", (SCREEN_W // 2, SCREEN_H // 2 + 34), 16, COL_TEXT, center=True)
            else:
                ash, red, blue = self.reward
                title = "БОСС ПОВЕРЖЕН" if en.boss else "ВРАГ ПОВЕРЖЕН"
                g.text(s, title, (SCREEN_W // 2, SCREEN_H // 2 - 28), 56, COL_GOLD, center=True)
                loot = f"+{ash} пепла   +{red} алых" + (f"   +{blue} синий" if blue else "")
                g.text(s, loot, (SCREEN_W // 2, SCREEN_H // 2 + 16), 18, COL_GOLD, center=True)
                g.text(s, "Звёздочка — следующий бой, Enter — к костру",
                       (SCREEN_W // 2, SCREEN_H // 2 + 34), 16, COL_TEXT, center=True)


# ---------------------------------------------------------------- Кузница
class ShopScene(Scene):
    """Мечи за алые камни, уникальное снаряжение за синие (с боссов)."""

    def __init__(self, game):
        super().__init__(game)
        g = game
        items = [(key, (lambda k=key: self.choose(k))) for key in SHOP_ORDER]
        items.append(("back", lambda: g.change(BonfireScene(g))))
        self.menu = Menu(items)
        self.message, self.msg_t = "Алые камни — за каждого врага, синие — за боссов.", 4.0
        self.embers = Particles(300, 120, rate=10)

    def say(self, msg, t=3.0):
        self.message, self.msg_t = msg, t

    def choose(self, key):
        p = self.game.player
        it = item(key)
        if key in p.owned:
            if key in SWORDS:
                p.equip(key)
                self.say(f"Надет: {it['name']}")
            else:
                self.say(f"{it['name']} уже действует")
        elif p.buy(key):
            self.game.sfx.play("level")
            self.say(f"Куплено: {it['name']}!" + (" Меч надет." if key in SWORDS else ""))
        else:
            red, blue = it["price"]
            need = f"{blue} синих" if blue else f"{red} алых"
            self.say(f"Не хватает камней: нужно {need}")
            return
        p.save()

    def handle(self, keys, moves):
        for e in keys:
            if e.key == pygame.K_ESCAPE:
                self.game.change(BonfireScene(self.game))
                return
        self.menu.handle(keys)

    def update(self, dt):
        self.embers.update(dt)
        self.msg_t -= dt

    def draw(self, c):
        a, t = self.game.art, self.game.time
        c.blit(a.arena_bg, (0, 0))
        dark = pygame.Surface(c.get_size(), pygame.SRCALPHA)
        dark.fill((0, 0, 0, 110))
        c.blit(dark, (0, 0))
        c.blit(anim(a.bonfire, t, 8), (292, GROUND_ARENA - 22))  # горн
        self.embers.draw(c)

    def draw_ui(self, s):
        g, p = self.game, self.game.player
        panel = pygame.Surface((396, 332), pygame.SRCALPHA)
        panel.fill((10, 6, 14, 215))
        s.blit(panel, (12, 14))
        pygame.draw.rect(s, (90, 64, 50), (12, 14, 396, 332), 1)
        g.text(s, "КУЗНИЦА", (26, 22), 30, COL_GOLD)
        g.gems(s, (396, 28), p, right=True)
        y = 58
        for i, (key, _) in enumerate(self.menu.items):
            sel = self.menu.index == i
            if sel:
                g.text(s, ">", (20, y + 2), 20, COL_GOLD)
            if key == "back":
                g.text(s, "Назад к костру", (34, y + 4), 20, COL_GOLD if sel else COL_TEXT)
                break
            it = item(key)
            if key in p.owned:
                status, scol = ("НАДЕТ", COL_GOLD) if p.sword == key else \
                    (("ВЗЯТЬ", COL_TEXT) if key in SWORDS else ("ЕСТЬ", COL_GOLD))
            else:
                status = price_text(key)
                scol = (130, 170, 255) if it["price"][1] else (240, 110, 110)
                if not p.can_afford(key):
                    scol = tuple(c // 2 for c in scol)
            name_col = (150, 190, 255) if it.get("unique") else (COL_GOLD if sel else COL_TEXT)
            g.text(s, it["name"], (34, y), 18, name_col)
            g.text(s, it["desc"], (34, y + 16), 14, COL_DIM)
            g.text(s, status, (396, y + 6), 18, scol, right=True)
            if i == 3:  # разделитель: дальше реликвии за синие камни
                pygame.draw.line(s, (70, 50, 44), (26, y + 36), (396, y + 36))
            y += 40
        # крупное превью героя с надетым мечом
        hero = anim(g.art.heroes[p.sword]["idle"], g.time, 1.5)
        s.blit(pygame.transform.scale(hero, (96, 128)), (466, 2 * GROUND_ARENA - 126))
        w = p.weapon
        g.text(s, f"Меч: {w['name']}", (SCREEN_W - 16, 24), 18, COL_TEXT, right=True)
        g.text(s, f"урон {p.damage}  крит x{w['crit']}  удар {w['cost']} сил", (SCREEN_W - 16, 42), 14, COL_DIM, right=True)
        relics = [RELICS[k]["name"] for k in RELICS if k in p.owned]
        if relics:
            g.text(s, "Реликвии: " + ", ".join(relics), (SCREEN_W - 16, 58), 14, (150, 190, 255), right=True)
        if self.msg_t > 0:
            for i, line in enumerate(g._wrap(self.message, 26)):
                g.text(s, line, (SCREEN_W - 16, SCREEN_H - 66 + i * 15), 16, COL_GOLD, right=True)


# ---------------------------------------------------------------- Калибровка камеры
class CameraScene(Scene):
    TIPS = [
        "Поставьте камеру на уровне пояса, в 2–3 м от себя.",
        "Отжимания и приседания: встаньте к камере БОКОМ.",
        "Звёздочка: встаньте к камере ЛИЦОМ, руки — над головой.",
        "Тело целиком должно быть в кадре.",
        "Без камеры: J (1) — отжимание, K (2) — присед, L (3) — звёздочка.",
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
