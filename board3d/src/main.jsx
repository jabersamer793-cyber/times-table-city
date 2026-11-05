// Entry point: the game (plain JavaScript in src/tpl_body.html) talks to the 2.5D board through window.Board3D.
//   Board3D.supported()            -> can this device draw WebGL?
//   const b = Board3D.mount(el, o)  -> draws the board into el; o = {nodes, cities, pic, reserve, wide}
//   b.update({players, turn, over, wide, reserve}) -> moves the cars and updates the station tags
//   b.destroy()
import { createRoot } from 'react-dom/client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Canvas } from '@react-three/fiber';
import { World, CameraRig, Lay } from './Scene.jsx';
import { makeLayout } from './layout.js';

const CHECK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Tags({ nodes, cities, players, labels }) {
  if (!labels) return null;
  return (
    <div className="b3d-tags" aria-hidden="true">
      {nodes.map((nd, i) => {
        const l = labels[i];
        if (!l || nd.t === 'start') return null;
        let tag, col;
        if (nd.t === 'city') {
          tag = <span className="ltr">×{nd.n}</span>;
          col = cities[nd.n].c;
        } else if (nd.t === 'work') {
          tag = 'ورشة';
          col = '#E39A00';
        } else {
          tag = 'القلعة';
          col = 'var(--violet)';
        }
        return (
          <div key={i} className={'b3d-tag ' + nd.t} style={{ left: l.x + '%', top: l.y + '%' }}>
            <span className="t" style={{ '--tc': col }}>
              {tag}
            </span>
            {nd.t === 'city' &&
              players.map((p, j) =>
                p.keys.includes(nd.n) ? (
                  <span key={j} className="done" style={{ background: p.color }} title={p.name}>
                    {CHECK}
                  </span>
                ) : null
              )}
          </div>
        );
      })}
    </div>
  );
}

function App({ store, opts }) {
  const st = useSyncExternalStore(store.sub, store.get);
  const [labels, setLabels] = useState(null);
  const reserve = st.reserve || opts.reserve || {};
  const wide = st.wide ?? opts.wide ?? true;
  const L = useMemo(() => makeLayout(wide), [wide]);
  return (
    <>
      <Canvas
        orthographic
        shadows
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [100, 100, 100], zoom: 10, near: 1, far: 600 }}
      >
        <Lay.Provider value={L}>
          <CameraRig reserve={reserve} onLabels={setLabels} />
          <World key={wide ? 'w' : 'p'} nodes={opts.nodes} cities={opts.cities} pic={opts.pic} players={st.players} turn={st.turn} over={st.over} />
        </Lay.Provider>
      </Canvas>
      <Tags nodes={opts.nodes} cities={opts.cities} players={st.players} labels={labels} />
    </>
  );
}

function supported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function mount(el, opts) {
  let state = { players: [], turn: 0, over: false };
  const subs = new Set();
  const store = {
    get: () => state,
    sub: (f) => (subs.add(f), () => subs.delete(f)),
  };
  const root = createRoot(el);
  root.render(<App store={store} opts={opts} />);
  return {
    update(s) {
      state = { ...state, ...s };
      subs.forEach((f) => f());
    },
    destroy() {
      root.unmount();
    },
  };
}

export { supported, mount };
