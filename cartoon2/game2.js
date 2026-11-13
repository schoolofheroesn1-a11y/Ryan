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
