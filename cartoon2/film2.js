/* «Даня и Карта Возможностей» — минутный мультфильм.
   Весь кадр рисуется кодом на canvas: FILM.render(t) рисует кадр для времени t (сек). */
(function () {
  const TL = window.TIMELINE;
  const W = 1280, H = 720, DUR = TL.dur;
  const TAU = Math.PI * 2;
  const FONT = "'Nunito','Trebuchet MS','DejaVu Sans',sans-serif";
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const win01 = (t, a, b, f = 0.25) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- примитивы ---------- */
  function ell(c, x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = fill; c.fill(); }
  function circ(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function poly(c, pts, w, col) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function vgrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }
  function sky(c, stops) { c.fillStyle = vgrad(c, 0, H, stops); c.fillRect(0, 0, W, H); }
  function cam(c, z, cx, cy, dy = 0, dx = 0) { c.translate(cx, cy); c.scale(z, z); c.translate(-cx + dx, -cy + dy); }
  function glow(c, x, y, r, col) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* ---------- персонажи ---------- */
  const DANYA = {
    name: 'Даня', skin: '#f2c9a8', skinShade: '#d9a383', hair: '#2e1c12', hairHi: '#6b4630', hairStyle: 'curly',
    shirt: '#1c1c21', shirtHi: '#383842', pants: '#cfb38b', pantsShade: '#b39670', shoe: '#f5f5f2', shoeAcc: '#27272c',
    eye: '#3b2416', watch: true,
  };
  const TEACHER = {
    skin: '#efc6a6', skinShade: '#d6a585', hair: '#cfc9c2', hairHi: '#eeeae4', hairStyle: 'bob', shirt: '#d29a33', shirtHi: '#e6b552',
    pants: '#48506a', pantsShade: '#3a4157', shoe: '#5a3d2b', shoeAcc: '#3a271b', eye: '#3a2a20', glasses: true,
  };
  const TUTOR = {
    skin: '#e6b48f', skinShade: '#c99572', hair: '#2a201b', hairHi: '#4a3a30', hairStyle: 'short', beard: true, shirt: '#2f5a46', shirtHi: '#9dc1df',
    pants: '#3c4252', pantsShade: '#2f3443', shoe: '#4b3426', shoeAcc: '#2b1d14', eye: '#2a1d16',
  };
  const RED = {
    skin: '#f7d6bd', skinShade: '#e2b293', hair: '#c4521e', hairHi: '#e07a3d', hairStyle: 'long', shirt: '#3e7c50', shirtHi: '#58996a',
    pants: '#2f3a56', pantsShade: '#252e45', shoe: '#efe9e0', shoeAcc: '#3e7c50', eye: '#2f4a2a',
  };
  const GLASSES = {
    skin: '#c99473', skinShade: '#ad7a5b', hair: '#1d1916', hairHi: '#3a332e', hairStyle: 'short', shirt: '#e4ddcf', shirtHi: '#f3eee4',
    pants: '#3a4a60', pantsShade: '#2e3b4d', shoe: '#2d2d33', shoeAcc: '#e4ddcf', eye: '#20160f', glasses: true, stripes: true,
  };
  const BUZZ = {
    skin: '#ebc19c', skinShade: '#d0a37f', hair: '#7a5a3e', hairHi: '#957358', hairStyle: 'buzz', shirt: '#8b909a', shirtHi: '#a3a8b1',
    pants: '#2e3340', pantsShade: '#242833', shoe: '#e9e6df', shoeAcc: '#b2483a', eye: '#2e2016',
  };

  const HERO = {
    skin: '#f4cfb6', skinShade: '#dcae92', hair: '#9a7247', hairHi: '#c9a06b', hairStyle: 'mop',
    shirt: '#dfe2e8', shirtHi: '#f4f5f7', plaid: true, tee: '#4a4d56', longSleeve: '#a3abbe',
    pants: '#394156', pantsShade: '#2e3546', shoe: '#e8e8e6', shoeAcc: '#3a3f4c', eye: '#4a5b6e', watch: '#c4c8cf',
  };
  const CURLS = (() => {
    const r = rng(7), a = [];
    for (let i = 0; i < 24; i++) {
      const ang = Math.PI * (1.0 + (1.0 * i) / 23);
      a.push([Math.cos(ang) * (35 + r() * 6), Math.sin(ang) * (37 + r() * 7) - 11, 12 + r() * 5]);
    }
    for (let i = 0; i < 16; i++) a.push([(r() - 0.5) * 56, -38 - r() * 18, 11 + r() * 5]);
    for (let i = 0; i < 8; i++) a.push([-27 + i * 7.8 + (r() - 0.5) * 3, -23 + r() * 6, 7.5 + r() * 3]);
    a.push([-34, -4, 9], [-36, 6, 7], [34, -4, 9], [36, 6, 7]);
    return a;
  })();

  function ik(sx, sy, tx, ty, l1, l2, prefer) {
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
    const maxd = l1 + l2 - 0.6;
    if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
    if (d < 1) d = 1;
    const th = Math.atan2(dy, dx);
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const e1 = [sx + l1 * Math.cos(th + a), sy + l1 * Math.sin(th + a)];
    const e2 = [sx + l1 * Math.cos(th - a), sy + l1 * Math.sin(th - a)];
    let e;
    if (prefer === 'fwd') e = e1[0] > e2[0] ? e1 : e2;
    else if (prefer === 'out') e = Math.abs(e1[0]) > Math.abs(e2[0]) ? e1 : e2;
    else if (prefer === 'up') e = e1[1] < e2[1] ? e1 : e2;
    else e = e1[1] > e2[1] ? e1 : e2;
    return { e, h: [sx + dx, sy + dy] };
  }

  function mouthShape(c, x, y, kind, P) {
    c.save(); c.translate(x, y);
    if (kind === 'smile' || kind === 'laugh') {
      const w = kind === 'laugh' ? 15 : 13, d = kind === 'laugh' ? 20 : 16;
      c.beginPath(); c.moveTo(-w, -2); c.quadraticCurveTo(0, 2, w, -2); c.quadraticCurveTo(w * 0.7, d, 0, d); c.quadraticCurveTo(-w * 0.7, d, -w, -2); c.closePath();
      c.fillStyle = '#6e2626'; c.fill();
      c.save(); c.clip();
      c.fillStyle = '#fbfaf6'; c.fillRect(-w, -4, w * 2, 7.5);
      ell(c, 0, d - 1, 8, 5, '#d9696a');
      c.restore();
    } else if (kind === 'open') {
      ell(c, 0, 4, 6.5, 7, '#6e2626'); ell(c, 0, 8, 4, 2.5, '#d9696a');
    } else if (kind === 'half') {
      ell(c, 0, 3, 8, 3.8, '#6e2626');
    } else if (kind === 'o') {
      ell(c, 0, 4, 4.5, 5.5, '#6e2626');
    } else if (kind === 'flat') {
      poly(c, [[-8, 2], [8, 2]], 2.6, '#8a4a3c');
    } else {
      c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(0, 9, 10, 0);
      c.lineWidth = 2.8; c.strokeStyle = '#8a4a3c'; c.lineCap = 'round'; c.stroke();
    }
    c.restore();
  }

  function talkMouth(t, base) {
    const v = Math.sin(t * 23) + Math.sin(t * 9.7) * 0.6;
    return v > 0.7 ? 'open' : v > -0.2 ? 'half' : base === 'smile' ? 'grin' : base || 'grin';
  }

  function drawHair(c, P, hx, hy, t, front) {
    const st = P.hairStyle;
    if (st === 'curly') {
      if (!front) { ell(c, hx, hy - 6, 41, 40, P.hair); return; }
      ell(c, hx, hy - 27, 40, 26, P.hair);
      CURLS.forEach((k, i) => {
        const sw = Math.sin(t * 2.6 + i * 1.7) * 0.9;
        const x = hx + k[0] + sw, y = hy + k[1] + Math.cos(t * 2.1 + i) * 0.6;
        circ(c, x, y, k[2], P.hair);
        c.beginPath(); c.arc(x - 1, y - 1, k[2] * 0.55, Math.PI * 1.05, Math.PI * 1.7);
        c.lineWidth = 2.2; c.strokeStyle = P.hairHi; c.lineCap = 'round'; c.stroke();
      });
    } else if (st === 'bob') {
      if (!front) { rrect(c, hx - 42, hy - 40, 84, 82, 34); c.fillStyle = P.hair; c.fill(); return; }
      c.beginPath(); c.moveTo(hx - 36, hy + 4); c.quadraticCurveTo(hx - 40, hy - 46, hx, hy - 46); c.quadraticCurveTo(hx + 40, hy - 46, hx + 36, hy + 4);
      c.quadraticCurveTo(hx + 20, hy - 22, hx - 6, hy - 18); c.quadraticCurveTo(hx - 24, hy - 14, hx - 36, hy + 4); c.fillStyle = P.hair; c.fill();
      poly(c, [[hx - 20, hy - 36], [hx + 10, hy - 40]], 2, P.hairHi);
    } else if (st === 'long') {
      if (!front) { rrect(c, hx - 42, hy - 38, 84, 118, 36); c.fillStyle = P.hair; c.fill(); return; }
      c.beginPath(); c.moveTo(hx - 34, hy + 8); c.quadraticCurveTo(hx - 38, hy - 46, hx + 2, hy - 46); c.quadraticCurveTo(hx + 40, hy - 46, hx + 34, hy + 8);
      c.quadraticCurveTo(hx + 26, hy - 20, hx + 4, hy - 26); c.quadraticCurveTo(hx - 18, hy - 18, hx - 34, hy + 8); c.fillStyle = P.hair; c.fill();
      poly(c, [[hx - 18, hy - 36], [hx + 14, hy - 38]], 2.2, P.hairHi);
    } else if (st === 'mop') {
      if (!front) { ell(c, hx, hy - 4, 42, 42, P.hair); rrect(c, hx - 43, hy - 30, 86, 64, 26); c.fillStyle = P.hair; c.fill(); return; }
      c.beginPath(); c.moveTo(hx - 40, hy + 8); c.quadraticCurveTo(hx - 46, hy - 56, hx + 2, hy - 54); c.quadraticCurveTo(hx + 48, hy - 54, hx + 40, hy + 8);
      c.lineTo(hx + 32, hy - 24); c.lineTo(hx - 32, hy - 24); c.closePath(); c.fillStyle = P.hair; c.fill();
      for (let i = 0; i < 6; i++) poly(c, [[hx - 30 + i * 12, hy - 46], [hx - 26 + i * 12, hy - 28]], 2, P.hairHi);
    } else if (st === 'buzz') {
      if (!front) return;
      c.beginPath(); c.moveTo(hx - 31, hy - 6); c.quadraticCurveTo(hx - 32, hy - 42, hx, hy - 42); c.quadraticCurveTo(hx + 32, hy - 42, hx + 31, hy - 6);
      c.quadraticCurveTo(hx, hy - 26, hx - 31, hy - 6); c.fillStyle = P.hair; c.fill();
    } else {
      if (!front) return;
      c.beginPath(); c.moveTo(hx - 33, hy - 2); c.quadraticCurveTo(hx - 36, hy - 46, hx + 2, hy - 45); c.quadraticCurveTo(hx + 38, hy - 44, hx + 33, hy - 2);
      c.quadraticCurveTo(hx + 24, hy - 26, hx - 4, hy - 24); c.quadraticCurveTo(hx - 22, hy - 20, hx - 33, hy - 2); c.fillStyle = P.hair; c.fill();
    }
  }

  function drawHead(c, P, hx, hy, o, t) {
    const lx = (o.look || 0) * 5, ly = -(o.lookUp || 0) * 3;
    const mopBangs = () => {
      const sw = !!o.swept, n = 9;
      for (let i = 0; i < n; i++) {
        const x = hx - 34 + i * 8.5;
        const len = sw ? 10 + i * 1.6 : (o.bangsLong ? 36 : 30) + ((i * 37) % 7);
        const tip = x + (sw ? 14 + i * 1.5 : (i - 4) * 1.3) + Math.sin(t * 2 + i) * 0.7;
        c.beginPath(); c.moveTo(x - 6, hy - 32); c.lineTo(x + 6, hy - 32); c.lineTo(tip, hy - 32 + len); c.closePath(); c.fillStyle = P.hair; c.fill();
        poly(c, [[x, hy - 30], [lerp(x, tip, 0.7), hy - 32 + len * 0.7]], 1.6, P.hairHi);
      }
    };
    drawHair(c, P, hx, hy, t, false);
    ell(c, hx - 31, hy + 4, 6, 9, P.skinShade); ell(c, hx + 31, hy + 4, 6, 9, P.skinShade);
    c.beginPath(); c.moveTo(hx - 30, hy - 8);
    c.bezierCurveTo(hx - 31, hy + 26, hx - 15, hy + 41, hx, hy + 41);
    c.bezierCurveTo(hx + 15, hy + 41, hx + 31, hy + 26, hx + 30, hy - 8);
    c.bezierCurveTo(hx + 30, hy - 42, hx - 30, hy - 42, hx - 30, hy - 8);
    c.fillStyle = P.skin; c.fill();
    if (P.beard) {
      c.beginPath(); c.moveTo(hx - 29, hy + 4); c.bezierCurveTo(hx - 29, hy + 34, hx - 14, hy + 47, hx, hy + 47);
      c.bezierCurveTo(hx + 14, hy + 47, hx + 29, hy + 34, hx + 29, hy + 4); c.bezierCurveTo(hx + 22, hy + 26, hx - 22, hy + 26, hx - 29, hy + 4);
      c.fillStyle = P.hair; c.fill();
    }
    drawHair(c, P, hx, hy, t, true);
    const ey = hy + 5 + ly;
    const blink = ((t * 0.31 + (o.seed || 0)) % 1) < 0.035;
    const eyes = blink ? 'closed' : o.eyes || 'open';
    if (eyes === 'happy' || eyes === 'closed') {
      [-12, 12].forEach((dx) => {
        c.beginPath();
        if (eyes === 'happy') c.arc(hx + dx + lx, ey + 3, 5.5, Math.PI * 1.1, Math.PI * 1.9);
        else { c.moveTo(hx + dx + lx - 5, ey + 1); c.lineTo(hx + dx + lx + 5, ey + 1); }
        c.lineWidth = 2.8; c.strokeStyle = P.eye; c.lineCap = 'round'; c.stroke();
      });
    } else {
      [-12, 12].forEach((dx) => {
        ell(c, hx + dx + lx, ey, 4.4, 5.8, P.eye);
        circ(c, hx + dx + lx + 1.3, ey - 2, 1.7, '#ffffff');
      });
    }
    const br = o.brow || 0;
    poly(c, [[hx - 19 + lx, hy - 7 - br], [hx - 6 + lx, hy - 9 - br - (o.browTilt || 0)]], 3.6, P.hairStyle === 'bob' ? '#9b928a' : P.hair);
    poly(c, [[hx + 6 + lx, hy - 9 - br], [hx + 19 + lx, hy - 7 - br + (o.browTilt || 0)]], 3.6, P.hairStyle === 'bob' ? '#9b928a' : P.hair);
    if (P.glasses) {
      c.lineWidth = 2.2; c.strokeStyle = '#2b2b30';
      [-12, 12].forEach((dx) => { c.beginPath(); c.arc(hx + dx + lx, ey, 9, 0, TAU); c.stroke(); });
      poly(c, [[hx - 3 + lx, ey - 1], [hx + 3 + lx, ey - 1]], 2, '#2b2b30');
    }
    if (P.hairStyle === 'mop') mopBangs();
    c.beginPath(); c.moveTo(hx + lx * 1.4 - 1, hy + 12); c.quadraticCurveTo(hx + lx * 1.4 + 5, hy + 18, hx + lx * 1.4 - 2, hy + 20);
    c.lineWidth = 2.2; c.strokeStyle = P.skinShade; c.lineCap = 'round'; c.stroke();
    ell(c, hx - 19, hy + 17, 6, 3.5, 'rgba(232,118,104,0.28)'); ell(c, hx + 19, hy + 17, 6, 3.5, 'rgba(232,118,104,0.28)');
    if (o.wet) {
      for (let i = 0; i < 4; i++) ell(c, hx - 20 + i * 13, hy - 20 + ((t * 60 + i * 23) % 50), 1.8, 3, 'rgba(160,210,240,0.9)');
    }
    mouthShape(c, hx + lx * 1.2, hy + 27, o.mouth || 'grin', P);
  }

  function shoe(c, x, y, P, sc = 1) {
    c.save(); c.translate(x, y); c.scale(sc, 1);
    rrect(c, -13, -13, 35, 15, 7); c.fillStyle = P.shoe; c.fill();
    c.fillStyle = P.shoeAcc; c.fillRect(-13, -1, 35, 3);
    c.beginPath(); c.moveTo(-6, -10); c.quadraticCurveTo(4, -5, 15, -9); c.lineWidth = 3; c.strokeStyle = P.shoeAcc; c.stroke();
    c.restore();
  }

  /* drawPerson: опорная точка — центр между ступнями на земле. Масштаб 1 ≈ 305 px роста. */
  function drawPerson(c, P, x, y, s, o = {}, t = 0) {
    c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s * (o.flip ? -1 : 1), s);
    const bob = o.bob || 0;
    const hipY = -120 + bob, shY = -212 + bob, headY = -263 + bob + (o.headDy || 0);
    const fL = o.footL || [17, 0], fR = o.footR || [-15, 0];
    const hL = o.handL || [40, -112 + bob], hR = o.handR || [-40, -112 + bob];
    if (P.hairStyle === 'long' || P.hairStyle === 'bob') {
      c.save(); c.translate(0, 0); drawHair(c, P, 0, headY, t, false); c.restore();
    }
    if (!o.noLegs) {
      [[-11, fR, true], [11, fL, false]].forEach(([hx, f, back]) => {
        const k = ik(hx, hipY, f[0], f[1] - 8, 62, 60, 'fwd');
        poly(c, [[hx, hipY], k.e, k.h], 25, back ? P.pantsShade : P.pants);
        shoe(c, k.h[0], k.h[1] + 8, P);
      });
      rrect(c, -26, hipY - 12, 52, 26, 9); c.fillStyle = P.pants; c.fill();
    }
    c.fillStyle = P.skinShade; c.fillRect(-7, shY - 18, 14, 22);
    c.beginPath(); c.moveTo(-24, hipY + 8); c.lineTo(-27, shY + 18); c.quadraticCurveTo(-33, shY, -14, shY - 3);
    c.lineTo(14, shY - 3); c.quadraticCurveTo(33, shY, 27, shY + 18); c.lineTo(24, hipY + 8); c.quadraticCurveTo(0, hipY + 14, -24, hipY + 8);
    c.fillStyle = P.shirt; c.fill();
    if (P.plaid) {
      c.save(); c.clip();
      for (let xx = -40; xx < 40; xx += 16) { c.fillStyle = 'rgba(43,58,94,0.85)'; c.fillRect(xx, shY - 10, 6, 140); c.fillStyle = 'rgba(120,128,146,0.5)'; c.fillRect(xx + 9, shY - 10, 3, 140); }
      for (let yy = shY - 6; yy < hipY + 14; yy += 16) { c.fillStyle = 'rgba(43,58,94,0.6)'; c.fillRect(-40, yy, 80, 6); c.fillStyle = 'rgba(201,160,70,0.8)'; c.fillRect(-40, yy + 9, 80, 1.6); }
      c.fillStyle = P.tee; c.fillRect(-9, shY - 4, 18, hipY - shY + 20);
      c.fillStyle = '#5f636d'; c.fillRect(-7, shY + 30, 14, 10);
      c.restore();
      c.beginPath(); c.moveTo(-12, shY - 3); c.lineTo(-3, shY + 14); c.lineTo(-9, shY - 4); c.fillStyle = P.shirtHi; c.fill();
      c.beginPath(); c.moveTo(12, shY - 3); c.lineTo(3, shY + 14); c.lineTo(9, shY - 4); c.fill();
    }
    if (P.stripes) {
      c.save(); c.clip(); for (let yy = shY; yy < hipY + 12; yy += 12) { c.fillStyle = '#8fa6c2'; c.fillRect(-34, yy, 68, 4); } c.restore();
    }
    if (P === TUTOR) { c.save(); c.clip(); c.fillStyle = P.shirtHi; c.fillRect(-9, shY - 4, 18, 100); c.restore(); }
    poly(c, [[-20, shY + 14], [-21, hipY - 4]], 4, P.shirtHi);
    c.beginPath(); c.arc(0, shY - 4, 9, 0.15 * Math.PI, 0.85 * Math.PI); c.lineWidth = 3; c.strokeStyle = P.shirtHi; c.stroke();
    if (o.apron) {
      c.beginPath(); c.moveTo(-20, shY + 22); c.lineTo(20, shY + 22); c.lineTo(26, hipY + 40); c.lineTo(-26, hipY + 40); c.closePath(); c.fillStyle = '#d9a33a'; c.fill();
      poly(c, [[-20, shY + 22], [-12, shY - 2]], 3, '#a87a22'); poly(c, [[20, shY + 22], [12, shY - 2]], 3, '#a87a22');
    }
    if (o.vest) {
      rrect(c, -29, shY + 2, 58, hipY - shY + 2, 12); c.fillStyle = '#f07a24'; c.fill();
      c.fillStyle = '#d4611a'; c.fillRect(-3, shY + 4, 6, hipY - shY - 4);
      c.fillStyle = '#ffffff'; c.globalAlpha = 0.7; c.fillRect(-26, shY + 50, 52, 6); c.globalAlpha = 1;
    }
    const hands = [];
    [[-29, hR, false], [29, hL, true]].forEach(([sx, tgt, isL]) => {
      const a = ik(sx, shY + 8, tgt[0], tgt[1], 49, 47, o.elbow || 'down');
      poly(c, [[sx, shY + 8], a.e, a.h], 13, P.skin);
      const vx = a.e[0] - sx, vy = a.e[1] - (shY + 8), vl = Math.hypot(vx, vy) || 1;
      poly(c, [[sx, shY + 8], [sx + (vx / vl) * 20, shY + 8 + (vy / vl) * 20]], 23, P.shirt);
      if (P.longSleeve) {
        const fx = a.h[0] - a.e[0], fy = a.h[1] - a.e[1];
        poly(c, [[sx, shY + 8], a.e, [a.e[0] + fx * 0.86, a.e[1] + fy * 0.86]], 17, P.longSleeve);
        poly(c, [[sx, shY + 8], a.e, [a.e[0] + fx * 0.86, a.e[1] + fy * 0.86]], 3, 'rgba(43,58,94,0.55)');
        poly(c, [[a.e[0] + fx * 0.8, a.e[1] + fy * 0.8], [a.e[0] + fx * 0.86, a.e[1] + fy * 0.86]], 18, P.shirtHi);
      }
      if (isL && P.watch) {
        const fx = a.h[0] - a.e[0], fy = a.h[1] - a.e[1];
        poly(c, [[a.e[0] + fx * 0.88, a.e[1] + fy * 0.88], [a.e[0] + fx * 0.95, a.e[1] + fy * 0.95]], 15, typeof P.watch === 'string' ? P.watch : '#151518');
      }
      hands.push(a.h);
    });
    if (o.paddle) {
      const [p0, p1] = o.paddle;
      poly(c, [p0, p1], 5, '#3a3a40');
      ell(c, p1[0], p1[1], 7, 20, '#2a9d8f', Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - Math.PI / 2);
    }
    if (o.map) drawMapProp(c, 0, shY + 62, 1, o.map === 'open' ? 1 : 0, t, o.mapPins || 0);
    hands.forEach((h) => circ(c, h[0], h[1], 9, P.skin));
    drawHead(c, P, 0, headY, o, t);
    if (o.goggles) {
      rrect(c, -28, headY - 6, 56, 20, 9); c.fillStyle = 'rgba(160,215,235,0.55)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#2e3440'; c.stroke();
      poly(c, [[-28, headY + 2], [-36, headY]], 3, '#2e3440'); poly(c, [[28, headY + 2], [36, headY]], 3, '#2e3440');
    }
    c.restore();
  }

  function drawMapProp(c, x, y, s, open, t, pins) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (!open) {
      rrect(c, -10, -34, 20, 68, 8); c.fillStyle = '#efe0bd'; c.fill();
      poly(c, [[-10, 0], [10, 0]], 2, '#a6824f');
    } else {
      c.rotate(-0.04);
      rrect(c, -56, -38, 112, 76, 6); c.fillStyle = '#f1e3c2'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#b8955c'; c.stroke();
      c.beginPath(); c.moveTo(-50, 26); c.bezierCurveTo(-20, 14, 10, 34, 50, 20); c.lineWidth = 5; c.strokeStyle = 'rgba(96,160,200,0.8)'; c.stroke();
      c.fillStyle = '#c0583a'; c.fillRect(-36, -24, 22, 20);
      c.beginPath(); c.moveTo(-39, -24); c.lineTo(-25, -34); c.lineTo(-11, -24); c.fillStyle = '#5b4a40'; c.fill();
      [[-25, 0], [6, -18], [28, -6], [40, 10], [-4, 14]].forEach((p) => {
        c.beginPath(); c.arc(p[0], p[1], 5, 0, TAU); c.lineWidth = 1.6; c.strokeStyle = '#a6824f'; c.setLineDash([2, 2]); c.stroke(); c.setLineDash([]);
      });
    }
    c.restore();
  }

  function drawCrow(c, x, y, s, o = {}, t = 0) {
    c.save(); c.translate(x, y); c.scale(s * (o.flip ? -1 : 1), s);
    c.beginPath(); c.moveTo(-16, -12); c.lineTo(-42, -4); c.lineTo(-38, 4); c.lineTo(-13, -3); c.fillStyle = '#202328'; c.fill();
    if (!o.flying) { poly(c, [[-3, -4], [-5, 8]], 2.6, '#2b2b2b'); poly(c, [[6, -4], [6, 8]], 2.6, '#2b2b2b'); }
    ell(c, 0, -17, 22, 15, '#8e9299', -0.25);
    c.save(); c.translate(-4, -20);
    const flap = o.flying ? Math.sin(t * 32) * 0.9 : (o.ruffle ? Math.sin(t * 18) * 0.15 : 0);
    c.rotate(-0.3 - flap); ell(c, -2, 0, 17, 10, '#23262c'); c.restore();
    c.save(); c.translate(17, -31); c.rotate(o.tilt || 0);
    circ(c, 0, 0, 10.5, '#23262c');
    c.beginPath(); c.moveTo(7, -3); c.lineTo(22, 1); c.lineTo(7, 2.5); c.fillStyle = '#17171a'; c.fill();
    if (o.caw) { c.beginPath(); c.moveTo(7, 2.5); c.lineTo(18, 9); c.lineTo(7, 5.5); c.fill(); }
    if (o.crust) { rrect(c, 14, -2, 14, 8, 3); c.fillStyle = '#c98b45'; c.fill(); }
    circ(c, 3.5, -3.5, 2.8, '#ffffff'); circ(c, 4.2, -3.4, 1.4, '#111111');
    c.restore();
    c.restore();
  }

  /* ---------- окружение ---------- */
  function cloud(c, x, y, s, a) {
    c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s);
    [[0, 0, 40], [38, -14, 34], [74, 2, 36], [36, 12, 34], [-30, 10, 28]].forEach((k) => circ(c, k[0], k[1], k[2], '#ffffff'));
    c.restore();
  }
  function pine(c, x, y, h, col = '#2f5f3c', dark = '#244b30') {
    c.fillStyle = '#5a3e2b'; c.fillRect(x - 6, y - h * 0.18, 12, h * 0.18);
    for (let i = 0; i < 4; i++) {
      const yy = y - h * 0.15 - i * h * 0.2, w = h * (0.34 - i * 0.065);
      c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x, yy - h * 0.34); c.lineTo(x + w, yy); c.closePath(); c.fillStyle = i % 2 ? dark : col; c.fill();
    }
  }
  function roundTree(c, x, y, h, seed, col, t = 0) {
    const r = rng(seed);
    c.fillStyle = '#5b4030'; c.fillRect(x - 8, y - h * 0.45, 16, h * 0.45);
    const shade = shadeCol(col, -0.18);
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, d = r() * h * 0.22;
      const sw = Math.sin(t * 1.3 + i) * 2;
      circ(c, x + Math.cos(a) * d * 1.2 + sw, y - h * 0.62 + Math.sin(a) * d, h * (0.12 + r() * 0.08), i < 6 ? shade : col);
    }
  }
  function birch(c, x, y, h, t, seed) {
    const r = rng(seed);
    c.fillStyle = '#f1efe8'; c.fillRect(x - 6, y - h, 12, h);
    for (let i = 0; i < 9; i++) { c.fillStyle = '#2f2f33'; c.fillRect(x - 6 + (r() > 0.5 ? 0 : 5), y - h * r(), 7, 3); }
    for (let i = 0; i < 16; i++) {
      const sw = Math.sin(t * 1.6 + i * 0.7) * 3;
      circ(c, x + (r() - 0.5) * h * 0.5 + sw, y - h * (0.75 + r() * 0.35), h * (0.06 + r() * 0.05), i % 3 ? '#8cbf5a' : '#6fa447');
    }
  }
  function bushes(c, pts, col) {
    pts.forEach((p, i) => {
      circ(c, p[0] - 26, p[1] - 14, 26, shadeCol(col, -0.15)); circ(c, p[0] + 22, p[1] - 12, 24, shadeCol(col, -0.15));
      circ(c, p[0], p[1] - 26, 30, col); circ(c, p[0] - 8, p[1] - 34, 12, shadeCol(col, 0.12));
    });
  }
  function shadeCol(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  /* ---------- школа: 4 этажа, красный кирпич, треугольная крыша ---------- */
  function makeSchool(night) {
    const S = 2, BW = 1000, BH = 1160;
    const cv = document.createElement('canvas'); cv.width = BW * S; cv.height = BH * S;
    const g = cv.getContext('2d'); g.scale(S, S);
    const r = rng(11), rl = rng(21);
    const x0 = 70, x1 = 930, yP = 1110, yTop = 390, ax = 500, ay = 120;
    const shape = () => { g.beginPath(); g.moveTo(x0, yP); g.lineTo(x0, yTop); g.lineTo(ax, ay); g.lineTo(x1, yTop); g.lineTo(x1, yP); g.closePath(); };
    g.save(); shape(); g.clip();
    g.fillStyle = '#b5482f'; g.fillRect(0, 0, BW, BH);
    const bh = 15, bl = 42;
    for (let k = 0; yP - k * bh > ay - 20; k++) {
      const y = yP - (k + 1) * bh, off = (k % 2) * bl / 2;
      for (let x = x0 - bl + off; x < x1 + bl; x += bl) {
        const v = r();
        const col = v < 0.17 ? '#9b3a25' : v < 0.34 ? '#c65638' : v < 0.44 ? '#a8432c' : v < 0.5 ? '#80301f' : v < 0.54 ? '#cf6a48' : null;
        if (col) { g.fillStyle = col; g.fillRect(x + 1, y + 1, bl - 2, bh - 2); }
      }
    }
    g.strokeStyle = 'rgba(238,228,214,0.55)'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; yP - k * bh > ay - 20; k++) {
      const yb = yP - k * bh, off = (k % 2) * bl / 2;
      g.moveTo(x0, yb); g.lineTo(x1, yb);
      for (let x = x0 + off; x < x1; x += bl) { g.moveTo(x, yb); g.lineTo(x, yb - bh); }
    }
    g.stroke();
    const sh = g.createLinearGradient(x0, 0, x1, 0);
    sh.addColorStop(0, 'rgba(255,235,210,0.10)'); sh.addColorStop(1, 'rgba(60,15,5,0.20)');
    g.fillStyle = sh; g.fillRect(0, 0, BW, BH);
    if (night) { g.fillStyle = 'rgba(30,25,70,0.42)'; g.fillRect(0, 0, BW, BH); }
    g.restore();

    for (let i = 1; i <= 4; i++) {
      const y = yP - 180 * i;
      g.fillStyle = night ? '#b9b3c4' : '#efeae2'; g.fillRect(x0 - 8, y - 6, x1 - x0 + 16, 12);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, y + 6, x1 - x0, 4);
    }
    const winW = 80, winH = 114;
    for (let fl = 0; fl < 4; fl++) {
      const yb = yP - 180 * fl;
      for (let k = 0; k < 6; k++) {
        if (fl === 0 && (k === 2 || k === 3)) continue;
        const cx = x0 + ((x1 - x0) * (k + 0.5)) / 6, y = yb - 146;
        const lit = night && rl() < 0.72;
        g.fillStyle = night ? '#c9c3d2' : '#f4f1ec'; g.fillRect(cx - winW / 2 - 7, y - 7, winW + 14, winH + 14);
        const gl = g.createLinearGradient(0, y, 0, y + winH);
        if (lit) { gl.addColorStop(0, '#ffe8a8'); gl.addColorStop(1, '#f5b04f'); }
        else if (night) { gl.addColorStop(0, '#34406a'); gl.addColorStop(1, '#1d2440'); }
        else { gl.addColorStop(0, '#d6ebf5'); gl.addColorStop(1, '#7ea6c1'); }
        g.fillStyle = gl; g.fillRect(cx - winW / 2, y, winW, winH);
        if (!night) {
          g.save(); g.beginPath(); g.rect(cx - winW / 2, y, winW, winH); g.clip();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(cx - 30, y + winH); g.lineTo(cx + 4, y); g.lineTo(cx + 22, y); g.lineTo(cx - 12, y + winH); g.fill();
          g.restore();
        }
        g.fillStyle = night ? '#c9c3d2' : '#f4f1ec'; g.fillRect(cx - 2.5, y, 5, winH); g.fillRect(cx - winW / 2, y + winH * 0.32, winW, 5);
        g.fillStyle = night ? '#b0aabb' : '#e3ddd2'; g.fillRect(cx - winW / 2 - 12, y + winH + 7, winW + 24, 7);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - winW / 2, y, winW, 5);
      }
    }
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(26, yTop + 14); g.lineTo(ax, ay - 22); g.lineTo(974, yTop + 14);
    g.lineWidth = 30; g.strokeStyle = night ? '#2c2f38' : '#3d414a'; g.stroke();
    g.beginPath(); g.moveTo(30, yTop + 4); g.lineTo(ax, ay - 32); g.lineTo(970, yTop + 4);
    g.lineWidth = 6; g.strokeStyle = night ? '#4a4e5a' : '#5f646e'; g.stroke();
    g.beginPath(); g.arc(ax, 285, 50, 0, TAU); g.fillStyle = night ? '#c9c3d2' : '#f4f1ec'; g.fill();
    g.beginPath(); g.arc(ax, 285, 40, 0, TAU); g.fillStyle = night ? '#ffd98a' : '#a9c9dc'; g.fill();
    g.fillStyle = night ? '#c9c3d2' : '#f4f1ec'; g.fillRect(ax - 2.5, 245, 5, 80); g.fillRect(ax - 40, 282, 80, 5);
    g.fillStyle = '#8f8a86'; g.fillRect(x0 - 10, yP, x1 - x0 + 20, 40);
    g.fillStyle = '#7d7874'; g.fillRect(x0 - 10, yP, x1 - x0 + 20, 5);
    g.fillStyle = '#7f858d'; g.fillRect(x0 + 4, yTop + 10, 8, yP - yTop - 10); g.fillRect(x1 - 12, yTop + 10, 8, yP - yTop - 10);
    g.fillStyle = night ? '#c9c3d2' : '#f4f1ec'; g.fillRect(418, 950, 164, 160);
    g.fillStyle = night ? '#ffd27a' : '#2f4f58'; g.fillRect(428, 960, 70, 150); g.fillRect(502, 960, 70, 150);
    g.fillStyle = night ? '#f6b65a' : '#86aebd';
    g.fillRect(438, 972, 50, 70); g.fillRect(512, 972, 50, 70);
    g.fillStyle = '#d9c38a'; g.fillRect(488, 1040, 5, 22); g.fillRect(507, 1040, 5, 22);
    g.fillStyle = '#2d3036'; g.fillRect(392, 928, 216, 16);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(400, 944, 200, 8);
    [[380, 1110, 240, 14], [362, 1124, 276, 13], [345, 1137, 310, 13]].forEach((s, i) => {
      g.fillStyle = ['#c9c4bd', '#bdb7b0', '#b2aca4'][i]; g.fillRect(s[0], s[1], s[2], s[3]);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(s[0], s[1] + s[3] - 3, s[2], 3);
    });
    if (night) {
      const lg = g.createRadialGradient(500, 1040, 10, 500, 1040, 220);
      lg.addColorStop(0, 'rgba(255,200,110,0.35)'); lg.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = lg; g.fillRect(260, 820, 480, 340);
    }
    return cv;
  }
  let SCHOOL_DAY = null, SCHOOL_NIGHT = null;
  function drawSchool(c, img, cx, gy, s) { c.drawImage(img, cx - 500 * s, gy - 1150 * s, 1000 * s, 1160 * s); }

  /* ---------- иконки и карта-HUD ---------- */
  function drawIcon(c, type, x, y, sz, col, lw = 2.4) {
    c.save(); c.translate(x, y); c.scale(sz / 24, sz / 24);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    if (type === 'door') { c.rect(-7, -11, 14, 22); c.stroke(); circ(c, 4, 1, 1.6, col); }
    else if (type === 'book') { c.moveTo(0, -7); c.quadraticCurveTo(-6, -11, -12, -9); c.lineTo(-12, 8); c.quadraticCurveTo(-6, 6, 0, 10); c.quadraticCurveTo(6, 6, 12, 8); c.lineTo(12, -9); c.quadraticCurveTo(6, -11, 0, -7); c.lineTo(0, 10); c.stroke(); }
    else if (type === 'gamepad') { rrect(c, -12, -7, 24, 14, 6); c.stroke(); c.beginPath(); c.moveTo(-7, 0); c.lineTo(-3, 0); c.moveTo(-5, -2); c.lineTo(-5, 2); c.stroke(); circ(c, 5, -1.5, 1.6, col); circ(c, 8, 1.5, 1.6, col); }
    else if (type === 'paddle') { c.moveTo(-9, -10); c.lineTo(5, 4); c.stroke(); c.beginPath(); c.ellipse(8, 7, 3.5, 7, -0.8, 0, TAU); c.fill(); }
    else if (type === 'people') { c.arc(-5, -5, 4, 0, TAU); c.moveTo(9, -5); c.arc(5, -5, 4, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(-12, 10); c.quadraticCurveTo(-5, 0, 2, 10); c.moveTo(-2, 10); c.quadraticCurveTo(5, 0, 12, 10); c.stroke(); }
    else if (type === 'laptop') { rrect(c, -10, -9, 20, 13, 2); c.stroke(); c.beginPath(); c.moveTo(-14, 8); c.lineTo(14, 8); c.stroke(); }
    else if (type === 'wrench') { c.moveTo(-9, 9); c.lineTo(4, -4); c.stroke(); c.beginPath(); c.arc(6, -6, 5, 0.6, 5.2); c.stroke(); }
    else if (type === 'ball') { c.arc(0, 0, 10, 0, TAU); c.moveTo(-10, 0); c.lineTo(10, 0); c.moveTo(0, -10); c.lineTo(0, 10); c.stroke(); c.beginPath(); c.arc(-14, 0, 10, -0.9, 0.9); c.stroke(); }
    else if (type === 'kart') { rrect(c, -12, -6, 24, 8, 3); c.fill(); c.beginPath(); c.arc(-7, 5, 4, 0, TAU); c.arc(7, 5, 4, 0, TAU); c.fill(); }
    else if (type === 'brush') { c.moveTo(-9, 9); c.lineTo(4, -4); c.stroke(); c.beginPath(); c.ellipse(6, -6, 3, 6, 0.8, 0, TAU); c.fill(); }
    c.restore();
  }
  const PIN_XY = { door: [50, 60], book: [82, 36], gamepad: [116, 50], paddle: [132, 92], people: [42, 90] };
  const PINS = (TL.pins || []).map((p) => ({ t: p.t, type: p.type, x: PIN_XY[p.type][0], y: PIN_XY[p.type][1] }));
  function drawHud(c, t) {
    const a = Math.min(seg(t, TL.hud[0], TL.hud[0] + 0.6), 1 - seg(t, TL.hud[1] - 0.6, TL.hud[1]));
    if (a <= 0) return;
    const X = 1094, Y = 24, w = 160, h = 112;
    c.save(); c.globalAlpha = a; c.translate(X, Y);
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
    rrect(c, 0, 0, w, h, 8); c.fillStyle = '#f2e4c3'; c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = 2; c.strokeStyle = '#b08a52'; c.stroke();
    c.beginPath(); c.moveTo(60, 112); c.bezierCurveTo(90, 96, 120, 108, 160, 82); c.lineWidth = 7; c.strokeStyle = 'rgba(96,160,205,0.75)'; c.stroke();
    c.fillStyle = '#c2573a'; c.fillRect(38, 40, 26, 26);
    c.beginPath(); c.moveTo(35, 40); c.lineTo(51, 28); c.lineTo(67, 40); c.fillStyle = '#4d4f57'; c.fill();
    c.fillStyle = '#9b7a52'; c.fillRect(30, 84, 22, 4);
    [[100, 28], [124, 30], [20, 30], [140, 46]].forEach((p) => circ(c, p[0], p[1], 7, '#88b06c'));
    const lineP = seg(t, TL.hudLine[0], TL.hudLine[1]);
    if (lineP > 0) {
      c.save(); c.beginPath();
      const pts = PINS.map((p) => [p.x, p.y]);
      const total = pts.length - 1, upto = lineP * total;
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i <= total; i++) {
        const f = clamp(upto - (i - 1));
        if (f <= 0) break;
        c.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
      }
      c.setLineDash([5, 4]); c.lineWidth = 2.6; c.strokeStyle = '#d4931c'; c.stroke(); c.restore();
    }
    PINS.forEach((p) => {
      const k = seg(t, p.t, p.t + 0.45);
      if (t < p.t) {
        c.beginPath(); c.arc(p.x, p.y, 9, 0, TAU); c.setLineDash([3, 3]); c.lineWidth = 1.6; c.strokeStyle = '#a88553'; c.stroke(); c.setLineDash([]);
        return;
      }
      const sc = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.9 : 1;
      glow(c, p.x, p.y, 26 * (1 + (1 - k) * 1.4), 'rgba(255,200,70,' + (0.55 * (1 - k) + 0.25) + ')');
      c.save(); c.translate(p.x, p.y); c.scale(sc, sc);
      circ(c, 0, 0, 11, '#f2b544'); c.lineWidth = 1.5; c.strokeStyle = '#a8691a'; c.stroke();
      drawIcon(c, p.type, 0, 0, 13, '#5a3508', 2.6);
      c.restore();
    });
    c.restore();
  }

  /* ---------- субтитры ---------- */
  const SUBS = TL.subs.slice(0, -1).map((k) => [k[0], k[1], '', k[2]]);
  function speaking(t, who) { return SUBS.some((s) => s[2] === who && t >= s[0] && t < s[1]); }
  function wrap(c, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    words.forEach((w) => { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawSubs(c, t) {
    const s = SUBS.find((k) => t >= k[0] && t < k[1]);
    if (!s) return;
    const a = win01(t, s[0], s[1], 0.18);
    c.save(); c.globalAlpha = a;
    const vo = !s[2];
    c.font = (vo ? 'italic 600 ' : '700 ') + '29px ' + FONT;
    const label = s[2] ? s[2] + ':  ' : '';
    const full = label + s[3];
    const lines = wrap(c, full, 1080);
    const lh = 40, bw = Math.max(...lines.map((l) => c.measureText(l).width)) + 44, bh = lines.length * lh + 18;
    const by = 694 - bh;
    rrect(c, 640 - bw / 2, by, bw, bh, 12); c.fillStyle = 'rgba(12,16,32,0.62)'; c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    lines.forEach((l, i) => {
      const lw2 = c.measureText(l).width, x = 640 - lw2 / 2, y = by + 9 + lh * (i + 0.5);
      if (i === 0 && label) {
        c.fillStyle = '#f2b544'; c.fillText(label, x, y);
        c.fillStyle = '#ffffff'; c.fillText(l.slice(label.length), x + c.measureText(label).width, y);
      } else { c.fillStyle = vo ? '#eef0f6' : '#ffffff'; c.fillText(l, x, y); }
    });
    c.restore();
  }

  /* ---------- СЦЕНА 1: утро, школа ---------- */
  function birds(c, t) {
    for (let i = 0; i < 4; i++) {
      const x = ((t * 55 + i * 170) % 1500) - 120, y = 140 + i * 26 + Math.sin(t * 2 + i) * 8;
      const f = Math.sin(t * 12 + i) * 6;
      poly(c, [[x - 10, y - f], [x, y], [x + 10, y - f]], 2.4, 'rgba(40,40,55,0.75)');
    }
  }
  function s1(c, t) {
    sky(c, ['#78b2e5', '#b7daf2', '#ffe6c8']);
    glow(c, 1010, 150, 190, 'rgba(255,240,190,0.85)'); circ(c, 1010, 150, 42, '#fff6d6');
    const z = lerp(1, 1.13, easeIO(seg(t, 0, 9.3))), dy = lerp(-70, 0, easeOut(seg(t, 0, 7)));
    c.save(); cam(c, z, 640, 520, dy);
    cloud(c, 160 + t * 9, 120, 0.9, 0.85); cloud(c, 620 + t * 6, 70, 0.7, 0.7); cloud(c, 1180 + t * 7, 210, 0.6, 0.6);
    c.fillStyle = '#9cc58f'; c.beginPath(); c.moveTo(-200, 600); c.quadraticCurveTo(300, 470, 700, 560); c.quadraticCurveTo(1100, 480, 1500, 580); c.lineTo(1500, 700); c.lineTo(-200, 700); c.fill();
    for (let i = 0; i < 22; i++) roundTree(c, -100 + i * 70, 590, 120 + (i % 3) * 25, 40 + i, i % 2 ? '#5f8f5a' : '#6a9a62', t);
    c.fillStyle = vgrad(c, 560, 620, ['#8cbf6a', '#78ad58']); c.fillRect(-200, 575, 1700, 60);
    pine(c, 120, 622, 330); roundTree(c, 230, 616, 250, 3, '#4f8a46', t); pine(c, 1170, 618, 300);
    drawSchool(c, SCHOOL_DAY, 640, 612, 0.47);
    bushes(c, [[400, 614], [470, 616], [810, 614], [880, 617]], '#4c8a43');
    birch(c, 1010, 650, 330, t, 5); birch(c, 1090, 660, 280, t, 6);
    c.fillStyle = vgrad(c, 610, 760, ['#80b95e', '#5e9b45']); c.fillRect(-200, 610, 1700, 220);
    c.fillStyle = '#e4d0a8'; c.beginPath(); c.moveTo(612, 612); c.lineTo(668, 612); c.lineTo(830, 780); c.lineTo(450, 780); c.closePath(); c.fill();
    roundTree(c, 30, 740, 320, 9, '#3f7a3c', t);
    c.restore();
    birds(c, t);
    const ta = win01(t, 0.9, 8.2, 0.7);
    if (ta > 0) {
      c.save(); c.globalAlpha = ta; c.textAlign = 'center'; c.textBaseline = 'middle';
      const yy = 104 - (1 - easeOut(seg(t, 0.9, 2))) * 16;
      c.shadowColor = 'rgba(20,30,60,0.45)'; c.shadowBlur = 18; c.shadowOffsetY = 3;
      c.font = '800 66px ' + FONT; c.fillStyle = '#ffffff'; c.fillText(TL.titleText || 'Даня и Карта Возможностей', 640, yy);
      c.shadowBlur = 8; c.font = '600 26px ' + FONT; c.fillStyle = '#fff5dc'; c.fillText('мультфильм о нашей школе', 640, yy + 52);
      c.restore();
    }
  }

  /* ---------- СЦЕНА 2: вход, находка карты ---------- */
  function s2(c, t) {
    const z = lerp(1.0, 1.07, easeIO(seg(t, 9, 17.2)));
    c.save(); cam(c, z, 560, 560);
    c.fillStyle = '#b5482f'; c.fillRect(-200, -200, 1700, 1000);
    drawSchool(c, SCHOOL_DAY, 640, 655, 1.9);
    c.fillStyle = vgrad(c, 655, 760, ['#d2c4ad', '#b8a78c']); c.fillRect(-200, 655, 1700, 160);
    c.strokeStyle = 'rgba(120,100,80,0.25)'; c.lineWidth = 2; c.beginPath();
    for (let x = -200; x < 1500; x += 90) { c.moveTo(x, 655); c.lineTo(x - 60, 780); }
    c.moveTo(-200, 700); c.lineTo(1500, 700); c.stroke();
    bushes(c, [[250, 662], [335, 664], [1000, 662], [1090, 664]], '#4f8c45');
    c.fillStyle = '#3a3d44';
    c.fillRect(905, 556, 7, 102); c.fillRect(1010, 556, 7, 102); c.fillRect(900, 552, 122, 8);
    const crowHop = seg(t, 13.3, 13.7);
    const cy = 552 - Math.sin(crowHop * Math.PI) * 26;
    const cx = lerp(985, 955, crowHop);
    const caw = t > 14.3 && t < 15.0 && Math.sin(t * 30) > -0.2;
    const peck = t < 13.2 ? Math.max(0, Math.sin(t * 4)) * 0.5 : 0;
    drawCrow(c, cx, cy, 1.05, { flip: t >= 13.3, tilt: t > 13.8 && t < 14.3 ? -0.45 : peck, caw, ruffle: caw }, t);
    if (t < 12.95) { c.save(); c.translate(585, 632); c.rotate(0.25); drawMapProp(c, 0, 0, 0.9, 0, t); c.restore(); }
    let x, o = { seed: 0.2 };
    const s = 0.95;
    if (t < 12.6) {
      x = lerp(-130, 540, seg(t, 9.2, 12.6));
      const ph = t * 8.2;
      o.footL = [5 + 28 * Math.sin(ph), -11 * Math.max(0, Math.cos(ph))];
      o.footR = [-5 - 28 * Math.sin(ph), -11 * Math.max(0, -Math.cos(ph))];
      o.handL = [34 - 22 * Math.sin(ph), -112]; o.handR = [-34 + 22 * Math.sin(ph), -112];
      o.bob = -3 * Math.abs(Math.cos(ph)); o.look = 0.8; o.mouth = 'grin';
    } else {
      x = 540;
      const cr = Math.sin(seg(t, 12.6, 13.5) * Math.PI);
      o.bob = 46 * cr; o.footL = [20, 0]; o.footR = [-16, 0];
      if (t < 13.25) { o.handL = [52, -78]; o.handR = [-18, -110 + o.bob]; o.look = 1; o.lookUp = -1; }
      else if (t < 13.6) { o.handL = [20, -150 + o.bob]; o.handR = [-20, -150 + o.bob]; o.map = 'closed'; }
      else { o.handL = [1, -150]; o.handR = [-1, -150]; o.map = 'open'; }
      if (t >= 13.0 && t < 13.25) o.map = 'closed';
      o.look = t > 13.4 ? 1 : 0.6;
      o.brow = t > 13.5 && t < 14.3 ? 4 : 0; o.browTilt = t > 13.5 && t < 14.3 ? 3 : 0;
      const talking = speaking(t, 'Даня');
      o.mouth = talking ? talkMouth(t, 'grin') : t > 15 ? 'smile' : t > 13.5 ? 'o' : 'grin';
    }
    drawPerson(c, DANYA, x, 706, s, o, t);
    c.restore();
  }

  /* ---------- СЦЕНА 3: класс, математика ---------- */
  function chalkText(c, txt, x, y, prog, col, size = 46) {
    if (prog <= 0) return;
    c.save(); c.font = '700 ' + size + 'px ' + FONT; c.textBaseline = 'middle';
    const w = c.measureText(txt).width;
    c.beginPath(); c.rect(x - 4, y - 40, (w + 8) * prog, 80); c.clip();
    c.fillStyle = col; c.fillText(txt, x, y);
    c.restore();
    return w;
  }
  function s3(c, t) {
    const z = lerp(1.0, 1.07, easeIO(seg(t, 16.6, 27.4)));
    c.save(); cam(c, z, 640, 380);
    c.fillStyle = '#efe2cb'; c.fillRect(-100, -100, 1500, 900);
    c.fillStyle = '#c99a68'; c.fillRect(-100, 520, 1500, 300);
    c.fillStyle = '#b4895c'; for (let x = -100; x < 1500; x += 120) c.fillRect(x, 520, 3, 300);
    c.fillStyle = '#9b7148'; c.fillRect(-100, 512, 1500, 12);
    c.fillStyle = '#f7f2e8'; c.fillRect(30, 110, 200, 300);
    c.fillStyle = vgrad(c, 120, 400, ['#9ccbe8', '#dceff8']); c.fillRect(42, 122, 176, 276);
    roundTree(c, 150, 420, 300, 4, '#6aa253', t);
    c.fillStyle = '#f7f2e8'; c.fillRect(126, 122, 8, 276); c.fillRect(42, 230, 176, 8);
    c.fillStyle = 'rgba(255,240,200,0.22)'; c.beginPath(); c.moveTo(42, 122); c.lineTo(218, 122); c.lineTo(560, 700); c.lineTo(260, 700); c.fill();
    c.fillStyle = '#8a6a45'; c.fillRect(312, 112, 716, 400);
    c.fillStyle = '#2f4a3d'; c.fillRect(326, 126, 688, 372);
    const bg = c.createRadialGradient(560, 260, 40, 560, 260, 520); bg.addColorStop(0, 'rgba(255,255,255,0.06)'); bg.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = bg; c.fillRect(326, 126, 688, 372);
    c.fillStyle = '#7a5c3b'; c.fillRect(312, 498, 716, 14);
    const chalk = 'rgba(240,240,228,0.92)';
    chalkText(c, '2x + 6 = 20', 380, 196, 1, chalk);
    chalkText(c, 'x = 13 ?', 380, 270, 1, chalk);
    const cross = seg(t, 21.0, 21.35);
    if (cross > 0) poly(c, [[372, 286], [lerp(372, 560, cross), lerp(286, 256, cross)]], 4, 'rgba(255,140,120,0.9)');
    chalkText(c, '2x = 14', 640, 350, seg(t, 21.35, 22.0), chalk);
    const g7 = seg(t, 22.5, 22.9) * (1 - seg(t, 24.0, 25.0) * 0.6);
    if (g7 > 0) { c.save(); c.shadowColor = 'rgba(255,200,70,' + g7 + ')'; c.shadowBlur = 26 * g7; chalkText(c, 'x = 7', 640, 428, 1, g7 > 0.3 ? '#ffd76a' : chalk); c.restore(); }
    else chalkText(c, 'x = 7', 640, 428, seg(t, 22.0, 22.5), chalk);
    if (t > 24.3) {
      const k = easeOut(seg(t, 24.3, 24.7));
      c.save(); c.translate(930, 180); c.rotate(0.07); c.scale(k, k);
      c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
      c.fillStyle = '#f7dc6a'; c.fillRect(-70, -36, 140, 72); c.shadowColor = 'transparent';
      c.fillStyle = '#5a4210'; c.font = '800 27px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ОГЭ · ЕГЭ', 0, 2);
      c.restore();
    }
    const tTalk = speaking(t, 'Учительница');
    drawPerson(c, TEACHER, 262, 706, 0.98, {
      look: 1, seed: 0.6,
      handL: tTalk ? [72 + Math.sin(t * 6) * 6, -232] : [40, -112],
      handR: [-36, -116],
      mouth: tTalk ? talkMouth(t, 'grin') : t > 23.6 ? 'smile' : 'grin',
      brow: tTalk ? 2 : 0,
    }, t);
    const writing = t > 21.0 && t < 22.5;
    const think = t < 21.0;
    const dTalk = speaking(t, 'Даня');
    drawPerson(c, DANYA, 905, 706, 1.0, {
      flip: true, rot: -0.05, seed: 0.3,
      handL: writing ? [150 + Math.sin(t * 14) * 8, -310 + Math.cos(t * 11) * 10] : think ? [12, -238] : [44, -110],
      handR: [-36, -114],
      look: think ? 1 : 0.4, lookUp: think ? 1 : 0, brow: think ? 3 : 0, browTilt: think ? 2 : 0,
      mouth: dTalk ? talkMouth(t, 'smile') : t > 22.5 ? 'smile' : think ? 'flat' : 'grin',
      eyes: t > 22.6 && t < 23.4 ? 'happy' : 'open',
    }, t);
    c.fillStyle = '#9b7148'; c.fillRect(330, 620, 440, 22);
    [[440, '#2f2f3a', BUZZ], [640, '#3e7c50', RED]].forEach(([xx, shirt, P]) => {
      rrect(c, xx - 58, 652, 116, 100, 30); c.fillStyle = shirt; c.fill();
      drawHair(c, P, xx, 628, t, false);
      ell(c, xx, 618, 34, 38, P.hair);
    });
    c.restore();
  }

  /* ---------- СЦЕНА 4: проектная, игра ---------- */
  function gameHero(t) {
    if (t < 29.5) { const k = seg(t, 27.2, 29.5); return { x: lerp(60, 430, k), y: 250 - Math.max(0, Math.sin(seg(t, 28.4, 29.2) * Math.PI)) * 70, vis: true }; }
    if (t < 30.4) { const k = seg(t, 29.5, 30.4); return { x: 450 + k * 30, y: 250 + k * k * 220, vis: true, glitch: true }; }
    if (t < 34.2) return { vis: false };
    const k = seg(t, 34.2, 36.2);
    const x = lerp(60, 700, k);
    const jump = Math.max(0, Math.sin(seg(t, 34.6, 35.4) * Math.PI)) * 90;
    return { x, y: 250 - jump, vis: true, win: t > 35.6 };
  }
  function s4(c, t) {
    c.fillStyle = vgrad(c, 0, H, ['#16213f', '#1f2d52', '#2a2f4f']); c.fillRect(0, 0, W, H);
    const z = lerp(1.02, 1.08, easeIO(seg(t, 26.8, 36.4)));
    c.save(); cam(c, z, 640, 360);
    c.fillStyle = 'rgba(255,255,255,0.04)'; for (let x = 0; x < W; x += 160) c.fillRect(x, 0, 2, 520);
    const SX = 220, SY = 64, SW = 840, SH = 350;
    glow(c, 640, 240, 560, 'rgba(90,170,255,0.22)');
    rrect(c, SX - 14, SY - 14, SW + 28, SH + 28, 14); c.fillStyle = '#0d1222'; c.fill();
    c.save(); c.beginPath(); c.rect(SX, SY, SW, SH); c.clip(); c.translate(SX, SY);
    c.fillStyle = vgrad(c, 0, SH, ['#5fb7ff', '#a8dcff']); c.fillRect(0, 0, SW, SH);
    for (let i = 0; i < 4; i++) { const cx = ((i * 260 + t * 20) % 1000) - 80; c.fillStyle = '#ffffff'; c.fillRect(cx, 50 + i * 18, 70, 18); c.fillRect(cx + 16, 34 + i * 18, 40, 18); }
    const plats = [[0, 274, 300], [360, 274, 140], [560, 244, 120], [720, 214, 120]];
    plats.forEach((p, i) => {
      const broken = i === 1 && t > 29.5 && t < 34.2;
      c.fillStyle = '#5bb34a'; c.fillRect(p[0], p[1], p[2], 14);
      c.fillStyle = '#8b5a33'; c.fillRect(p[0], p[1] + 14, p[2], 70);
      if (broken) { c.fillStyle = 'rgba(255,60,90,0.5)'; c.fillRect(p[0] + 50, p[1], 40, 84); }
    });
    c.fillStyle = '#ffffff'; c.fillRect(800, 120, 4, 94); c.fillStyle = '#ff5a5f'; c.beginPath(); c.moveTo(804, 122); c.lineTo(830, 132); c.lineTo(804, 142); c.fill();
    const hero = gameHero(t);
    if (hero.vis) {
      const jit = hero.glitch ? (Math.sin(t * 90) > 0 ? 4 : -4) : 0;
      c.fillStyle = hero.glitch ? 'rgba(255,90,140,0.9)' : '#ffcf3f'; c.fillRect(hero.x + jit, hero.y - 26, 24, 26);
      c.fillStyle = '#20202a'; c.fillRect(hero.x + 14 + jit, hero.y - 20, 4, 6);
    }
    if (t > 29.6 && t < 34.2) {
      for (let i = 0; i < 5; i++) { const yy = (i * 73 + t * 400) % SH; c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, yy, SW, 3); }
      c.fillStyle = 'rgba(20,20,40,0.55)'; c.fillRect(SW / 2 - 110, 20, 220, 44);
      c.fillStyle = '#ff6b8a'; c.font = '800 26px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ОШИБКА  404', SW / 2, 43);
    }
    if (hero.win) {
      const r = rng(3);
      for (let i = 0; i < 40; i++) { const k = seg(t, 35.6, 36.4); c.fillStyle = ['#ff5a5f', '#ffd23f', '#3ec1d3', '#7bd389'][i % 4]; c.fillRect(r() * SW, (r() * 0.4 + k * 0.8) * SH, 7, 10); }
    }
    c.restore();
    const gTalk = speaking(t, 'Одноклассница'), dTalk = speaking(t, 'Даня');
    const laugh = t > 33.3 && t < 34.2, cheer = t > 34.8;
    const typing = t > 33.3 && t < 34.6;
    const shake = laugh ? Math.sin(t * 30) * 2 : 0;
    drawPerson(c, RED, 330, 700, 0.95, {
      noLegs: true, look: 0.6, lookUp: 1, seed: 0.1, bob: shake,
      handL: gTalk ? [92, -330] : cheer ? [60, -330] : [44, -112], handR: cheer ? [-60, -330] : [-40, -112],
      mouth: gTalk ? talkMouth(t, 'o') : laugh || cheer ? 'laugh' : 'grin', eyes: laugh ? 'happy' : 'open', brow: gTalk ? 4 : 0,
    }, t);
    drawPerson(c, GLASSES, 952, 700, 0.92, {
      noLegs: true, look: -0.6, lookUp: 1, seed: 0.5, bob: shake,
      handL: cheer ? [60, -330] : [42, -112], handR: cheer ? [-60, -330] : [-30, -150],
      mouth: laugh || cheer ? 'laugh' : 'grin', eyes: laugh ? 'happy' : 'open',
    }, t);
    drawPerson(c, DANYA, 640, 712, 1.0, {
      noLegs: true, seed: 0.3, bob: shake, look: dTalk ? 0 : 0.2, lookUp: dTalk ? 0 : 0.8,
      handL: typing ? [30 + Math.sin(t * 40) * 6, -150] : cheer ? [66, -340] : [42, -114],
      handR: typing ? [-30 + Math.cos(t * 40) * 6, -150] : cheer ? [-66, -340] : [-42, -114],
      mouth: dTalk ? talkMouth(t, 'flat') : laugh || cheer ? 'laugh' : 'grin',
      eyes: laugh ? 'happy' : 'open', brow: dTalk ? -1 : 0,
    }, t);
    c.fillStyle = '#6b4c34'; c.fillRect(120, 612, 1040, 26);
    c.fillStyle = '#4e3626'; c.fillRect(120, 638, 1040, 120);
    [[330, '#c9ccd4'], [640, '#c9ccd4'], [952, '#c9ccd4']].forEach(([lx, col]) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(lx - 46, 612); c.lineTo(lx + 46, 612); c.lineTo(lx + 38, 576); c.lineTo(lx - 38, 576); c.closePath(); c.fill();
      circ(c, lx, 594, 5, '#9aa0ac');
    });
    c.restore();
    c.fillStyle = 'rgba(90,150,255,0.10)'; c.fillRect(0, 0, W, H);
  }

  /* ---------- СЦЕНА 5: река и SUP ---------- */
  function s5(c, t) {
    sky(c, ['#5fa8e6', '#a6d4f2', '#e5f3fb']);
    cloud(c, 200 + t * 6, 110, 0.9, 0.9); cloud(c, 820 + t * 4, 80, 0.7, 0.8);
    c.fillStyle = '#7fb36a'; c.beginPath(); c.moveTo(-50, 420); c.quadraticCurveTo(400, 300, 900, 360); c.quadraticCurveTo(1150, 330, 1350, 380); c.lineTo(1350, 470); c.lineTo(-50, 470); c.fill();
    drawSchool(c, SCHOOL_DAY, 930, 382, 0.21);
    for (let i = 0; i < 16; i++) roundTree(c, -40 + i * 90 + (i > 9 ? 120 : 0), 440 + (i % 2) * 8, 110 + (i % 3) * 20, 70 + i, i % 2 ? '#4f8a4b' : '#5d9a55', t);
    c.fillStyle = '#6aa457'; c.fillRect(-50, 436, 1400, 30);
    c.fillStyle = vgrad(c, 455, 720, ['#5d9cc4', '#3f7fae', '#2d6595']); c.fillRect(0, 455, W, 270);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2.4;
    for (let row = 0; row < 9; row++) {
      const y = 480 + row * 28, off = t * (30 + row * 6);
      c.beginPath();
      for (let x = -40; x < W + 40; x += 140) { const xx = ((x + off) % (W + 160)) - 80; c.moveTo(xx, y); c.quadraticCurveTo(xx + 20, y - 5, xx + 40, y); }
      c.stroke();
    }
    [[260, 505, 0.36, 0], [1090, 515, 0.36, 1.3]].forEach(([fx, fy, fs, ph]) => {
      ell(c, fx, fy + 4, 52 * fs * 2.2, 8 * fs * 2, '#ffffff');
      const st = Math.sin(t * 2.4 + ph);
      drawPerson(c, fx < 640 ? RED : BUZZ, fx, fy, fs, { vest: true, seed: ph, handL: [30, -190], handR: [-30, -150], paddle: [[-30 + st * 10, -230], [40 - st * 20, 40]], mouth: 'grin', look: 0 }, t);
    });
    const water = 610;
    let bx = 640, by = water + Math.sin(t * 2.2) * 3, rot = 0, o = { vest: true, seed: 0.3 };
    let hidden = false, headOnly = false;
    if (t < 39.3) {
      const w = seg(t, 36.0, 39.3), amp = 0.04 + w * 0.17;
      rot = Math.sin(t * 7.5) * amp;
      o.handL = [70 + Math.sin(t * 9) * 25, -230 + Math.cos(t * 8) * 30]; o.handR = [-70 - Math.sin(t * 8) * 25, -220 + Math.sin(t * 9.5) * 30];
      o.mouth = w > 0.5 ? 'o' : 'grin'; o.brow = w > 0.5 ? 5 : 1; o.footL = [26, 0]; o.footR = [-24, 0];
      o.look = Math.sin(t * 3) * 0.6;
    } else if (t < 39.9) {
      const k = seg(t, 39.3, 39.9);
      rot = lerp(0.2, 1.5, k * k); by += k * k * 60; o.mouth = 'o'; o.brow = 6;
      o.handL = [80, -280]; o.handR = [-80, -260];
    } else if (t < 41.2) hidden = true;
    else if (t < 43.4) { headOnly = true; }
    else {
      bx = lerp(470, 780, seg(t, 43.4, 46.4));
      const st = Math.sin(t * 3.2);
      o.paddle = [[-40 + st * 12, -250], [70 - st * 30, 60]];
      o.handL = [-30 + st * 12 + 18, -205]; o.handR = [-10 + st * 4, -110];
      o.mouth = 'smile'; o.footL = [22, 0]; o.footR = [-20, 0]; o.look = 0.6;
    }
    if (!headOnly) {
      c.save(); c.translate(bx, by);
      ell(c, 0, 6, 150, 17, '#f07a24'); ell(c, 0, 2, 140, 11, '#ff9a4a'); poly(c, [[-120, 2], [120, 2]], 3, '#ffffff');
      c.restore();
    } else {
      c.save(); c.translate(bx + 120, water + Math.sin(t * 2) * 4); c.rotate(0.1); ell(c, 0, 6, 150, 17, '#f07a24'); ell(c, 0, 2, 140, 11, '#ff9a4a'); c.restore();
    }
    if (!hidden && !headOnly) drawPerson(c, DANYA, bx, by - 6, 0.95, Object.assign(o, { rot }), t);
    if (headOnly) {
      const k = easeOut(seg(t, 41.2, 41.6));
      const dt = speaking(t, 'Даня');
      drawPerson(c, DANYA, bx - 40, water + 250 - k * 30 + Math.sin(t * 3) * 3, 0.95, {
        vest: true, wet: true, mouth: dt ? talkMouth(t, 'laugh') : 'laugh', eyes: dt ? 'open' : 'happy', seed: 0.3,
        handL: [70, -260 + Math.sin(t * 10) * 14], handR: [-70, -250],
      }, t);
      c.fillStyle = 'rgba(46,104,150,0.86)'; c.fillRect(0, water + 6, W, 200);
      for (let i = 0; i < 3; i++) {
        const r = ((t - 41.2) * 70 + i * 40) % 120;
        c.beginPath(); c.ellipse(bx - 40, water + 6, r, r * 0.22, 0, 0, TAU); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,' + (0.5 - r / 260) + ')'; c.stroke();
      }
    }
    if (t > 39.8 && t < 41.3) {
      const k = seg(t, 39.8, 41.3), r = rng(9);
      for (let i = 0; i < 46; i++) {
        const vx = (r() - 0.5) * 520, vy = -260 - r() * 260;
        const x = bx + 60 + vx * k, y = water + vy * k + 600 * k * k;
        if (y < water + 10) circ(c, x, y, 3 + r() * 5, 'rgba(225,245,255,' + (1 - k) + ')');
      }
      for (let i = 0; i < 3; i++) {
        const rr = k * 160 + i * 30;
        c.beginPath(); c.ellipse(bx + 60, water + 6, rr, rr * 0.2, 0, 0, TAU); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - k)) + ')'; c.stroke();
      }
      if (t > 40.1) for (let i = 0; i < 6; i++) circ(c, bx + 40 + i * 9, water + 20 - ((t - 40.1) * 80 + i * 14) % 30, 3, 'rgba(255,255,255,0.7)');
    }
    const flash = Math.max(0, 1 - Math.abs(t - 43.35) / 0.3);
    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash * 0.85 + ')'; c.fillRect(0, 0, W, H); }
    for (let i = 0; i < 18; i++) {
      const x = (i * 97 + t * 40) % W, y = 470 + (i * 53) % 240, a = Math.max(0, Math.sin(t * 5 + i * 2));
      c.fillStyle = 'rgba(255,255,255,' + a * 0.8 + ')'; c.fillRect(x, y, 10, 2);
    }
  }

  /* ---------- СЦЕНА 6: беседка, вечер ---------- */
  function s6(c, t) {
    sky(c, ['#3d3f7d', '#9a5f88', '#f19a6b', '#ffcf8a']);
    glow(c, 170, 470, 260, 'rgba(255,200,120,0.6)'); circ(c, 170, 470, 46, '#ffe2a6');
    c.fillStyle = '#4c5a3f'; c.fillRect(0, 520, W, 200);
    for (let i = 0; i < 8; i++) birch(c, -30 + i * 190 + (i % 2) * 40, 540, 280 + (i % 3) * 30, t, 30 + i);
    c.fillStyle = vgrad(c, 540, 720, ['#6a7a46', '#4b5a33']); c.fillRect(0, 540, W, 180);
    c.fillStyle = '#7a5a3c'; c.fillRect(190, 610, 900, 26); c.fillStyle = '#5e432c'; c.fillRect(190, 636, 900, 14);
    c.fillStyle = '#5e432c'; c.fillRect(330, 230, 14, 380); c.fillRect(936, 230, 14, 380);
    c.fillStyle = '#4a3322'; c.beginPath(); c.moveTo(150, 236); c.lineTo(640, 70); c.lineTo(1130, 236); c.closePath(); c.fill();
    c.fillStyle = '#6b4a30'; c.fillRect(160, 224, 960, 22);
    const bulbs = [];
    for (let i = 0; i <= 22; i++) { const k = i / 22, x = lerp(200, 1080, k), y = 262 + Math.sin(k * Math.PI) * 46; bulbs.push([x, y]); }
    poly(c, bulbs, 1.6, '#2c2420');
    bulbs.forEach((b, i) => { const f = 0.75 + Math.sin(t * 7 + i * 1.7) * 0.15; glow(c, b[0], b[1] + 6, 24, 'rgba(255,210,120,' + f * 0.55 + ')'); circ(c, b[0], b[1] + 6, 5, '#ffe7a8'); });
    const laugh = t > 47.4 && t < 48.3;
    const shake = laugh ? Math.sin(t * 28) * 2 : 0;
    const crowIn = t > 48.0, crowLand = 48.6;
    const crowNear = t > 48.6 && t < 50.6;
    const ppl = [
      [TUTOR, 400, 0.98, -0.2, 1.1], [RED, 525, 0.95, 0.5, 2.0], [DANYA, 660, 1.0, crowNear ? 0.9 : -0.2, 0.3],
      [GLASSES, 800, 0.95, -0.6, 2.7], [TEACHER, 915, 0.95, -0.7, 3.3],
    ];
    ppl.forEach(([P, x, s, look, seed]) => {
      const chat = !laugh && Math.sin(t * 2 + seed * 3) > 0.6 && P !== DANYA;
      let mouth = laugh ? 'laugh' : chat ? talkMouth(t + seed, 'grin') : 'grin';
      let eyes = laugh ? 'happy' : 'open';
      if (P === DANYA && t > 49.1 && t < 50.4) { mouth = 'laugh'; eyes = 'happy'; }
      drawPerson(c, P, x, 690, s, {
        noLegs: true, look, seed, bob: shake, mouth, eyes,
        handL: P === RED && t < 47.4 ? [60, -200] : [30, -128], handR: [-30, -128],
      }, t);
    });
    c.fillStyle = '#8a6646'; c.fillRect(300, 540, 690, 22); c.fillStyle = '#6e4f35'; c.fillRect(300, 562, 690, 10);
    c.fillStyle = '#6e4f35'; c.fillRect(330, 572, 16, 60); c.fillRect(944, 572, 16, 60);
    [[440, '#e9e2d6'], [585, '#f2b544'], [860, '#7cc1d6']].forEach(([mx, col]) => { rrect(c, mx - 12, 512, 24, 30, 4); c.fillStyle = col; c.fill(); });
    c.save(); c.translate(720, 536); c.rotate(-0.08); c.fillStyle = '#efe6d2'; c.fillRect(-40, -8, 80, 10); c.restore();
    if (crowIn) {
      let cx, cy, flying = false, tilt = 0, crust = false;
      if (t < crowLand) { const k = easeOut(seg(t, 48.0, crowLand)); cx = lerp(1320, 735, k); cy = lerp(300, 540, k) - Math.sin(k * Math.PI) * 40; flying = true; crust = true; }
      else if (t < 50.6) { cx = 735; cy = 540; crust = t < 48.85; tilt = t > 49.1 && t < 49.5 ? 0.45 : 0; }
      else { const k = seg(t, 50.6, 51.4); cx = 735 + k * 400; cy = 540 - Math.sin(k * Math.PI) * 120 - k * 180; flying = k > 0.15; }
      drawCrow(c, cx, cy, 0.85, { flip: t < 50.6, flying, tilt, crust }, t);
      if (t > 48.85 && t < 51.0) { rrect(c, 700, 534, 14, 7, 3); c.fillStyle = '#c98b45'; c.fill(); }
    }
    c.fillStyle = 'rgba(255,150,70,0.10)'; c.fillRect(0, 0, W, H);
  }

  /* ---------- СЦЕНА 7: финал ---------- */
  const RISERS = ['book', 'gamepad', 'laptop', 'brush', 'people', 'wrench', 'ball', 'paddle'];
  function s7(c, t) {
    const dusk = seg(t, 52, 58);
    sky(c, [lerp3('#5b4a8f', '#232a5a', dusk), lerp3('#d97b74', '#7a4f7f', dusk), lerp3('#ffc27a', '#f08a5d', dusk)]);
    for (let i = 0; i < 30; i++) { const r = rng(100 + i); const a = dusk * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))); circ(c, r() * W, r() * 260, 1.4, 'rgba(255,255,255,' + a + ')'); }
    const z = lerp(1.14, 1.0, easeIO(seg(t, 51.8, 60)));
    c.save(); cam(c, z, 760, 520);
    for (let i = 0; i < 18; i++) roundTree(c, -60 + i * 85, 600, 130 + (i % 3) * 30, 200 + i, '#3c4a3a', t);
    c.fillStyle = '#495a3e'; c.fillRect(-100, 585, 1500, 60);
    drawSchool(c, SCHOOL_DAY, 470, 632, 0.5);
    c.save(); c.globalAlpha = ease(seg(t, 52.5, 57)); drawSchool(c, SCHOOL_NIGHT, 470, 632, 0.5); c.restore();
    pine(c, 120, 640, 300, '#2b4433', '#223829');
    c.fillStyle = vgrad(c, 625, 760, ['#5d6c45', '#3d4a2e']); c.fillRect(-100, 625, 1500, 200);
    c.fillStyle = 'rgba(255,170,90,' + (0.25 * (1 - dusk)) + ')'; c.fillRect(-100, -100, 1500, 900);
    RISERS.forEach((ty, i) => {
      const t0 = 53.4 + i * 0.32, k = seg(t, t0, t0 + 4.5);
      if (k <= 0) return;
      const x = 690 + ((i * 137) % 520) + Math.sin(t * 1.3 + i) * 14, y = lerp(620, 120 + (i % 3) * 40, easeOut(k));
      const a = Math.min(1, k * 4) * (1 - seg(k, 0.75, 1) * 0.5);
      c.save(); c.globalAlpha = a;
      glow(c, x, y, 52, 'rgba(255,205,100,0.55)'); drawIcon(c, ty, x, y, 38, '#ffe39a', 2.8);
      c.restore();
    });
    const wave = Math.sin(t * 5) * 14 * (1 - seg(t, 55, 56));
    const push = seg(t, TL.title[0] - 1.6, TL.title[0] - 0.6);
    drawPerson(c, HERO, 900, 712, 1.06, {
      seed: 0.4, look: 0, mouth: 'smile', swept: push > 0.5,
      handL: push > 0 && push < 1 ? [lerp(40, 10, push), lerp(-150, -300, Math.sin(push * Math.PI))] : t > TL.title[1] ? [110 + wave * 0.3, -330 + wave] : [44, -112],
      handR: [-46, -112], footL: [22, 0], footR: [-20, 0], elbow: 'out', eyes: t > TL.title[2] ? 'happy' : 'open',
    }, t);
    c.restore();
    const ta = seg(t, TL.title[0], TL.title[0] + 0.6);
    if (ta > 0) {
      c.fillStyle = 'rgba(10,14,40,' + 0.55 * ta + ')'; c.fillRect(0, 0, W, H);
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 16;
      const words = [['Наша школа.', TL.title[0]], ['Твои возможности.', TL.title[1]], ['Твоё будущее.', TL.title[2]]];
      words.forEach(([w, t0], i) => {
        const k = easeOut(seg(t, t0, t0 + 0.5));
        c.globalAlpha = k; c.font = '800 58px ' + FONT; c.fillStyle = i === 2 ? '#f2b544' : '#ffffff';
        c.fillText(w, 640, 270 + i * 78 + (1 - k) * 18);
      });
      c.restore();
    }
  }
  function lerp3(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }


  /* ---------- КРЮЧОК: 10 000 часов ---------- */
  const fmtNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const MEM = (() => { const r = rng(42), set = new Set(); while (set.size < 9) set.add(Math.floor(r() * 200)); return set; })();
  function sHook(c, u) {
    c.fillStyle = vgrad(c, 0, H, ['#0e152e', '#19234b', '#111936']); c.fillRect(0, 0, W, H);
    const cx = 300, cy = 330, R = 150;
    glow(c, cx, cy, 300, 'rgba(242,181,68,0.10)');
    circ(c, cx, cy, R + 14, '#2b3563'); circ(c, cx, cy, R, '#f3eee3');
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU, r0 = i % 5 ? R - 10 : R - 22;
      poly(c, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)]], i % 5 ? 2 : 5, '#2b3150');
    }
    const spin = u < 5.4 ? u * u * 1.6 : 5.4 * 5.4 * 1.6 + (u - 5.4) * 2;
    const mA = spin * 2.2 - Math.PI / 2, hA = spin * 0.18 - Math.PI / 2;
    poly(c, [[cx, cy], [cx + Math.cos(hA) * 80, cy + Math.sin(hA) * 80]], 10, '#1d2440');
    poly(c, [[cx, cy], [cx + Math.cos(mA) * 125, cy + Math.sin(mA) * 125]], 6, '#d9534f');
    circ(c, cx, cy, 10, '#1d2440');
    const k = easeOut(seg(u, 1.0, 5.2));
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 118px ' + FONT; c.fillStyle = '#f2b544';
    c.shadowColor = 'rgba(242,181,68,0.35)'; c.shadowBlur = 24;
    c.fillText(fmtNum(Math.round(10000 * k)), 840, 150);
    c.shadowBlur = 0; c.font = '700 30px ' + FONT; c.fillStyle = '#b9c1dc';
    c.fillText('часов в школе', 840, 228);
    c.restore();
    const r = rng(77);
    for (let i = 0; i < 200; i++) {
      const col = i % 20, row = Math.floor(i / 20);
      let x = 600 + col * 24.5, y = 280 + row * 23;
      const appear = seg(u, 1.0 + (i / 200) * 4.0, 1.25 + (i / 200) * 4.0);
      const fs = 6.3 + r() * 1.6, drift = (r() - 0.5) * 80;
      if (appear <= 0) continue;
      const mem = MEM.has(i);
      let a = appear, fill = '#4a5688';
      if (u > 6.2) {
        if (mem) { fill = '#f2b544'; const g2 = seg(u, 6.4, 7.2); if (g2 > 0) glow(c, x + 10, y + 9, 30 * g2, 'rgba(242,181,68,0.5)'); }
        else if (u > fs) { const d = u - fs; y += 700 * d * d; x += drift * d; a = Math.max(0, 1 - d * 0.9); fill = '#3a4166'; }
      }
      if (a <= 0) continue;
      c.globalAlpha = a; rrect(c, x, y, 20, 18, 4); c.fillStyle = fill; c.fill(); c.globalAlpha = 1;
    }
  }

  /* ---------- ПРОБЛЕМА: класс на 30 человек ---------- */
  function greyC(hex, k = 0.18) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const y = 0.3 * r + 0.59 * g + 0.11 * b;
    const f = (v) => Math.round((y + (v - y) * k) * 0.95);
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function greyP(P) { const o = {}; for (const k in P) o[k] = typeof P[k] === 'string' ? greyC(P[k]) : P[k]; return o; }
  const KIDS = (() => {
    const base = [RED, GLASSES, BUZZ], shirts = ['#5d6a7a', '#7b6a5a', '#4f6d63', '#6a5a78', '#8a7f6a', '#56657e'], hairs = ['#3a2a20', '#6b4a2e', '#1f1b18', '#8a6a3e', '#b65a2a'];
    const r = rng(19), out = [];
    for (let i = 0; i < 30; i++) {
      const b = base[i % 3];
      out.push(Object.assign({}, b, { shirt: shirts[Math.floor(r() * shirts.length)], hair: hairs[Math.floor(r() * hairs.length)], hairStyle: ['short', 'long', 'buzz', 'bob'][Math.floor(r() * 4)], glasses: r() < 0.2, stripes: false }));
    }
    return out.map(greyP);
  })();
  const ROWS = [{ y: 292, s: 0.36, n: 9 }, { y: 380, s: 0.46, n: 8 }, { y: 488, s: 0.6, n: 7 }, { y: 628, s: 0.76, n: 6 }];
  function sProblem(c, u) {
    const z = lerp(1.0, 1.16, easeIO(seg(u, 0, 12.5)));
    c.save(); cam(c, z, 640, 470);
    c.fillStyle = '#c3c8bf'; c.fillRect(-100, -100, 1500, 900);
    c.fillStyle = '#a9ae9f'; c.fillRect(-100, 250, 1500, 700);
    c.fillStyle = '#6f6a5c'; c.fillRect(380, 30, 520, 190); c.fillStyle = '#3d4a40'; c.fillRect(392, 42, 496, 166);
    const rr = rng(5);
    for (let i = 0; i < 9; i++) { const y = 62 + i * 17; poly(c, [[410, y], [410 + 200 + rr() * 250, y]], 3, 'rgba(230,230,220,0.55)'); }
    const ck = [1090, 105];
    circ(c, ck[0], ck[1], 46, '#eee'); c.lineWidth = 4; c.strokeStyle = '#555'; c.beginPath(); c.arc(ck[0], ck[1], 46, 0, TAU); c.stroke();
    const sp = u < 4.3 ? u * 0.5 : u < 7.6 ? 2.15 + (u - 4.3) * 7 : 25.25 + (u - 7.6) * 0.5;
    poly(c, [ck, [ck[0] + Math.cos(sp - 1.57) * 36, ck[1] + Math.sin(sp - 1.57) * 36]], 4, '#333');
    poly(c, [ck, [ck[0] + Math.cos(sp / 12 - 1.57) * 22, ck[1] + Math.sin(sp / 12 - 1.57) * 22]], 6, '#333');
    const yr = clamp(1 + Math.floor(seg(u, 4.4, 7.4) * 10.99), 1, 11);
    c.fillStyle = '#f2f2ee'; c.fillRect(120, 50, 130, 140); c.fillStyle = '#7d7472'; c.fillRect(120, 50, 130, 30);
    c.fillStyle = '#333'; c.font = '800 64px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(yr), 185, 132);
    c.font = '700 18px ' + FONT; c.fillText('класс', 185, 176);
    const flip = (u * 3.3) % 1;
    if (u > 4.4 && u < 7.4) {
      c.save(); c.translate(185, 50 + flip * 260); c.rotate(flip * 2.4); c.globalAlpha = 1 - flip;
      c.fillStyle = '#f2f2ee'; c.fillRect(-65, 0, 130, 110); c.restore();
    }
    const ring = u > 4.3 && u < 5.4 ? Math.sin(u * 60) * 0.25 : 0;
    c.save(); c.translate(1200, 230); c.rotate(ring); circ(c, 0, 0, 26, '#8d8a80'); circ(c, 0, 0, 8, '#555'); c.restore();
    const bob = Math.sin(u * 4.2) * 3;
    let ki = 0, dx = 0;
    ROWS.forEach((row, ri) => {
      const span = 1180, step = span / row.n, x0 = 640 - span / 2 + step / 2;
      for (let j = 0; j < row.n; j++) {
        const x = x0 + j * step;
        const isD = ri === 2 && j === 3;
        if (!isD) {
          drawPerson(c, KIDS[ki++], x, row.y, row.s, { noLegs: true, bob, mouth: 'flat', look: 0, seed: ki * 0.37, handL: [48, -108 + bob], handR: [-48, -108 + bob], elbow: 'out', brow: -1 }, u);
        } else dx = x;
      }
      if (ri === 2) {
        const raise = Math.sin(seg(u, 7.9, 9.3) * Math.PI);
        const sad = u > 10.2;
        drawPerson(c, DANYA, dx, row.y, row.s, {
          noLegs: true, seed: 0.3, rot: u < 7.9 ? 0.05 : 0,
          handL: raise > 0.02 ? [40 + raise * 10, -150 - raise * 190] : u < 7.9 ? [12, -232] : [34, -132],
          handR: [-30, -132], headDy: u < 7.9 ? 6 : 0, look: u < 7.9 ? 0.6 : 0,
          mouth: sad ? 'flat' : u < 7.9 ? 'flat' : 'o', eyes: u < 7.9 && Math.sin(u * 1.3) > 0.85 ? 'closed' : 'open',
          brow: sad ? 3 : 0, browTilt: sad ? -3 : 0,
        }, u);
      }
      const dy = row.y - 118 * row.s;
      c.fillStyle = '#8c8776'; c.fillRect(-60, dy, 1400, 16 * row.s + 6);
      c.fillStyle = '#76715f'; c.fillRect(-60, dy + 16 * row.s + 6, 1400, 120 * row.s);
      if (ri === 2) {
        const nb = Math.floor(seg(u, 5.4, 7.6) * 6.99);
        for (let b = 0; b < nb; b++) { c.fillStyle = ['#7d7d80', '#8a8984', '#73766f'][b % 3]; c.fillRect(dx + 60 - b * 2, dy - 10 - b * 11, 70, 10); }
        if (u > 10.1) {
          const kk = easeOut(seg(u, 10.1, 10.5));
          c.save(); c.translate(dx - 50, dy - 2); c.rotate(-0.12); c.scale(kk, kk);
          c.fillStyle = '#fbfaf5'; c.fillRect(-40, -52, 80, 56);
          c.strokeStyle = '#d63a2f'; c.lineWidth = 4; c.beginPath(); c.arc(0, -24, 20, 0, TAU); c.stroke();
          c.fillStyle = '#d63a2f'; c.font = '800 34px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('2', 0, -22);
          c.restore();
        }
      }
    });
    c.restore();
    c.fillStyle = 'rgba(40,50,70,0.18)'; c.fillRect(0, 0, W, H);
  }

  /* ===== ВТОРОЙ ФИЛЬМ: «Из тетради — в реальность» ===== */
  const LT = (id, i) => (TL.L[id] || [])[i] || 0;
  function wheel(c, x, y, spin, r = 22) {
    circ(c, x, y, r, '#1d1f24'); circ(c, x, y, r * 0.45, '#9aa1ad');
    poly(c, [[x + Math.cos(spin) * r * 0.4, y + Math.sin(spin) * r * 0.4], [x - Math.cos(spin) * r * 0.4, y - Math.sin(spin) * r * 0.4]], 3, '#5d636e');
  }
  function drawKart(c, x, y, s, o = {}) {
    const b = o.build == null ? 1 : o.build, spin = o.spin || 0;
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(o.tilt || 0);
    if (b > 0.05) poly(c, [[-110, -30], [112, -30]], 8, '#3d424d');
    if (b > 0.3) {
      c.beginPath(); c.moveTo(-104, -30); c.lineTo(-94, -64); c.lineTo(-14, -64); c.lineTo(18, -47); c.lineTo(96, -47); c.lineTo(114, -30); c.closePath();
      c.fillStyle = '#e8742c'; c.fill(); c.fillStyle = '#ffffff'; c.fillRect(30, -44, 52, 6); circ(c, -48, -46, 11, '#ffffff');
      c.fillStyle = '#e8742c'; c.font = '800 14px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', -48, -45);
    }
    if (b > 0.5) { rrect(c, -82, -100, 26, 48, 8); c.fillStyle = '#22252c'; c.fill(); }
    if (b > 0.62) { poly(c, [[10, -52], [-8, -88]], 5, '#2f3440'); c.save(); c.translate(-8, -88); c.rotate(-0.4); ell(c, 0, 0, 4, 14, '#22252c'); c.restore(); }
    if (b > 0.75) wheel(c, -80, -20, spin);
    if (b > 0.9 && !o.lostFront) wheel(c, 82, -20, spin);
    c.restore();
  }
  function kartCowl(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-104, -30); c.lineTo(-94, -64); c.lineTo(-40, -64); c.lineTo(-40, -30); c.closePath(); c.fillStyle = '#e8742c'; c.fill();
    c.restore();
  }
  const SKETCH = (() => {
    const p = [[-150, -100], [150, -100], [150, 90], [-150, 90], [-150, -100], null, [-20, 90], [-30, 118], [30, 118], [20, 90], null,
      [-130, 60], [-40, 60], null, [-10, 30], [60, 30], null, [80, 0], [140, 0], null,
      [-110, 60], [-110, 38], [-92, 38], [-92, 60], null];
    for (let i = 0; i <= 12; i++) { const k = i / 12; p.push([lerp(-92, -5, k), 38 - Math.sin(k * Math.PI) * 40 - k * 10]); }
    [[25, 12], [110, -18]].forEach((cc) => { p.push(null); for (let i = 0; i <= 12; i++) p.push([cc[0] + Math.cos((i / 12) * TAU) * 6, cc[1] + Math.sin((i / 12) * TAU) * 6]); });
    p.push(null, [130, 0], [130, -40], [146, -33], [130, -26]);
    return p;
  })();
  function drawSketch(c, x, y, s, prog, col, w) {
    let total = 0; const segs = [];
    for (let i = 1; i < SKETCH.length; i++) { const a = SKETCH[i - 1], b = SKETCH[i]; if (!a || !b) continue; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, l]); total += l; }
    let left = prog * total, tip = null;
    c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = w / s;
    c.beginPath();
    for (const [a, b, l] of segs) {
      if (left <= 0) break;
      const f = Math.min(1, left / l); c.moveTo(a[0], a[1]); const e = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; c.lineTo(e[0], e[1]); tip = e; left -= l;
    }
    c.stroke(); c.restore();
    return tip ? [x + tip[0] * s, y + tip[1] * s] : null;
  }
  function sHookK(c, u) {
    const D = TL.sceneDur.hook;
    c.fillStyle = '#fbfaf3'; c.fillRect(0, 0, W, H);
    const z = lerp(1.08, 1.0, easeOut(seg(u, 0, 4)));
    c.save(); cam(c, z, 640, 360);
    c.strokeStyle = 'rgba(120,160,210,0.35)'; c.lineWidth = 1.4; c.beginPath();
    for (let x = 0; x < W; x += 28) { c.moveTo(x, -50); c.lineTo(x, H + 50); }
    for (let y = 0; y < H; y += 28) { c.moveTo(-50, y); c.lineTo(W + 50, y); }
    c.stroke(); poly(c, [[118, -50], [118, H + 50]], 2.5, 'rgba(220,90,90,0.6)');
    const p = seg(u, 0.4, LT('hook', 1) - 0.4);
    const gold = seg(u, LT('hook', 1) - 0.2, LT('hook', 1) + 0.6);
    const real = seg(u, LT('hook', 1) + 0.6, LT('hook', 1) + 1.6);
    const go = seg(u, D - 2.0, D - 0.3);
    const kx = 640;
    if (real < 1) {
      c.save(); c.globalAlpha = 1 - real;
      if (gold > 0) { c.shadowColor = 'rgba(242,181,68,' + gold + ')'; c.shadowBlur = 18 * gold; }
      const tip = drawSketch(c, 640, 360, 2.35, p, gold > 0 ? '#d79a22' : '#4a4a52', 3.2);
      c.restore();
      if (tip && p < 1) {
        c.save(); c.translate(tip[0], tip[1]); c.rotate(-0.7);
        c.fillStyle = '#f3c64a'; c.fillRect(0, -7, 120, 14); c.fillStyle = '#f2d6b0'; c.beginPath(); c.moveTo(0, -7); c.lineTo(-20, 0); c.lineTo(0, 7); c.fill();
        c.fillStyle = '#333'; c.beginPath(); c.moveTo(-14, -2.2); c.lineTo(-20, 0); c.lineTo(-14, 2.2); c.fill(); c.fillStyle = '#e88aa0'; c.fillRect(112, -7, 12, 14);
        c.restore();
      }
      c.save(); c.globalAlpha = (1 - real) * seg(u, 2.6, 3.2); c.font = 'italic 600 30px ' + FONT; c.fillStyle = '#4a4a52';
      c.fillText('jump!', 1010, 180); c.fillText('уровень 1', 160, 150); c.restore();
    }
    if (real > 0) {
      c.save(); c.globalAlpha = real;
      
      c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = 20; c.shadowOffsetY = 12;
      rrect(c, 640 - 372, 360 - 252, 744, 474, 18); c.fillStyle = '#20263a'; c.fill();
      c.fillStyle = '#20263a'; c.fillRect(600, 580, 80, 50); c.fillRect(560, 625, 160, 12);
      gameScreen(c, 640 - 352, 360 - 232, 704, 430, u, { hero: heroAt(seg(u, LT('hook', 1) + 1.2, D - 0.2)), got: Math.floor(seg(u, LT('hook', 1) + 1.2, D - 0.2) * 3.2) });
      c.restore();
    }
    c.restore();
  }

  function sProblem2(c, u) {
    const D = TL.sceneDur.problem;
    const row = ROWS[0], step = 1180 / row.n, hx = 640 - 590 + step / 2 + 6 * step;
    const z = lerp(1.0, 2.0, easeIO(seg(u, 0.3, D - 0.6)));
    c.save(); cam(c, z, lerp(640, hx, easeIO(seg(u, 0.3, D - 0.6))), lerp(470, 230, easeIO(seg(u, 0.3, D - 0.6))));
    c.fillStyle = '#c3c8bf'; c.fillRect(-100, -100, 1500, 900);
    c.fillStyle = '#a9ae9f'; c.fillRect(-100, 250, 1500, 700);
    c.fillStyle = '#6f6a5c'; c.fillRect(380, 30, 520, 190); c.fillStyle = '#3d4a40'; c.fillRect(392, 42, 496, 166);
    const par = 14 + Math.floor(seg(u, LT('problem', 1), LT('problem', 2)) * 13.99);
    c.fillStyle = 'rgba(230,230,220,0.85)'; c.font = '800 80px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('§ ' + par, 640, 125);
    const ck = [1090, 105];
    circ(c, ck[0], ck[1], 46, '#eee'); c.lineWidth = 4; c.strokeStyle = '#555'; c.beginPath(); c.arc(ck[0], ck[1], 46, 0, TAU); c.stroke();
    const sp = u * 1.4;
    poly(c, [ck, [ck[0] + Math.cos(sp - 1.57) * 36, ck[1] + Math.sin(sp - 1.57) * 36]], 4, '#333');
    poly(c, [ck, [ck[0] + Math.cos(sp / 12 - 1.57) * 22, ck[1] + Math.sin(sp / 12 - 1.57) * 22]], 6, '#333');
    const bob = Math.sin(u * 4.2) * 3;
    let ki = 0;
    ROWS.forEach((rw, ri) => {
      const st = 1180 / rw.n, x0 = 640 - 590 + st / 2;
      for (let j = 0; j < rw.n; j++) {
        const x = x0 + j * st;
        if (ri === 0 && j === 6) {
          const down = u > LT('problem', 2);
          drawPerson(c, HERO, x, rw.y, rw.s, {
            noLegs: true, seed: 0.4, bangsLong: true, headDy: down ? 8 : 4, lookUp: -1, look: -0.2,
            handL: [24 + Math.sin(u * 7) * 5, -150], handR: [-26, -140], mouth: down ? 'flat' : 'grin',
          }, u);
          continue;
        }
        drawPerson(c, KIDS[ki++ % KIDS.length], x, rw.y, rw.s, { noLegs: true, bob, mouth: 'flat', look: 0, seed: ki * 0.37, handL: [48, -108 + bob], handR: [-48, -108 + bob], elbow: 'out', brow: -1 }, u);
      }
      const dy = rw.y - 118 * rw.s;
      c.fillStyle = '#8c8776'; c.fillRect(-60, dy, 1400, 16 * rw.s + 6);
      c.fillStyle = '#76715f'; c.fillRect(-60, dy + 16 * rw.s + 6, 1400, 120 * rw.s);
      if (ri === 0) {
        c.fillStyle = '#f4f2ea'; c.fillRect(hx - 22, dy - 3, 44, 7);
        const fade = 1 - seg(u, LT('problem', 2), LT('problem', 2) + 2.2);
        const a = seg(u, 0.6, 1.6) * fade;
        if (a > 0) {
          c.save(); c.globalAlpha = a; c.shadowColor = 'rgba(242,181,68,0.9)'; c.shadowBlur = 10;
          drawSketch(c, hx, dy - 40 - Math.sin(u * 2) * 3, 0.16, 1, '#f2b544', 1.6);
          drawIcon(c, 'gamepad', hx + 36, dy - 72 - Math.sin(u * 2 + 1) * 3, 22, '#f2b544', 2.4);
          c.restore();
        }
        if (fade < 1 && fade > 0) { c.save(); c.globalAlpha = 1 - fade; drawSketch(c, hx, dy - 40, 0.16, 1, 'rgba(120,120,120,0.5)', 1.4); c.restore(); }
      }
    });
    c.restore();
    c.fillStyle = 'rgba(40,50,70,0.18)'; c.fillRect(0, 0, W, H);
  }

  function roomBg(c, t) {
    c.fillStyle = '#efe2cb'; c.fillRect(-100, -100, 1500, 900);
    c.fillStyle = '#c99a68'; c.fillRect(-100, 520, 1500, 300);
    c.fillStyle = '#b4895c'; for (let x = -100; x < 1500; x += 120) c.fillRect(x, 520, 3, 300);
    c.fillStyle = '#9b7148'; c.fillRect(-100, 512, 1500, 12);
    c.fillStyle = '#f7f2e8'; c.fillRect(30, 110, 200, 300);
    c.fillStyle = vgrad(c, 120, 400, ['#9ccbe8', '#dceff8']); c.fillRect(42, 122, 176, 276);
    roundTree(c, 150, 420, 300, 4, '#6aa253', t);
    c.fillStyle = '#f7f2e8'; c.fillRect(126, 122, 8, 276); c.fillRect(42, 230, 176, 8);
    c.fillStyle = 'rgba(255,240,200,0.22)'; c.beginPath(); c.moveTo(42, 122); c.lineTo(218, 122); c.lineTo(560, 700); c.lineTo(260, 700); c.fill();
    c.fillStyle = '#8a6a45'; c.fillRect(312, 92, 716, 360);
    c.fillStyle = '#2f4a3d'; c.fillRect(326, 106, 688, 332);
  }
  function sClass2(c, u) {
    const D = TL.sceneDur.cls, l2 = LT('cls', 1);
    c.save(); cam(c, lerp(1.0, 1.06, easeIO(seg(u, 0, D))), 640, 380);
    roomBg(c, u);
    const chalk = 'rgba(240,240,228,0.92)';
    const bp = seg(u, l2, l2 + 2.6);
    if (bp > 0) {
      drawSketch(c, 560, 290, 1.05, bp, chalk, 3);
      const ap = 0;
      if (ap > 0) {
        poly(c, [[380, 300], [380 + 110 * ap, 300]], 4, '#ffd76a');
        poly(c, [[490, 300], [478, 292]], 4, ap > 0.95 ? '#ffd76a' : 'transparent');
        poly(c, [[490, 300], [478, 308]], 4, ap > 0.95 ? '#ffd76a' : 'transparent');
      }
      c.save(); c.globalAlpha = seg(u, l2 + 1.6, l2 + 2.4); c.font = '700 40px ' + FONT; c.fillStyle = chalk; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('y = v·t − g·t²/2', 735, 330); c.fillText('if (jump) vy = −8', 735, 390); c.restore();
    } else {
      [[150, 380], [200, 300], [250, 420]].forEach(([y, w]) => poly(c, [[370, y], [370 + w, y]], 3, 'rgba(240,240,228,0.5)'));
    }
    [[RED, 860, 0.7, 1.2], [BUZZ, 1010, 0.72, 2.2]].forEach(([P, x, s, sd]) => drawPerson(c, P, x, 650, s, { noLegs: true, seed: sd, look: -0.6, lookUp: 0.6, mouth: 'grin', handL: [40, -120], handR: [-40, -120] }, u));
    c.fillStyle = '#9b7148'; c.fillRect(780, 572, 300, 16); c.fillStyle = '#7f5b38'; c.fillRect(780, 588, 300, 80);
    const walk = seg(u, 0.4, 2.2);
    let tx = lerp(1060, 690, easeIO(walk)), tO = { seed: 0.6, flip: true, look: 1 };
    if (walk > 0 && walk < 1) {
      const ph = u * 8;
      tO.footL = [5 + 26 * Math.sin(ph), -10 * Math.max(0, Math.cos(ph))]; tO.footR = [-5 - 26 * Math.sin(ph), -10 * Math.max(0, -Math.cos(ph))];
      tO.handL = [34 - 20 * Math.sin(ph), -112]; tO.handR = [-34 + 20 * Math.sin(ph), -112]; tO.mouth = 'grin';
    } else if (walk >= 1) {
      tO.rot = -0.08; tO.lookUp = -0.8; tO.mouth = u > 2.6 ? 'smile' : 'o'; tO.brow = 3;
      if (u > l2) { tO.flip = false; tO.look = 0.6; tO.lookUp = 0.6; tO.rot = 0; tO.handL = [90 + Math.sin(u * 3) * 6, -280]; tO.mouth = 'smile'; }
    }
    drawPerson(c, TEACHER, tx, 712, 1.0, tO, u);
    const noticed = u > 2.4;
    drawPerson(c, HERO, 440, 745, 1.05, {
      noLegs: true, seed: 0.4, look: noticed ? 0.9 : 0, lookUp: noticed ? 1 : -1, headDy: noticed ? 0 : 6,
      handL: noticed ? [54, -116] : [44 + Math.sin(u * 9) * 8, -120], handR: [-52, -116], elbow: 'out',
      mouth: noticed ? (u > 3.2 ? 'smile' : 'o') : 'grin', brow: noticed && u < 3.2 ? 4 : 0, eyes: 'open',
    }, u);
    c.fillStyle = '#9b7148'; c.fillRect(250, 618, 470, 20); c.fillStyle = '#7f5b38'; c.fillRect(250, 638, 470, 90);
    c.fillStyle = '#fbfaf3'; c.save(); c.translate(445, 612); c.rotate(-0.05); c.fillRect(-70, -10, 140, 14); c.restore();
    c.restore();
  }

  function sTutor2(c, u) {
    const D = TL.sceneDur.tutor;
    c.save(); cam(c, lerp(1.04, 1.0, easeOut(seg(u, 0, D))), 640, 360);
    c.fillStyle = '#efe3cf'; c.fillRect(-100, -100, 1500, 900);
    c.fillStyle = '#f7f2e8'; c.fillRect(1010, 90, 220, 330); c.fillStyle = vgrad(c, 100, 410, ['#a7d2ea', '#e6f3fa']); c.fillRect(1022, 102, 196, 306);
    glow(c, 1120, 260, 320, 'rgba(255,236,190,0.35)');
    c.fillStyle = '#8f6a43'; c.fillRect(430, 70, 420, 250); c.fillStyle = '#c99f6c'; c.fillRect(442, 82, 396, 226);
    const notes = [[520, 190, 'target', '#f7dc6a'], [640, 160, 'list', '#9fe0c2'], [760, 200, 'cal', '#f6b0a6']];
    notes.forEach(([x, y, ty, col], i) => {
      const k = easeOut(seg(u, 0.6 + i * 1.0, 0.95 + i * 1.0));
      if (k <= 0) return;
      c.save(); c.translate(x, y); c.rotate((i - 1) * 0.06); c.scale(k, k);
      c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.fillStyle = col; c.fillRect(-46, -46, 92, 92); c.shadowColor = 'transparent';
      c.strokeStyle = '#3a3a44'; c.lineWidth = 3; c.lineCap = 'round';
      if (ty === 'target') { [26, 16, 6].forEach((r) => { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }); }
      else if (ty === 'list') { for (let j = 0; j < 3; j++) { c.strokeRect(-30, -24 + j * 18, 9, 9); poly(c, [[-14, -20 + j * 18], [28, -20 + j * 18]], 3, '#3a3a44'); } }
      else { c.strokeRect(-28, -24, 56, 50); for (let j = 1; j < 4; j++) poly(c, [[-28 + j * 14, -12], [-28 + j * 14, 26]], 2, '#3a3a44'); poly(c, [[-28, -12], [28, -12]], 2, '#3a3a44'); }
      c.restore();
      if (i > 0) {
        const ap = seg(u, 0.4 + i * 1.0, 0.8 + i * 1.0); const px = notes[i - 1][0] + 50, py = notes[i - 1][1];
        poly(c, [[px, py], [lerp(px, x - 50, ap), lerp(py, y, ap)]], 4, '#e3a321');
      }
    });
    drawPerson(c, TUTOR, 400, 800, 1.05, {
      noLegs: true, seed: 1.1, look: 0.8, mouth: Math.sin(u * 2.5) > 0 ? talkMouth(u, 'grin') : 'smile',
      handL: u > 0.6 && u < 3.2 ? [95, -300 + Math.sin(u * 4) * 10] : [60, -150], handR: [-40, -140],
    }, u);
    drawPerson(c, HERO, 880, 800, 1.05, {
      noLegs: true, seed: 0.4, swept: true, look: -0.8, lookUp: 0.4, headDy: Math.max(0, Math.sin(u * 5)) * 3 * seg(u, 2.5, 3),
      mouth: u > 2.6 ? 'smile' : 'grin', handL: [52, -116], handR: [-52, -116], elbow: 'out',
    }, u);
    ell(c, 640, 650, 420, 70, '#9b7148'); ell(c, 640, 640, 410, 60, '#b8895a');
    [[520, '#e9e2d6'], [760, '#7cc1d6']].forEach(([mx, col]) => { rrect(c, mx - 14, 600, 28, 34, 5); c.fillStyle = col; c.fill(); });
    c.save(); c.translate(640, 630); c.rotate(0.04); c.fillStyle = '#fbfaf3'; c.fillRect(-60, -12, 120, 18); drawSketch(c, 0, -2, 0.18, 1, '#4a4a52', 1.2); c.restore();
    c.restore();
  }

  /* ===== игра ученика ===== */
  const LEVEL = { plats: [[0, 360, 230], [290, 330, 150], [500, 290, 130], [680, 250, 120]], coins: [[340, 290], [560, 250], [720, 200]], flag: [760, 250] };
  function heroAt(k, bug) {
    const pts = [[40, 360], [200, 360], [330, 330], [540, 290], [740, 250]];
    const f = clamp(k) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), r = f - i;
    let x = lerp(pts[i][0], pts[i + 1][0], r), y = lerp(pts[i][1], pts[i + 1][1], r) - Math.sin(r * Math.PI) * (i > 0 ? 70 : 0);
    if (bug != null && k > bug) { const d = (k - bug) * 6; x = lerp(pts[2][0], pts[2][0] + 20, Math.min(1, d)); y = pts[2][1] + d * d * 260; }
    return [x, y];
  }
  function gameScreen(c, x, y, w, h, t, o = {}) {
    const tiles = o.tiles == null ? 1 : o.tiles;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); c.scale(w / 800, h / 450);
    c.fillStyle = vgrad(c, 0, 450, ['#5fb7ff', '#b4e1ff']); c.fillRect(0, 0, 800, 450);
    for (let i = 0; i < 4; i++) { const cx = ((i * 230 + t * 18) % 960) - 80; c.fillStyle = '#ffffff'; c.fillRect(cx, 50 + i * 20, 70, 18); c.fillRect(cx + 16, 34 + i * 20, 40, 18); }
    LEVEL.plats.forEach((p, i) => {
      const k = clamp(tiles * 4 - i);
      if (k <= 0) return;
      c.globalAlpha = k; c.fillStyle = '#5bb34a'; c.fillRect(p[0], p[1], p[2] * k, 14); c.fillStyle = '#8b5a33'; c.fillRect(p[0], p[1] + 14, p[2] * k, 120);
      if (o.bugPlat && i === 1) { c.fillStyle = 'rgba(255,60,90,0.45)'; c.fillRect(p[0] + 40, p[1], 50, 134); }
      c.globalAlpha = 1;
    });
    if (tiles >= 0.95) {
      LEVEL.coins.forEach((cn, i) => { if (o.got && o.got > i) return; const b = Math.sin(t * 4 + i) * 4; circ(c, cn[0], cn[1] + b, 11, '#ffd23f'); circ(c, cn[0] - 3, cn[1] + b - 3, 3, '#fff3b0'); });
      c.fillStyle = '#ffffff'; c.fillRect(LEVEL.flag[0], LEVEL.flag[1] - 90, 5, 90); c.fillStyle = '#ff5a5f'; c.beginPath(); c.moveTo(LEVEL.flag[0] + 5, LEVEL.flag[1] - 88); c.lineTo(LEVEL.flag[0] + 34, LEVEL.flag[1] - 76); c.lineTo(LEVEL.flag[0] + 5, LEVEL.flag[1] - 64); c.fill();
    }
    if (o.hero) {
      const [hx, hy] = o.hero, sp = o.sprite == null ? 1 : o.sprite;
      c.globalAlpha = sp; c.fillStyle = o.glitch ? 'rgba(255,90,140,0.9)' : '#ffcf3f'; c.fillRect(hx - 13, hy - 30, 26, 30);
      c.fillStyle = '#9a7247'; c.fillRect(hx - 14, hy - 34, 28, 10); c.fillStyle = '#20202a'; c.fillRect(hx + 4, hy - 22, 4, 6); c.globalAlpha = 1;
    }
    if (o.label) {
      c.fillStyle = 'rgba(20,20,40,0.6)'; c.fillRect(300, 24, 200, 52); c.fillStyle = '#ff6b8a'; c.font = '800 32px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.label, 400, 51);
    }
    if (o.win) { const r = rng(3); for (let i = 0; i < 46; i++) { c.fillStyle = ['#ff5a5f', '#ffd23f', '#3ec1d3', '#7bd389'][i % 4]; c.fillRect(r() * 800, (r() * 0.4 + o.win * 0.8) * 450, 8, 12); } }
    c.restore();
  }
  function sStudio(c, u) {
    const D = TL.sceneDur.garage;
    c.fillStyle = vgrad(c, 0, H, ['#16213f', '#1f2d52', '#2a2f4f']); c.fillRect(0, 0, W, H);
    c.save(); cam(c, lerp(1.0, 1.06, easeIO(seg(u, 0, D))), 640, 360);
    glow(c, 640, 220, 560, 'rgba(90,170,255,0.22)');
    rrect(c, 226, 46, 828, 348, 14); c.fillStyle = '#0d1222'; c.fill();
    const tiles = seg(u, 0.4, D - 1.6), spr = seg(u, 1.2, D - 1.2);
    gameScreen(c, 240, 60, 800, 320, u, { tiles, hero: [120, 360], sprite: spr });
    c.save(); c.globalAlpha = 0.35 * (1 - tiles); c.strokeStyle = '#9fd1ff'; c.lineWidth = 1;
    for (let x = 240; x < 1040; x += 40) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x, 380); c.stroke(); }
    for (let y = 60; y < 380; y += 40) { c.beginPath(); c.moveTo(240, y); c.lineTo(1040, y); c.stroke(); }
    c.restore();
    const typing = u < D - 1.3;
    drawPerson(c, HERO, 500, 712, 1.0, {
      noLegs: true, seed: 0.4, swept: true, look: 0.2, lookUp: typing ? 0.6 : 0,
      handL: typing ? [40 + Math.sin(u * 38) * 6, -122] : [66, -330], handR: typing ? [-40 + Math.cos(u * 40) * 6, -122] : [-46, -114], elbow: 'out',
      mouth: typing ? 'grin' : 'laugh', eyes: typing ? 'open' : 'happy',
    }, u);
    drawPerson(c, RED, 820, 712, 0.95, {
      noLegs: true, seed: 1.2, look: -0.4, lookUp: -0.6, handL: [30 + Math.sin(u * 6) * 10, -128], handR: [-40, -120], elbow: 'out', mouth: typing ? 'grin' : 'laugh',
    }, u);
    c.fillStyle = '#6b4c34'; c.fillRect(160, 612, 960, 26); c.fillStyle = '#4e3626'; c.fillRect(160, 638, 960, 120);
    c.fillStyle = '#c9ccd4'; c.beginPath(); c.moveTo(440, 612); c.lineTo(560, 612); c.lineTo(548, 566); c.lineTo(452, 566); c.closePath(); c.fill();
    rrect(c, 760, 590, 120, 22, 5); c.fillStyle = '#2b2f3a'; c.fill(); rrect(c, 770, 593, 100, 15, 3); c.fillStyle = '#3ec1d3'; c.fill();
    if (typing) for (let i = 0; i < 5; i++) { const yy = 520 - ((u * 60 + i * 30) % 120); c.fillStyle = 'rgba(160,220,255,' + (0.6 - (520 - yy) / 240) + ')'; c.font = '700 16px ' + FONT; c.textAlign = 'center'; c.fillText(['{ }', 'jump()', 'x += v', 'if', '< >'][i], 500 + (i - 2) * 40, yy); }
    c.restore();
    c.fillStyle = 'rgba(90,150,255,0.08)'; c.fillRect(0, 0, W, H);
  }
  function sPlay(c, u) {
    const D = TL.sceneDur.test;
    c.fillStyle = vgrad(c, 0, H, ['#1d2547', '#2b335a', '#30355a']); c.fillRect(0, 0, W, H);
    c.save(); cam(c, lerp(1.02, 1.08, easeIO(seg(u, 0, D))), 640, 360);
    glow(c, 640, 220, 600, 'rgba(255,200,120,0.12)');
    rrect(c, 226, 46, 828, 348, 14); c.fillStyle = '#0d1222'; c.fill();
    const run1 = u < 3.0;
    let opt;
    if (run1) { const k = seg(u, 0.2, 2.6); opt = { hero: heroAt(k * 0.7, 0.45), bugPlat: k > 0.6, glitch: k * 0.7 > 0.45, label: k * 0.7 > 0.5 ? 'БАГ!' : null }; }
    else { const k = seg(u, 3.3, D - 1.0); opt = { hero: heroAt(k), got: Math.floor(k * 3.2), win: seg(u, D - 1.1, D) || 0 }; }
    gameScreen(c, 240, 60, 800, 320, u, opt);
    const laugh = run1 && u > 2.0, fixing = u > 2.5 && u < 3.3, cheer = !run1 && u > D - 1.2;
    const sh = laugh ? Math.sin(u * 28) * 2 : 0;
    drawPerson(c, GLASSES, 330, 712, 0.92, { noLegs: true, seed: 2.7, bob: sh, look: 0.4, lookUp: 0.8, handL: cheer ? [60, -330] : [30, -130], handR: cheer ? [-60, -330] : [-30, -130], elbow: 'out', mouth: laugh || cheer ? 'laugh' : 'o', eyes: laugh ? 'happy' : 'open' }, u);
    drawPerson(c, BUZZ, 950, 712, 0.92, { noLegs: true, seed: 2.2, bob: sh, look: -0.4, lookUp: 0.8, handL: cheer ? [60, -330] : [30, -130], handR: cheer ? [-60, -330] : [-30, -130], elbow: 'out', mouth: laugh || cheer ? 'laugh' : 'grin', eyes: laugh ? 'happy' : 'open' }, u);
    drawPerson(c, HERO, 640, 712, 1.0, {
      noLegs: true, seed: 0.4, swept: true, bob: sh, look: 0, lookUp: fixing ? -0.6 : 0.8,
      handL: cheer ? [66, -340] : fixing ? [40 + Math.sin(u * 40) * 6, -122] : [52, -116], handR: cheer ? [-66, -340] : fixing ? [-40, -122] : [-52, -116], elbow: 'out',
      mouth: laugh || cheer ? 'laugh' : fixing ? 'flat' : u > 1.6 && run1 ? 'o' : 'grin', eyes: laugh || cheer ? 'happy' : 'open', brow: run1 && u > 1.6 ? 4 : 0,
    }, u);
    c.fillStyle = '#6b4c34'; c.fillRect(160, 612, 960, 26); c.fillStyle = '#4e3626'; c.fillRect(160, 638, 960, 120);
    [[330, 580], [950, 580]].forEach(([gx, gy]) => { rrect(c, gx - 34, gy, 68, 26, 12); c.fillStyle = '#2b2f3a'; c.fill(); circ(c, gx + 16, gy + 10, 4, '#ff5a5f'); });
    c.fillStyle = '#c9ccd4'; c.beginPath(); c.moveTo(580, 612); c.lineTo(700, 612); c.lineTo(688, 566); c.lineTo(592, 566); c.closePath(); c.fill();
    c.restore();
    const flash = Math.max(0, 1 - Math.abs(u - 3.15) / 0.25);
    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash * 0.8 + ')'; c.fillRect(0, 0, W, H); }
  }

  function sGarage(c, u) {
    const D = TL.sceneDur.garage;
    c.save(); cam(c, lerp(1.0, 1.08, easeIO(seg(u, 0, D))), 640, 420);
    c.fillStyle = vgrad(c, 0, 560, ['#4e5563', '#646b79']); c.fillRect(-100, -100, 1500, 700);
    c.fillStyle = vgrad(c, 560, 760, ['#9d9a92', '#85827a']); c.fillRect(-100, 560, 1500, 300);
    c.fillStyle = vgrad(c, 60, 560, ['#bfe0f5', '#e9f5e3']); c.fillRect(840, 60, 400, 500);
    c.fillStyle = '#7fb85d'; c.fillRect(840, 470, 400, 90);
    drawSchool(c, SCHOOL_DAY, 1060, 480, 0.3);
    c.fillStyle = '#3b404a'; c.fillRect(828, 40, 424, 34); for (let y = 40; y < 74; y += 8) { c.fillStyle = '#4a505b'; c.fillRect(828, y, 424, 3); }
    c.fillStyle = 'rgba(255,240,200,0.18)'; c.beginPath(); c.moveTo(840, 74); c.lineTo(1240, 74); c.lineTo(900, 720); c.lineTo(300, 720); c.fill();
    c.fillStyle = '#c8a979'; c.fillRect(70, 90, 500, 290);
    c.fillStyle = 'rgba(80,60,30,0.45)'; for (let x = 90; x < 560; x += 22) for (let y = 108; y < 370; y += 22) c.fillRect(x, y, 4, 4);
    c.save(); c.translate(150, 170); c.rotate(-0.6); poly(c, [[0, 0], [0, 110]], 10, '#3b3f48'); c.beginPath(); c.arc(0, -10, 16, 0.5, 5.8); c.lineWidth = 9; c.strokeStyle = '#3b3f48'; c.stroke(); c.restore();
    poly(c, [[260, 130], [260, 270]], 9, '#7a5a3a'); c.fillStyle = '#3b3f48'; c.fillRect(232, 120, 56, 26);
    c.fillStyle = '#9aa1ad'; c.beginPath(); c.moveTo(340, 130); c.lineTo(470, 130); c.lineTo(470, 175); c.lineTo(340, 205); c.closePath(); c.fill(); c.fillStyle = '#7a5a3a'; c.fillRect(470, 120, 40, 60);
    poly(c, [[520, 140], [520, 300]], 8, '#d64a3a'); poly(c, [[520, 300], [520, 340]], 3, '#9aa1ad');
    c.fillStyle = '#6b4c34'; c.fillRect(40, 470, 380, 26); c.fillStyle = '#4e3626'; c.fillRect(56, 496, 16, 120); c.fillRect(390, 496, 16, 120);
    c.fillStyle = '#3b404a'; c.fillRect(300, 440, 50, 30);
    const build = lerp(0.55, 1.0, seg(u, 0.4, D - 1.4));
    const kx = 600, ky = 640, ks = 1.55;
    c.fillStyle = '#5a5f6a'; c.fillRect(kx - 120, ky - 6, 30, 8); c.fillRect(kx + 100, ky - 6, 30, 8);
    drawKart(c, kx, ky, ks, { build });
    const working = u < D - 1.2;
    const hb = working ? Math.sin(u * 10) * 6 : 0;
    drawPerson(c, BUZZ, 360, 712, 0.95, { seed: 2.2, look: 1, handL: [70, -150], handR: [40, -160], goggles: true, mouth: u > D - 1.4 ? 'laugh' : 'grin' }, u);
    drawPerson(c, HERO, 905, 712, 1.0, {
      flip: true, seed: 0.4, swept: true, goggles: true, apron: true, bob: working ? 24 : 0, rot: working ? -0.18 : 0,
      handL: working ? [150 + hb, -95] : [60, -320], handR: working ? [70, -70] : [-44, -112], look: 0.6, lookUp: working ? -1 : 0,
      mouth: working ? 'flat' : 'laugh', eyes: working ? 'open' : 'happy', footL: [26, 0], footR: [-20, 0],
    }, u);
    if (working && Math.sin(u * 10) > 0.6) for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.25; poly(c, [[kx + 127, ky - 31], [kx + 127 + Math.cos(a) * 26, ky - 31 + Math.sin(a) * 26]], 2.5, '#ffd76a'); }
    c.restore();
  }

  function sTest(c, u) {
    const D = TL.sceneDur.test;
    sky(c, ['#69ade6', '#b3d9f3', '#eef7fb']);
    cloud(c, 200 + u * 10, 110, 0.8, 0.85); cloud(c, 900 + u * 6, 80, 0.6, 0.7);
    c.fillStyle = '#86bb6c'; c.fillRect(0, 430, W, 300);
    for (let i = 0; i < 14; i++) roundTree(c, -40 + i * 100, 440, 120 + (i % 3) * 20, 300 + i, i % 2 ? '#4f8a4b' : '#5d9a55', u);
    drawSchool(c, SCHOOL_DAY, 300, 470, 0.33);
    c.fillStyle = '#7ab35e'; c.fillRect(0, 466, W, 254);
    c.fillStyle = '#d9c7a1'; c.fillRect(0, 560, W, 100); c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(0, 560, W, 6);
    [[230, 548], [520, 548], [810, 548], [1100, 548], [380, 672], [960, 672]].forEach(([x, y]) => { c.fillStyle = '#f07a24'; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x, y - 30); c.lineTo(x + 12, y); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 6, y - 16, 12, 4); });
    const run1 = u < 3.0, ph2 = seg(u, 3.3, D - 0.2);
    const cheer = !run1 && u > 3.6, laugh = run1 && u > 2.2;
    const fans = [[RED, 760, 1.2], [GLASSES, 860, 2.7], [TUTOR, 960, 1.1], [BUZZ, 1060, 2.2]];
    fans.forEach(([P, x, sd]) => drawPerson(c, P, x, 540, 0.62, {
      seed: sd, look: run1 ? -0.5 : 0, mouth: cheer || laugh ? 'laugh' : 'grin', eyes: laugh ? 'happy' : 'open',
      handL: cheer ? [60, -330 + Math.sin(u * 9 + sd) * 12] : laugh ? [24, -270] : [42, -112], handR: cheer ? [-60, -330] : laugh ? [-24, -270] : [-42, -112],
    }, u));
    let kx, tilt = 0, lost = false, spin, face = 'smile';
    if (run1) {
      const k = seg(u, 0, 2.6); kx = lerp(-180, 640, easeOut(k)); spin = kx / 22;
      if (u > 1.9) { lost = true; tilt = 0.14 * seg(u, 1.9, 2.2); face = 'o'; }
      if (lost) { const wk = u - 1.9; wheel(c, 640 + 82 * 1.25 + wk * 380, 622 - 20 * 1.25 - Math.abs(Math.sin(wk * 7)) * 50 * Math.exp(-wk), wk * 18, 20); }
    } else { kx = lerp(-200, 1480, easeIn2(ph2)); spin = kx / 22; face = 'laugh'; }
    const ky = 622, ks = 1.25;
    if (!run1) for (let i = 0; i < 5; i++) poly(c, [[kx - 150 - i * 22, 560 + i * 12], [kx - 260 - i * 22, 560 + i * 12]], 3, 'rgba(255,255,255,0.7)');
    c.save(); c.translate(kx, ky); c.rotate(tilt); c.translate(-kx, -ky);
    drawKart(c, kx, ky, ks, { spin, lostFront: lost });
    drawPerson(c, HERO, kx - 69 * ks, ky - 58 * ks + 120 * 0.6, 0.6, {
      noLegs: true, seed: 0.4, swept: true, goggles: !run1, look: 1, handL: [96, -122], handR: [70, -112], elbow: 'out',
      mouth: face, eyes: face === 'laugh' ? 'happy' : 'open', brow: face === 'o' ? 5 : 0,
    }, u);
    kartCowl(c, kx, ky, ks);
    c.restore();
    const flash = Math.max(0, 1 - Math.abs(u - 3.15) / 0.25);
    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash * 0.9 + ')'; c.fillRect(0, 0, W, H); }
  }
  const easeIn2 = (t) => t * t * (1.6 - 0.6 * t);

  const STEPS = ['Идея', 'План', 'Код', 'Тест'];
  function drawSteps(c, t) {
    const a = Math.min(seg(t, TL.stepsShow[0], TL.stepsShow[0] + 0.6), 1 - seg(t, TL.stepsShow[1] - 0.6, TL.stepsShow[1]));
    if (a <= 0) return;
    c.save(); c.globalAlpha = a; c.font = '800 19px ' + FONT; c.textBaseline = 'middle'; c.textAlign = 'center';
    const x0 = 820, y = 46, wS = 104;
    rrect(c, x0 - 14, y - 26, wS * 4 + 8, 52, 26); c.fillStyle = 'rgba(14,20,40,0.55)'; c.fill();
    STEPS.forEach((lab, i) => {
      const on = seg(t, TL.steps[i], TL.steps[i] + 0.4), cx = x0 + i * wS + 44;
      if (i > 0) poly(c, [[cx - wS + 40, y], [cx - 40, y]], 3, on > 0 ? '#f2b544' : 'rgba(255,255,255,0.25)');
      if (on > 0 && on < 1) glow(c, cx, y, 70, 'rgba(242,181,68,' + 0.6 * (1 - on) + ')');
      rrect(c, cx - 40, y - 16, 80, 32, 16); c.fillStyle = on > 0 ? '#f2b544' : 'rgba(255,255,255,0.12)'; c.fill();
      c.fillStyle = on > 0 ? '#3a2405' : 'rgba(255,255,255,0.7)'; c.fillText(lab, cx, y + 1);
    });
    c.restore();
  }

  /* ---------- монтаж ---------- */
  const DRAW = { hook: sHookK, problem: sProblem2, s1, cls: sClass2, tutor: sTutor2, garage: sStudio, test: sPlay, s7 };
  const SCENES = TL.scenes.map((k) => ({ id: k.id, a: k.a, b: k.id === 's7' ? k.b + 0.01 : k.b, src: k.src, draw: DRAW[k.id] }));

  let ctx, buf, bctx, tmp, tctx, DPR = 1;
  function init(canvas, dpr) {
    DPR = dpr || 1;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx = canvas.getContext('2d');
    buf = document.createElement('canvas'); buf.width = W * DPR; buf.height = H * DPR; bctx = buf.getContext('2d');
    tmp = document.createElement('canvas'); tmp.width = W * DPR; tmp.height = H * DPR; tctx = tmp.getContext('2d');
    if (!SCHOOL_DAY) { SCHOOL_DAY = makeSchool(false); SCHOOL_NIGHT = makeSchool(true); }
  }
  function drawScene(c, sc, t) {
    c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.globalAlpha = 1;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const lt = sc.src == null ? t - sc.a : sc.src + (t - sc.a);
    const sat = sc.id === 's1' ? lerp(0.2, 1, ease(seg(t, TL.turnSat[0], TL.turnSat[1]))) : 1;
    if (sat < 0.999) {
      tctx.save(); tctx.setTransform(DPR, 0, 0, DPR, 0, 0); tctx.fillStyle = '#000'; tctx.fillRect(0, 0, W, H); sc.draw(tctx, lt); tctx.restore();
      c.filter = 'saturate(' + sat.toFixed(3) + ')'; c.drawImage(tmp, 0, 0, W, H); c.filter = 'none';
    } else sc.draw(c, lt);
    c.restore();
  }
  function render(t) {
    t = clamp(t, 0, DUR);
    const act = SCENES.filter((s) => t >= s.a && t < s.b);
    const cur = act[0] || SCENES[SCENES.length - 1];
    drawScene(ctx, cur, t);
    const nxt = act[1];
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (nxt) {
      drawScene(bctx, nxt, t);
      const p = ease(seg(t, nxt.a, cur.b));
      if (nxt.tr === 'iris') {
        const r = p * 1500;
        ctx.save(); ctx.beginPath(); ctx.arc(nxt.ix, nxt.iy, r, 0, TAU); ctx.clip(); ctx.drawImage(buf, 0, 0, W, H); ctx.restore();
        ctx.beginPath(); ctx.arc(nxt.ix, nxt.iy, r, 0, TAU); ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(242,181,68,' + (1 - p) + ')'; ctx.stroke();
      } else { ctx.globalAlpha = p; ctx.drawImage(buf, 0, 0, W, H); ctx.globalAlpha = 1; }
    }
    const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 820);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawSteps(ctx, t);
    drawSubs(ctx, t);
    const fin = 1 - seg(t, 0, 0.8), fout = seg(t, DUR - 0.7, DUR);
    if (fin > 0) { ctx.fillStyle = 'rgba(8,12,28,' + fin + ')'; ctx.fillRect(0, 0, W, H); }
    if (fout > 0) { ctx.fillStyle = 'rgba(8,12,28,' + fout + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
  window.FILM = { W, H, DUR, init, render };
})();
