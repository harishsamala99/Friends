export function drawStadium(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth || window.innerWidth;
  const ch = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);

  // Design space is 1600 x 900, scaled to cover the canvas.
  const DW = 1600,
    DH = 900;
  const k = Math.max(cw / DW, ch / DH);
  const ox = (cw - DW * k) / 2,
    oy = (ch - DH * k) / 2;
  const vx0 = -ox / k,
    vx1 = vx0 + cw / k,
    vy0 = -oy / k,
    vy1 = vy0 + ch / k;
  const view = (c) => c.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);

  // Camera: high behind the near goal, looking down the pitch.
  const F = 1000,
    CAMH = 50,
    D = 70,
    CX = 800,
    YH = 290;
  const P = (u, v, h = 0) => {
    const s = F / (D + v);
    return [CX + u * s, YH + (CAMH - h) * s, s];
  };
  const XY = (u, v, h = 0) => P(u, v, h).slice(0, 2);

  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const SHIRT = {
    red: [172, 46, 50],
    blue: [46, 92, 178],
    white: [220, 220, 212],
    dark: [32, 36, 46],
    gold: [200, 166, 68],
  };
  const SKIN = [
    [196, 150, 118],
    [124, 82, 56],
    [226, 190, 158],
    [60, 44, 38],
    [160, 120, 96],
  ];

  // ------------------------------------------------------------------ static
  const off = document.createElement("canvas");
  off.width = canvas.width;
  off.height = canvas.height;
  const staticContext = off.getContext("2d");
  const M = canvas.getContext("2d");
  if (!staticContext || !M) return () => {};

  (function paintStatic(ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#03060b";
    ctx.fillRect(0, 0, cw, ch);
    view(ctx);

    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const full = { x: vx0 - 50, y: vy0 - 50, w: vx1 - vx0 + 100, h: vy1 - vy0 + 100 };

    // ---- Night sky, city glow, stars ----
    const sky = ctx.createLinearGradient(0, vy0, 0, 430);
    sky.addColorStop(0, "#02040a");
    sky.addColorStop(0.55, "#0a1427");
    sky.addColorStop(1, "#1b2b44");
    ctx.fillStyle = sky;
    ctx.fillRect(full.x, full.y, full.w, full.h);
    const city = ctx.createRadialGradient(800, 400, 0, 800, 400, 900);
    city.addColorStop(0, "rgba(255,170,95,0.28)");
    city.addColorStop(0.5, "rgba(255,150,90,0.08)");
    city.addColorStop(1, "rgba(255,150,90,0)");
    ctx.save();
    ctx.translate(0, 400);
    ctx.scale(1, 0.45);
    ctx.translate(0, -400);
    ctx.fillStyle = city;
    ctx.fillRect(vx0 - 600, 0, vx1 - vx0 + 1200, 900);
    ctx.restore();
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      const r = 0.4 + rnd() * 0.8;
      ctx.fillRect(vx0 + rnd() * (vx1 - vx0), vy0 + rnd() * (330 - vy0), r, r);
    }

    // ---- Floodlight towers (behind the stands) ----
    const towers = [
      [-100, 150, 60],
      [100, 150, 60],
      [-42, 205, 64],
      [42, 205, 64],
    ];
    towers.forEach(([u, v, h]) => {
      const b = P(u, v, 0),
        t = P(u, v, h);
      ctx.strokeStyle = "rgba(10,14,20,0.95)";
      ctx.lineWidth = Math.max(1.5, 0.5 * t[2]);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(t[0], t[1]);
      ctx.stroke();
      ctx.strokeStyle = "rgba(60,75,95,0.55)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) {
        const y0 = b[1] + (t[1] - b[1]) * (i / 9),
          y1 = b[1] + (t[1] - b[1]) * ((i + 1) / 9);
        ctx.beginPath();
        ctx.moveTo(t[0] - 3, y0);
        ctx.lineTo(t[0] + 3, y1);
        ctx.moveTo(t[0] + 3, y0);
        ctx.lineTo(t[0] - 3, y1);
        ctx.stroke();
      }
    });

    // ---- Pitch: apron, mown stripes, grass grain, edge shadows ----
    poly(
      [P(-70, -40), P(70, -40), P(70, 112), P(-70, 112)].map((p) => [p[0], p[1]]),
      "#0c2a19",
    );
    for (let i = 0; i < 15; i++) {
      const v0 = i * 7,
        v1 = v0 + 7;
      poly(
        [P(-46, v0), P(46, v0), P(46, v1), P(-46, v1)].map((p) => [p[0], p[1]]),
        i % 2 ? "#2a9344" : "#1f7a37",
      );
    }
    for (let i = 0; i < 9000; i++) {
      const [x, y, s] = P(-46 + rnd() * 92, rnd() * 105);
      ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.045)" : "rgba(0,20,0,0.07)";
      ctx.fillRect(x, y, 0.8 * s, Math.max(0.5, 0.1 * s));
    }
    poly(
      [P(-70, 105), P(70, 105), P(70, 110), P(-70, 110)].map((p) => [p[0], p[1]]),
      "#262c34",
    );
    [-1, 1].forEach((sd) => {
      const a = P(sd * 34, 0),
        b = P(sd * 34, 105),
        c = P(sd * 52, 105),
        d = P(sd * 52, 0);
      const g = ctx.createLinearGradient(a[0], 0, c[0], 0);
      g.addColorStop(0, "rgba(0,8,4,0)");
      g.addColorStop(1, "rgba(0,8,4,0.55)");
      poly(
        [
          [a[0], a[1]],
          [b[0], b[1]],
          [c[0], c[1]],
          [d[0], d[1]],
        ],
        g,
      );
    });

    // ---- Crowd ----
    const pickShirt = (side, t) => {
      const dom =
        side < 0
          ? "red"
          : side > 0
            ? "blue"
            : t < -45
              ? "red"
              : t > 45
                ? "blue"
                : rnd() < 0.5
                  ? "red"
                  : "blue";
      const r = rnd();
      if (r < 0.5) return SHIRT[dom];
      if (r < 0.64) return SHIRT.white;
      if (r < 0.82) return SHIRT.dark;
      if (r < 0.9) return SHIRT.gold;
      return SHIRT[dom === "red" ? "blue" : "red"];
    };
    const corner = (fn, t, a) => {
      const [u, v, h] = fn(t, a);
      return XY(u, v, h);
    };
    const stand = (fn, tMin, tMax, side) => {
      const g = ctx.createLinearGradient(0, 200, 0, 720);
      g.addColorStop(0, "#080c12");
      g.addColorStop(1, "#141b25");
      poly(
        [corner(fn, tMin, 0), corner(fn, tMax, 0), corner(fn, tMax, 50), corner(fn, tMin, 50)],
        g,
      );
      for (let a = 50; a >= 0; a -= 0.8) {
        if (a > 23 && a < 27) continue;
        const upper = a >= 27;
        for (let t = tMin; t <= tMax; t += 1) {
          if (Math.round(t - tMin) % 14 === 0) continue; // stairways
          const [u, v, h] = fn(t, a);
          const [x, y, s] = P(u, v, h);
          if (x < vx0 - 12 || x > vx1 + 12 || y < vy0 - 12 || y > vy1 + 12) continue;
          const f = (upper ? 0.58 : 0.86) * (0.8 + 0.3 * rnd()) * (1 - 0.18 * (a / 50));
          const c = pickShirt(side, t);
          ctx.fillStyle = `rgb(${(c[0] * f) | 0},${(c[1] * f) | 0},${(c[2] * f) | 0})`;
          ctx.fillRect(x - 0.26 * s, y - 0.05 * s, 0.52 * s, 0.4 * s);
          const sk = SKIN[(rnd() * 5) | 0];
          ctx.fillStyle = `rgb(${(sk[0] * f) | 0},${(sk[1] * f) | 0},${(sk[2] * f) | 0})`;
          ctx.fillRect(x - 0.12 * s, y - 0.3 * s, 0.24 * s, 0.24 * s);
        }
      }
      // Lit concourse between the two tiers, with pillars
      poly(
        [corner(fn, tMin, 23), corner(fn, tMax, 23), corner(fn, tMax, 27), corner(fn, tMin, 27)],
        "#120e0a",
      );
      for (let t = tMin; t < tMax; t += 10) {
        const q = [
          corner(fn, t + 1.2, 23.6),
          corner(fn, t + 8.8, 23.6),
          corner(fn, t + 8.8, 26.4),
          corner(fn, t + 1.2, 26.4),
        ];
        const y0 = q[0][1],
          y1 = q[3][1];
        const lg = ctx.createLinearGradient(0, y1, 0, y0);
        lg.addColorStop(0, "rgba(255,214,150,0.75)");
        lg.addColorStop(1, "rgba(255,170,90,0.45)");
        poly(q, lg);
      }
      // Rails
      ctx.strokeStyle = "rgba(190,210,230,0.28)";
      ctx.lineWidth = 1.2;
      [27, 50, 0.2].forEach((a) => {
        const p0 = corner(fn, tMin, a),
          p1 = corner(fn, tMax, a);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      });
    };
    const farFn = (t, a) => [t, 110 + a, 0.62 * a];
    stand(farFn, -260, 260, 0);
    stand((t, a) => [-(37 + a), t, 0.62 * a], -25, 112, -1);
    stand((t, a) => [37 + a, t, 0.62 * a], -25, 112, 1);

    // Big screen on the far stand
    {
      const q = [
        corner(farFn, -20, 31),
        corner(farFn, 20, 31),
        corner(farFn, 20, 45),
        corner(farFn, -20, 45),
      ];
      const sg = ctx.createLinearGradient(0, q[3][1], 0, q[0][1]);
      sg.addColorStop(0, "#14305a");
      sg.addColorStop(1, "#071327");
      poly(q, sg);
      ctx.strokeStyle = "rgba(180,200,225,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      const cx0 = (q[0][0] + q[1][0]) / 2,
        h = q[0][1] - q[3][1];
      ctx.textAlign = "center";
      ctx.fillStyle = "#f3ead0";
      ctx.shadowColor = "rgba(255,230,160,0.8)";
      ctx.shadowBlur = 6;
      ctx.font = `700 ${Math.round(h * 0.34)}px "Barlow Condensed","Arial Narrow",sans-serif`;
      ctx.fillText("E FOOTBALL", cx0, q[3][1] + h * 0.42);
      ctx.fillStyle = "#e9c46a";
      ctx.font = `600 ${Math.round(h * 0.24)}px "Barlow Condensed","Arial Narrow",sans-serif`;
      ctx.fillText("FRIENDS 0 - 0 LEAGUE", cx0, q[3][1] + h * 0.78);
      ctx.shadowBlur = 0;
      ctx.textAlign = "start";
    }

    // ---- Canopy along the top of the stands ----
    const canopy = (a, b) => {
      const p = [XY(a[0], a[1], 31), XY(b[0], b[1], 31), XY(b[0], b[1], 36), XY(a[0], a[1], 36)];
      const g = ctx.createLinearGradient(0, p[3][1], 0, p[0][1]);
      g.addColorStop(0, "#1b2530");
      g.addColorStop(1, "#06090d");
      poly(p, g);
      ctx.strokeStyle = "rgba(170,195,220,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[3][0], p[3][1]);
      ctx.lineTo(p[2][0], p[2][1]);
      ctx.stroke();
    };
    canopy([-260, 160], [260, 160]);
    canopy([-87, -25], [-87, 112]);
    canopy([87, -25], [87, 112]);

    // ---- Advertising boards ----
    const BOARD = [
      ["#1d3a74", "#3d63b4"],
      ["#c9a13a", "#f0d57a"],
      ["#14464c", "#2c8d93"],
      ["#9d2f2f", "#d65a5a"],
      ["#e9e9e2", "#ffffff"],
    ];
    const board = (p0, p1, h, i) => {
      const q = [XY(p0[0], p0[1]), XY(p1[0], p1[1]), XY(p1[0], p1[1], h), XY(p0[0], p0[1], h)];
      const [c0, c1] = BOARD[i % BOARD.length];
      const g = ctx.createLinearGradient(0, q[0][1], 0, q[3][1]);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      poly(q, g);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(q[3][0], q[3][1]);
      ctx.lineTo(q[2][0], q[2][1]);
      ctx.stroke();
    };
    for (let i = 0, u = -52; u < 52; u += 6, i++) board([u, 106.5], [u + 6, 106.5], 1.1, i);
    for (let i = 0, v = -20; v < 106; v += 7, i++) {
      board([-36.5, v], [-36.5, v + 7], 1.0, i);
      board([36.5, v], [36.5, v + 7], 1.0, i + 2);
    }

    // ---- Pitch markings (soft glow + crisp line) ----
    ctx.lineJoin = "round";
    const pl = (pts, w = 1.8) => {
      [
        ["rgba(255,255,255,0.16)", w * 3],
        ["rgba(255,255,255,0.88)", w],
      ].forEach(([c, lw]) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach(([u, v], i) => {
          const [x, y] = P(u, v);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      });
    };
    const ring = (cu, cv, r, a0, a1, w = 1.8) => {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const a = a0 + ((a1 - a0) * i) / 64;
        pts.push([cu + r * Math.sin(a), cv - r * Math.cos(a)]);
      }
      pl(pts, w);
    };
    pl(
      [
        [-34, 0],
        [34, 0],
        [34, 105],
        [-34, 105],
        [-34, 0],
      ],
      2.6,
    );
    pl([
      [-34, 52.5],
      [34, 52.5],
    ]);
    ring(0, 52.5, 9.15, 0, Math.PI * 2);
    pl([
      [-20.16, 105],
      [-20.16, 88.5],
      [20.16, 88.5],
      [20.16, 105],
    ]);
    pl([
      [-9.16, 105],
      [-9.16, 99.5],
      [9.16, 99.5],
      [9.16, 105],
    ]);
    const arc = Math.acos((94 - 88.5) / 9.15);
    ring(0, 94, 9.15, Math.PI - arc, Math.PI + arc);
    pl(
      [
        [-20.16, 0],
        [-20.16, 16.5],
        [20.16, 16.5],
        [20.16, 0],
      ],
      3,
    );
    pl(
      [
        [-9.16, 0],
        [-9.16, 5.5],
        [9.16, 5.5],
        [9.16, 0],
      ],
      3,
    );
    [
      [0, 52.5],
      [0, 94],
      [0, 11],
    ].forEach(([u, v]) => {
      const [x, y] = P(u, v);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // ---- Far goal with net ----
    const GW = 3.66,
      GH = 2.44;
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 0.8;
    for (let i = -6; i <= 6; i++) {
      const a = P((i / 6) * GW, 105, GH),
        b = P((i / 6) * GW, 107.2, GH * 0.8),
        c = P((i / 6) * GW, 107.2, 0);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    }
    for (let j = 0; j <= 5; j++) {
      const h = (j / 5) * GH * 0.8;
      const a = P(-GW, 107.2, h),
        b = P(GW, 107.2, h);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2.4;
    const g0 = P(-GW, 105),
      g1 = P(-GW, 105, GH),
      g2 = P(GW, 105, GH),
      g3 = P(GW, 105);
    ctx.beginPath();
    ctx.moveTo(g0[0], g0[1]);
    ctx.lineTo(g1[0], g1[1]);
    ctx.lineTo(g2[0], g2[1]);
    ctx.lineTo(g3[0], g3[1]);
    ctx.stroke();

    // ---- Light: canopy rows, tower glare, beams, pitch hot-spot ----
    ctx.globalCompositeOperation = "lighter";
    const rowLights = [];
    for (let v = 0; v <= 112; v += 12) rowLights.push(P(-87, v, 31), P(87, v, 31));
    for (let u = -80; u <= 80; u += 12) rowLights.push(P(u, 160, 31));
    rowLights.forEach(([x, y, s]) => {
      const r = Math.min(16, Math.max(7, 2.6 * s));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      g.addColorStop(0, "rgba(255,250,230,0.8)");
      g.addColorStop(0.2, "rgba(255,240,205,0.25)");
      g.addColorStop(1, "rgba(255,240,205,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
    });
    towers
      .map(([u, v, h]) => P(u, v, h))
      .forEach(([x, y, s]) => {
        for (let i = 0; i < 3; i++) {
          const tu = -26 + rnd() * 52,
            tv = 20 + rnd() * 62;
          const a = P(tu - 9, tv),
            b = P(tu + 9, tv);
          const bg = ctx.createLinearGradient(x, y, (a[0] + b[0]) / 2, a[1]);
          bg.addColorStop(0, "rgba(225,238,255,0.22)");
          bg.addColorStop(1, "rgba(225,238,255,0)");
          poly(
            [
              [x - 3, y + 3],
              [a[0], a[1]],
              [b[0], b[1]],
              [x + 3, y + 3],
            ],
            bg,
          );
        }
        for (let ix = 0; ix < 4; ix++)
          for (let iy = 0; iy < 3; iy++) {
            ctx.fillStyle = "rgba(255,255,245,0.95)";
            ctx.fillRect(x - 10 + ix * 5.5, y - 7 + iy * 5.5, 3.6, 3.6);
          }
        const R = 38 + s * 10;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.2);
        g.addColorStop(0, "rgba(255,252,238,0.95)");
        g.addColorStop(0.12, "rgba(255,246,220,0.5)");
        g.addColorStop(1, "rgba(255,246,220,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4);
        const sg = ctx.createLinearGradient(x - R * 2, 0, x + R * 2, 0);
        sg.addColorStop(0, "rgba(255,245,220,0)");
        sg.addColorStop(0.5, "rgba(255,245,220,0.55)");
        sg.addColorStop(1, "rgba(255,245,220,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(x - R * 2, y - 0.7, R * 4, 1.4);
        const vg2 = ctx.createLinearGradient(0, y - R * 1.2, 0, y + R * 1.2);
        vg2.addColorStop(0, "rgba(255,245,220,0)");
        vg2.addColorStop(0.5, "rgba(255,245,220,0.4)");
        vg2.addColorStop(1, "rgba(255,245,220,0)");
        ctx.fillStyle = vg2;
        ctx.fillRect(x - 0.6, y - R * 1.2, 1.2, R * 2.4);
      });
    const pc = P(0, 62);
    const pg = ctx.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], 560);
    pg.addColorStop(0, "rgba(255,255,225,0.2)");
    pg.addColorStop(1, "rgba(255,255,225,0)");
    ctx.fillStyle = pg;
    ctx.fillRect(full.x, full.y, full.w, full.h);
    ctx.globalCompositeOperation = "source-over";

    // Haze over the bowl and a vignette
    const hz = ctx.createLinearGradient(0, 160, 0, 650);
    hz.addColorStop(0, "rgba(130,160,200,0.2)");
    hz.addColorStop(1, "rgba(130,160,200,0)");
    ctx.fillStyle = hz;
    ctx.fillRect(full.x, full.y, full.w, full.h);
    const vg = ctx.createRadialGradient(800, 470, 330, 800, 470, 1150);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(full.x, full.y, full.w, full.h);
  })(staticContext);

  // ----------------------------------------------------------------- dynamic
  const flashes = [];
  for (let i = 0; i < 110; i++) {
    const side = (rnd() * 3) | 0,
      a = rnd() * 48;
    const pt =
      side === 0
        ? P(-200 + rnd() * 400, 110 + a, 0.62 * a)
        : side === 1
          ? P(-(37 + a), -10 + rnd() * 120, 0.62 * a)
          : P(37 + a, -10 + rnd() * 120, 0.62 * a);
    flashes.push({ x: pt[0], y: pt[1], s: pt[2], rate: 0.8 + rnd() * 2.2, ph: rnd() * 20 });
  }
  const flares = [
    P(-62, 120, 8),
    P(-18, 122, 10),
    P(34, 119, 6),
    P(70, 123, 9),
    P(-52, 55, 5),
    P(52, 40, 6),
  ].map((p, i) => ({ x: p[0], y: p[1], s: p[2], ph: i * 1.7 }));

  const RED = [214, 58, 58],
    BLUE = [52, 104, 226],
    KEEP = [236, 196, 50],
    REF = [28, 28, 32];
  const players = [];
  let n = 0;
  [
    [0, 4, KEEP],
    [-22, 16, RED],
    [-8, 14, RED],
    [8, 14, RED],
    [22, 16, RED],
    [-24, 32, RED],
    [-9, 30, RED],
    [9, 30, RED],
    [24, 32, RED],
    [-7, 46, RED],
    [7, 46, RED],
    [0, 101, KEEP],
    [-22, 89, BLUE],
    [-8, 91, BLUE],
    [8, 91, BLUE],
    [22, 89, BLUE],
    [-24, 73, BLUE],
    [-9, 75, BLUE],
    [9, 75, BLUE],
    [24, 73, BLUE],
    [-9, 60, BLUE],
    [9, 60, BLUE],
    [14, 52, REF],
  ].forEach(([u, v, kit]) => {
    const i = n++;
    players.push({
      u,
      v,
      kit,
      au: 1.5 + ((i * 7) % 5) * 0.6,
      av: 1.5 + ((i * 3) % 6) * 0.7,
      w1: 0.35 + ((i * 5) % 7) * 0.06,
      w2: 0.3 + ((i * 11) % 6) * 0.07,
      ph: i * 1.3,
    });
  });
  const pos = (p, t) => [
    Math.max(-33, Math.min(33, p.u + p.au * Math.sin(t * p.w1 + p.ph))),
    Math.max(1, Math.min(104, p.v + p.av * Math.cos(t * p.w2 + p.ph * 0.7))),
  ];

  const fireworks = [];
  let nextFire = 0.4;
  const FW = [
    [255, 214, 120],
    [120, 255, 170],
    [255, 255, 255],
    [255, 120, 200],
    [120, 190, 255],
  ];

  const drawPlayer = (c, p, t) => {
    const [u, v] = pos(p, t);
    const [x, y, s] = P(u, v);
    const swing = Math.sin(t * 6 + p.ph) * 0.28 * s;
    c.fillStyle = "rgba(0,0,0,0.3)";
    c.beginPath();
    c.ellipse(x, y + 0.05 * s, 0.55 * s, 0.16 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgb(235,225,215)";
    c.lineWidth = Math.max(1, 0.2 * s);
    c.beginPath();
    c.moveTo(x - 0.12 * s, y - 0.8 * s);
    c.lineTo(x - 0.12 * s + swing, y);
    c.moveTo(x + 0.12 * s, y - 0.8 * s);
    c.lineTo(x + 0.12 * s - swing, y);
    c.stroke();
    c.fillStyle = "rgb(24,26,34)";
    c.fillRect(x - 0.27 * s, y - 0.98 * s, 0.54 * s, 0.3 * s);
    c.fillStyle = `rgb(${p.kit[0]},${p.kit[1]},${p.kit[2]})`;
    c.fillRect(x - 0.3 * s, y - 1.5 * s, 0.6 * s, 0.6 * s);
    c.fillStyle = "rgb(210,166,132)";
    c.beginPath();
    c.arc(x, y - 1.66 * s, 0.17 * s, 0, Math.PI * 2);
    c.fill();
  };

  const render = (t) => {
    M.setTransform(1, 0, 0, 1, 0, 0);
    M.drawImage(off, 0, 0);
    view(M);

    // Players and ball, far to near
    [...players].sort((a, b) => pos(b, t)[1] - pos(a, t)[1]).forEach((p) => drawPlayer(M, p, t));
    const [bx, by, bs] = P(6 * Math.sin(t * 0.9), 52 + 7 * Math.cos(t * 0.7));
    const hop = Math.abs(Math.sin(t * 3.4)) * 0.7 * bs;
    M.fillStyle = "rgba(0,0,0,0.3)";
    M.beginPath();
    M.ellipse(bx, by, 0.25 * bs, 0.08 * bs, 0, 0, Math.PI * 2);
    M.fill();
    M.fillStyle = "#fafaf6";
    M.beginPath();
    M.arc(bx, by - 0.14 * bs - hop, 0.14 * bs, 0, Math.PI * 2);
    M.fill();

    M.globalCompositeOperation = "lighter";
    // Camera flashes
    flashes.forEach((f) => {
      const a = Math.pow(Math.max(0, Math.sin(t * f.rate + f.ph)), 60);
      if (a < 0.04) return;
      const r = 3 + 2.4 * f.s;
      const g = M.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      M.fillStyle = g;
      M.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    });
    // Flares
    flares.forEach((f) => {
      const flick = 0.65 + 0.35 * Math.sin(t * 9 + f.ph) * Math.sin(t * 5.3 + f.ph);
      const r = 10 + 4.5 * f.s;
      const g = M.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 2);
      g.addColorStop(0, `rgba(255,170,90,${0.85 * flick})`);
      g.addColorStop(0.3, `rgba(255,90,40,${0.35 * flick})`);
      g.addColorStop(1, "rgba(255,60,20,0)");
      M.fillStyle = g;
      M.fillRect(f.x - r * 2, f.y - r * 2, r * 4, r * 4);
    });
    M.globalCompositeOperation = "source-over";
    // Smoke drifting up from the flares
    flares.forEach((f) => {
      for (let i = 0; i < 4; i++) {
        const ph = (((t * 0.18 + i / 4 + f.ph) % 1) + 1) % 1;
        const r = (6 + ph * 34) * (0.6 + 0.12 * f.s);
        const x = f.x + ph * 18,
          y = f.y - ph * 70 * (0.5 + 0.1 * f.s);
        const g = M.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(210,90,80,${0.16 * (1 - ph)})`);
        g.addColorStop(1, "rgba(210,90,80,0)");
        M.fillStyle = g;
        M.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });

    // Fireworks
    if (t > nextFire) {
      nextFire = t + 2.4 + rnd() * 2.6;
      const parts = [];
      for (let i = 0; i < 70; i++) {
        const a = rnd() * Math.PI * 2,
          sp = 40 + rnd() * 140;
        parts.push([Math.cos(a) * sp, Math.sin(a) * sp]);
      }
      fireworks.push({
        t0: t,
        cx: 280 + rnd() * 1040,
        cy: 50 + rnd() * 150,
        col: FW[(rnd() * FW.length) | 0],
        parts,
      });
    }
    M.globalCompositeOperation = "lighter";
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i],
        tau = t - fw.t0;
      if (tau > 2.3) {
        fireworks.splice(i, 1);
        continue;
      }
      const life = 1 - tau / 2.3;
      if (tau < 0.2) {
        const g = M.createRadialGradient(fw.cx, fw.cy, 0, fw.cx, fw.cy, 90);
        g.addColorStop(0, `rgba(${fw.col[0]},${fw.col[1]},${fw.col[2]},${0.5 * (1 - tau / 0.2)})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        M.fillStyle = g;
        M.fillRect(fw.cx - 90, fw.cy - 90, 180, 180);
      }
      M.strokeStyle = `rgba(${fw.col[0]},${fw.col[1]},${fw.col[2]},${0.85 * life})`;
      M.lineWidth = 1.6;
      fw.parts.forEach(([vx, vy]) => {
        const d = 1 - tau * 0.12,
          e = 1 - (tau - 0.06) * 0.12;
        M.beginPath();
        M.moveTo(
          fw.cx + vx * (tau - 0.06) * e,
          fw.cy + vy * (tau - 0.06) * e + 38 * (tau - 0.06) * (tau - 0.06),
        );
        M.lineTo(fw.cx + vx * tau * d, fw.cy + vy * tau * d + 38 * tau * tau);
        M.stroke();
      });
    }
    M.globalCompositeOperation = "source-over";
  };

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0,
    last = 0,
    stopped = false;
  const t0 = performance.now();
  const loop = (now) => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    if (now - last < 32) return;
    last = now;
    render((now - t0) / 1000);
  };
  if (reduce) render(1.2);
  else raf = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
