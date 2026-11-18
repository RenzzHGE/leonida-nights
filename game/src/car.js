// LEONIDA NIGHTS — cars. Builds every car mesh from boxes and cylinders
// (body, cabin, wheels, headlights, neon underglow) and drives the player's
// car with arcade physics: acceleration, speed-sensitive steering, handbrake
// drift, damage and collisions.

import * as THREE from 'three';
import { CARS } from './config.js';

/** A low-poly car. `color` is the paint; `police` adds a light bar. */
export function buildCarMesh(color, { police = false, taxi = false } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c14, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.15, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.2), glass);
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.0), paint);
  hood.position.set(0, 0.82, 1.55);
  g.add(hood);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), dark);
  spoiler.position.set(0, 0.95, -2.05);
  g.add(spoiler);

  // Wheels: steer the front pair visually.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [x, z, front] of [[-0.95, 1.45, true], [0.95, 1.45, true], [-0.95, -1.45, false], [0.95, -1.45, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(wheel);
    pivot.add(hub);
    g.add(pivot);
    wheels.push({ pivot, front });
  }

  // Headlights and taillights (emissive so they read at night).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    h.position.set(x, 0.62, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const x of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    t.position.set(x, 0.62, -2.22);
    g.add(t);
  }

  // Neon underglow.
  const glowColor = police ? 0x3355ff : 0xff2e88;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.0),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.22 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.06;
  g.add(glow);

  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.4), dark);
    bar.position.set(0, 1.36, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.set(-0.32, 1.36, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.32, 1.36, -0.25);
    g.add(blue);
    g.userData.lightBar = { red, blue };
  }
  if (taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    sign.position.set(0, 1.42, -0.25);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

/** The player's car: arcade physics over the world grid. */
export class PlayerCar {
  constructor(scene, carDef, upgrades) {
    this.scene = scene;
    this.setCar(carDef, upgrades);
    this.x = 0;
    this.z = 235;
    this.heading = Math.PI; // face north, into the city
    this.speed = 0;
    this.damage = 0; // 0..100, at 100 the car stalls
    this.drift = 0; // lateral slide amount
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
  }

  setCar(carDef, upgrades) {
    if (this.mesh) this.scene.remove(this.mesh);
    this.def = carDef;
    this.upgrades = upgrades || { engine: 0, tires: 0, armor: 0 };
    this.mesh = buildCarMesh(carDef.color);
    this.mesh.position.set(this.x || 0, 0, this.z || 235);
    this.mesh.rotation.y = this.heading || Math.PI;
    this.scene.add(this.mesh);
  }

  get topSpeed() {
    return this.def.speed * (1 + 0.12 * this.upgrades.engine);
  }

  get grip() {
    return this.def.grip * (1 + 0.15 * this.upgrades.tires);
  }

  get armor() {
    return 1 + 0.34 * this.upgrades.armor;
  }

  get speedMph() {
    return Math.abs(this.speed) * 2.237;
  }

  reset(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.damage = 0;
    this.drift = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  /** Returns impact strength 0..1 when a collision happened this frame. */
  update(dt, throttle, steer, handbrake, world) {
    const top = this.topSpeed;
    const stalled = this.damage >= 100;
    // Acceleration and braking.
    if (!stalled) {
      if (throttle > 0) this.speed += this.def.accel * dt * (1 - Math.max(0, this.speed) / top);
      else if (throttle < 0) {
        if (this.speed > 0.5) this.speed -= this.def.accel * 1.6 * dt; // brake
        else this.speed = Math.max(-top * 0.35, this.speed - this.def.accel * 0.6 * dt); // reverse
      }
    }
    // Drag and rolling resistance.
    this.speed -= this.speed * 0.35 * dt;
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    // Steering: stronger at low speed, weaker at top speed; drift on handbrake.
    const spd = Math.abs(this.speed);
    const steerAuthority = 1.6 * Math.min(1, spd / 12 + 0.25) * (this.grip / 3);
    this.heading += steer * steerAuthority * dt * Math.sign(this.speed || 1) * (handbrake ? 1.7 : 1);
    if (handbrake && spd > 8) {
      this.drift += (1 - this.drift) * dt * 3;
      this.speed *= 1 - 0.5 * dt;
    } else {
      this.drift += (0 - this.drift) * dt * 4;
    }
    // Move, with a sideways slide while drifting.
    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);
    const slide = this.drift * 0.55;
    const moveX = fwdX * this.speed * dt + Math.cos(this.heading) * this.speed * slide * dt * 0.4;
    const moveZ = fwdZ * this.speed * dt - Math.sin(this.heading) * this.speed * slide * dt * 0.4;
    const beforeX = this.x;
    const beforeZ = this.z;
    this.x += moveX;
    this.z += moveZ;
    // Collide with buildings and props; a hard hit costs speed and damage.
    const hit = world.collideCircle(this, 2.1);
    let impact = 0;
    if (hit) {
      impact = Math.min(1, spd / 30);
      if (spd > 6) {
        this.speed *= 0.45;
        this.damage = Math.min(100, this.damage + (spd / this.armor) * 0.55);
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Visuals: steer the front wheels, lean the body into turns.
    const steerVis = steer * 0.42;
    for (const w of this.mesh.userData.wheels) {
      if (w.front) w.pivot.rotation.y = steerVis;
      w.pivot.children[0].rotation.x += this.speed * dt * 0.5;
    }
    this.mesh.rotation.z = -steer * Math.min(1, spd / 25) * 0.05;
    return impact;
  }

  applyDamage(amount) {
    this.damage = Math.min(100, this.damage + amount / this.armor);
  }

  repair() {
    this.damage = 0;
  }
}

/** Look up a car definition by id. */
export function carById(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}
