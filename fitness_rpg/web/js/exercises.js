// Распознавание упражнений по ключевым точкам MediaPipe Pose.
// Порт game/exercises.py: те же пороги и события, чтобы ПК- и мобильная версии вели себя одинаково.
//   "pushup"     — засчитано отжимание (атака / прокачка Силы)
//   "squat_down" — игрок присел (мгновенный уворот в бою)
//   "squat"      — засчитан полный присед (прокачка Живучести)
//   "pushup_down"— игрок опустился в нижнюю точку отжимания (уворот из планки)
//   "jack"       — засчитан прыжок «звёздочка» (зелье / прокачка Выносливости)
//   "punch"      — удар рукой (бокс): серия ударов у костра — «В БОЙ»
// Банк упражнений (режим с камерой): вместо отжиманий, приседа и звёздочки можно выбрать другие —
//   "pullup" подтягивание, "dip" брусья, "lunge_down"/"lunge" выпад, "highknee" высокие колени, "burpee" бёрпи.
//   mapBank переводит их в события игры (pushup / squat_down / squat / jack), так что бой и прокачка не меняются.

export const NOSE = 0;
export const L_SHOULDER = 11, R_SHOULDER = 12;
export const L_ELBOW = 13, R_ELBOW = 14;
export const L_WRIST = 15, R_WRIST = 16;
export const L_HIP = 23, R_HIP = 24;
export const L_KNEE = 25, R_KNEE = 26;
export const L_ANKLE = 27, R_ANKLE = 28;

export const EXERCISES = ["pushup", "squat", "jack"];
// NAMES[слот] — название упражнения, назначенного на слот (меняется банком: setBank)
export const NAMES = { pushup: "Отжимания", squat: "Приседания", jack: "Звёздочка" };

/** Банк: слот игры → упражнения на выбор. attack — удар (слот pushup), dodge — уворот (squat), heal — зелье (jack). */
export const BANK = {
  attack: ["pushup", "pullup", "dip"],
  dodge: ["squat", "lunge"],
  heal: ["jack", "highknee", "burpee"],
};
export const SLOT = { attack: "pushup", dodge: "squat", heal: "jack" };
export const DEFAULT_BANK = { attack: "pushup", dodge: "squat", heal: "jack" };
export const EX_NAMES = {
  pushup: "Отжимания", pullup: "Подтягивания", dip: "Брусья",
  squat: "Приседания", lunge: "Выпады",
  jack: "Звёздочка", highknee: "Высокие колени", burpee: "Бёрпи",
};
export const EX_SHORT = { pushup: "Отжим", pullup: "Подтяг", dip: "Брусья", squat: "Присед", lunge: "Выпад", jack: "Звезда", highknee: "Колени", burpee: "Бёрпи" };
/** Как встать перед камерой. */
export const EX_TIPS = {
  pushup: "Боком к телефону, всё тело в кадре",
  pullup: "Телефон перед турником: видно руки, голову и перекладину",
  dip: "Боком к брусьям: видно плечи, локти и кисти",
  squat: "Боком к телефону, всё тело в кадре",
  lunge: "Боком к телефону: шаг вперёд и вниз, затем встать",
  jack: "Лицом к телефону: руки над головой, ноги в стороны",
  highknee: "Лицом к телефону: колени до пояса, по очереди",
  burpee: "Боком: упор лёжа, затем встать",
};

/** Проверенный банк (старые или испорченные настройки — по умолчанию). */
export function cleanBank(b) {
  const out = { ...DEFAULT_BANK };
  for (const k of Object.keys(BANK)) if (b && BANK[k].includes(b[k])) out[k] = b[k];
  return out;
}

/** Назначить банк: названия слотов во всей игре берутся из NAMES. */
export function setBank(b) {
  const bank = cleanBank(b);
  NAMES.pushup = EX_NAMES[bank.attack];
  NAMES.squat = EX_NAMES[bank.dodge];
  NAMES.jack = EX_NAMES[bank.heal];
  return bank;
}

/**
 * События детектора → события игры по банку. Невыбранные упражнения не засчитываются (иначе подтягивания
 * считались бы ещё и звёздочкой: руки над головой). Бокс (punch) работает всегда.
 */
export function mapBank(events, b) {
  const bank = cleanBank(b);
  const map = { punch: "punch", [bank.attack]: "pushup", [bank.dodge]: "squat", [bank.heal]: "jack" };
  if (bank.attack === "pushup") map.pushup_down = "pushup_down"; // уворот из планки — только с отжиманиями
  map[`${bank.dodge}_down`] = "squat_down";
  return events.map((e) => map[e]).filter(Boolean);
}

const MIN_VIS = 0.5;
const MIN_REP_INTERVAL = 0.35; // сек, защита от дребезга

const SQUAT_DOWN_KNEE = 110;
const SQUAT_UP_KNEE = 155;
const PUSHUP_DOWN_ELBOW = 100;
const PUSHUP_UP_ELBOW = 150;
const UPRIGHT_MAX_TILT = 45;
const PUNCH_GUARD_ELBOW = 100; // рука согнута у лица — стойка
const PUNCH_HIT_ELBOW = 145; // рука выпрямлена на уровне плеч — удар
const PUNCH_INTERVAL = 0.15; // сек между ударами (двойка левой-правой)
const HORIZONTAL_MIN_TILT = 55;
const PULLUP_HANG_ELBOW = 145; // вис на прямых руках
const PULLUP_TOP_ELBOW = 90; // подтянулся: локти согнуты, подбородок у перекладины
const DIP_TOP_ELBOW = 150;
const DIP_LOW_ELBOW = 100;
const LUNGE_DOWN_KNEE = 110; // согнуто хотя бы одно колено
const LUNGE_UP_KNEE = 155;

const deg = (r) => (r * 180) / Math.PI;

export function angle(a, b, c) {
  const v1x = a[0] - b[0], v1y = a[1] - b[1];
  const v2x = c[0] - b[0], v2y = c[1] - b[1];
  const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
  if (n1 === 0 || n2 === 0) return 180;
  const cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const visible = (lm, ...idx) => idx.every((i) => lm[i][2] >= MIN_VIS);

function sideAngle(lm, left, right) {
  const vals = [left, right].filter((t) => visible(lm, ...t)).map(([a, b, c]) => angle(lm[a], lm[b], lm[c]));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

export class ExerciseDetector {
  constructor() {
    this.squatDown = false;
    this.pushupDown = false;
    this.jackOpen = false;
    this.lastRep = { pushup: -1e9, squat: -1e9, jack: -1e9, punch: -1e9, pullup: -1e9, dip: -1e9, lunge: -1e9, highknee: -1e9, burpee: -1e9 };
    this.counts = { pushup: 0, squat: 0, jack: 0, punch: 0, pullup: 0, dip: 0, lunge: 0, highknee: 0, burpee: 0 };
    this.pullHang = false; // подтягивания: был вис на прямых руках
    this.dipTop = false;
    this.dipLow = false;
    this.lungeDown = false;
    this.kneeUp = [false, false]; // высокие колени: какое колено поднято
    this.kneeSteps = 0;
    this.lastKnee = -1;
    this.burpeeDown = false; // бёрпи: был упор лёжа
    this.bank = { ...DEFAULT_BANK }; // распознаются только выбранные в банке упражнения (и бокс)
    this.punchArmed = [false, false]; // рука побывала в стойке — следующий выпрямленный выпад засчитается
    this.posture = "нет человека";
    this.knee = this.elbow = this.tilt = null;
  }

  /** Игрок сейчас «внизу» (присед или нижняя точка отжимания) — пригнулся под удар. */
  get low() {
    return this.squatDown || this.pushupDown || this.lungeDown;
  }

  _rep(name, t, events) {
    if (t - this.lastRep[name] >= MIN_REP_INTERVAL) {
      this.lastRep[name] = t;
      this.counts[name] += 1;
      events.push(name);
    }
  }

  /** lm — массив из 33 [x, y, vis] или null; t — время в секундах. */
  update(lm, t) {
    const events = [];
    if (!lm || (!visible(lm, L_SHOULDER, R_SHOULDER) && !visible(lm, L_HIP, R_HIP))) {
      this.posture = "нет человека";
      return events;
    }
    const sh = mid(lm[L_SHOULDER], lm[R_SHOULDER]);
    const hip = mid(lm[L_HIP], lm[R_HIP]);
    const dx = sh[0] - hip[0], dy = sh[1] - hip[1];
    this.tilt = deg(Math.atan2(Math.abs(dx), Math.abs(dy) + 1e-6));
    this.knee = sideAngle(lm, [L_HIP, L_KNEE, L_ANKLE], [R_HIP, R_KNEE, R_ANKLE]);
    this.elbow = sideAngle(lm, [L_SHOULDER, L_ELBOW, L_WRIST], [R_SHOULDER, R_ELBOW, R_WRIST]);

    if (this.tilt <= UPRIGHT_MAX_TILT) {
      this.posture = "стоя";
      this.pushupDown = false;
      this._squat(t, events);
      this._jack(lm, t, events);
      this._punch(lm, t, events);
      const b = this.bank;
      if (b.attack === "pullup") this._pullup(lm, t, events);
      if (b.attack === "dip") this._dip(lm, t, events);
      if (b.dodge === "lunge") this._lunge(lm, t, events);
      if (b.heal === "highknee") this._highknee(lm, t, events);
      if (b.heal === "burpee" && this.burpeeDown && (this.knee == null || this.knee > SQUAT_UP_KNEE)) { // встал из упора — бёрпи
        this.burpeeDown = false;
        this._rep("burpee", t, events);
      }
    } else if (this.tilt >= HORIZONTAL_MIN_TILT) {
      this.posture = "планка";
      this.squatDown = false;
      this.jackOpen = false;
      this.lungeDown = false;
      this.burpeeDown = true;
      this._pushup(t, events);
    } else {
      this.posture = "переход";
    }
    return events;
  }

  /** Размер тела в кадре: ширина плеч (не меньше разумного, если стоит боком). */
  _scale(lm) {
    return Math.max(Math.abs(lm[L_SHOULDER][0] - lm[R_SHOULDER][0]) || 0, 0.08);
  }

  /** Подтягивание: вис на прямых руках (кисти над головой) → локти согнуты, голова у кистей. */
  _pullup(lm, t, events) {
    if (!visible(lm, L_WRIST, R_WRIST, L_SHOULDER, R_SHOULDER) || this.elbow == null) return;
    const scale = this._scale(lm);
    const wristY = Math.min(lm[L_WRIST][1], lm[R_WRIST][1]);
    const headY = visible(lm, NOSE) ? lm[NOSE][1] : Math.min(lm[L_SHOULDER][1], lm[R_SHOULDER][1]) - scale * 0.6;
    if (wristY > headY) { // руки не над головой — это не турник
      this.pullHang = false;
      return;
    }
    if (this.elbow > PULLUP_HANG_ELBOW) this.pullHang = true;
    else if (this.pullHang && this.elbow < PULLUP_TOP_ELBOW && headY - wristY < scale * 0.9) {
      this.pullHang = false;
      this._rep("pullup", t, events);
    }
  }

  /** Брусья: корпус прямо, кисти ниже плеч; прямые руки → локти до 90° → снова прямые. */
  _dip(lm, t, events) {
    if (!visible(lm, L_WRIST, R_WRIST, L_SHOULDER, R_SHOULDER) || this.elbow == null) return;
    const scale = this._scale(lm);
    const below = Math.min(lm[L_WRIST][1], lm[R_WRIST][1]) > Math.max(lm[L_SHOULDER][1], lm[R_SHOULDER][1]) + scale * 0.3;
    if (!below) {
      this.dipTop = this.dipLow = false;
      return;
    }
    if (this.elbow > DIP_TOP_ELBOW) {
      if (this.dipTop && this.dipLow) this._rep("dip", t, events);
      this.dipTop = true;
      this.dipLow = false;
    } else if (this.dipTop && this.elbow < DIP_LOW_ELBOW) {
      this.dipLow = true;
    }
  }

  /** Выпад: согнулось хотя бы одно колено (lunge_down — мгновенный уворот), обе ноги выпрямились — повтор. */
  _lunge(lm, t, events) {
    const knees = [[L_HIP, L_KNEE, L_ANKLE], [R_HIP, R_KNEE, R_ANKLE]].filter((k) => visible(lm, ...k)).map(([a, b, c]) => angle(lm[a], lm[b], lm[c]));
    if (!knees.length) return;
    const low = Math.min(...knees), high = Math.max(...knees);
    if (!this.lungeDown && low < LUNGE_DOWN_KNEE) {
      this.lungeDown = true;
      events.push("lunge_down");
    } else if (this.lungeDown && low > LUNGE_UP_KNEE && high > LUNGE_UP_KNEE) {
      this.lungeDown = false;
      this._rep("lunge", t, events);
    }
  }

  /** Высокие колени: колено поднялось к поясу, левое и правое по очереди — пара шагов = повтор. */
  _highknee(lm, t, events) {
    if (!visible(lm, L_HIP, R_HIP, L_SHOULDER, R_SHOULDER)) return;
    const hipY = (lm[L_HIP][1] + lm[R_HIP][1]) / 2;
    const torso = Math.abs((lm[L_SHOULDER][1] + lm[R_SHOULDER][1]) / 2 - hipY) || 0.2;
    const raised = [L_KNEE, R_KNEE].map((k) => visible(lm, k) && lm[k][1] < hipY + torso * 0.2);
    const lowered = [L_KNEE, R_KNEE].map((k) => visible(lm, k) && lm[k][1] > hipY + torso * 0.4);
    [[L_KNEE, 0], [R_KNEE, 1]].forEach(([k, i]) => {
      if (!visible(lm, k)) return;
      const up = raised[i] && lowered[1 - i]; // одно колено вверху, другое внизу (в приседе оба у пояса — не считается)
      if (up && !this.kneeUp[i]) {
        if (this.lastKnee !== i) {
          this.kneeSteps += 1;
          this.lastKnee = i;
          if (this.kneeSteps >= 2) {
            this.kneeSteps = 0;
            this._rep("highknee", t, events);
          }
        }
      }
      this.kneeUp[i] = up;
    });
  }

  _squat(t, events) {
    if (this.knee == null) return;
    if (!this.squatDown && this.knee < SQUAT_DOWN_KNEE) {
      this.squatDown = true;
      events.push("squat_down");
    } else if (this.squatDown && this.knee > SQUAT_UP_KNEE) {
      this.squatDown = false;
      this._rep("squat", t, events);
    }
  }

  _pushup(t, events) {
    if (this.elbow == null) return;
    if (!this.pushupDown && this.elbow < PUSHUP_DOWN_ELBOW) {
      this.pushupDown = true;
      events.push("pushup_down");
    } else if (this.pushupDown && this.elbow > PUSHUP_UP_ELBOW) {
      this.pushupDown = false;
      this._rep("pushup", t, events);
    }
  }

  /**
   * Бокс: рука из стойки (согнута, кулак у лица или груди) резко выпрямляется на уровне плеч — сбоку или вполоборота —
   * или кулак уходит за середину тела (кросс, хук — так видно и лицом к камере). «Звёздочку» не путает:
   * там руки прямые всё время и уходят выше головы.
   */
  _punch(lm, t, events) {
    if (!visible(lm, L_SHOULDER, R_SHOULDER)) return;
    const shoulderW = Math.abs(lm[L_SHOULDER][0] - lm[R_SHOULDER][0]) || 1e-3;
    const scale = Math.max(shoulderW, 0.08); // сбоку плечи сливаются — берём не меньше разумного
    const midX = (lm[L_SHOULDER][0] + lm[R_SHOULDER][0]) / 2;
    const shY = Math.min(lm[L_SHOULDER][1], lm[R_SHOULDER][1]);
    const headY = visible(lm, NOSE) ? lm[NOSE][1] : shY - scale * 0.6;
    [[L_SHOULDER, L_ELBOW, L_WRIST, -1], [R_SHOULDER, R_ELBOW, R_WRIST, 1]].forEach(([s, e, w, side], i) => {
      if (!visible(lm, s, e, w)) return;
      const wr = lm[w], el = angle(lm[s], lm[e], wr);
      const atHead = wr[1] > headY - scale * 0.5 && wr[1] < shY + scale * 0.9; // кулак от макушки до груди
      if (!atHead) {
        this.punchArmed[i] = false;
        return;
      }
      if (el < PUNCH_GUARD_ELBOW) {
        this.punchArmed[i] = true;
        return;
      }
      const ownSide = Math.sign(lm[s][0] - midX) || side;
      const crossed = (wr[0] - midX) * ownSide < -scale * 0.35; // кулак ушёл за середину тела
      if (this.punchArmed[i] && (el > PUNCH_HIT_ELBOW || crossed) && t - this.lastRep.punch >= PUNCH_INTERVAL) {
        this.punchArmed[i] = false;
        this.lastRep.punch = t;
        this.counts.punch += 1;
        events.push("punch");
      }
    });
  }

  _jack(lm, t, events) {
    if (!visible(lm, L_WRIST, R_WRIST, L_SHOULDER, R_SHOULDER)) return;
    const shoulderW = Math.abs(lm[L_SHOULDER][0] - lm[R_SHOULDER][0]) || 1e-3;
    const headY = visible(lm, NOSE) ? lm[NOSE][1] : Math.min(lm[L_SHOULDER][1], lm[R_SHOULDER][1]);
    const armsUp = lm[L_WRIST][1] < headY && lm[R_WRIST][1] < headY;
    const armsDown = lm[L_WRIST][1] > lm[L_SHOULDER][1] && lm[R_WRIST][1] > lm[R_SHOULDER][1];
    let legsOpen = true, legsClosed = true; // ноги не в кадре — считаем только по рукам
    if (visible(lm, L_ANKLE, R_ANKLE)) {
      const feet = Math.abs(lm[L_ANKLE][0] - lm[R_ANKLE][0]) / shoulderW;
      legsOpen = feet > 1.3;
      legsClosed = feet < 1.25;
    }
    if (!this.jackOpen && armsUp && legsOpen) {
      this.jackOpen = true;
    } else if (this.jackOpen && armsDown && legsClosed) {
      this.jackOpen = false;
      this._rep("jack", t, events);
    }
  }
}
