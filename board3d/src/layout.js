// World layout of the 2.5D board. The ground is the x/z plane, y is up.
// The road snakes over a grid of streets, seen from above at an angle like a city-builder map.
// Wide screens: 4 stations per street, seen from the corner (the map is a diamond, wider than tall).
// Upright phones: 3 stations per street and 5 streets, seen more from the front, so the map is taller than wide.
export const SX = 11; // distance between two stations along a street
export const SZ = 14; // distance between two streets
export const ROAD_W = 3.4; // asphalt width
export const WALK_W = 4.8; // asphalt + sidewalks
export const N = 13;

const deg = (d) => (d * Math.PI) / 180;

export function makeLayout(wide) {
  const cols = wide ? 4 : 3;
  const rows = Math.ceil(N / cols);
  const POS = Array.from({ length: N }, (_, i) => {
    const row = Math.floor(i / cols);
    const idx = i % cols;
    const col = row % 2 === 0 ? idx : cols - 1 - idx;
    return [col * SX, (rows - 1 - row) * SZ];
  });
  // straight road pieces between consecutive stations
  const SEGS = POS.slice(0, -1).map((a, i) => [a, POS[i + 1]]);
  const segDir = (i) => {
    const s = SEGS[Math.max(0, Math.min(SEGS.length - 1, i))];
    const dx = s[1][0] - s[0][0];
    const dz = s[1][1] - s[0][1];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  };
  // Where each station's building stands: beside the road, on the far side of the street,
  // or on the outer side at the corners (where the far side is taken by the turning road).
  const mid = ((cols - 1) * SX) / 2;
  const PLOTS = POS.map(([x, z], i) => {
    if (i === N - 1) return { x, z: z - 7, r: 6 }; // castle at the end of the road
    if (i === 0) return { x: x + (x > mid ? 7 : -7), z, r: 3.6 }; // start sign before the first street
    const turnsHere = POS[i - 1][1] !== z || POS[i + 1][1] !== z;
    if (turnsHere) return { x: x + (x > mid ? 6.8 : -6.8), z, r: 4.1 };
    return { x, z: z - 6.8, r: 4.1 };
  });
  const distToRoad = (x, z) => {
    let best = Infinity;
    for (const [a, b] of SEGS) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
    }
    return best;
  };
  const W = (cols - 1) * SX;
  const D = (rows - 1) * SZ;
  return {
    wide,
    POS,
    SEGS,
    PLOTS,
    segDir,
    distToRoad,
    center: [W / 2, D / 2],
    // the area scenery is scattered over (a good margin around the streets)
    box: [-28, W + 28, -26, D + 26],
    // camera angles: azimuth (from the front) and how high it looks down from
    az: wide ? deg(45) : deg(22),
    el: wide ? deg(36) : deg(47),
  };
}

// seeded random numbers, so the scenery is the same every game
export function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
