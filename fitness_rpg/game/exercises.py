"""Распознавание упражнений по ключевым точкам тела (MediaPipe Pose).

Модуль не зависит от камеры: на вход — 33 точки (x, y, visibility) в
нормированных координатах кадра (y растёт вниз), на выходе — события:

    "pushup"      — засчитано отжимание (атака / прокачка Силы)
    "squat_down"  — игрок присел (мгновенный уворот в бою)
    "squat"       — засчитан полный присед (прокачка Живучести)
    "pushup_down" — игрок опустился в нижнюю точку отжимания (уворот из планки)
    "jack"        — засчитан прыжок «звёздочка» (эстус / прокачка Выносливости)
"""
import math

# Индексы точек MediaPipe Pose
NOSE = 0
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28

EXERCISES = ("pushup", "squat", "jack")
NAMES = {"pushup": "Отжимания", "squat": "Приседания", "jack": "Прыжки «звёздочка»"}

MIN_VIS = 0.5
MIN_REP_INTERVAL = 0.35  # сек, защита от дребезга

# Пороги углов (градусы) с гистерезисом
SQUAT_DOWN_KNEE = 110
SQUAT_UP_KNEE = 155
PUSHUP_DOWN_ELBOW = 100
PUSHUP_UP_ELBOW = 150
UPRIGHT_MAX_TILT = 45     # корпус почти вертикален
HORIZONTAL_MIN_TILT = 55  # корпус почти горизонтален (планка)


def angle(a, b, c):
    """Угол ABC в градусах."""
    v1 = (a[0] - b[0], a[1] - b[1])
    v2 = (c[0] - b[0], c[1] - b[1])
    n1, n2 = math.hypot(*v1), math.hypot(*v2)
    if n1 == 0 or n2 == 0:
        return 180.0
    cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def _mid(p, q):
    return ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)


def _visible(lm, *idx):
    return all(lm[i][2] >= MIN_VIS for i in idx)


def _side_angle(lm, left, right):
    """Средний угол по видимым сторонам тела (или None)."""
    vals = [angle(lm[a], lm[b], lm[c]) for a, b, c in (left, right) if _visible(lm, a, b, c)]
    return sum(vals) / len(vals) if vals else None


class ExerciseDetector:
    def __init__(self):
        self.squat_down = False
        self.pushup_down = False
        self.jack_open = False
        self.last_rep = {e: -1e9 for e in EXERCISES}
        self.counts = {e: 0 for e in EXERCISES}
        # Для отображения на экране калибровки
        self.posture = "нет человека"
        self.knee = None
        self.elbow = None
        self.tilt = None

    @property
    def low(self):
        """Игрок сейчас «внизу» (присед или нижняя точка отжимания) — пригнулся под удар."""
        return self.squat_down or self.pushup_down

    def _rep(self, name, t, events):
        if t - self.last_rep[name] >= MIN_REP_INTERVAL:
            self.last_rep[name] = t
            self.counts[name] += 1
            events.append(name)

    def update(self, lm, t):
        """lm — список из 33 (x, y, vis) или None; t — время в секундах."""
        events = []
        if lm is None or not _visible(lm, L_SHOULDER, R_SHOULDER) and not _visible(lm, L_HIP, R_HIP):
            self.posture = "нет человека"
            return events

        sh = _mid(lm[L_SHOULDER], lm[R_SHOULDER])
        hip = _mid(lm[L_HIP], lm[R_HIP])
        dx, dy = sh[0] - hip[0], sh[1] - hip[1]
        # Наклон корпуса от вертикали: 0 — стоя, 90 — лёжа
        self.tilt = math.degrees(math.atan2(abs(dx), abs(dy) + 1e-6))
        self.knee = _side_angle(lm, (L_HIP, L_KNEE, L_ANKLE), (R_HIP, R_KNEE, R_ANKLE))
        self.elbow = _side_angle(lm, (L_SHOULDER, L_ELBOW, L_WRIST), (R_SHOULDER, R_ELBOW, R_WRIST))

        if self.tilt <= UPRIGHT_MAX_TILT:
            self.posture = "стоя"
            self.pushup_down = False
            self._update_squat(t, events)
            self._update_jack(lm, t, events)
        elif self.tilt >= HORIZONTAL_MIN_TILT:
            self.posture = "планка"
            self.squat_down = False
            self.jack_open = False
            self._update_pushup(t, events)
        else:
            self.posture = "переход"
        return events

    def _update_squat(self, t, events):
        if self.knee is None:
            return
        if not self.squat_down and self.knee < SQUAT_DOWN_KNEE:
            self.squat_down = True
            events.append("squat_down")
        elif self.squat_down and self.knee > SQUAT_UP_KNEE:
            self.squat_down = False
            self._rep("squat", t, events)

    def _update_pushup(self, t, events):
        if self.elbow is None:
            return
        if not self.pushup_down and self.elbow < PUSHUP_DOWN_ELBOW:
            self.pushup_down = True
            events.append("pushup_down")
        elif self.pushup_down and self.elbow > PUSHUP_UP_ELBOW:
            self.pushup_down = False
            self._rep("pushup", t, events)

    def _update_jack(self, lm, t, events):
        if not _visible(lm, L_WRIST, R_WRIST, L_SHOULDER, R_SHOULDER):
            return
        shoulder_w = abs(lm[L_SHOULDER][0] - lm[R_SHOULDER][0]) or 1e-3
        head_y = lm[NOSE][1] if _visible(lm, NOSE) else min(lm[L_SHOULDER][1], lm[R_SHOULDER][1])
        arms_up = lm[L_WRIST][1] < head_y and lm[R_WRIST][1] < head_y
        arms_down = (lm[L_WRIST][1] > lm[L_SHOULDER][1] and lm[R_WRIST][1] > lm[R_SHOULDER][1])
        if _visible(lm, L_ANKLE, R_ANKLE):
            feet = abs(lm[L_ANKLE][0] - lm[R_ANKLE][0]) / shoulder_w
            legs_open, legs_closed = feet > 1.3, feet < 1.25
        else:  # ноги не в кадре — считаем только по рукам
            legs_open = legs_closed = True
        if not self.jack_open and arms_up and legs_open:
            self.jack_open = True
        elif self.jack_open and arms_down and legs_closed:
            self.jack_open = False
            self._rep("jack", t, events)
