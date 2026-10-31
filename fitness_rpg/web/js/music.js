// Музыка локаций: заранее сгенерированные петли (tools/music/location_music.py) — у каждой земли свой голос,
// у главного меню — увертюра «Ash & Iron», у костра (кузница, инвентарь) — своя тихая тема.
// Петли бесшовные (точка петли — из music.json), при смене сцены треки плавно перетекают друг в друга,
// позиция каждого трека запоминается. В памяти держатся только звучащие сейчас треки (расжатый звук тяжёлый).
// Модуль ничего не импортирует: звуковой контекст ему передаёт sfx.js (attachMusic) — без циклических импортов.

// .m4a (AAC) — Safari и Chrome; .ogg (Opus) — запасной для браузеров без AAC
const FILES = {
  crypt: ["assets/music/crypt.m4a", "assets/music/crypt.ogg"], castle: ["assets/music/castle.m4a", "assets/music/castle.ogg"],
  grave: ["assets/music/grave.m4a", "assets/music/grave.ogg"], abyss: ["assets/music/abyss.m4a", "assets/music/abyss.ogg"],
  bonfire: ["assets/music/bonfire.m4a", "assets/music/bonfire.ogg"], menu: ["assets/music/menu.m4a", "assets/music/menu.ogg"],
  samhain: ["assets/music/samhain.m4a", "assets/music/samhain.ogg"],
};
let format = 0; // какой формат декодируется в этом браузере (выясняется на первом треке)
const MANIFEST = "assets/music/music.json";
const FADE_IN = 2.2, FADE_OUT = 1.6;
const DUCK = 0.35; // насколько приглушать музыку под сигнал «приседай»

let out = null; // { ctx, master } — от sfx.js, когда звук разрешён
const audioOut = () => out;
let bus = null; // общая громкость музыки
let duckGain = null;
let level = 0.55;
let loops = null; // длительности петель
let wanted = null;
let current = null; // { id, src, gain, buf, start, offset }
const raw = {}; // сжатые файлы (немного памяти) — расжимаются по требованию
const positions = {}; // где остановился каждый трек

function setup() {
  const a = audioOut();
  if (!a) return null;
  if (!bus) {
    bus = a.ctx.createGain();
    duckGain = a.ctx.createGain();
    bus.gain.value = level * level;
    bus.connect(duckGain).connect(a.master);
  }
  return a;
}

async function manifest() {
  if (!loops) loops = fetch(MANIFEST).then((r) => r.json()).catch(() => ({}));
  return loops;
}

function decodeData(ctx, data) {
  return new Promise((ok, fail) => {
    const p = ctx.decodeAudioData(data.slice(0), ok, fail); // копия: decode отбирает буфер; колбэки — для старого Safari
    if (p && p.catch) p.catch(() => {});
  });
}

async function decode(ctx, id) {
  for (; format < FILES[id].length; format++) {
    const key = `${id}:${format}`, url = FILES[id][format];
    if (!raw[key]) raw[key] = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))));
    try {
      return await decodeData(ctx, await raw[key]);
    } catch (e) {
      delete raw[key]; // формат не подошёл — пробуем запасной
    }
  }
  format = 0;
  throw new Error("no music format");
}

function stop(track) {
  if (!track) return;
  const a = audioOut();
  if (!a) return;
  const now = a.ctx.currentTime, { loopStart: ls, loopEnd: le } = track;
  let pos = track.offset + (now - track.start);
  if (pos > le) pos = ls + ((pos - ls) % (le - ls)); // после первого круга играет петля [ls, le)
  positions[track.id] = pos;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, now);
  track.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
  try { track.src.stop(now + FADE_OUT + 0.05); } catch (e) { /* уже остановлен */ }
}

/** Включить тему (crypt / castle / grave / abyss / bonfire) или null — тишина. Повторный вызов с той же темой ничего не меняет. */
export async function playMusic(id) {
  wanted = id;
  const a = setup();
  if (!a || (current && current.id === id)) return;
  if (!id || !FILES[id]) {
    stop(current);
    current = null;
    return;
  }
  let buf, man;
  try {
    [buf, man] = await Promise.all([decode(a.ctx, id), manifest()]);
  } catch (e) {
    return; // нет сети или формат не поддерживается — играем без музыки
  }
  if (wanted !== id || (current && current.id === id)) return; // пока грузили, сцена сменилась
  stop(current);
  const src = a.ctx.createBufferSource(), gain = a.ctx.createGain();
  src.buffer = buf;
  src.loop = true;
  // петля — внутри файла (music.json: [начало, конец]): края файла кодек искажает, там стык щёлкал бы
  const m = man[id], [loopStart, end] = Array.isArray(m) ? m : [0, m || buf.duration], loopEnd = Math.min(buf.duration, end);
  src.loopStart = loopStart;
  src.loopEnd = loopEnd;
  src.connect(gain).connect(bus);
  const now = a.ctx.currentTime, offset = positions[id] || 0;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + FADE_IN);
  src.start(now, offset);
  current = { id, src, gain, buf, start: now, offset, loopStart, loopEnd };
}

/** Звук разрешён (касание): sfx.js передаёт контекст и общую громкость; отложенная тема запускается. */
export function attachMusic(ctx, master) {
  out = { ctx, master };
  if (wanted && !current) playMusic(wanted);
}

/** Громкость музыки 0..1 (поверх общей громкости). */
export function setMusicVolume(v) {
  level = v;
  if (bus) bus.gain.value = level * level;
}

/** Приглушить музыку на время сигнала, чтобы его было слышно. */
export function duckMusic(sec = 0.9) {
  const a = audioOut();
  if (!a || !duckGain) return;
  const now = a.ctx.currentTime, g = duckGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(DUCK, now + 0.05);
  g.setValueAtTime(DUCK, now + sec);
  g.linearRampToValueAtTime(1, now + sec + 0.6);
}

/** Тема, которую сейчас хочет игра (после разрешения звука её надо запустить). */
export const wantedMusic = () => wanted;
