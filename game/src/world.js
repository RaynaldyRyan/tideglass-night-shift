// Tideglass: Night Shift — the simulation. One World owns the thief, the guards
// and their vision cones, the sweeping cameras, the loot case, the decoy coin
// and the alarm meter. It knows nothing about drawing or input devices: step()
// takes a plain input object ({ mx, my, grab, click }) and advances the rules.
import {
  ALARM,
  CAMERA,
  GUARD,
  LOOT_POINTS,
  NO_DETECTION_POINTS,
  PLAYER,
  ROOM,
  TIME_BONUS_PER_SECOND,
  UNUSED_DECOY_POINTS,
} from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_SPOTTED = 1;
export const EVENT_LOOT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_COMPLETE = 8;

const TAU = Math.PI * 2;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function angleTowards(from, to, maxStep) {
  const d = angleDiff(to, from);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

// True when the segment (x1,y1)-(x2,y2) touches the rectangle.
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let a = (r.x - x1) / dx;
    let b = (r.x + r.w - x1) / dx;
    if (a > b) [a, b] = [b, a];
    tmin = Math.max(tmin, a);
    tmax = Math.min(tmax, b);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let a = (r.y - y1) / dy;
    let b = (r.y + r.h - y1) / dy;
    if (a > b) [a, b] = [b, a];
    tmin = Math.max(tmin, a);
    tmax = Math.min(tmax, b);
    if (tmin > tmax) return false;
  }
  return true;
}

// The room's border walls as rectangles, so sight and movement share them.
function borderWalls() {
  return [
    { x: 0, y: ROOM.top - 14, w: 1200, h: 14 },
    { x: 0, y: ROOM.bottom, w: 1200, h: 14 },
    { x: 0, y: ROOM.top, w: ROOM.left, h: ROOM.bottom - ROOM.top },
    { x: ROOM.right, y: ROOM.top, w: 1200 - ROOM.right, h: ROOM.bottom - ROOM.top },
  ];
}

function circleHitsRect(x, y, radius, r) {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

function resolveCircle(body, solids) {
  for (const r of solids) {
    if (!circleHitsRect(body.x, body.y, body.radius, r)) continue;
    const cx = clamp(body.x, r.x, r.x + r.w);
    const cy = clamp(body.y, r.y, r.y + r.h);
    let dx = body.x - cx;
    let dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 === 0) {
      // Centre inside the rectangle: push out along the shortest side.
      const left = body.x - r.x;
      const right = r.x + r.w - body.x;
      const top = body.y - r.y;
      const bottom = r.y + r.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = r.x - body.radius;
      else if (m === right) body.x = r.x + r.w + body.radius;
      else if (m === top) body.y = r.y - body.radius;
      else body.y = r.y + r.h + body.radius;
      continue;
    }
    const d = Math.sqrt(d2);
    dx /= d;
    dy /= d;
    body.x = cx + dx * body.radius;
    body.y = cy + dy * body.radius;
  }
}

function makeGuard(def) {
  const first = def.waypoints[0];
  return {
    x: first.x,
    y: first.y,
    radius: GUARD.radius,
    waypoints: def.waypoints,
    waypointIndex: 1 % def.waypoints.length,
    speed: def.speed,
    pause: def.pause,
    pauseLeft: 0,
    angle: 0,
    state: 'patrol', // patrol | suspicious | investigate | alerted
    suspicion: 0,
    alertLeft: 0,
    investigate: null,
    investigateLeft: 0,
    lookLeft: 0,
    seesPlayer: false,
  };
}

function makeCamera(def) {
  return {
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    period: def.period,
    phase: def.phase,
    range: CAMERA.range,
    angle: def.baseAngle,
    seesPlayer: false,
  };
}

export class TideglassWorld {
  constructor(levelIndex) {
    this.reset(levelIndex);
  }

  reset(levelIndex) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.solids = [...borderWalls(), ...this.level.plinths];
    this.player = {
      x: this.level.spawn.x,
      y: this.level.spawn.y,
      radius: PLAYER.radius,
      angle: -Math.PI / 2,
    };
    this.guards = this.level.guards.map(makeGuard);
    this.cameras = this.level.cameras.map(makeCamera);
    this.loot = { x: this.level.loot.x, y: this.level.loot.y, taken: false, hold: 0 };
    this.exit = this.level.exit;
    this.alarm = 0;
    this.maxAlarm = 0;
    this.time = 0;
    this.score = 0;
    this.detections = 0;
    this.decoys = 1;
    this.coin = null; // { x, y, fromX, fromY, t, landed, ripple }
    this.ripples = [];
    this.spottedTimer = 0;
    this.caught = false;
    this.complete = false;
    this.breakdown = null;
    this.totalScore = 0;
  }

  // Warm lighting past a third of the alarm, red wash past two thirds.
  get alarmMood() {
    if (this.alarm >= ALARM.redAt) return 'red';
    if (this.alarm >= ALARM.warmAt) return 'warm';
    return 'calm';
  }

  get lootTaken() {
    return this.loot.taken;
  }

  get canExit() {
    return this.loot.taken;
  }

  seesFrom(x, y, angle, halfAngle, range) {
    const dx = this.player.x - x;
    const dy = this.player.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 1) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return false;
    for (const r of this.solids) {
      if (segmentHitsRect(x, y, this.player.x, this.player.y, r)) return false;
    }
    return true;
  }

  throwDecoy(x, y) {
    if (this.decoys <= 0 || this.coin || this.caught || this.complete) return false;
    this.decoys -= 1;
    this.coin = {
      fromX: this.player.x,
      fromY: this.player.y,
      x: this.player.x,
      y: this.player.y,
      targetX: clamp(x, ROOM.left + 10, ROOM.right - 10),
      targetY: clamp(y, ROOM.top + 10, ROOM.bottom - 10),
      t: 0,
      landed: false,
      ripple: 0,
    };
    return true;
  }

  nearestGuardTo(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const g of this.guards) {
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  step(dt, input) {
    if (this.caught || this.complete) return EVENT_NONE;
    let events = EVENT_NONE;
    this.time += dt;
    if (this.spottedTimer > 0) this.spottedTimer -= dt;

    // --- thief movement (axis separated, so walls slide instead of sticking)
    const mx = input.mx || 0;
    const my = input.my || 0;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const speed = PLAYER.speed;
      this.player.x += (mx / len) * speed * dt;
      resolveCircle(this.player, this.solids);
      this.player.y += (my / len) * speed * dt;
      resolveCircle(this.player, this.solids);
      this.player.angle = Math.atan2(my, mx);
    }
    this.player.x = clamp(this.player.x, ROOM.left + PLAYER.radius, ROOM.right - PLAYER.radius);
    this.player.y = clamp(this.player.y, ROOM.top + PLAYER.radius, ROOM.bottom - PLAYER.radius);

    // --- decoy coin: fly, land, ring, pull the nearest guard
    if (input.click) this.throwDecoy(input.click.x, input.click.y);
    if (this.coin) {
      const c = this.coin;
      if (!c.landed) {
        c.t += dt / 0.35;
        if (c.t >= 1) {
          c.t = 1;
          c.landed = true;
          c.ripple = 3;
          this.ripples.push({ x: c.targetX, y: c.targetY, t: 0, life: 1.1 });
          const g = this.nearestGuardTo(c.targetX, c.targetY);
          if (g && Math.hypot(g.x - c.targetX, g.y - c.targetY) < 460) {
            g.state = 'investigate';
            g.investigate = { x: c.targetX, y: c.targetY };
            g.investigateLeft = GUARD.investigateTime;
            g.suspicion = 0.4;
          }
        }
        c.x = c.fromX + (c.targetX - c.fromX) * c.t;
        c.y = c.fromY + (c.targetY - c.fromY) * c.t;
      } else {
        c.ripple -= dt;
        if (c.ripple <= 0) this.coin = null;
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      this.ripples[i].t += dt;
      if (this.ripples[i].t > this.ripples[i].life) this.ripples.splice(i, 1);
    }

    // --- cameras sweep and watch
    let anySeeing = false;
    let alarmRate = 0;
    for (const cam of this.cameras) {
      cam.angle = cam.baseAngle + cam.sweep * Math.sin((TAU * this.time) / cam.period + cam.phase);
      cam.seesPlayer = this.seesFrom(cam.x, cam.y, cam.angle, CAMERA.halfAngle, cam.range);
      if (cam.seesPlayer) {
        anySeeing = true;
        alarmRate = Math.max(alarmRate, ALARM.cameraRate);
      }
    }

    // --- guards patrol, suspect, investigate and chase
    const hurry = this.alarm >= ALARM.warmAt ? 1.18 : 1;
    for (const g of this.guards) {
      const half =
        g.state === 'alerted'
          ? GUARD.halfAngleAlerted
          : g.state === 'suspicious' || g.state === 'investigate'
            ? GUARD.halfAngleSuspicious
            : GUARD.halfAngleUnaware;
      g.seesPlayer = this.seesFrom(g.x, g.y, g.angle, half, GUARD.range);
      if (g.seesPlayer) {
        anySeeing = true;
        alarmRate = Math.max(alarmRate, g.state === 'alerted' ? ALARM.alertRate : ALARM.guardRate);
        if (g.state === 'patrol') g.state = 'suspicious';
        if (g.state === 'suspicious' || g.state === 'investigate') {
          g.suspicion += dt / GUARD.suspicionTime;
          if (g.suspicion >= 1) {
            g.state = 'alerted';
            g.alertLeft = GUARD.alertChaseTime;
            g.suspicion = 1;
            this.detections += 1;
            this.spottedTimer = 1.4;
            events |= EVENT_SPOTTED;
          }
        }
        // A guard that sees the thief turns to face them.
        g.angle = angleTowards(g.angle, Math.atan2(this.player.y - g.y, this.player.x - g.x), 6 * dt);
      } else if (g.state === 'suspicious') {
        g.suspicion -= dt / 1.2;
        if (g.suspicion <= 0) {
          g.suspicion = 0;
          g.state = 'patrol';
        }
      }

      if (g.state === 'alerted') {
        g.alertLeft -= dt;
        const dx = this.player.x - g.x;
        const dy = this.player.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          g.x += (dx / d) * g.speed * 1.45 * dt;
          g.y += (dy / d) * g.speed * 1.45 * dt;
          resolveCircle(g, this.solids);
          g.angle = Math.atan2(dy, dx);
        }
        if (g.alertLeft <= 0) {
          g.state = 'patrol';
          g.suspicion = 0.3;
        }
      } else if (g.state === 'investigate' && g.investigate) {
        g.investigateLeft -= dt;
        const dx = g.investigate.x - g.x;
        const dy = g.investigate.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 14) {
          g.x += (dx / d) * g.speed * 1.15 * dt;
          g.y += (dy / d) * g.speed * 1.15 * dt;
          resolveCircle(g, this.solids);
          g.angle = Math.atan2(dy, dx);
        } else {
          g.lookLeft += dt;
          g.angle += 1.6 * dt; // look around the spot before giving up
        }
        if (g.investigateLeft <= 0) {
          g.state = 'patrol';
          g.investigate = null;
          g.lookLeft = 0;
        }
      } else if (g.state === 'patrol') {
        if (g.pauseLeft > 0) {
          g.pauseLeft -= dt;
        } else {
          const target = g.waypoints[g.waypointIndex];
          const dx = target.x - g.x;
          const dy = target.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d < 6) {
            g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
            g.pauseLeft = g.pause;
          } else {
            g.x += (dx / d) * g.speed * hurry * dt;
            g.y += (dy / d) * g.speed * hurry * dt;
            resolveCircle(g, this.solids);
            g.angle = Math.atan2(dy, dx);
          }
        }
      }
    }

    // --- the alarm meter: rises under watch, drains while hidden
    if (anySeeing) this.alarm = clamp(this.alarm + alarmRate * dt, 0, 100);
    else this.alarm = clamp(this.alarm - ALARM.drainRate * dt, 0, 100);
    if (this.alarm > this.maxAlarm) this.maxAlarm = this.alarm;
    if (this.alarm >= 100) {
      this.caught = true;
      return events | EVENT_CAUGHT;
    }

    // --- loot: hold E beside the case until it opens
    const lootDist = Math.hypot(this.player.x - this.loot.x, this.player.y - this.loot.y);
    if (!this.loot.taken && lootDist < 52 && input.grab) {
      this.loot.hold += dt;
      if (this.loot.hold >= this.level.holdTime) {
        this.loot.taken = true;
        this.loot.hold = this.level.holdTime;
        this.score += LOOT_POINTS;
        events |= EVENT_LOOT;
      }
    } else if (!this.loot.taken) {
      this.loot.hold = Math.max(0, this.loot.hold - dt * 2);
    }

    // --- exit: with the loot, press E inside the doorway
    if (this.loot.taken && input.grab) {
      const e = this.exit;
      if (
        this.player.x > e.x - 6 &&
        this.player.x < e.x + e.w + 6 &&
        this.player.y > e.y - 6 &&
        this.player.y < e.y + e.h + 6
      ) {
        this.finishLevel();
        return events | EVENT_COMPLETE;
      }
    }
    return events;
  }

  finishLevel() {
    const timeBonus = Math.max(0, Math.round(this.level.par - this.time)) * TIME_BONUS_PER_SECOND;
    const noDetection = this.detections === 0 ? NO_DETECTION_POINTS : 0;
    const decoyBonus = this.decoys > 0 ? UNUSED_DECOY_POINTS : 0;
    this.breakdown = {
      loot: LOOT_POINTS,
      timeBonus,
      noDetection,
      decoyBonus,
      total: LOOT_POINTS + timeBonus + noDetection + decoyBonus,
    };
    this.totalScore = this.score + timeBonus + noDetection + decoyBonus;
    this.complete = true;
  }

  // Staging helper for the escape screenshot: a finished room, honestly scored.
  debugComplete() {
    this.loot.taken = true;
    this.score = LOOT_POINTS;
    this.time = 61.4;
    this.alarm = 18;
    this.maxAlarm = 41;
    this.player.x = 120;
    this.player.y = 600;
    this.finishLevel();
  }
}
