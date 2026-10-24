import React, { useEffect, useRef } from "react";

/*
  Small three.js illustrations in Walras teal, for the landing page:
  <WalrasScene variant="hero|database|server|globe|layers" tone="muted" follow />.
  three.js is loaded on demand (its own chunk), the animation pauses while
  off screen, and it's a still frame under prefers-reduced-motion. Without
  WebGL it simply draws nothing.
*/

let threeP = null;
const loadThree = () => threeP || (threeP = import("three"));
const still = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

const PAL = {
  live: { body: 0x0a6b60, body2: 0x0d8274, top: 0xd9f7ee, glow: 0x1fc4a2, glow2: 0x5eebc2, dim: 0x0a5048 },
  muted: { body: 0x9a9a9e, body2: 0xababaf, top: 0xeeeef0, glow: 0x7a7a7d, glow2: 0xb7b7ba, dim: 0x8a8a8e },
};

function dbStack(T, parent, p, o) {
  const { tiers = 3, r = 1, h = 0.5, gap = 0.14 } = o || {};
  const bodyMat = new T.MeshStandardMaterial({ color: p.body, roughness: 0.32, metalness: 0.2 });
  const capMat = new T.MeshStandardMaterial({ color: p.top, roughness: 0.55 });
  const ringMat = new T.MeshBasicMaterial({ color: p.glow });
  const tierGeo = new T.CylinderGeometry(r, r, h, 72);
  const capGeo = new T.CylinderGeometry(r * 0.99, r * 0.99, 0.02, 72);
  const ringGeo = new T.TorusGeometry(r * 1.004, 0.02, 8, 140);
  const ledGeo = new T.BoxGeometry(0.15, 0.045, 0.03);
  const leds = [];
  const stack = new T.Group();
  for (let i = 0; i < tiers; i++) {
    const tier = new T.Group();
    tier.position.y = i * (h + gap) + h / 2;
    tier.add(new T.Mesh(tierGeo, bodyMat));
    for (const s of [1, -1]) {
      const ring = new T.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (s * h) / 2;
      tier.add(ring);
    }
    if (i === tiers - 1) {
      const cap = new T.Mesh(capGeo, capMat);
      cap.position.y = h / 2 + 0.011;
      tier.add(cap);
    }
    for (let k = 0; k < 3; k++) {
      const m = new T.MeshBasicMaterial({ color: p.glow2 });
      const led = new T.Mesh(ledGeo, m);
      const a = -0.32 + k * 0.2;
      led.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      led.rotation.y = a;
      tier.add(led);
      leds.push({ m, ph: i * 1.3 + k * 2.1 });
    }
    stack.add(tier);
  }
  parent.add(stack);
  const on = new T.Color(p.glow2);
  const off = new T.Color(p.dim);
  return {
    stack,
    blink(t) {
      for (const l of leds) l.m.color.lerpColors(off, on, Math.sin(t * 2.4 + l.ph) > -0.3 ? 1 : 0.1);
    },
  };
}

function orbit(T, parent, p, o) {
  const R = o.radius;
  const n = o.count || 4;
  const s = o.size || 0.08;
  const holder = new T.Group();
  holder.position.y = o.y || 0;
  holder.rotation.z = o.tilt || 0;
  holder.rotation.x = o.tiltX || 0;
  const ring = new T.Mesh(
    new T.TorusGeometry(R, o.tube || 0.006, 6, 220),
    new T.MeshBasicMaterial({ color: p.glow, transparent: true, opacity: o.opacity == null ? 0.5 : o.opacity })
  );
  ring.rotation.x = Math.PI / 2;
  holder.add(ring);
  const geo = new T.BoxGeometry(s, s, s);
  const mat = new T.MeshBasicMaterial({ color: p.glow2 });
  const packets = [];
  for (let i = 0; i < n; i++) {
    const m = new T.Mesh(geo, mat);
    holder.add(m);
    packets.push({ m, a: (i / n) * Math.PI * 2 });
  }
  parent.add(holder);
  return (t) => {
    for (const q of packets) {
      const a = q.a + t * (o.speed || 0.5);
      q.m.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      q.m.rotation.set(t * 1.3, t, 0);
    }
  };
}

function edged(T, geo, mat, edgeMat) {
  const g = new T.Group();
  g.add(new T.Mesh(geo, mat));
  g.add(new T.LineSegments(new T.EdgesGeometry(geo), edgeMat));
  return g;
}

const BUILD = {
  hero(T, g, p) {
    const db = dbStack(T, g, p, { tiers: 3, r: 1.05, h: 0.52, gap: 0.15 });
    const o1 = orbit(T, g, p, { radius: 1.75, y: 0, tilt: 0.32, count: 6, speed: 0.45, opacity: 0.55, size: 0.085 });
    const o2 = orbit(T, g, p, { radius: 2.3, y: -0.2, tilt: -0.2, tiltX: 0.15, count: 3, speed: -0.28, opacity: 0.25, size: 0.06 });
    const cg = new T.BoxGeometry(0.18, 0.18, 0.18);
    const cm = new T.MeshStandardMaterial({ color: p.body2, roughness: 0.4, metalness: 0.2 });
    const em = new T.LineBasicMaterial({ color: p.glow });
    const spots = [[-2.1, 1.1, -0.6], [2.2, 0.9, 0.4], [-1.7, -1.2, 1.0], [1.9, -1.0, -0.9], [0.4, 1.75, -1.4], [-0.6, -1.6, -1.6]];
    const cubes = spots.map(([x, y, z], i) => {
      const c = edged(T, cg, cm, em);
      c.position.set(x, y, z);
      c.scale.setScalar(0.7 + (i % 3) * 0.25);
      g.add(c);
      return { c, y, ph: i * 1.1 };
    });
    const disc = new T.Mesh(new T.CircleGeometry(1.9, 64), new T.MeshBasicMaterial({ color: p.glow, transparent: true, opacity: 0.1 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -1.0;
    g.add(disc);
    const grid = new T.GridHelper(7, 14, p.glow, p.glow);
    grid.material.transparent = true;
    grid.material.opacity = 0.08;
    grid.position.y = -1.02;
    g.add(grid);
    return {
      camera: { pos: [0, 1.7, 8.2], target: [0, -0.05, 0], fov: 32 },
      tick(t) {
        db.stack.rotation.y = t * 0.18;
        db.stack.position.y = -0.95 + Math.sin(t * 0.9) * 0.05;
        db.blink(t);
        o1(t);
        o2(t);
        for (const q of cubes) {
          q.c.position.y = q.y + Math.sin(t * 0.8 + q.ph) * 0.12;
          q.c.rotation.set(t * 0.3 + q.ph, t * 0.4, 0);
        }
      },
    };
  },
  database(T, g, p) {
    const db = dbStack(T, g, p, { tiers: 3, r: 0.9, h: 0.42, gap: 0.12 });
    const o1 = orbit(T, g, p, { radius: 1.45, y: -0.05, tilt: 0.3, count: 4, speed: 0.5, opacity: 0.45, size: 0.07 });
    return {
      camera: { pos: [0, 1.5, 6.2], target: [0, -0.1, 0], fov: 30 },
      tick(t) {
        db.stack.rotation.y = t * 0.2;
        db.stack.position.y = -0.75 + Math.sin(t) * 0.04;
        db.blink(t);
        o1(t);
      },
    };
  },
  server(T, g, p) {
    const rack = new T.Group();
    const unitGeo = new T.BoxGeometry(1.8, 0.3, 1.2);
    const bodyMat = new T.MeshStandardMaterial({ color: p.body, roughness: 0.35, metalness: 0.25 });
    const faceMat = new T.MeshStandardMaterial({ color: p.dim, roughness: 0.6 });
    const edgeMat = new T.LineBasicMaterial({ color: p.glow });
    const faceGeo = new T.BoxGeometry(1.7, 0.22, 0.02);
    const ventGeo = new T.BoxGeometry(0.55, 0.022, 0.01);
    const ventMat = new T.MeshBasicMaterial({ color: p.body2 });
    const ledGeo = new T.BoxGeometry(0.06, 0.06, 0.02);
    const leds = [];
    for (let i = 0; i < 4; i++) {
      const u = edged(T, unitGeo, bodyMat, edgeMat);
      u.position.y = i * 0.36;
      const face = new T.Mesh(faceGeo, faceMat);
      face.position.z = 0.61;
      u.add(face);
      for (let v = 0; v < 3; v++) {
        const vent = new T.Mesh(ventGeo, ventMat);
        vent.position.set(-0.42, -0.06 + v * 0.06, 0.625);
        u.add(vent);
      }
      for (let k = 0; k < 2; k++) {
        const m = new T.MeshBasicMaterial({ color: p.glow2 });
        const led = new T.Mesh(ledGeo, m);
        led.position.set(0.58 + k * 0.13, 0, 0.625);
        u.add(led);
        leds.push({ m, ph: i * 0.9 + k * 2.7 });
      }
      rack.add(u);
    }
    rack.position.y = -0.55;
    g.add(rack);
    const on = new T.Color(p.glow2);
    const off = new T.Color(p.dim);
    return {
      camera: { pos: [0, 1.4, 5.6], target: [0, 0, 0], fov: 30 },
      tick(t) {
        rack.rotation.y = -0.6 + Math.sin(t * 0.5) * 0.25;
        rack.position.y = -0.55 + Math.sin(t * 0.9) * 0.03;
        for (const l of leds) l.m.color.lerpColors(off, on, Math.sin(t * 3 + l.ph) > -0.2 ? 1 : 0.1);
      },
    };
  },
  globe(T, g, p) {
    const ball = new T.Group();
    ball.add(new T.Mesh(new T.SphereGeometry(0.95, 48, 32), new T.MeshStandardMaterial({ color: p.body, roughness: 0.4, metalness: 0.15 })));
    ball.add(new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(1.05, 1)), new T.LineBasicMaterial({ color: p.glow })));
    ball.rotation.x = 0.3;
    g.add(ball);
    const o1 = orbit(T, g, p, { radius: 1.5, tilt: 0.4, count: 2, speed: 0.6, opacity: 0.6, size: 0.1 });
    return {
      camera: { pos: [0, 0.6, 5.4], target: [0, 0, 0], fov: 34 },
      tick(t) {
        ball.rotation.y = t * 0.3;
        o1(t);
      },
    };
  },
  layers(T, g, p) {
    const slabGeo = new T.BoxGeometry(1.6, 0.12, 1.6);
    const mat = new T.MeshStandardMaterial({ color: p.body, roughness: 0.4, metalness: 0.2 });
    const top = new T.MeshStandardMaterial({ color: p.top, roughness: 0.6 });
    const edge = new T.LineBasicMaterial({ color: p.glow });
    const slabs = [0, 1, 2].map((i) => {
      const s = edged(T, slabGeo, i === 2 ? top : mat, edge);
      g.add(s);
      return s;
    });
    return {
      camera: { pos: [3.2, 3.0, 3.6], target: [0, 0.3, 0], fov: 32 },
      tick(t) {
        slabs.forEach((s, i) => { s.position.y = i * (0.34 + 0.08 * Math.sin(t * 1.1)); });
        g.rotation.y = t * 0.25;
      },
    };
  },
};

// Draws the scene into `host` and returns a function that stops and frees it.
function mount(T, host, { variant, tone, follow }) {
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement;
  cv.style.cssText = "display:block;width:100%;height:100%";
  host.appendChild(cv);

  const p = tone === "muted" ? PAL.muted : PAL.live;
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xf2fffb, 0x0b2622, 1.6));
  const key = new T.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new T.DirectionalLight(p.glow, 2.2);
  rim.position.set(-5, 2, -4);
  scene.add(rim);
  const rig = new T.Group();
  scene.add(rig);
  const g = new T.Group();
  rig.add(g);
  const b = (BUILD[variant] || BUILD.database)(T, g, p);
  const cam = new T.PerspectiveCamera(b.camera.fov, 1, 0.1, 100);
  cam.position.set(...b.camera.pos);
  cam.lookAt(...b.camera.target);

  let px = 0;
  let py = 0;
  const t0 = performance.now();
  const onMove = (e) => { px = e.clientX / window.innerWidth - 0.5; py = e.clientY / window.innerHeight - 0.5; };
  if (follow) window.addEventListener("pointermove", onMove, { passive: true });

  const draw = (t) => {
    b.tick(t);
    if (follow) {
      rig.rotation.y += (px * 0.35 - rig.rotation.y) * 0.05;
      rig.rotation.x += (py * 0.18 - rig.rotation.x) * 0.05;
    }
    renderer.render(scene, cam);
  };
  const size = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  size();
  draw(1.2);
  const ro = new ResizeObserver(() => { size(); draw(1.2 + (performance.now() - t0) / 1000); });
  ro.observe(host);
  let vis = true;
  let raf = 0;
  const io = new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; });
  io.observe(host);
  const loop = (now) => { raf = requestAnimationFrame(loop); if (vis) draw((now - t0) / 1000 + 1.2); };
  if (!still()) raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    cv.remove();
  };
}

const WalrasScene = ({ variant = "database", tone, follow = false, className, style }) => {
  const host = useRef(null);
  useEffect(() => {
    let stop = null;
    let live = true;
    loadThree()
      .then((T) => { if (live && host.current) stop = mount(T, host.current, { variant, tone, follow }); })
      .catch(() => {});
    return () => { live = false; if (stop) stop(); };
  }, [variant, tone, follow]);
  return <div ref={host} className={className} style={style} aria-hidden="true" />;
};

export default WalrasScene;
