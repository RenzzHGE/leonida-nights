// LEONIDA NIGHTS — the city. A seeded, deterministic night city: a 7x7 road
// grid, neon towers, a beach boulevard with palms and an ocean, streetlights,
// stars and a moon. Also owns the collision boxes the cars drive against.

import * as THREE from 'three';
import { CFG, DISTRICTS } from './config.js';

/** Deterministic RNG so the city is the same every night. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEON = [0xff2e88, 0x37e0ff, 0xb537f2, 0xffd166, 0x7dffb0, 0xff5a3c];
const PITCH = CFG.blockSize + CFG.roadWidth; // 74
const HALF = (CFG.blocks * PITCH) / 2; // city edge

/** A lit-window texture drawn on a canvas: dark glass, some windows glowing. */
function windowTexture(rand, hue) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0b18';
  g.fillRect(0, 0, 128, 256);
  const cols = 8;
  const rows = 16;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rand() < 0.42;
      if (!lit) {
        g.fillStyle = '#101024';
      } else {
        const pick = rand();
        g.fillStyle = pick < 0.45 ? '#ffd166' : pick < 0.75 ? '#7fd8ff' : '#ff9de2';
      }
      g.globalAlpha = lit ? 0.85 + rand() * 0.15 : 1;
      g.fillRect(4 + x * 15, 5 + y * 15, 10, 9);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asphalt with a dashed centre line, tiled along a road. */
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#17171f';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#23232e';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  g.fillStyle = '#e8d44d';
  g.fillRect(30, 6, 4, 22);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function oceanTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#06283d';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(120,220,255,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    const y = i * 13 + 6;
    for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + i) * 3);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rand = mulberry32(1337);
    /** Building collision boxes {minX,maxX,minZ,maxZ}. */
    this.colliders = [];
    /** Points on roads, for spawning traffic, jobs and the player. */
    this.roadPoints = [];
    this.ocean = null;
    this.build();
  }

  roadCenters() {
    const centers = [];
    const n = CFG.blocks;
    for (let i = 0; i < n; i++) centers.push(-HALF + PITCH / 2 + i * PITCH);
    return centers;
  }

  build() {
    const rand = this.rand;
    const scene = this.scene;

    // Night sky, fog and lights.
    scene.background = new THREE.Color(0x0a0620);
    scene.fog = new THREE.Fog(0x0a0620, 120, 420);
    scene.add(new THREE.HemisphereLight(0x6a5acd, 0x1a1a2e, 1.4));
    scene.add(new THREE.AmbientLight(0x334, 0.6));
    const moon = new THREE.DirectionalLight(0xbfd8ff, 1.0);
    moon.position.set(-120, 200, -80);
    scene.add(moon);

    // Stars.
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2;
      const e = rand() * Math.PI * 0.45 + 0.08;
      const r = 480;
      starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 1.6, sizeAttenuation: false })));

    // Moon disc.
    const moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(18, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8f2ff, fog: false }),
    );
    moonDisc.position.set(-260, 190, -320);
    moonDisc.lookAt(0, 0, 0);
    scene.add(moonDisc);

    // Ground: dark base for the whole island.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0x0d0d16 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 40);
    scene.add(ground);

    // Roads: asphalt strips with dashes, both directions.
    const roadTex = roadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const centers = this.roadCenters();
    const roadLen = CFG.blocks * PITCH + CFG.roadWidth;
    for (const c of centers) {
      for (const [w, l, x, z] of [
        [CFG.roadWidth, roadLen, c, 0],
        [roadLen, CFG.roadWidth, 0, c],
      ]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, 0, z);
        road.material = roadMat;
        scene.add(road);
        const tex = roadTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(l / 14)));
        road.material = new THREE.MeshLambertMaterial({ map: tex });
      }
    }

    // Sidewalk slabs inside each block (pale strips around the buildings).
    // Blocks sit BETWEEN the roads: their centres are a half-pitch off the
    // road centres, so no building ever stands on a road.
    const walkMat = new THREE.MeshLambertMaterial({ color: 0x2a2a38 });
    for (let bx = 0; bx < CFG.blocks - 1; bx++) {
      for (let bz = 0; bz < CFG.blocks - 1; bz++) {
        const cx = -HALF + PITCH * bx + PITCH;
        const cz = -HALF + PITCH * bz + PITCH;
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(CFG.blockSize + 6, CFG.blockSize + 6), walkMat);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(cx, 0.02, cz);
        scene.add(slab);
      }
    }

    // Buildings: one or two towers per block, neon roof edges, glowing windows.
    const winTexs = [windowTexture(rand), windowTexture(rand), windowTexture(rand)];
    const neonMats = NEON.map((c) => new THREE.MeshBasicMaterial({ color: c }));
    let bi = 0;
    for (let bx = 0; bx < CFG.blocks - 1; bx++) {
      for (let bz = 0; bz < CFG.blocks - 1; bz++) {
        const cx = -HALF + PITCH * bx + PITCH;
        const cz = -HALF + PITCH * bz + PITCH;
        const downtown = Math.abs(cx) < 90 && Math.abs(cz) < 90;
        const towers = downtown ? 2 : rand() < 0.55 ? 2 : 1;
        for (let t = 0; t < towers; t++) {
          const w = 16 + rand() * 18;
          const d = 16 + rand() * 18;
          const h = downtown ? 35 + rand() * 55 : 10 + rand() * 26;
          const ox = (rand() - 0.5) * (CFG.blockSize - w - 8);
          const oz = (rand() - 0.5) * (CFG.blockSize - d - 8);
          const x = cx + ox + (towers === 2 ? (t === 0 ? -9 : 9) : 0);
          const z = cz + oz;
          const tex = winTexs[bi % winTexs.length];
          const mat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e, roughness: 0.85, metalness: 0.2,
            emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, map: tex,
          });
          const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          tower.position.set(x, h / 2, z);
          scene.add(tower);
          // Neon roof edge: four thin glowing strips.
          const neon = neonMats[bi % neonMats.length];
          const edge = 0.5;
          const mkStrip = (sx, sz, px, pz) => {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, edge, sz), neon);
            strip.position.set(px, h + edge / 2, pz);
            scene.add(strip);
          };
          mkStrip(w + 0.4, edge, x, z - d / 2);
          mkStrip(w + 0.4, edge, x, z + d / 2);
          mkStrip(edge, d + 0.4, x - w / 2, z);
          mkStrip(edge, d + 0.4, x + w / 2, z);
          // Rooftop beacon on the tallest towers.
          if (h > 55) {
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3355 }));
            beacon.position.set(x, h + 1.6, z);
            scene.add(beacon);
          }
          this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
          bi++;
        }
      }
    }

    // Beach: sand strip, palms, then the ocean.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 60),
      new THREE.MeshLambertMaterial({ color: 0xc2a878 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, CFG.beachZ - 10);
    scene.add(sand);
    const oceanTex = oceanTexture();
    oceanTex.repeat.set(10, 3);
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 140),
      new THREE.MeshLambertMaterial({ map: oceanTex, color: 0x9fd4ff }),
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(0, 0.02, CFG.oceanZ + 55);
    scene.add(this.ocean);
    // Boardwalk along the sand.
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a2c22 }),
    );
    board.rotation.x = -Math.PI / 2;
    board.position.set(0, 0.05, CFG.beachZ - 38);
    scene.add(board);

    // Palm trees along Ocean Drive and the beach.
    this.buildPalms(rand);

    // Streetlights at intersections: pole, arm, glowing bulb, plus a few real lights.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    let lightCount = 0;
    for (const cx of centers) {
      for (const cz of centers) {
        if ((cx + cz) % 148 !== 0) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
        pole.position.set(cx + 6, 3.5, cz + 6);
        scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), bulbMat);
        bulb.position.set(cx + 6, 7.2, cz + 6);
        scene.add(bulb);
        if (lightCount < 8) {
          const pl = new THREE.PointLight(0xffd9a0, 60, 55, 1.8);
          pl.position.set(cx + 6, 7, cz + 6);
          scene.add(pl);
          lightCount++;
        }
      }
    }

    // Road points for spawns: every intersection and mid-block road point.
    for (const cx of centers) {
      for (const cz of centers) this.roadPoints.push({ x: cx, z: cz });
    }
    for (let i = 0; i < centers.length - 1; i++) {
      const mid = (centers[i] + centers[i + 1]) / 2;
      for (const c of centers) {
        this.roadPoints.push({ x: mid, z: c });
        this.roadPoints.push({ x: c, z: mid });
      }
    }
    // Ocean Drive spawn points along the beach road.
    for (let x = -220; x <= 220; x += 44) this.roadPoints.push({ x, z: CFG.beachZ - 44 });
  }

  buildPalms(rand) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x1f7a3a, side: THREE.DoubleSide });
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 7, 7), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = 0.08;
    palm.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.7, 7.1, Math.sin(a) * 1.7);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      frond.scale.set(1, 1, 0.28);
      palm.add(frond);
    }
    for (let i = 0; i < 34; i++) {
      const p = palm.clone();
      const alongBeach = rand() < 0.6;
      const x = alongBeach ? -260 + rand() * 520 : -240 + rand() * 480;
      const z = alongBeach ? CFG.beachZ - 30 + rand() * 22 : -240 + rand() * 440;
      p.position.set(x, 0, z);
      p.rotation.y = rand() * Math.PI * 2;
      const s = 0.8 + rand() * 0.5;
      p.scale.set(s, s, s);
      this.scene.add(p);
      this.colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
    }
  }

  /** A random point on a road, optionally far from (x, z). */
  randomRoadPoint(awayFrom = null, minDist = 0) {
    const pts = this.roadPoints;
    for (let tries = 0; tries < 40; tries++) {
      const p = pts[Math.floor(this.rand() * pts.length)];
      if (!awayFrom) return p;
      const dx = p.x - awayFrom.x;
      const dz = p.z - awayFrom.z;
      if (dx * dx + dz * dz >= minDist * minDist) return p;
    }
    return pts[0];
  }

  /** Push a circle (x, z, radius) out of every building collider. Returns true on hit. */
  collideCircle(pos, radius) {
    let hit = false;
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          pos.x = b.maxX + radius;
        }
      }
    }
    // World bounds: the island ends at the ocean and the north edge.
    const lim = 275;
    if (pos.x < -lim) pos.x = -lim;
    if (pos.x > lim) pos.x = lim;
    if (pos.z < -lim) pos.z = -lim;
    if (pos.z > CFG.beachZ + 8) pos.z = CFG.beachZ + 8;
    return hit;
  }

  districtAt(x, z) {
    const i = Math.abs(Math.floor(x / 60) + Math.floor(z / 60)) % DISTRICTS.length;
    return DISTRICTS[i];
  }
}
