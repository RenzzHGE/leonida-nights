// LEONIDA NIGHTS — the HUD. Cash, rep and rank, wanted stars, speed, the job
// banner, message feed and a live canvas minimap: roads, the beach, the player
// arrow, job markers, the destination and every police cruiser.

import { RANKS } from './config.js';

export function rankFor(rep) {
  let rank = RANKS[0];
  for (const r of RANKS) if (rep >= r.rep) rank = r;
  return rank;
}

export function nextRank(rep) {
  for (const r of RANKS) if (rep < r.rep) return r;
  return null;
}

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      cash: document.getElementById('cash'),
      repFill: document.getElementById('rep-fill'),
      rank: document.getElementById('rank'),
      stars: document.getElementById('stars'),
      clock: document.getElementById('clock'),
      jobBanner: document.getElementById('job-banner'),
      minimap: document.getElementById('minimap'),
      speedNum: document.getElementById('speed-num'),
      carName: document.getElementById('car-name'),
      message: document.getElementById('message'),
      prompt: document.getElementById('prompt'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.msgTimer = null;
    this.clockMinutes = 2 * 60 + 14; // 02:14 AM, the night ticks on
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  showMessage(text, ms = 2600) {
    this.el.message.textContent = text;
    window.clearTimeout(this.msgTimer);
    this.msgTimer = window.setTimeout(() => { this.el.message.textContent = ''; }, ms);
  }

  showPrompt(text) {
    this.el.prompt.textContent = text || '';
  }

  /** Full HUD refresh from the game state, once a frame. */
  update(state) {
    this.el.cash.textContent = `$${Math.floor(state.cash).toLocaleString('en-US')}`;
    const rank = rankFor(state.rep);
    const next = nextRank(state.rep);
    const span = next ? next.rep - rank.rep : 1;
    const fill = next ? Math.min(100, ((state.rep - rank.rep) / span) * 100) : 100;
    this.el.repFill.style.width = `${fill}%`;
    this.el.rank.textContent = rank.title;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < state.wanted ? 'lit' : 'dim'}">★</span>`;
    this.el.stars.innerHTML = stars;
    // Clock ticks one game-minute every two real seconds.
    this.clockMinutes += 1 / 120;
    const hh = Math.floor(this.clockMinutes / 60) % 24;
    const mm = Math.floor(this.clockMinutes % 60);
    const ampm = hh < 12 ? 'AM' : 'PM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    this.el.clock.textContent = `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
    // Speed and car.
    this.el.speedNum.textContent = String(Math.round(state.speedMph));
    this.el.carName.textContent = state.inCar ? `${state.carName}${state.damage >= 100 ? ' — STALLED' : state.damage > 55 ? ' — smoking' : ''}` : 'On foot';
    // Job banner.
    if (state.job) {
      const j = state.job;
      const t = Math.max(0, Math.ceil(j.timer));
      const mm2 = Math.floor(t / 60);
      const ss = String(t % 60).padStart(2, '0');
      const dist = state.jobDistance != null ? `${Math.round(state.jobDistance)}m` : '';
      const label = j.type === 'race'
        ? `CHECKPOINT ${j.cpIndex + 1}/${j.checkpoints.length}`
        : `${j.def.name.toUpperCase()} — ${dist}`;
      this.el.jobBanner.innerHTML = `${label}<span class="sub">${mm2}:${ss} left &nbsp;·&nbsp; $${j.def.pay} + ${j.def.rep} REP</span>`;
      this.el.jobBanner.classList.remove('hidden');
    } else {
      this.el.jobBanner.classList.add('hidden');
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 220;
    const W = 580; // world span shown, -290..290
    const toMap = (x, z) => [((x + W / 2) / W) * S, ((z + W / 2) / W) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a0620';
    ctx.fillRect(0, 0, S, S);
    // Ocean and beach at the south (bottom of the map).
    const [, beachY] = toMap(0, 240);
    ctx.fillStyle = '#0a3a55';
    ctx.fillRect(0, beachY, S, S - beachY);
    ctx.fillStyle = '#c2a878';
    ctx.fillRect(0, beachY - 8, S, 8);
    // Roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 4;
    for (const c of state.roadCenters) {
      const [x] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      const [, y] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    // Job markers.
    for (const m of state.markers) {
      const [x, y] = toMap(m.x, m.z);
      ctx.fillStyle = `#${m.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Active destination: a pulsing ring.
    if (state.job) {
      const dest = state.job.type === 'race'
        ? state.job.checkpoints[state.job.cpIndex]
        : state.job.dest;
      if (dest) {
        const [x, y] = toMap(dest.x, dest.z);
        const pulse = 7 + Math.sin(performance.now() * 0.006) * 2.5;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Police cruisers.
    for (const c of state.cops) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillStyle = '#ff3355';
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated by heading (heading 0 = +z = down the map).
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - state.heading);
    ctx.fillStyle = '#7dffb0';
    ctx.strokeStyle = '#062b16';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
