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
    const p = [[-104, -30], [-94, -64], [-14, -64], [18, -47], [96, -47], [114, -30], [-104, -30], null, [-82, -52], [-82, -100], [-56, -100], [-56, -52], null, [10, -52], [-8, -88]];
    [[-80, -20], [82, -20]].forEach((w) => { p.push(null); for (let i = 0; i <= 20; i++) p.push([w[0] + Math.cos((i / 20) * TAU) * 22, w[1] + Math.sin((i / 20) * TAU) * 22]); });
    p.push(null, [30, -90], [80, -90], [70, -98], null, [80, -90], [70, -82]);
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
    const kx = 640 + easeIO(go) * 900;
    if (real < 1) {
      c.save(); c.globalAlpha = 1 - real;
      if (gold > 0) { c.shadowColor = 'rgba(242,181,68,' + gold + ')'; c.shadowBlur = 18 * gold; }
      const tip = drawSketch(c, 640, 400, 2.6, p, gold > 0 ? '#d79a22' : '#4a4a52', 3.2);
      c.restore();
      if (tip && p < 1) {
        c.save(); c.translate(tip[0], tip[1]); c.rotate(-0.7);
        c.fillStyle = '#f3c64a'; c.fillRect(0, -7, 120, 14); c.fillStyle = '#f2d6b0'; c.beginPath(); c.moveTo(0, -7); c.lineTo(-20, 0); c.lineTo(0, 7); c.fill();
        c.fillStyle = '#333'; c.beginPath(); c.moveTo(-14, -2.2); c.lineTo(-20, 0); c.lineTo(-14, 2.2); c.fill(); c.fillStyle = '#e88aa0'; c.fillRect(112, -7, 12, 14);
        c.restore();
      }
      c.save(); c.globalAlpha = (1 - real) * seg(u, 2.6, 3.2); c.font = 'italic 600 30px ' + FONT; c.fillStyle = '#4a4a52';
      c.fillText('v = ?', 860, 170); c.fillText('F = m·a', 220, 190); c.restore();
    }
    if (real > 0) {
      c.save(); c.globalAlpha = real;
      if (go > 0) for (let i = 0; i < 6; i++) poly(c, [[kx - 340 - i * 30, 260 + i * 34], [kx - 200 - i * 30, 260 + i * 34]], 4, 'rgba(120,120,140,' + 0.4 * go + ')');
      c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = 20; c.shadowOffsetY = 12;
      drawKart(c, kx, 400, 2.6, { spin: u * 12 * (0.2 + go * 3) });
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
          drawSketch(c, hx + 34, dy - 70 - Math.sin(u * 2 + 1) * 3, 0.1, 1, '#f2b544', 1.3);
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
      drawSketch(c, 560, 330, 1.25, bp, chalk, 3);
      const ap = seg(u, l2 + 1.2, l2 + 2.2);
      if (ap > 0) {
        poly(c, [[380, 300], [380 + 110 * ap, 300]], 4, '#ffd76a');
        poly(c, [[490, 300], [478, 292]], 4, ap > 0.95 ? '#ffd76a' : 'transparent');
        poly(c, [[490, 300], [478, 308]], 4, ap > 0.95 ? '#ffd76a' : 'transparent');
      }
      c.save(); c.globalAlpha = seg(u, l2 + 1.6, l2 + 2.4); c.font = '700 40px ' + FONT; c.fillStyle = chalk; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('F = m·a', 760, 170); c.fillText('v = s / t', 760, 230); c.restore();
    } else {
      [[150, 380], [200, 300], [250, 420]].forEach(([y, w]) => poly(c, [[370, y], [370 + w, y]], 3, 'rgba(240,240,228,0.5)'));
    }
    [[RED, 860, 0.7, 1.2], [BUZZ, 1010, 0.72, 2.2]].forEach(([P, x, s, sd]) => drawPerson(c, P, x, 650, s, { noLegs: true, seed: sd, look: -0.6, lookUp: 0.6, mouth: 'grin', handL: [40, -120], handR: [-40, -120] }, u));
    c.fillStyle = '#9b7148'; c.fillRect(780, 572, 300, 16); c.fillStyle = '#7f5b38'; c.fillRect(780, 588, 300, 80);
    const walk = seg(u, 0.4, 2.2);
    let tx = lerp(1060, 700, easeIO(walk)), tO = { seed: 0.6, flip: true, look: 1 };
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
    drawPerson(c, HERO, 470, 790, 1.08, {
      noLegs: true, seed: 0.4, look: noticed ? 0.9 : 0, lookUp: noticed ? 1 : -1, headDy: noticed ? 0 : 6,
      handL: noticed ? [36, -150] : [30 + Math.sin(u * 9) * 8, -158], handR: [-30, -150],
      mouth: noticed ? (u > 3.2 ? 'smile' : 'o') : 'grin', brow: noticed && u < 3.2 ? 4 : 0, eyes: 'open',
    }, u);
    c.fillStyle = '#9b7148'; c.fillRect(250, 618, 470, 20); c.fillStyle = '#7f5b38'; c.fillRect(250, 638, 470, 90);
    c.fillStyle = '#fbfaf3'; c.save(); c.translate(470, 612); c.rotate(-0.05); c.fillRect(-70, -10, 140, 14); c.restore();
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
      mouth: u > 2.6 ? 'smile' : 'grin', handL: [40, -140], handR: [-60, -150],
    }, u);
    ell(c, 640, 650, 420, 70, '#9b7148'); ell(c, 640, 640, 410, 60, '#b8895a');
    [[520, '#e9e2d6'], [760, '#7cc1d6']].forEach(([mx, col]) => { rrect(c, mx - 14, 600, 28, 34, 5); c.fillStyle = col; c.fill(); });
    c.save(); c.translate(640, 630); c.rotate(0.04); c.fillStyle = '#fbfaf3'; c.fillRect(-60, -12, 120, 18); drawSketch(c, 0, -2, 0.18, 1, '#4a4a52', 1.2); c.restore();
    c.restore();
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
      handL: working ? [150 + hb, -95] : [60, -320], handR: working ? [120, -80] : [-44, -112], look: 0.6, lookUp: working ? -1 : 0,
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
      if (lost) { const wk = u - 1.9; wheel(c, 640 + 82 * 0.9 + wk * 380, 610 - 18 * 0.9 - Math.abs(Math.sin(wk * 7)) * 50 * Math.exp(-wk), wk * 18, 20); }
    } else { kx = lerp(-200, 1480, easeIn2(ph2)); spin = kx / 22; face = 'laugh'; }
    const ky = 615, ks = 0.9;
    if (!run1) for (let i = 0; i < 5; i++) poly(c, [[kx - 150 - i * 22, 560 + i * 12], [kx - 260 - i * 22, 560 + i * 12]], 3, 'rgba(255,255,255,0.7)');
    c.save(); c.translate(kx, ky); c.rotate(tilt); c.translate(-kx, -ky);
    drawKart(c, kx, ky, ks, { spin, lostFront: lost });
    drawPerson(c, HERO, kx - 64 * ks, ky - 66 * ks + 120 * 0.72, 0.72, {
      noLegs: true, seed: 0.4, swept: true, goggles: !run1, look: 1, handL: [90, -150], handR: [70, -140],
      mouth: face, eyes: face === 'laugh' ? 'happy' : 'open', brow: face === 'o' ? 5 : 0,
    }, u);
    kartCowl(c, kx, ky, ks);
    c.restore();
    const flash = Math.max(0, 1 - Math.abs(u - 3.15) / 0.25);
    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash * 0.9 + ')'; c.fillRect(0, 0, W, H); }
  }
  const easeIn2 = (t) => t * t * (1.6 - 0.6 * t);

  const STEPS = ['Идея', 'План', 'Деталь', 'Тест'];
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
