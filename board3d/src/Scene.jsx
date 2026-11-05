// The city map: grass, the road with its stations, scenery, the two cars, and a fixed corner-view camera.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { N, ROAD_W, WALK_W, rng } from './layout.js';

// the street layout in use (see layout.js); it changes when the screen turns
export const Lay = createContext(null);
const useLay = () => useContext(Lay);
import { Part, Many, Card, Blob, toon, stripes, INK, gradient } from './parts.jsx';

/* ---------- shared shapes ---------- */
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  ball: new THREE.IcosahedronGeometry(1, 1),
  blobby: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 7),
  roof: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
  disc: new THREE.CylinderGeometry(1, 1, 0.1, 28),
  ring: new THREE.TorusGeometry(1, 0.08, 6, 40).rotateX(Math.PI / 2),
  wheel: new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2),
};

/* ---------- camera: a fixed view from one corner, fitted to the board ---------- */
const viewDir = (L) => new THREE.Vector3(Math.cos(L.el) * Math.sin(L.az), Math.sin(L.el), Math.cos(L.el) * Math.cos(L.az));

// sizes of the station pictures: [max width, max height]
export const SIZE = { city: [9.4, 7.2], work: [7.4, 4.4], castle: [15, 10.5] };
function fitPoints({ POS, PLOTS, az }) {
  const pts = [];
  const rx = Math.cos(az), rz = -Math.sin(az); // the camera's sideways direction on the ground
  POS.forEach(([x, z]) => pts.push([x, 0, z]));
  PLOTS.forEach((p, i) => {
    const [w, h] = i === N - 1 ? SIZE.castle : SIZE.city;
    for (const [dx, dz] of [[p.r, 0], [-p.r, 0], [0, p.r], [0, -p.r]]) pts.push([p.x + dx, 0, p.z + dz]);
    for (const k of [-0.5, 0.5]) pts.push([p.x + rx * w * k, h * (i === N - 1 ? 1.02 : 0.85), p.z + rz * w * k]);
  });
  return pts.map((p) => new THREE.Vector3(...p));
}

export function CameraRig({ reserve, onLabels }) {
  const L = useLay();
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!size.width || !size.height) return;
    const VIEW = viewDir(L), FIT = fitPoints(L);
    camera.position.copy(VIEW).multiplyScalar(200);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of FIT) {
      const q = p.clone().applyMatrix4(inv);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    // keep a margin, and leave the reserved strip (where the card pile sits) free
    const W = size.width, H = size.height;
    const rb = reserve.bottom || 0, rl = reserve.left || 0;
    const availW = W * (1 - rl) * 0.98, availH = H * (1 - rb) * 0.97;
    const zoom = Math.min(availW / (x1 - x0), availH / (y1 - y0));
    const cx = (x0 + x1) / 2 - ((rl * W) / 2) / zoom;
    const cy = (y0 + y1) / 2 - ((rb * H) / 2) / zoom;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const target = right.multiplyScalar(cx).add(up.multiplyScalar(cy));
    camera.position.copy(target).addScaledVector(VIEW, 200);
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.near = 1;
    camera.far = 600;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // where the station name tags go on the screen (percent of the board)
    onLabels(
      anchorsOf(L).map((a) => {
        const v = new THREE.Vector3(...a).project(camera);
        return { x: ((v.x + 1) / 2) * 100, y: ((1 - v.y) / 2) * 100 };
      })
    );
  }, [L, camera, size.width, size.height, reserve.bottom, reserve.left]);
  return null;
}

/* ---------- ground ---------- */
function Ground() {
  const { PLOTS, box, center } = useLay();
  const patches = useMemo(() => {
    const R = rng(7);
    const out = [];
    for (let i = 0; i < 70; i++) {
      const x = box[0] - 10 + R() * (box[1] - box[0] + 20), z = box[2] - 10 + R() * (box[3] - box[2] + 20);
      out.push({ p: [x, 0.01, z], s: [2 + R() * 5, 1, 2 + R() * 4], r: R() * 3, c: R() < 0.5 ? '#8ED65A' : '#6FBF45' });
    }
    return out;
  }, []);
  // sandy ground around each station, like a building lot
  const lots = useMemo(
    () => PLOTS.map((p) => ({ p: [p.x, 0.02, p.z], s: [p.r + 1.3, 1, p.r + 1.1], c: '#EBCB82' })),
    [PLOTS]
  );
  const groundMat = useMemo(() => new THREE.MeshToonMaterial({ color: '#7DCB4F', gradientMap: gradient() }), []);
  const flatMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], 0, center[1]]} receiveShadow material={groundMat}>
        <planeGeometry args={[400, 400]} />
      </mesh>
      <Many geo={G.disc} items={patches} mat={flatMat} cast={false} />
      <Many geo={G.disc} items={lots} mat={flatMat} cast={false} />
    </>
  );
}

/* ---------- road ---------- */
function Road({ cityAt }) {
  const { SEGS } = useLay();
  const pieces = useMemo(() => {
    const base = [], walk = [], asph = [], dash = [], zebra = [];
    SEGS.forEach(([a, b], i) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, r = -Math.atan2(dz, dx);
      base.push({ p: [cx, 0.05, cz], s: [L + WALK_W + 0.4, 0.1, WALK_W + 0.4], r });
      walk.push({ p: [cx, 0.12, cz], s: [L + WALK_W, 0.12, WALK_W], r });
      asph.push({ p: [cx, 0.16, cz], s: [L + ROAD_W, 0.12, ROAD_W], r });
      const ux = dx / L, uz = dz / L;
      for (let t = 2.6; t < L - 2.4; t += 1.5) dash.push({ p: [a[0] + ux * t, 0.23, a[1] + uz * t], s: [0.7, 0.02, 0.14], r });
      // a zebra crossing just before each city
      if (cityAt(i + 1)) {
        const t = L - 3.2;
        for (let k = -2; k <= 2; k++) {
          const px = a[0] + ux * t - uz * k * 0.62, pz = a[1] + uz * t + ux * k * 0.62;
          zebra.push({ p: [px, 0.23, pz], s: [0.9, 0.02, 0.36], r });
        }
      }
    });
    return { base, walk, asph, dash, zebra };
  }, [cityAt, SEGS]);
  const flat = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradient() });
  const mats = useMemo(() => ({ base: flat(INK), walk: flat('#D9DDEB'), asph: flat('#4A536E'), dash: flat('#FFD23F'), zebra: flat('#FFFFFF') }), []);
  return (
    <>
      {Object.keys(pieces).map((k) => (
        <Many key={k} geo={G.box} items={pieces[k]} mat={mats[k]} cast={false} receive />
      ))}
    </>
  );
}

/* ---------- stations ---------- */
function Station({ i, node, city, pic }) {
  const p = useLay().PLOTS[i];
  const top = 0.7;
  const castle = node.t === 'castle', work = node.t === 'work';
  const col = castle ? '#C9B6FF' : work ? '#FFD23F' : city ? city.c : '#ffffff';
  const img = castle ? 'castle' : work ? 'barrier' : city ? city.img : 'start';
  const topMat = useMemo(
    () =>
      work
        ? new THREE.MeshToonMaterial({ map: stripes(), gradientMap: gradient() })
        : new THREE.MeshToonMaterial({ color: new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.35), gradientMap: gradient() }),
    [col, work]
  );
  if (node.t === 'start') {
    return (
      <group>
        <Part geo={G.cyl8} color="#8A8FA8" position={[p.x + 1.2, 1.6, p.z]} scale={[0.14, 3.2, 0.14]} />
        <Card url={pic('start')} position={[p.x + 1.2, 2.2, p.z]} maxW={3.4} maxH={3.4} />
        <Blob position={[p.x + 1.2, 0.05, p.z]} w={2.2} />
        {/* Mohammad and Bassam wave the cars off at the start */}
        <Card url={pic('av0')} position={[p.x - 0.9, 0, p.z - 1.4]} maxW={2.4} maxH={4.6} />
        <Card url={pic('av1')} position={[p.x - 0.9, 0, p.z + 1.6]} maxW={2.4} maxH={4.6} />
        <Blob position={[p.x - 0.9, 0.05, p.z - 1.4]} w={1.8} d={1.2} />
        <Blob position={[p.x - 0.9, 0.05, p.z + 1.6]} w={1.8} d={1.2} />
      </group>
    );
  }
  const r = p.r;
  return (
    <group>
      <Part geo={G.cyl} color={col} position={[p.x, top / 2, p.z]} scale={[r, top, r * 0.9]} ink={0.04} receive />
      <mesh geometry={G.disc} material={topMat} position={[p.x, top + 0.01, p.z]} scale={[r * 0.86, 1, r * 0.78]} receiveShadow />
      <Card
        url={pic(img)}
        position={[p.x, top, p.z]}
        maxW={(castle ? SIZE.castle : work ? SIZE.work : SIZE.city)[0]}
        maxH={(castle ? SIZE.castle : work ? SIZE.work : SIZE.city)[1]}
      />
    </group>
  );
}

/* ---------- scenery: trees, houses, ponds, lamps and traffic lights ---------- */
function Scenery({ lights }) {
  const { PLOTS, SEGS, distToRoad, box } = useLay();
  const s = useMemo(() => {
    const R = rng(20261105);
    const placed = [];
    const nearPlot = (x, z, r) => PLOTS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1.6 + r);
    const free = (x, z, r, gap, space) =>
      distToRoad(x, z) > WALK_W / 2 + gap + r && !nearPlot(x, z, r) && placed.every(([a, b, c]) => Math.hypot(a - x, b - z) > c + r + space);
    const scatter = (n, r, gap, space, box) => {
      const out = [];
      for (let t = 0; t < n * 60 && out.length < n; t++) {
        const x = box[0] + R() * (box[1] - box[0]), z = box[2] + R() * (box[3] - box[2]);
        if (free(x, z, r, gap, space)) {
          placed.push([x, z, r]);
          out.push([x, z, R()]);
        }
      }
      return out;
    };
    const wide = box;
    const inner = [box[0] + 20, box[1] - 20, box[2] + 18, box[3] - 18];
    const ponds = scatter(4, 4.6, 2, 8, wide).map(([x, z, v]) => [x, z, 3.4 + v * 2.4, 2.2 + v * 1.4]);
    const houses = scatter(11, 2.2, 1.2, 2.5, inner);
    const trees = scatter(70, 1.1, 1.4, 0.6, wide);
    const pines = scatter(34, 0.9, 1.4, 0.5, wide);
    const bushes = scatter(40, 0.6, 0.8, 0.3, wide);
    const flowers = scatter(60, 0.3, 0.5, 0.1, wide);

    const H = { walls: [], roofs: [], doors: [] };
    const wallC = ['#FFF3D6', '#FFE0E0', '#E3F1FF', '#FFF0B8'], roofC = ['#E5483B', '#2E86F0', '#8A5A3B', '#7A55D9'];
    houses.forEach(([x, z, v]) => {
      const w = 2.6 + v * 0.8, r = Math.floor(v * 4) * (Math.PI / 2);
      H.walls.push({ p: [x, 1, z], s: [w, 2, 2.4], r, c: wallC[Math.floor(v * 4)] });
      H.roofs.push({ p: [x, 2.75, z], s: [w * 0.82, 1.5, 1.9], r, c: roofC[Math.floor(v * 13) % 4] });
    });
    const T = { trunks: [], tops: [], pineTops: [], bush: [], flowers: [] };
    trees.forEach(([x, z, v]) => {
      const k = 0.85 + v * 0.45;
      T.trunks.push({ p: [x, 0.6 * k, z], s: [0.22 * k, 1.2 * k, 0.22 * k], c: '#8A5A3B' });
      T.tops.push({ p: [x, 1.9 * k, z], s: 1.05 * k, r: v * 6, c: v < 0.5 ? '#3E9E3A' : '#4DB548' });
    });
    pines.forEach(([x, z, v]) => {
      const k = 0.85 + v * 0.4;
      T.trunks.push({ p: [x, 0.35 * k, z], s: [0.18 * k, 0.7 * k, 0.18 * k], c: '#8A5A3B' });
      T.pineTops.push({ p: [x, 1.5 * k, z], s: [0.9 * k, 1.8 * k, 0.9 * k], c: '#2E8A4E' });
      T.pineTops.push({ p: [x, 2.4 * k, z], s: [0.65 * k, 1.3 * k, 0.65 * k], c: '#36A05A' });
    });
    bushes.forEach(([x, z, v]) => T.bush.push({ p: [x, 0.35, z], s: [0.65 + v * 0.3, 0.5, 0.6], r: v * 6, c: v < 0.5 ? '#4FB548' : '#5CC250' }));
    const fc = ['#F2603F', '#FFC52E', '#FFFFFF', '#E86BB0'];
    flowers.forEach(([x, z, v]) => {
      for (let k = 0; k < 3; k++) T.flowers.push({ p: [x + Math.cos(k * 2.1) * 0.25, 0.15, z + Math.sin(k * 2.1) * 0.25], s: 0.13, c: fc[Math.floor(v * 4)] });
    });
    // street lamps along the long streets
    const L = { posts: [], heads: [] };
    SEGS.forEach(([a, b], i) => {
      if (a[1] !== b[1]) return;
      for (const f of [0.3, 0.7]) {
        const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (i % 2 ? -1 : 1) * (WALK_W / 2 - 0.3);
        L.posts.push({ p: [x, 1.1, z], s: [0.08, 2.2, 0.08], c: '#3C4C85' });
        L.heads.push({ p: [x, 2.3, z], s: 0.22, c: '#FFE070' });
      }
    });
    return { ponds, H, T, L };
  }, [PLOTS, SEGS, distToRoad, box]);
  const lit = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
  const water = useMemo(() => new THREE.MeshToonMaterial({ color: '#6EC6F2', gradientMap: gradient() }), []);
  const waterHi = useMemo(() => new THREE.MeshBasicMaterial({ color: '#B7E6FF' }), []);
  return (
    <>
      <Many geo={G.box} items={s.H.walls} ink={0.05} />
      <Many geo={G.roof} items={s.H.roofs} ink={0.05} />
      <Many geo={G.cyl8} items={s.T.trunks} />
      <Many geo={G.blobby} items={s.T.tops} ink={0.07} />
      <Many geo={G.cone} items={s.T.pineTops} ink={0.07} />
      <Many geo={G.blobby} items={s.T.bush} ink={0.08} />
      <Many geo={G.ball} items={s.T.flowers} mat={lit} cast={false} />
      <Many geo={G.cyl8} items={s.L.posts} />
      <Many geo={G.ball} items={s.L.heads} mat={lit} cast={false} />
      {s.ponds.map(([x, z, a, b], i) => (
        <group key={i}>
          <mesh geometry={G.disc} material={toon(INK)} position={[x, 0.03, z]} scale={[a + 0.25, 1, b + 0.25]} />
          <mesh geometry={G.disc} material={water} position={[x, 0.06, z]} scale={[a, 1, b]} receiveShadow />
          <mesh geometry={G.disc} material={waterHi} position={[x - a * 0.25, 0.08, z - b * 0.25]} scale={[a * 0.45, 1, b * 0.22]} />
        </group>
      ))}
      <TrafficLights at={lights} />
    </>
  );
}

// traffic lights in front of each city blink through red, green and yellow
function TrafficLights({ at }) {
  const mats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#333' })), []);
  const ph = useRef(-1);
  useFrame(({ clock }) => {
    const p = Math.floor(clock.elapsedTime / 1.8) % 3;
    if (p === ph.current) return;
    ph.current = p;
    const on = [['#FF5A4A', '#5A4A1A', '#2E4A2E'], ['#5A2A2A', '#5A4A1A', '#4BE36A'], ['#5A2A2A', '#FFD23F', '#2E4A2E']][p];
    mats.forEach((m, i) => m.color.set(on[i]));
  });
  return at.map(([x, z], k) => (
    <group key={k} position={[x, 0, z]}>
      <Part geo={G.cyl8} color="#3C4C85" position={[0, 1.2, 0]} scale={[0.09, 2.4, 0.09]} ink={0} />
      <Part geo={G.box} color="#2B3354" position={[0, 2.75, 0]} scale={[0.5, 1.1, 0.45]} ink={0.08} />
      {[0, 1, 2].map((j) => (
        <mesh key={j} geometry={G.ball} material={mats[j]} position={[0.2, 3.1 - j * 0.34, 0.2]} scale={0.12} />
      ))}
    </group>
  ));
}

/* ---------- cars ---------- */
const ease = (t) => t * t * (3 - 2 * t);
function pathAt(POS, prog) {
  const i = Math.max(0, Math.min(N - 2, Math.floor(prog)));
  const f = Math.max(0, Math.min(1, prog - i));
  const a = POS[i], b = POS[i + 1], e = ease(f);
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, i];
}
function Car({ idx, pos, color, dark, active }) {
  const { POS, segDir } = useLay();
  const g = useRef();
  const body = useRef();
  const ring = useRef();
  const st = useRef({ prog: pos, ang: null });
  useFrame((_, dt) => {
    const s = st.current;
    dt = Math.min(dt, 0.05);
    // drive along the road one station at a time (the game waits 0.9 s per station)
    if (pos < s.prog - 0.01) s.prog = pos;
    else if (s.prog < pos) s.prog = Math.min(pos, s.prog + dt / 0.9);
    const moving = s.prog < pos;
    const [x, z, seg] = pathAt(POS, s.prog);
    // face the next street when parked, the current one while driving
    const atNode = Math.abs(s.prog - Math.round(s.prog)) < 0.001;
    const [dx, dz] = segDir(atNode && !moving ? Math.min(Math.round(s.prog), N - 2) : seg);
    const want = Math.atan2(-dz, dx);
    if (s.ang == null) s.ang = want;
    let d = want - s.ang;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    s.ang += d * Math.min(1, dt * 8);
    // the two cars share the street side by side
    const side = idx === 0 ? -1 : 1, lane = 0.78;
    const px = Math.sin(s.ang) * side * lane, pz = Math.cos(s.ang) * side * lane;
    g.current.position.set(x + px, 0.22, z + pz);
    g.current.rotation.y = s.ang;
    const t = performance.now() / 1000;
    body.current.position.y = active ? Math.abs(Math.sin(t * 5)) * 0.12 : moving ? Math.sin(t * 30) * 0.03 : 0;
    if (ring.current) {
      ring.current.visible = active;
      ring.current.rotation.y = t * 1.5;
    }
  });
  const glass = '#BDE6FF';
  return (
    <group ref={g}>
      <group ref={body}>
        <Part geo={G.box} color={color} position={[0, 0.5, 0]} scale={[2.5, 0.55, 1.32]} ink={0.05} />
        <Part geo={G.box} color={dark} position={[-0.12, 0.98, 0]} scale={[1.35, 0.48, 1.14]} ink={0.06} />
        <Part geo={G.box} color={glass} position={[0.56, 0.97, 0]} scale={[0.06, 0.36, 1.0]} ink={0} cast={false} />
        <Part geo={G.box} color={glass} position={[-0.8, 0.97, 0]} scale={[0.06, 0.34, 1.0]} ink={0} cast={false} />
        <Part geo={G.box} color={glass} position={[-0.12, 0.98, 0.58]} scale={[1.0, 0.3, 0.02]} ink={0} cast={false} />
        <Part geo={G.box} color={glass} position={[-0.12, 0.98, -0.58]} scale={[1.0, 0.3, 0.02]} ink={0} cast={false} />
        <Part geo={G.box} color="#FFE070" position={[1.26, 0.55, 0.42]} scale={[0.04, 0.16, 0.26]} ink={0} cast={false} />
        <Part geo={G.box} color="#FFE070" position={[1.26, 0.55, -0.42]} scale={[0.04, 0.16, 0.26]} ink={0} cast={false} />
        <Part geo={G.box} color="#F2603F" position={[-1.26, 0.55, 0.45]} scale={[0.04, 0.14, 0.22]} ink={0} cast={false} />
        <Part geo={G.box} color="#F2603F" position={[-1.26, 0.55, -0.45]} scale={[0.04, 0.14, 0.22]} ink={0} cast={false} />
      </group>
      {[[0.78, 0.66], [0.78, -0.66], [-0.78, 0.66], [-0.78, -0.66]].map(([x, z], k) => (
        <Part key={k} geo={G.wheel} color="#2B3354" position={[x, 0.3, z]} scale={[0.32, 0.32, 0.24]} ink={0.08} />
      ))}
      <mesh ref={ring} geometry={G.ring} material={toon('#FFFFFF')} position={[0, 0.05, 0]} scale={[1.9, 1, 1.9]} />
    </group>
  );
}

/* ---------- lights ---------- */
function Sun() {
  const { center } = useLay();
  const [cx, cz] = center;
  const ref = useRef();
  useEffect(() => {
    const l = ref.current;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera;
    c.left = -50; c.right = 50; c.top = 50; c.bottom = -50; c.near = 1; c.far = 200;
    c.updateProjectionMatrix();
  }, [cx, cz]);
  return (
    <directionalLight
      ref={ref}
      position={[cx - 30, 60, cz + 40]}
      intensity={2.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
    />
  );
}

export function World({ nodes, cities, players, turn, over, pic }) {
  const { PLOTS } = useLay();
  const cityAt = useMemo(() => (i) => nodes[i] && nodes[i].t === 'city', [nodes]);
  // a traffic light at the corner of each city's lot
  const lights = useMemo(
    () =>
      nodes
        .map((nd, i) => (nd.t === 'city' ? [PLOTS[i].x + PLOTS[i].r + 0.4, PLOTS[i].z + 1.8] : null))
        .filter(Boolean),
    [nodes, PLOTS]
  );
  return (
    <>
      <color attach="background" args={['#7DCB4F']} />
      <hemisphereLight args={['#ffffff', '#7DCB4F', 1.4]} />
      <Sun />
      <Ground />
      <Road cityAt={cityAt} />
      {nodes.map((nd, i) => (
        <Station key={i} i={i} node={nd} city={nd.t === 'city' ? cities[nd.n] : null} pic={pic} />
      ))}
      <Scenery lights={lights} />
      {players.map((p, i) => (
        <Car key={i} idx={i} pos={p.pos} color={p.color} dark={p.dark} active={!over && turn === i} />
      ))}
    </>
  );
}

// where each station's name tag sits: at the front edge of its lot
function anchorsOf({ PLOTS, az }) {
  // toward the camera from the lot's centre
  const fx = Math.sin(az), fz = Math.cos(az);
  return PLOTS.map((p) => [p.x + fx * p.r * 0.8, 0, p.z + fz * p.r * 0.8]);
}
