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
        from game.core import Game
        cls.game = Game(use_camera=False)

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
