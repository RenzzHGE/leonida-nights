// LEONIDA NIGHTS — the city's other inhabitants. Traffic cars cruise the road
// grid and turn at intersections; pedestrians stroll the sidewalks. Both are
// simple, cheap, and give the player something to dodge, steal from and —
// if they are careless — answer to the police for.

import * as THREE from 'three';
import { buildCarMesh } from './car.js';

const TRAFFIC_COLORS = [0xdddddd, 0x3a6fd8, 0x2fae5f, 0xd8d8d8, 0x8a5a2b, 0x555566, 0xaa3355, 0x2b8a8a];
const SHIRT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa78bfa, 0x95d5b2, 0xf4a259, 0xffffff, 0xff9de2];

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

export class Traffic {
  constructor(scene, world, rand) {
    this.scene = scene;
    this.world = world;
    this.rand = rand;
    this.cars = [];
    this.peds = [];
    this.spawnCars(14);
    this.spawnPeds(18);
  }

  spawnCars(n) {
    for (let i = 0; i < n; i++) {
      const p = this.world.randomRoadPoint();
      const taxi = this.rand() < 0.18;
      const mesh = buildCarMesh(taxi ? 0xffd166 : pick(TRAFFIC_COLORS, this.rand), { taxi });
      const heading = this.rand() < 0.5 ? 0 : Math.PI / 2;
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.cars.push({
        mesh,
        x: p.x,
        z: p.z,
        heading,
        speed: 8 + this.rand() * 7,
        target: null,
        stuck: 0,
        taxi,
      });
    }
  }

  spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const p = this.world.randomRoadPoint();
      const mesh = this.makePed(pick(SHIRT_COLORS, this.rand));
      mesh.position.set(p.x + 5, 0, p.z + 5);
      this.scene.add(mesh);
      this.peds.push({
        mesh,
        x: p.x + 5,
        z: p.z + 5,
        heading: this.rand() * Math.PI * 2,
        speed: 1.2 + this.rand() * 1.2,
        target: this.world.randomRoadPoint(),
        down: 0,
        downTimer: 0,
      });
    }
  }

  makePed(shirtColor) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6b, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), shirt);
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.75;
    g.add(head);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.7, 8), pants);
    legs.position.y = 0.35;
    g.add(legs);
    return g;
  }

  /** Nearest drivable traffic car to (x, z) within maxDist, or null. */
  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      const dx = c.x - x;
      const dz = c.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Remove a traffic car (stolen by the player) and spawn a replacement later. */
  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars.splice(this.cars.indexOf(car), 1);
    const p = this.world.randomRoadPoint({ x: 0, z: 0 }, 120);
    const mesh = buildCarMesh(pick(TRAFFIC_COLORS, this.rand), {});
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    this.cars.push({ mesh, x: p.x, z: p.z, heading: 0, speed: 9, target: null, stuck: 0, taxi: false });
  }

  update(dt, player, onPedHit, onCarHit) {
    // --- traffic cars: follow the grid, turn at intersections ---
    for (const c of this.cars) {
      if (!c.target) {
        const step = 74;
        const dirs = [
          { x: step, z: 0 }, { x: -step, z: 0 }, { x: 0, z: step }, { x: 0, z: -step },
        ];
        const d = dirs[Math.floor(this.rand() * dirs.length)];
        c.target = { x: c.x + d.x, z: c.z + d.z };
        // Stay on the island.
        c.target.x = Math.max(-260, Math.min(260, c.target.x));
        c.target.z = Math.max(-260, Math.min(240, c.target.z));
      }
      const dx = c.target.x - c.x;
      const dz = c.target.z - c.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      // Slow down if another car is right ahead.
      let ahead = false;
      for (const o of this.cars) {
        if (o === c) continue;
        const ox = o.x - c.x;
        const oz = o.z - c.z;
        const od = Math.sqrt(ox * ox + oz * oz);
        if (od < 9) {
          const dot = (ox * Math.sin(c.heading) + oz * Math.cos(c.heading)) / (od || 1);
          if (dot > 0.7) { ahead = true; break; }
        }
      }
      const speed = ahead ? 0 : c.speed;
      c.x += Math.sin(c.heading) * speed * dt;
      c.z += Math.cos(c.heading) * speed * dt;
      if (dist < 3) c.target = null;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Bump the player: a traffic car hit at speed is a crime, not a nudge.
      if (player && player.inCar) {
        const px = player.car.x - c.x;
        const pz = player.car.z - c.z;
        const pd = Math.sqrt(px * px + pz * pz);
        if (pd < 3.4) {
          const push = 3.4 - pd;
          const nx = px / (pd || 1);
          const nz = pz / (pd || 1);
          player.car.x += nx * push;
          player.car.z += nz * push;
          if (Math.abs(player.car.speed) > 9) {
            player.car.applyDamage(6);
            onCarHit && onCarHit();
          } else {
            player.car.speed *= 0.5;
          }
        }
      }
    }

    // --- pedestrians: stroll between road points, on the sidewalk edge ---
    for (const p of this.peds) {
      if (p.down > 0) {
        p.downTimer -= dt;
        p.mesh.rotation.x = -Math.PI / 2;
        if (p.downTimer <= 0) {
          p.down = 0;
          p.mesh.rotation.x = 0;
          const spot = this.world.randomRoadPoint();
          p.x = spot.x + 5;
          p.z = spot.z + 5;
          p.target = this.world.randomRoadPoint();
        }
        continue;
      }
      const dx = p.target.x - p.x;
      const dz = p.target.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2) {
        p.target = this.world.randomRoadPoint();
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      p.heading = wantHeading;
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Walk animation: a gentle bob.
      p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008 + p.x)) * 0.06;
      // Hit by the player's car at speed: down they go, and the law notices.
      if (player && player.inCar && Math.abs(player.car.speed) > 5) {
        const px = player.car.x - p.x;
        const pz = player.car.z - p.z;
        if (px * px + pz * pz < 2.6 * 2.6) {
          p.down = 1;
          p.downTimer = 20;
          onPedHit && onPedHit();
        }
      }
    }
  }
}
