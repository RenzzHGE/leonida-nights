// LEONIDA NIGHTS — the game itself. Boots Three.js, owns the loop, and wires
// every system together: the city, the player's car and feet, traffic,
// police, jobs, HUD, sound and saves. Played with keyboard; the whole night
// is one open world with no loading screens.

import * as THREE from 'three';
import { World, mulberry32 } from './world.js';
import { PlayerCar, carById } from './car.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Jobs } from './jobs.js';
import { Hud, rankFor, nextRank } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { CFG, CARS, UPGRADES, RANKS, JOB_TYPES } from './config.js';
import { loadSave, storeSave, clearSave } from './save.js';

const REPAIR_COST = 200;

export class Game {
  constructor() {
    this.save = loadSave();
    this.state = 'menu'; // menu | playing | paused | overlay
    this.overlayTimer = 0;
    this.rand = mulberry32(20261118);
    this.sound = new SoundBank();
    this.input = new Input();
    this.hud = new Hud();

    // Renderer and scene.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.getElementById('game-root').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 26, 262);

    // World and systems.
    this.world = new World(this.scene);
    this.car = new PlayerCar(this.scene, carById(this.save.car), this.save.upgrades);
    this.traffic = new Traffic(this.scene, this.world, this.rand);
    this.police = new Police(this.scene, this.world, this.rand, this.sound);
    this.jobs = new Jobs(this.scene, this.world, this.rand);

    // The player on foot.
    this.inCar = true;
    this.px = 0;
    this.pz = 232;
    this.pHeading = Math.PI;
    this.foot = this.buildPedestrian(0xff2e88);
    this.foot.visible = false;
    this.scene.add(this.foot);
    this.car.reset(0, 235, Math.PI);

    // Camera smoothing.
    this.camPos = new THREE.Vector3(0, 26, 262);
    this.camLook = new THREE.Vector3(0, 2, 235);

    this.lastTime = performance.now();
    this.saveTimer = 0;
    this.wireMenus();
    window.addEventListener('resize', () => this.onResize());
    this.applyShotMode();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  buildPedestrian(jacket) {
    const g = new THREE.Group();
    const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6b, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1c1c2e, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8), jacketMat);
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
    head.position.y = 1.78;
    g.add(head);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.72, 8), pants);
    legs.position.y = 0.36;
    g.add(legs);
    return g;
  }

  // ---------- menus ----------

  wireMenus() {
    const menu = document.getElementById('menu');
    const pause = document.getElementById('pause');
    const overlay = document.getElementById('overlay');
    const btnPlay = document.getElementById('btn-play');
    const btnContinue = document.getElementById('btn-continue');
    const btnResume = document.getElementById('btn-resume');
    const btnRestart = document.getElementById('btn-restart');
    const btnQuit = document.getElementById('btn-quit');
    const stats = document.getElementById('menu-stats');

    const refreshMenu = () => {
      const has = this.save.earned > 0 || this.save.jobsDone > 0 || this.save.cash !== 600;
      btnContinue.classList.toggle('hidden', !has);
      stats.textContent = has
        ? `$${Math.floor(this.save.cash).toLocaleString('en-US')} · ${rankFor(this.save.rep).title} · ${this.save.jobsDone} jobs done`
        : 'A new night in Leonida. $600 in your pocket. Make it count.';
    };
    refreshMenu();
    btnPlay.addEventListener('click', () => {
      this.sound.unlock();
      menu.classList.add('hidden');
      this.startPlaying();
    });
    btnContinue.addEventListener('click', () => {
      this.sound.unlock();
      menu.classList.add('hidden');
      this.startPlaying();
    });
    btnResume.addEventListener('click', () => this.resume());
    btnRestart.addEventListener('click', () => {
      clearSave();
      window.location.reload();
    });
    btnQuit.addEventListener('click', () => {
      storeSave(this.save);
      pause.classList.add('hidden');
      this.state = 'menu';
      this.hud.hide();
      menu.classList.remove('hidden');
      refreshMenu();
    });
    this.menuEl = menu;
    this.pauseEl = pause;
    this.overlayEl = overlay;
    this.refreshMenu = refreshMenu;
  }

  startPlaying() {
    this.state = 'playing';
    this.hud.show();
    this.hud.showMessage('Welcome to Leonida. Find a glowing job marker — press E to start work.');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.renderPause();
    this.pauseEl.classList.remove('hidden');
    this.sound.setEngine(0, false);
  }

  resume() {
    this.pauseEl.classList.add('hidden');
    this.state = 'playing';
  }

  renderPause() {
    document.getElementById('pause-stats').textContent =
      `$${Math.floor(this.save.cash).toLocaleString('en-US')} · ${rankFor(this.save.rep).title} · ${this.save.jobsDone} jobs · $${Math.floor(this.save.earned).toLocaleString('en-US')} earned`;
    const garage = document.getElementById('garage');
    garage.innerHTML = '';
    for (const c of CARS) {
      const owned = this.save.owned.includes(c.id);
      const current = this.save.car === c.id;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `<div><div class="nm">${c.name}${current ? ' — YOUR RIDE' : ''}</div><div class="ds">${c.desc} Top ${Math.round(c.speed * 2.237)} MPH.</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = current ? 'SELECTED' : owned ? 'DRIVE IT' : `BUY $${c.price.toLocaleString('en-US')}`;
      btn.disabled = current || (!owned && this.save.cash < c.price);
      btn.addEventListener('click', () => {
        if (!owned) {
          this.save.cash -= c.price;
          this.save.owned.push(c.id);
          this.sound.cash();
        }
        this.save.car = c.id;
        this.car.setCar(c, this.save.upgrades);
        storeSave(this.save);
        this.renderPause();
        this.hud.showMessage(`${c.name} — yours. Drive it like you stole it.`);
      });
      row.appendChild(btn);
      garage.appendChild(row);
    }
    const ups = document.getElementById('upgrades');
    ups.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = this.save.upgrades[u.id] || 0;
      const maxed = lvl >= u.prices.length;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `<div><div class="nm">${u.name} — Lv ${lvl}/3</div><div class="ds">${u.desc}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = maxed ? 'MAXED' : `BUY $${u.prices[lvl].toLocaleString('en-US')}`;
      btn.disabled = maxed || this.save.cash < u.prices[lvl];
      btn.addEventListener('click', () => {
        this.save.cash -= u.prices[lvl];
        this.save.upgrades[u.id] = lvl + 1;
        this.car.setCar(carById(this.save.car), this.save.upgrades);
        this.sound.cash();
        storeSave(this.save);
        this.renderPause();
      });
      row.appendChild(btn);
      ups.appendChild(row);
    }
  }

  showOverlay(html, ms = 3200) {
    document.getElementById('overlay-inner').innerHTML = html;
    this.overlayEl.classList.remove('hidden');
    this.state = 'overlay';
    this.overlayTimer = ms / 1000;
  }

  // ---------- screenshot modes (for the maker's own screenshots) ----------

  applyShotMode() {
    const mode = new URLSearchParams(window.location.search).get('shot');
    if (!mode) return;
    document.getElementById('menu').classList.add('hidden');
    this.state = 'playing';
    this.hud.show();
    if (mode === 'drive') {
      this.car.reset(0, 150, Math.PI);
      this.inCar = true;
      this.car.speed = 22;
      this.shotThrottle = true;
      this.hud.showMessage('');
    } else if (mode === 'chase') {
      this.car.reset(0, 170, Math.PI);
      this.inCar = true;
      this.car.speed = 26;
      this.shotThrottle = true;
      this.police.setWanted(3);
      const marker = this.jobs.markers.find((m) => m.type === 'race') || this.jobs.markers[0];
      if (marker) this.jobs.startJob(marker, this.playerProxy(), this.police);
      this.hud.showMessage('');
    } else if (mode === 'foot') {
      this.exitCar();
      this.hud.showMessage('');
    }
  }

  playerProxy() {
    return {
      inCar: this.inCar,
      car: this.car,
      x: this.px,
      z: this.pz,
      heading: this.pHeading,
      walkSpeed: this.inCar ? 0 : CFG.walkSpeed,
    };
  }

  // ---------- car / foot switching ----------

  exitCar() {
    this.inCar = false;
    this.px = this.car.x + Math.cos(this.car.heading) * 3;
    this.pz = this.car.z - Math.sin(this.car.heading) * 3;
    this.pHeading = this.car.heading;
    this.foot.visible = true;
    this.foot.position.set(this.px, 0, this.pz);
    this.foot.rotation.y = this.pHeading;
  }

  enterCar() {
    this.inCar = true;
    this.foot.visible = false;
    this.car.reset(this.car.x, this.car.z, this.car.heading);
  }

  stealCar(trafficCar) {
    const color = trafficCar.mesh.children[0].material.color.getHex();
    this.traffic.removeCar(trafficCar);
    const stolen = {
      id: 'stolen', name: 'Stolen Ride', price: 0,
      speed: 34, accel: 13, grip: 2.6, color, desc: 'Hot. Very hot.',
    };
    this.car.setCar(stolen, this.save.upgrades);
    this.car.reset(this.car.x, this.car.z, this.car.heading);
    this.inCar = true;
    this.foot.visible = false;
    this.police.addWanted(1, 'stolen car');
    this.sound.cash();
    this.hud.showMessage('You stole a car! The law noticed. Lose them!');
  }

  // ---------- frame ----------

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'overlay') {
      this.overlayTimer -= dt;
      if (this.overlayTimer <= 0) {
        this.overlayEl.classList.add('hidden');
        this.state = 'playing';
      }
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  update(dt) {
    const input = this.input;
    if (input.wasPressed('Escape')) { this.pause(); return; }
    if (input.wasPressed('KeyG')) { this.pause(); return; }

    const player = this.playerProxy();
    const px = this.inCar ? this.car.x : this.px;
    const pz = this.inCar ? this.car.z : this.pz;

    // --- interactions ---
    if (input.wasPressed('KeyF')) {
      if (this.inCar) this.exitCar();
      else {
        const dx = this.car.x - this.px;
        const dz = this.car.z - this.pz;
        if (dx * dx + dz * dz < 25) this.enterCar();
      }
    }
    if (input.wasPressed('KeyE')) {
      const marker = this.jobs.markerAt(px, pz);
      if (marker && !this.jobs.active) {
        const job = this.jobs.startJob(marker, player, this.police);
        this.sound.cash();
        this.hud.showMessage(`${job.def.name} started — reach the gold marker!`);
      } else if (!this.inCar) {
        const near = this.traffic.nearestCar(this.px, this.pz, 6);
        if (near) this.stealCar(near);
        else {
          const dx = this.car.x - this.px;
          const dz = this.car.z - this.pz;
          if (dx * dx + dz * dz < 25) this.enterCar();
        }
      }
    }
    if (input.wasPressed('KeyR') && this.inCar && this.car.damage >= 100) {
      if (this.save.cash >= REPAIR_COST) {
        this.save.cash -= REPAIR_COST;
        this.car.repair();
        this.sound.cash();
        this.hud.showMessage('Car repaired. Back on the road.');
      } else {
        this.sound.denied();
        this.hud.showMessage('Not enough cash to repair ($200).');
      }
    }

    // --- driving / walking ---
    if (this.inCar) {
      const throttle = this.shotThrottle ? 1 : input.throttle();
      const impact = this.car.update(dt, throttle, input.steer(), input.held('Space'), this.world);
      if (impact > 0.25) {
        this.sound.crash(impact);
        if (impact > 0.5) this.police.addWanted(1, 'reckless driving');
      }
      this.sound.setEngine(Math.abs(this.car.speed) / this.car.topSpeed, true);
    } else {
      const run = input.held('ShiftLeft', 'ShiftRight');
      const speed = run ? CFG.runSpeed : CFG.walkSpeed;
      let mx = 0;
      let mz = 0;
      if (input.held('KeyW', 'ArrowUp')) mz -= 1;
      if (input.held('KeyS', 'ArrowDown')) mz += 1;
      if (input.held('KeyA', 'ArrowLeft')) mx -= 1;
      if (input.held('KeyD', 'ArrowRight')) mx += 1;
      if (mx !== 0 || mz !== 0) {
        // Move relative to the camera's facing (which follows the player).
        const camAngle = this.pHeading;
        const fx = Math.sin(camAngle);
        const fz = Math.cos(camAngle);
        const rx = Math.cos(camAngle);
        const rz = -Math.sin(camAngle);
        const len = Math.hypot(mx, mz);
        const nx = (fx * -mz + rx * mx) / len;
        const nz = (fz * -mz + rz * mx) / len;
        this.px += nx * speed * dt;
        this.pz += nz * speed * dt;
        this.pHeading = Math.atan2(nx, nz);
        this.world.collideCircle(this, 0.6);
        this.foot.position.set(this.px, Math.abs(Math.sin(performance.now() * 0.01)) * 0.05, this.pz);
        this.foot.rotation.y = this.pHeading;
      }
      this.sound.setEngine(0, false);
    }

    // --- traffic, police, jobs ---
    this.traffic.update(dt, this.playerProxy(), () => {
      this.police.addWanted(1, 'hit a pedestrian');
      this.hud.showMessage('You hit a pedestrian! Wanted level up.');
    }, () => {
      this.police.addWanted(1, 'hit and run');
    });
    const res = this.police.update(dt, this.playerProxy(), {
      onRam: () => this.sound.crash(0.4),
      onCooled: (w) => this.hud.showMessage(w === 0 ? 'You lost the cops. Clean.' : `Heat dropping — ${w} star${w === 1 ? '' : 's'} left.`),
    });
    if (res.busted) return this.getBusted();
    this.jobs.update(dt, this.playerProxy(), {
      onCheckpoint: (i, n) => {
        this.sound.blip(990, 0.14, 'triangle', 0.2);
        this.hud.showMessage(`Checkpoint ${i}/${n}!`);
      },
      onComplete: ({ pay, rep, text }) => this.completeJob(pay, rep, text),
      onFail: ({ text }) => {
        this.sound.denied();
        this.hud.showMessage(text);
      },
    });

    // --- prompts ---
    const marker = this.jobs.markerAt(px, pz);
    if (marker && !this.jobs.active) {
      this.hud.showPrompt(`Press E — start ${JOB_TYPES[marker.type].name} ($${JOB_TYPES[marker.type].pay})`);
    } else if (!this.inCar) {
      const near = this.traffic.nearestCar(this.px, this.pz, 6);
      if (near) this.hud.showPrompt('Press E — steal this car');
      else {
        const dx = this.car.x - this.px;
        const dz = this.car.z - this.pz;
        this.hud.showPrompt(dx * dx + dz * dz < 25 ? 'Press F — get in your car' : '');
      }
    } else if (this.car.damage >= 100) {
      this.hud.showPrompt(`Car stalled! Press R — repair ($${REPAIR_COST})`);
    } else {
      this.hud.showPrompt('');
    }

    // --- HUD ---
    this.hud.update({
      cash: this.save.cash,
      rep: this.save.rep,
      wanted: this.police.wanted,
      speedMph: this.inCar ? this.car.speedMph : 0,
      carName: this.car.def.name,
      damage: this.car.damage,
      inCar: this.inCar,
      job: this.jobs.active,
      jobDistance: this.jobs.objectiveDistance(this.playerProxy()),
      markers: this.jobs.markers.map((m) => ({ x: m.x, z: m.z, color: JOB_TYPES[m.type].color })),
      cops: this.police.cops.map((c) => ({ x: c.x, z: c.z })),
      roadCenters: this.world.roadCenters(),
      playerX: px,
      playerZ: pz,
      heading: this.inCar ? this.car.heading : this.pHeading,
    });

    // --- autosave ---
    this.saveTimer += dt;
    if (this.saveTimer > 10) {
      this.saveTimer = 0;
      storeSave(this.save);
    }
  }

  completeJob(pay, rep, text) {
    this.save.cash += pay;
    this.save.earned += pay;
    this.save.jobsDone += 1;
    const before = rankFor(this.save.rep);
    this.save.rep += rep;
    const after = rankFor(this.save.rep);
    this.sound.cash();
    storeSave(this.save);
    if (after.rep > before.rep) {
      const next = nextRank(this.save.rep);
      this.save.cash += after.bonus;
      this.sound.rankUp();
      this.showOverlay(
        `<div class="big">RANK UP</div><p>${text} +$${pay} · +${rep} REP</p><p>You are now <b>${after.title}</b> — bonus $${after.bonus.toLocaleString('en-US')}!</p>`,
        3600,
      );
    } else {
      this.hud.showMessage(`${text} +$${pay} · +${rep} REP`);
    }
  }

  getBusted() {
    const lost = Math.floor(this.save.cash * 0.2);
    this.save.cash -= lost;
    this.save.busts += 1;
    this.police.clearAll();
    this.jobs.abort();
    this.car.repair();
    this.car.reset(0, -190, 0);
    this.inCar = true;
    this.foot.visible = false;
    storeSave(this.save);
    this.sound.denied();
    this.showOverlay(
      `<h2>BUSTED</h2><p>The Leonida PD caught you. You lost $${lost.toLocaleString('en-US')} in fines and impound fees.</p><p>Back on the street. Stay low, drive fast.</p>`,
      3600,
    );
  }

  updateCamera(dt) {
    const px = this.inCar ? this.car.x : this.px;
    const pz = this.inCar ? this.car.z : this.pz;
    const heading = this.inCar ? this.car.heading : this.pHeading;
    const speedFrac = this.inCar ? Math.abs(this.car.speed) / this.car.topSpeed : 0;
    const dist = this.inCar ? 11 + speedFrac * 5 : 7;
    const height = this.inCar ? 4.6 + speedFrac * 1.2 : 3.2;
    const tx = px - Math.sin(heading) * dist;
    const tz = pz - Math.cos(heading) * dist;
    const k = 1 - Math.exp(-dt * (this.inCar ? 4.5 : 6));
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (height - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.x += (px + Math.sin(heading) * 8 - this.camLook.x) * k;
    this.camLook.y += (1.6 - this.camLook.y) * k;
    this.camLook.z += (pz + Math.cos(heading) * 8 - this.camLook.z) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    const targetFov = 62 + speedFrac * 14;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

new Game();
