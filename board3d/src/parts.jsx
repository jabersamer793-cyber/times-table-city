// Small building blocks: cel-shaded materials, ink outlines, instanced scenery and camera-facing picture cards.
import { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

export const INK = '#16296B';

// three tones of light, like a cartoon
let GRAD;
export function gradient() {
  if (!GRAD) {
    GRAD = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
    GRAD.needsUpdate = true;
  }
  return GRAD;
}
const MATS = new Map();
export function toon(color) {
  let m = MATS.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient() });
    MATS.set(color, m);
  }
  return m;
}
export const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// a mesh with a dark ink rim around it (the back faces of a slightly bigger copy)
export function Part({ geo, color, position, rotation, scale = 1, ink = 0.06, cast = true, receive = false, material }) {
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} material={material || toon(color)} scale={s} castShadow={cast} receiveShadow={receive} />
      {ink > 0 && <mesh geometry={geo} material={inkMat} scale={s.map((v) => v * (1 + ink))} />}
    </group>
  );
}

// many copies of one shape in one draw call; items: {p:[x,y,z], s:[sx,sy,sz]|n, r:angle, c:'#hex'}
const tmpO = new THREE.Object3D();
const tmpC = new THREE.Color();
export function Many({ geo, items, color = '#ffffff', ink = 0, cast = true, receive = false, mat }) {
  const ref = useRef();
  const inkRef = useRef();
  const material = useMemo(
    () => mat || new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient() }),
    [mat]
  );
  useLayoutEffect(() => {
    const put = (mesh, grow) => {
      if (!mesh) return;
      items.forEach((it, i) => {
        const s = Array.isArray(it.s) ? it.s : [it.s ?? 1, it.s ?? 1, it.s ?? 1];
        tmpO.position.set(...it.p);
        tmpO.rotation.set(it.rx || 0, it.r || 0, 0);
        tmpO.scale.set(s[0] * grow, s[1] * grow, s[2] * grow);
        tmpO.updateMatrix();
        mesh.setMatrixAt(i, tmpO.matrix);
        if (mesh === ref.current) mesh.setColorAt(i, tmpC.set(it.c || color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    put(ref.current, 1);
    put(inkRef.current, 1 + ink);
  }, [items, color, ink]);
  if (!items.length) return null;
  return (
    <>
      <instancedMesh ref={ref} args={[geo, material, items.length]} castShadow={cast} receiveShadow={receive} />
      {ink > 0 && <instancedMesh ref={inkRef} args={[geo, inkMat, items.length]} />}
    </>
  );
}

// a picture loaded once per data URL
const TEX = new Map();
export function useTexture(url) {
  const [, force] = useState(0);
  const t = useMemo(() => {
    if (!url) return null;
    let e = TEX.get(url);
    if (!e) {
      const tex = new THREE.Texture();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      e = { tex, aspect: 1, ready: false, wait: [] };
      const im = new Image();
      im.onload = () => {
        tex.image = im;
        tex.needsUpdate = true;
        e.aspect = im.width / im.height;
        e.ready = true;
        e.wait.forEach((f) => f());
        e.wait = [];
      };
      im.src = url;
      TEX.set(url, e);
    }
    return e;
  }, [url]);
  useEffect(() => {
    if (t && !t.ready) {
      const f = () => force((n) => n + 1);
      t.wait.push(f);
      return () => (t.wait = t.wait.filter((g) => g !== f));
    }
  }, [t]);
  return t;
}

// A flat picture standing on the ground and always facing the camera (the "2.5D" look).
// The card is fitted inside a box of maxW x maxH, standing on its bottom edge.
export function Card({ url, position, maxW, maxH, lift = 0 }) {
  const t = useTexture(url);
  const ref = useRef();
  const mat = useMemo(
    () => (t ? new THREE.MeshBasicMaterial({ map: t.tex, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false }) : null),
    [t]
  );
  const a = t && t.ready ? t.aspect : 1;
  let h = maxH;
  let w = h * a;
  if (w > maxW) {
    w = maxW;
    h = w / a;
  }
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const camera = useThree((s) => s.camera);
  // lean back with the camera's view, so the picture is always seen face on
  useFrame(() => ref.current && ref.current.quaternion.copy(camera.quaternion));
  if (!t || !t.ready) return null;
  return <mesh ref={ref} geometry={geo} material={mat} position={[position[0], position[1] + lift, position[2]]} scale={[w, h, 1]} />;
}

// soft dark blob under things that do not cast real shadows
const blobTex = (() => {
  let tex;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(22,41,107,.45)');
    g.addColorStop(1, 'rgba(22,41,107,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function Blob({ position, w, d }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }), []);
  return <mesh geometry={blobGeo} material={mat} position={position} scale={[w, 1, d ?? w]} renderOrder={1} />;
}

// yellow and black stripes for the workshop platforms
let STRIPES;
export function stripes() {
  if (!STRIPES) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#FFD23F';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#2A2A2A';
    for (let i = -128; i < 256; i += 32) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 16, 0);
      x.lineTo(i + 16 + 128, 128);
      x.lineTo(i + 128, 128);
      x.fill();
    }
    STRIPES = new THREE.CanvasTexture(c);
    STRIPES.colorSpace = THREE.SRGBColorSpace;
    STRIPES.wrapS = STRIPES.wrapT = THREE.RepeatWrapping;
    STRIPES.repeat.set(2, 2);
  }
  return STRIPES;
}
