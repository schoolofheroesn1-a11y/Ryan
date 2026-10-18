"""Тесты: распознавание упражнений и игровая логика (без камеры и дисплея).

Запуск:  python -m unittest discover -s tests
"""
import math
import os
import sys
import unittest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from game import exercises as ex  # noqa: E402
from game.player import Player  # noqa: E402

_GAME = None


def shared_game():
    """Один экземпляр игры на все тесты: pygame держит одно окно на процесс."""
    global _GAME
    if _GAME is None:
        from game.core import Game
        _GAME = Game(use_camera=False)
    return _GAME


def blank():
    return [(0.5, 0.5, 0.0)] * 33


def standing(knee_deg=180, arms_up=False, feet_wide=False):
    """Человек лицом к камере; колени согнуты на заданный угол."""
    lm = blank()

    def put(i, x, y):
        lm[i] = (x, y, 0.99)

    put(ex.NOSE, 0.5, 0.15)
    put(ex.L_SHOULDER, 0.42, 0.25)
    put(ex.R_SHOULDER, 0.58, 0.25)
    put(ex.L_HIP, 0.45, 0.5)
    put(ex.R_HIP, 0.55, 0.5)
    # бедро вниз-вперёд, голень строится под углом knee_deg к бедру
    thigh = 0.18
    bend = math.radians(180 - knee_deg)
    for hip, knee, ankle, sx in ((ex.L_HIP, ex.L_KNEE, ex.L_ANKLE, -1), (ex.R_HIP, ex.R_KNEE, ex.R_ANKLE, 1)):
        hx, hy = lm[hip][:2]
        spread = 0.12 * sx if feet_wide else 0.0
        kx, ky = hx + spread / 2, hy + thigh
        ax = kx + spread / 2 + math.sin(bend) * thigh
        ay = ky + math.cos(bend) * thigh
        put(knee, kx, ky)
        put(ankle, ax, ay)
    if arms_up:
        put(ex.L_ELBOW, 0.38, 0.12)
        put(ex.L_WRIST, 0.36, 0.02)
        put(ex.R_ELBOW, 0.62, 0.12)
        put(ex.R_WRIST, 0.64, 0.02)
    else:
        put(ex.L_ELBOW, 0.40, 0.38)
        put(ex.L_WRIST, 0.40, 0.5)
        put(ex.R_ELBOW, 0.60, 0.38)
        put(ex.R_WRIST, 0.60, 0.5)
    return lm


def plank(elbow_deg):
    """Человек боком в упоре лёжа; локоть согнут на заданный угол."""
    lm = blank()

    def put(i, x, y):
        lm[i] = (x, y, 0.99)

    for sh, el, wr, hip, knee, ank in ((ex.L_SHOULDER, ex.L_ELBOW, ex.L_WRIST, ex.L_HIP, ex.L_KNEE, ex.L_ANKLE),
                                       (ex.R_SHOULDER, ex.R_ELBOW, ex.R_WRIST, ex.R_HIP, ex.R_KNEE, ex.R_ANKLE)):
        put(sh, 0.3, 0.6)
        put(hip, 0.6, 0.62)
        put(knee, 0.75, 0.64)
        put(ank, 0.9, 0.66)
        # плечо->локоть вниз, затем предплечье под углом elbow_deg
        put(el, 0.3, 0.75)
        a = math.radians(180 - elbow_deg)
        put(wr, 0.3 - math.sin(a) * 0.15, 0.75 + math.cos(a) * 0.15)
    return lm


class ExerciseDetectorTest(unittest.TestCase):
    def test_angle(self):
        self.assertAlmostEqual(ex.angle((1, 0), (0, 0), (0, 1)), 90)
        self.assertAlmostEqual(ex.angle((1, 0), (0, 0), (-1, 0)), 180)

    def test_squat_rep(self):
        d = ex.ExerciseDetector()
        self.assertEqual(d.update(standing(175), 0.0), [])
        self.assertEqual(d.update(standing(90), 0.5), ["squat_down"])
        self.assertEqual(d.update(standing(100), 0.7), [])   # всё ещё внизу
        self.assertEqual(d.update(standing(175), 1.2), ["squat"])
        self.assertEqual(d.posture, "стоя")

    def test_half_squat_not_counted(self):
        d = ex.ExerciseDetector()
        events = [e for t, k in enumerate((175, 130, 175, 130, 175)) for e in d.update(standing(k), t)]
        self.assertEqual(events, [])

    def test_pushup_rep(self):
        d = ex.ExerciseDetector()
        self.assertEqual(d.update(plank(170), 0.0), [])
        self.assertEqual(d.posture, "планка")
        self.assertEqual(d.update(plank(80), 0.6), ["pushup_down"])
        self.assertTrue(d.low)
        self.assertEqual(d.update(plank(170), 1.2), ["pushup"])
        self.assertFalse(d.low)
        self.assertEqual(d.counts["pushup"], 1)

    def test_jumping_jack(self):
        d = ex.ExerciseDetector()
        d.update(standing(), 0.0)
        self.assertEqual(d.update(standing(arms_up=True, feet_wide=True), 0.5), [])
        self.assertEqual(d.update(standing(), 1.0), ["jack"])

    def test_debounce(self):
        d = ex.ExerciseDetector()
        d.update(standing(90), 0.0)
        self.assertEqual(d.update(standing(175), 0.1), ["squat"])
        d.update(standing(90), 0.15)
        self.assertEqual(d.update(standing(175), 0.2), [])  # слишком быстро

    def test_no_person(self):
        d = ex.ExerciseDetector()
        self.assertEqual(d.update(None, 0), [])
        self.assertEqual(d.posture, "нет человека")


class PlayerTest(unittest.TestCase):
    def test_level_up_costs_souls(self):
        p = Player(souls=100)
        cost = p.level_cost()
        p.level_up("strength")
        self.assertEqual(p.strength, 2)
        self.assertEqual(p.souls, 100 - cost)
        self.assertGreater(p.level_cost(), cost)

    def test_save_roundtrip(self):
        import tempfile
        p = Player(strength=4, souls=7)
        p.total_reps["squat"] = 42
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "s.json")
            p.save(path)
            q = Player.load(path)
        self.assertEqual((q.strength, q.souls, q.total_reps["squat"]), (4, 7, 42))


class BattleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.game = shared_game()

    def setUp(self):
        from game.scenes import BattleScene
        self.game.player = Player()
        self.game.player.save = lambda *a, **k: None
        self.game.run = None
        self.scene = BattleScene(self.game)
        self.scene.ready = 0  # пропускаем отсчёт «Приготовьтесь»
        self.game.change(self.scene)

    def run_for(self, seconds):
        for _ in range(int(seconds * 60)):
            self.game.frame(1 / 60, [])

    def test_dodge_avoids_hit(self):
        s = self.scene
        s.enemy.set("windup", 0.3)
        s.act("squat_down")
        self.run_for(0.5)
        self.assertEqual(s.hp, self.game.player.max_hp)

    def test_hit_without_dodge(self):
        s = self.scene
        s.enemy.set("windup", 0.1)
        self.run_for(0.3)
        self.assertEqual(s.hp, self.game.player.max_hp - s.enemy.damage)

    def test_pushups_kill_skeleton_and_give_souls(self):
        s, p = self.scene, self.game.player
        souls = p.souls
        for _ in range(20):
            s.stamina = p.max_stamina
            s.act("pushup")
            if s.result:
                break
        self.assertEqual(s.result, "won")
        self.assertGreater(p.souls, souls)
        self.assertEqual(p.wave, 2)

    def test_early_dodge_lasts_until_strike(self):
        # Присел сразу, как только скелет начал замах — удар всё равно не проходит
        s = self.scene
        s.enemy.set("windup", s.enemy.windup_time)
        s.act("squat_down")
        self.run_for(s.enemy.windup_time + 0.3)
        self.assertEqual(s.hp, self.game.player.max_hp)

    def test_dodge_is_free(self):
        s = self.scene
        s.stamina = 5
        s.act("pushup_down")
        self.assertEqual(s.stamina, 5)
        self.assertGreater(s.invuln, 0)

    def test_countdown_blocks_actions(self):
        from game.scenes import BattleScene
        s = BattleScene(self.game)
        self.game.change(s)
        s.handle([], ["pushup"])
        self.assertEqual(s.enemy.hp, s.enemy.max_hp)
        self.run_for(0.5)
        self.assertEqual(s.enemy.state, "idle")

    def test_hp_carries_over_and_jack_starts_next_fight(self):
        from game.scenes import BattleScene
        s = self.scene
        s.hp = 40
        while not s.result:
            s.stamina = 999
            s.act("pushup")
        s.result_t = 2
        s.handle([], ["jack"])
        nxt = self.game.scene
        self.assertIsInstance(nxt, BattleScene)
        self.assertIsNot(nxt, s)
        self.assertEqual(nxt.hp, 40)

    def test_bonfire_restores(self):
        from game.scenes import BattleScene, BonfireScene
        self.game.run = {"hp": 10, "estus": 0}
        BonfireScene(self.game)
        self.assertEqual(BattleScene(self.game).hp, self.game.player.max_hp)

    def test_new_game_needs_confirmation(self):
        from game.scenes import TitleScene
        self.game.player = Player(souls=500)
        self.game.player.save = lambda *a, **k: None
        t = TitleScene(self.game)
        self.game.change(t)
        Player.save, orig = (lambda *a, **k: None), Player.save
        try:
            t.new_game()
            self.assertEqual(self.game.player.souls, 500)
            t.new_game()
            self.assertEqual(self.game.player.souls, 100)
        finally:
            Player.save = orig

    def test_estus_heals(self):
        s = self.scene
        s.hp = 10
        s.act("jack")
        self.assertGreater(s.hp, 10)
        self.assertEqual(s.estus, 2)


if __name__ == "__main__":
    unittest.main()


class BossAndGearTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.game = shared_game()

    def battle(self, player):
        from game.scenes import BattleScene
        player.save = lambda *a, **k: None
        self.game.player = player
        self.game.run = None
        s = BattleScene(self.game)
        s.ready = 0
        self.game.change(s)
        return s

    def test_every_fifth_wave_is_boss(self):
        from game.gear import is_boss_wave
        self.assertEqual([w for w in range(1, 16) if is_boss_wave(w)], [5, 10, 15])
        boss, regular = self.battle(Player(wave=5)).enemy, self.battle(Player(wave=4)).enemy
        self.assertTrue(boss.boss)
        self.assertFalse(regular.boss)
        self.assertGreater(boss.max_hp, 1.5 * regular.max_hp)

    def test_enemies_get_stronger(self):
        hp = [self.battle(Player(wave=w)).enemy.max_hp for w in (1, 2, 3, 4)]
        self.assertEqual(hp, sorted(hp))
        self.assertGreater(self.battle(Player(wave=10)).enemy.max_hp, self.battle(Player(wave=5)).enemy.max_hp)

    def test_boss_armor_halves_damage_outside_window(self):
        s = self.battle(Player(wave=5))
        en, p = s.enemy, self.game.player
        en.set("idle", 99)
        s.act("pushup")
        self.assertEqual(en.max_hp - en.hp, p.damage // 2)
        s.stamina = 999
        en.set("recover", 99)
        hp = en.hp
        s.act("pushup")
        self.assertEqual(hp - en.hp, int(p.damage * p.crit_mult))

    def test_rewards_red_for_enemy_blue_for_boss(self):
        for wave, blue in ((1, 0), (5, 1)):
            s = self.battle(Player(wave=wave))
            p = self.game.player
            while not s.result:
                s.stamina = 999
                s.enemy.set("recover", 99)
                s.act("pushup")
            self.assertGreaterEqual(p.red_gems, 2)
            self.assertEqual(p.blue_gems, blue)

    def test_shop_buy_and_equip(self):
        p = Player(red_gems=5)
        self.assertFalse(p.buy("steel"))  # стоит 6
        p.red_gems = 6
        self.assertTrue(p.buy("steel"))
        self.assertEqual((p.sword, p.red_gems), ("steel", 0))
        self.assertEqual(p.damage, 10 + 3 * p.strength + 5)
        p.equip("rusty")
        self.assertEqual(p.sword, "rusty")
        self.assertFalse(p.buy("ash"))  # уникальный — только за синие
        p.blue_gems = 3
        self.assertTrue(p.buy("ash"))
        self.assertEqual(p.lifesteal, 4)

    def test_relics(self):
        p = Player(blue_gems=3)
        self.assertTrue(p.buy("armor"))
        self.assertTrue(p.buy("amulet"))
        self.assertEqual(p.estus_max, 4)
        s = self.battle(p)
        self.assertEqual(s.estus, 4)
        s.enemy.set("windup", 0.01)
        self.run_hit(s)
        self.assertEqual(p.max_hp - s.hp, round(s.enemy.damage * 0.75))

    def run_hit(self, s):
        for _ in range(5):
            s.update(1 / 60)

    def test_old_save_without_gear_loads(self):
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "s.json")
            with open(path, "w") as f:
                json.dump({"strength": 3, "souls": 40, "sword": "bogus"}, f)
            p = Player.load(path)
        self.assertEqual((p.strength, p.sword, p.owned, p.red_gems), (3, "rusty", ["rusty"], 0))


class KeyboardTest(unittest.TestCase):
    """Управление с клавиатуры для проверки игры без камеры."""

    @classmethod
    def setUpClass(cls):
        cls.game = shared_game()

    def key(self, kind, key=0, scancode=0):
        import pygame
        return pygame.event.Event(kind, key=key, scancode=scancode, mod=0, unicode="")

    def test_jkl_by_scancode(self):
        import pygame
        evs = [self.key(pygame.KEYDOWN, 0, sc) for sc in (pygame.KSCAN_J, pygame.KSCAN_K, pygame.KSCAN_L)]
        self.assertEqual(self.game.motion.poll(evs), ["pushup", "squat_down", "squat", "jack"])

    def test_holding_k_keeps_hero_low(self):
        import pygame
        from game.scenes import BattleScene
        g = self.game
        g.player = Player()
        g.player.save = lambda *a, **k: None
        g.run = None
        s = BattleScene(g)
        s.ready = 0
        g.change(s)
        g.frame(1 / 60, [self.key(pygame.KEYDOWN, pygame.K_k, pygame.KSCAN_K)])
        s.enemy.set("windup", 2.0)  # удар через 2 с — дольше обычного уворота
        for _ in range(150):
            g.frame(1 / 60, [])
        self.assertEqual(s.hp, g.player.max_hp)
        g.frame(1 / 60, [self.key(pygame.KEYUP, pygame.K_k, pygame.KSCAN_K)])
        self.assertFalse(g.manual_low)

    def test_test_keys(self):
        import pygame
        g = self.game
        g.player = Player(wave=2)
        g.player.save = lambda *a, **k: None
        g.test_keys([self.key(pygame.KEYDOWN, pygame.K_F2), self.key(pygame.KEYDOWN, pygame.K_F3)])
        self.assertEqual((g.player.red_gems, g.player.blue_gems, g.player.wave), (10, 1, 5))


class SkinsTest(unittest.TestCase):
    """Каждая вещь меняет модель героя."""

    @classmethod
    def setUpClass(cls):
        cls.art = shared_game().art

    def pixels(self, surf):
        import pygame
        return pygame.image.tobytes(surf, "RGBA")

    def test_every_sword_and_look_has_its_own_model(self):
        from game.art import LOOKS, SWORD_MAPS, hero_look
        idle = {key: self.pixels(f["idle"][0]) for key, f in self.art.heroes.items()}
        attack = {key: self.pixels(f["attack"][0]) for key, f in self.art.heroes.items()}
        self.assertEqual(len(idle), len(SWORD_MAPS) * len(LOOKS))
        self.assertEqual(len(set(idle.values())), len(idle))
        self.assertEqual(len(set(attack.values())), len(attack))
        self.assertEqual(hero_look(["rusty", "armor"]), "armor")
        self.assertEqual(hero_look(["rusty", "armor", "amulet"]), "both")


class CastleTest(unittest.TestCase):
    """Вторая локация: разбойники и Глава разбойников."""

    @classmethod
    def setUpClass(cls):
        cls.game = shared_game()

    def battle(self, wave, **kw):
        from game.scenes import BattleScene
        p = Player(wave=wave, strength=8, vigor=6, endurance=6, **kw)
        p.save = lambda *a, **k: None
        self.game.player = p
        self.game.run = None
        s = BattleScene(self.game)
        s.ready = 0
        self.game.change(s)
        return s

    def test_locations_and_enemies(self):
        from game.gear import enemy_kind, location_for
        self.assertEqual([enemy_kind(w) for w in (4, 5, 15)], ["skeleton", "knight", "knight"])
        self.assertEqual((location_for(15), location_for(16)), (1, 2))
        kinds = {enemy_kind(w) for w in range(16, 30)}
        self.assertEqual(kinds, {"skeleton", "bandit", "chief"})
        self.assertEqual(enemy_kind(20), "chief")
        self.assertEqual(self.battle(16).location, 2)

    def test_bandit_steals_ash(self):
        s = self.battle(16, souls=200)
        self.assertEqual(s.enemy.kind, "bandit")
        s.enemy.set("windup", 0.01)
        for _ in range(5):
            s.update(1 / 60)
        self.assertEqual(self.game.player.souls, 200 - s.enemy.steal)

    def test_chief_potion_can_be_knocked_out(self):
        s = self.battle(20)
        en = s.enemy
        self.assertEqual(en.kind, "chief")
        en.hp = en.max_hp // 2 + 1
        en.set("idle", 99)
        s.act("pushup")
        self.assertEqual(en.state, "drink")
        hp = en.hp
        for _ in range(3):
            s.stamina = 999
            s.act("pushup")
        self.assertEqual(en.state, "recover")
        self.assertLess(en.hp, hp)

    def test_chief_heals_if_not_interrupted(self):
        s = self.battle(20)
        en = s.enemy
        en.hp = en.max_hp // 2 + 1
        en.set("idle", 99)
        s.act("pushup")
        hp = en.hp
        for _ in range(int(3 * 60)):
            s.update(1 / 60)
        self.assertGreater(en.hp, hp)
        self.assertTrue(en.enraged)
