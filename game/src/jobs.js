// LEONIDA NIGHTS — work. Three job markers glow around the city at all times:
// a Delivery (reach the drop in time), a Getaway (reach the drop while the
// law is on you) and a Street Race (beat two rivals through five checkpoints).
// Finish one and another appears; the money and rep buy cars and rank.

import * as THREE from 'three';
import { JOB_TYPES, CFG } from './config.js';
import { buildCarMesh } from './car.js';

const MARKER_TYPES = ['delivery', 'getaway', 'race'];

function beaconMesh(color) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 13;
  g.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.18, 8, 32),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  core.position.y = 2.2;
  g.add(core);
  g.userData.ring = ring;
  g.userData.core = core;
  return g;
}

export class Jobs {
  constructor(scene, world, rand) {
    this.scene = scene;
    this.world = world;
    this.rand = rand;
    this.markers = [];
    this.active = null;
    for (let i = 0; i < CFG.jobMarkerCount; i++) this.spawnMarker(MARKER_TYPES[i]);
  }

  spawnMarker(type) {
    const p = this.world.randomRoadPoint({ x: 0, z: 0 }, 60);
    const def = JOB_TYPES[type];
    const mesh = beaconMesh(def.color);
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    this.markers.push({ type, x: p.x, z: p.z, mesh });
  }

  removeMarker(m) {
    this.scene.remove(m.mesh);
    this.markers.splice(this.markers.indexOf(m), 1);
  }

  /** The marker the player stands on, if any. */
  markerAt(x, z, maxDist = 7) {
    for (const m of this.markers) {
      const dx = m.x - x;
      const dz = m.z - z;
      if (dx * dx + dz * dz < maxDist * maxDist) return m;
    }
    return null;
  }

  startJob(marker, player, police) {
    const type = marker.type;
    const def = JOB_TYPES[type];
    const from = { x: marker.x, z: marker.z };
    this.removeMarker(marker);
    if (type === 'getaway') police.setWanted(3);
    const dest = this.world.randomRoadPoint(from, 130);
    const dist = Math.hypot(dest.x - from.x, dest.z - from.z);
    const job = {
      type,
      def,
      dest,
      timer: type === 'delivery' ? Math.max(30, dist / 14) : type === 'race' ? 150 : 120,
      total: 0,
      checkpoints: [],
      cpIndex: 0,
      racers: [],
      destMesh: beaconMesh(def.color),
    };
    job.total = job.timer;
    job.destMesh.position.set(dest.x, 0, dest.z);
    job.destMesh.scale.setScalar(1.3);
    this.scene.add(job.destMesh);
    if (type === 'race') {
      // Five checkpoints from the start to the destination.
      for (let i = 1; i <= 5; i++) {
        const t = i / 6;
        const cx = from.x + (dest.x - from.x) * t + (this.rand() - 0.5) * 60;
        const cz = from.z + (dest.z - from.z) * t + (this.rand() - 0.5) * 60;
        job.checkpoints.push({ x: cx, z: cz });
      }
      job.checkpoints.push({ x: dest.x, z: dest.z });
      // Two rival racers start beside the player.
      for (let i = 0; i < 2; i++) {
        const mesh = buildCarMesh(i === 0 ? 0xaa3355 : 0x2fae5f, {});
        const sx = from.x + (i === 0 ? -6 : 6);
        const sz = from.z + 4;
        mesh.position.set(sx, 0, sz);
        this.scene.add(mesh);
        job.racers.push({ mesh, x: sx, z: sz, heading: player.heading, speed: 0, cp: 0, finished: false });
      }
    }
    this.active = job;
    return job;
  }

  /** Distance from the player to the active objective. */
  objectiveDistance(player) {
    if (!this.active) return null;
    const px = player.inCar ? player.car.x : player.x;
    const pz = player.inCar ? player.car.z : player.z;
    if (this.active.type === 'race') {
      const cp = this.active.checkpoints[this.active.cpIndex];
      if (!cp) return null;
      return Math.hypot(cp.x - px, cp.z - pz);
    }
    return Math.hypot(this.active.dest.x - px, this.active.dest.z - pz);
  }

  update(dt, player, events) {
    // Animate the marker beacons.
    const t = performance.now() * 0.001;
    for (const m of this.markers) {
      m.mesh.userData.ring.rotation.z = t * 0.8;
      m.mesh.userData.core.position.y = 2.2 + Math.sin(t * 2 + m.x) * 0.35;
    }
    if (!this.active) return;
    const job = this.active;
    job.timer -= dt;
    job.destMesh.userData.ring.rotation.z = t;
    job.destMesh.userData.core.position.y = 2.2 + Math.sin(t * 2) * 0.35;
    const px = player.inCar ? player.car.x : player.x;
    const pz = player.inCar ? player.car.z : player.z;

    if (job.type === 'race') {
      // Rival racers chase the checkpoints.
      const cp = job.checkpoints[job.cpIndex];
      for (const r of job.racers) {
        if (r.finished) continue;
        const target = job.checkpoints[r.cp] || job.checkpoints[job.checkpoints.length - 1];
        const dx = target.x - r.x;
        const dz = target.z - r.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let dh = want - r.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        r.heading += Math.max(-2 * dt, Math.min(2 * dt, dh));
        r.speed += (26 - r.speed) * dt * 0.5;
        r.x += Math.sin(r.heading) * r.speed * dt;
        r.z += Math.cos(r.heading) * r.speed * dt;
        r.mesh.position.set(r.x, 0, r.z);
        r.mesh.rotation.y = r.heading;
        if (d < 10) {
          r.cp++;
          if (r.cp >= job.checkpoints.length) r.finished = true;
        }
      }
      if (cp) {
        const dx = cp.x - px;
        const dz = cp.z - pz;
        if (dx * dx + dz * dz < 10 * 10) {
          job.cpIndex++;
          events.onCheckpoint && events.onCheckpoint(job.cpIndex, job.checkpoints.length);
          if (job.cpIndex >= job.checkpoints.length) {
            const rivalsDone = job.racers.filter((r) => r.finished).length;
            this.finishJob(rivalsDone === 0 ? 1 : 0.5, events, rivalsDone === 0 ? 'You won the race!' : 'Second place — the rivals were faster.');
            return;
          }
        }
      }
    } else {
      const dx = job.dest.x - px;
      const dz = job.dest.z - pz;
      if (dx * dx + dz * dz < 9 * 9) {
        this.finishJob(1, events, job.type === 'getaway' ? 'Clean getaway!' : 'Delivery complete!');
        return;
      }
    }
    if (job.timer <= 0) {
      this.failJob(events, 'Too slow — the job went to someone else.');
    }
  }

  finishJob(multiplier, events, text) {
    const job = this.active;
    const pay = Math.round(job.def.pay * multiplier);
    const rep = Math.round(job.def.rep * multiplier);
    this.cleanupJob();
    // A fresh marker of the same type appears elsewhere.
    this.spawnMarker(job.type);
    events.onComplete && events.onComplete({ pay, rep, text });
  }

  failJob(events, text) {
    const job = this.active;
    this.cleanupJob();
    this.spawnMarker(job.type);
    events.onFail && events.onFail({ text });
  }

  cleanupJob() {
    if (!this.active) return;
    this.scene.remove(this.active.destMesh);
    for (const r of this.active.racers || []) this.scene.remove(r.mesh);
    this.active = null;
  }

  abort() {
    if (!this.active) return;
    const type = this.active.type;
    this.cleanupJob();
    this.spawnMarker(type);
  }
}
