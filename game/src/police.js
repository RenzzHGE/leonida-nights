// LEONIDA NIGHTS — the law. A wanted level of 0–5 stars, police cruisers
// that spawn, chase and ram, and the two ways out: break line of sight long
// enough to cool off, or get busted and pay the price.

import * as THREE from 'three';
import { buildCarMesh } from './car.js';
import { CFG } from './config.js';

export class Police {
  constructor(scene, world, rand, sound) {
    this.scene = scene;
    this.world = world;
    this.rand = rand;
    this.sound = sound;
    this.wanted = 0;
    this.cops = [];
    this.unseenTimer = 0;
    this.bustedTimer = 0;
    this.coolTimer = 0;
    this.heat = 0; // 0..1, how recently the player was seen committing a crime
  }

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = Math.min(CFG.wantedMax, this.wanted + n);
    this.heat = 1;
    if (this.wanted > before) this.syncCops();
    return this.wanted;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(CFG.wantedMax, n));
    this.heat = this.wanted > 0 ? 1 : 0;
    this.syncCops();
  }

  /** Keep the number of cruisers on the street equal to the wanted level. */
  syncCops() {
    const want = Math.min(this.wanted, 4);
    while (this.cops.length < want) {
      const p = this.world.randomRoadPoint({ x: 0, z: 0 }, 90);
      const mesh = buildCarMesh(0xe8e8e8, { police: true });
      mesh.position.set(p.x, 0, p.z);
      this.scene.add(mesh);
      this.cops.push({ mesh, x: p.x, z: p.z, heading: 0, speed: 0 });
    }
    while (this.cops.length > want) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
  }

  clearAll() {
    this.wanted = 0;
    this.heat = 0;
    this.bustedTimer = 0;
    this.unseenTimer = 0;
    this.syncCops();
  }

  update(dt, player, events) {
    // Heat cools off when the player behaves.
    this.heat = Math.max(0, this.heat - dt * 0.02);
    if (this.wanted === 0) {
      this.sound.setSiren(false);
      return { busted: false };
    }
    this.sound.setSiren(true);

    const px = player.inCar ? player.car.x : player.x;
    const pz = player.inCar ? player.car.z : player.z;
    const playerSpeed = player.inCar ? Math.abs(player.car.speed) : player.walkSpeed;

    // Find the nearest cruiser.
    let nearest = Infinity;
    for (const c of this.cops) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nearest) nearest = d;
      // Pursuit steering: turn toward the player, faster than traffic.
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const top = 30 + this.wanted * 3.5;
      const targetSpeed = d > 12 ? top : top * 0.7;
      c.speed += (targetSpeed - c.speed) * dt * 0.8;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      this.world.collideCircle(c, 2.1);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Flash the light bar.
      const bar = c.mesh.userData.lightBar;
      if (bar) {
        const phase = Math.floor(performance.now() / 260) % 2 === 0;
        bar.red.material.color.setHex(phase ? 0xff2233 : 0x551111);
        bar.blue.material.color.setHex(phase ? 0x111155 : 0x2255ff);
      }
      // Ram the player.
      if (d < 3.6 && player.inCar) {
        const nx = (player.car.x - c.x) / (d || 1);
        const nz = (player.car.z - c.z) / (d || 1);
        player.car.x += nx * 1.2;
        player.car.z += nz * 1.2;
        player.car.speed *= 0.82;
        player.car.applyDamage(2.5);
        events.onRam && events.onRam();
      }
    }

    // Busted: a cruiser sits on you while you are slow.
    if (nearest < 5 && playerSpeed < 5) {
      this.bustedTimer += dt;
      if (this.bustedTimer >= CFG.bustedHoldSeconds) {
        this.bustedTimer = 0;
        return { busted: true };
      }
    } else {
      this.bustedTimer = 0;
    }

    // Cooling off: stay far from every cruiser and the heat drops a star.
    if (nearest > CFG.loseCopsDistance) {
      this.unseenTimer += dt;
      if (this.unseenTimer >= CFG.loseCopsSeconds) {
        this.unseenTimer = 0;
        this.wanted = Math.max(0, this.wanted - 1);
        this.syncCops();
        events.onCooled && events.onCooled(this.wanted);
        if (this.wanted === 0) this.sound.setSiren(false);
      }
    } else {
      this.unseenTimer = 0;
    }
    return { busted: false };
  }
}
