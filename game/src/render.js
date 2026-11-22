// Tideglass: Night Shift — everything the player sees. Canvas 2D, drawn in one
// pass: floor, loot and exit, vision cones, cover that occludes them, guards,
// cameras and the thief, the alarm's mood in the room itself, then the HUD and
// the screen panels. The thief is the most saturated object after the cones,
// so the eye lands on them first in every frame.
import { FONT, PALETTE, ROOM, VIEW } from './config.js';

function coneColor(state) {
  if (state === 'alerted') return PALETTE.coneAlerted;
  if (state === 'suspicious' || state === 'investigate') return PALETTE.coneSuspicious;
  return PALETTE.coneUnaware;
}

function drawCone(ctx, x, y, angle, halfAngle, range, rgb, hard) {
  const gradient = ctx.createRadialGradient(x, y, 8, x, y, range);
  gradient.addColorStop(0, `rgba(${rgb},0.62)`);
  gradient.addColorStop(0.75, `rgba(${rgb},0.34)`);
  gradient.addColorStop(1, `rgba(${rgb},0.02)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fill();
  // The cone's rim: a hard bright edge when alerted, a soft one otherwise.
  ctx.strokeStyle = `rgba(${rgb},${hard ? 0.95 : 0.4})`;
  ctx.lineWidth = hard ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
  ctx.stroke();
}

function drawGuardCone(ctx, guard) {
  const half =
    guard.state === 'alerted' ? 0.52 : guard.state === 'patrol' ? 0.96 : 0.7;
  drawCone(ctx, guard.x, guard.y, guard.angle, half, 250, coneColor(guard.state), guard.state === 'alerted');
}

function drawCameraCone(ctx, cam) {
  drawCone(ctx, cam.x, cam.y, cam.angle, 0.42, 275, PALETTE.cameraCone, false);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, weight, align) {
  ctx.font = `${weight || 600} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawFloor(ctx) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Faint tile grid so the room reads as a floor, not a void.
  ctx.strokeStyle = PALETTE.floorGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ROOM.left; x <= ROOM.right; x += 60) {
    ctx.moveTo(x, ROOM.top);
    ctx.lineTo(x, ROOM.bottom);
  }
  for (let y = ROOM.top; y <= ROOM.bottom; y += 60) {
    ctx.moveTo(ROOM.left, y);
    ctx.lineTo(ROOM.right, y);
  }
  ctx.stroke();
  // Rain-streaked window light along the top wall: a cool diagonal wash.
  const wash = ctx.createLinearGradient(0, ROOM.top, 0, ROOM.top + 190);
  wash.addColorStop(0, 'rgba(140, 200, 220, 0.10)');
  wash.addColorStop(1, 'rgba(140, 200, 220, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(ROOM.left, ROOM.top, ROOM.right - ROOM.left, 190);
}

function drawWalls(ctx, world) {
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, ROOM.top - 14, VIEW.width, 14);
  ctx.fillRect(0, ROOM.bottom, VIEW.width, 14);
  ctx.fillRect(0, ROOM.top, ROOM.left, ROOM.bottom - ROOM.top);
  ctx.fillRect(ROOM.right, ROOM.top, VIEW.width - ROOM.right, ROOM.bottom - ROOM.top);
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(0, ROOM.top - 14, VIEW.width, 3);
  ctx.fillRect(0, ROOM.bottom, VIEW.width, 3);
  // The exit door, cut into the left wall.
  const e = world.exit;
  const lit = world.canExit;
  const pulse = lit ? 0.55 + 0.35 * Math.sin(world.time * 5) : 0.25;
  ctx.fillStyle = lit ? `rgba(47, 214, 163, ${pulse})` : 'rgba(47, 214, 163, 0.25)';
  ctx.fillRect(2, e.y, 26, e.h);
  ctx.fillStyle = PALETTE.exit;
  ctx.fillRect(26, e.y, 4, e.h);
  text(ctx, 'EXIT', 30, e.y - 16, 13, PALETTE.exit, 800, 'left');
}

function drawPlinths(ctx, world) {
  for (const p of world.level.plinths) {
    ctx.fillStyle = PALETTE.plinth;
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.plinthTop;
    roundRect(ctx, p.x + 5, p.y + 5, p.w - 10, 10, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.stroke();
  }
}

function drawLoot(ctx, world) {
  const loot = world.loot;
  const glow = 18 + 8 * Math.sin(world.time * 3);
  ctx.save();
  ctx.shadowColor = PALETTE.loot;
  ctx.shadowBlur = loot.taken ? 4 : glow;
  ctx.fillStyle = loot.taken ? '#5c4d1e' : PALETTE.loot;
  roundRect(ctx, loot.x - 20, loot.y - 14, 40, 28, 5);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = loot.taken ? '#8a7a3a' : '#7a5b00';
  ctx.fillRect(loot.x - 20, loot.y - 3, 40, 6);
  text(ctx, loot.taken ? 'LOOT TAKEN' : 'TIDEGLASS LENS', loot.x, loot.y - 30, 12, loot.taken ? PALETTE.muted : PALETTE.loot, 800, 'center');
  if (!loot.taken && loot.hold > 0) {
    ctx.strokeStyle = PALETTE.loot;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 32, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * loot.hold) / world.level.holdTime);
    ctx.stroke();
  }
}

function drawGuards(ctx, world) {
  for (const g of world.guards) {
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick: the direction the guard is looking.
    ctx.strokeStyle = PALETTE.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * (g.radius + 7), g.y + Math.sin(g.angle) * (g.radius + 7));
    ctx.stroke();
    // State mark above the guard: ? while suspicious, ! while alerted.
    if (g.state === 'suspicious' || g.state === 'investigate') {
      text(ctx, '?', g.x, g.y - 24, 20, '#ffb020', 800, 'center');
    } else if (g.state === 'alerted') {
      text(ctx, '!', g.x, g.y - 24, 22, PALETTE.danger, 800, 'center');
    }
  }
}

function drawCameras(ctx, world) {
  for (const cam of world.cameras) {
    ctx.fillStyle = '#3d2f10';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.cameraCone;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffe98c';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.angle) * 5, cam.y + Math.sin(cam.angle) * 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (cam.seesPlayer) {
      text(ctx, '!', cam.x, cam.y - 22, 18, PALETTE.danger, 800, 'center');
    }
  }
}

function drawThief(ctx, world) {
  const p = world.player;
  const pulse = 1 + 0.08 * Math.sin(world.time * 4);
  ctx.strokeStyle = PALETTE.thiefRing;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius + 6 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c2d00';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Facing tick, same language as the guards.
  ctx.strokeStyle = '#fff3df';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * (p.radius + 5), p.y + Math.sin(p.angle) * (p.radius + 5));
  ctx.stroke();
  text(ctx, 'YOU', p.x, p.y - 26, 12, '#ffffff', 800, 'center');
}

function drawCoinAndRipples(ctx, world) {
  for (const r of world.ripples) {
    const k = r.t / r.life;
    ctx.strokeStyle = `rgba(255, 217, 77, ${0.8 * (1 - k)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 12 + 90 * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (world.coin) {
    const c = world.coin;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(c.x, c.y - 10 * Math.sin(Math.PI * Math.min(1, c.t)), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawAlarmMood(ctx, world) {
  const mood = world.alarmMood;
  if (mood === 'warm') {
    ctx.fillStyle = 'rgba(255, 150, 40, 0.05)';
    ctx.fillRect(ROOM.left, ROOM.top, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top);
  } else if (mood === 'red') {
    ctx.fillStyle = 'rgba(255, 30, 20, 0.10)';
    ctx.fillRect(ROOM.left, ROOM.top, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top);
    // Rotating warning light in the top-right corner of the room.
    const bx = ROOM.right - 24;
    const by = ROOM.top + 24;
    const beam = world.time * 2.4;
    ctx.strokeStyle = 'rgba(255, 60, 50, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(beam) * 70, by + Math.sin(beam) * 70);
    ctx.stroke();
    ctx.fillStyle = '#ff3c32';
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    // Pulsing red frame: the whole room is on alert.
    ctx.strokeStyle = `rgba(255, 60, 50, ${0.35 + 0.25 * Math.sin(world.time * 5)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(ROOM.left + 2, ROOM.top + 2, ROOM.right - ROOM.left - 4, ROOM.bottom - ROOM.top - 4);
  }
}

function drawHud(ctx, world, levelIndex) {
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, 0, VIEW.width, 64);
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(VIEW.width, 64);
  ctx.stroke();

  text(ctx, 'TIDEGLASS · NIGHT SHIFT', 18, 20, 18, PALETTE.text, 800, 'left');
  text(ctx, world.level.name, 18, 44, 13, PALETTE.muted, 600, 'left');

  // The alarm meter: labelled, numbered, impossible to miss.
  const barX = 470;
  const barY = 14;
  const barW = 260;
  const barH = 18;
  const mood = world.alarmMood;
  const fillColor = mood === 'red' ? PALETTE.danger : mood === 'warm' ? '#ffb020' : '#7fd4ff';
  text(ctx, 'ALARM', barX - 8, barY + barH / 2, 14, PALETTE.text, 800, 'right');
  ctx.fillStyle = '#16282e';
  roundRect(ctx, barX, barY, barW, barH, 5);
  ctx.fill();
  ctx.fillStyle = fillColor;
  if (world.alarm > 0) {
    roundRect(ctx, barX, barY, Math.max(10, (barW * world.alarm) / 100), barH, 5);
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1.5;
  roundRect(ctx, barX, barY, barW, barH, 5);
  ctx.stroke();
  text(ctx, `${Math.round(world.alarm)}%`, barX + barW + 10, barY + barH / 2, 15, fillColor, 800, 'left');

  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60).toString().padStart(2, '0');
  text(ctx, `LOOT ${world.loot.taken ? '●' : '○'}`, 800, 20, 14, world.loot.taken ? PALETTE.loot : PALETTE.text, 700, 'left');
  text(ctx, `SCORE ${world.score}`, 900, 20, 14, PALETTE.text, 700, 'left');
  text(ctx, `TIME ${mins}:${secs}`, 1050, 20, 14, PALETTE.text, 700, 'left');
  text(ctx, `COIN ×${world.decoys}`, 800, 44, 13, PALETTE.loot, 700, 'left');
  text(ctx, world.loot.taken ? 'LOOT SECURED — REACH THE EXIT' : 'STEAL THE TIDEGLASS LENS, THEN ESCAPE', 900, 44, 12, PALETTE.muted, 600, 'left');

  text(
    ctx,
    'WASD move  ·  E grab / exit  ·  Click = decoy  ·  Esc pause',
    500,
    54,
    11,
    PALETTE.muted,
    600,
    'center',
  );
}

function drawPrompts(ctx, world) {
  const lootDist = Math.hypot(world.player.x - world.loot.x, world.player.y - world.loot.y);
  if (!world.loot.taken && lootDist < 70) {
    text(ctx, 'HOLD  E  TO CRACK THE CASE', world.loot.x, world.loot.y + 52, 13, PALETTE.loot, 800, 'center');
  }
  if (world.loot.taken) {
    const e = world.exit;
    const near =
      world.player.x > e.x - 30 && world.player.x < e.x + e.w + 30 && world.player.y > e.y - 30 && world.player.y < e.y + e.h + 30;
    if (near) text(ctx, 'PRESS  E  TO SLIP OUT', 110, world.exit.y + world.exit.h / 2, 14, PALETTE.exit, 800, 'left');
  }
}

function drawTitlePanel(ctx, world) {
  panel(ctx, 24, 84, 400, 216);
  text(ctx, 'TIDEGLASS', 46, 116, 34, PALETTE.text, 800, 'left');
  text(ctx, 'NIGHT SHIFT — a coastal archive heist', 46, 146, 14, PALETTE.loot, 700, 'left');
  text(ctx, 'Cross the room. Dodge the cones.', 46, 176, 14, PALETTE.text, 600, 'left');
  text(ctx, 'Crack the case, then reach the EXIT.', 46, 198, 14, PALETTE.text, 600, 'left');
  text(ctx, 'WASD move · E grab / exit · Click = decoy coin', 46, 224, 13, PALETTE.muted, 600, 'left');
  text(ctx, '3 rooms · 1 coin per room · alarm 100% = caught', 46, 246, 13, PALETTE.muted, 600, 'left');
  text(ctx, '▶  PRESS ENTER TO START THE HEIST', 46, 280, 15, PALETTE.exit, 800, 'left');
}

function drawBreakdown(ctx, lines, y) {
  let row = y;
  for (const [label, value] of lines) {
    text(ctx, label, 380, row, 15, PALETTE.text, 600, 'left');
    text(ctx, value, 820, row, 15, PALETTE.loot, 800, 'right');
    row += 28;
  }
  return row;
}

function drawCompletePanel(ctx, world, totalScore, isVictory) {
  panel(ctx, 350, 150, 500, 330);
  text(ctx, isVictory ? 'HEIST COMPLETE' : 'ESCAPED!', 600, 196, 34, PALETTE.exit, 800, 'center');
  text(ctx, isVictory ? 'All three rooms cleared — the Tideglass is yours.' : `${world.level.name} — the lens is yours.`, 600, 230, 14, PALETTE.muted, 600, 'center');
  const b = world.breakdown;
  const next = drawBreakdown(
    ctx,
    [
      ['Loot — the Tideglass lens', `+${b.loot}`],
      ['Time bonus', `+${b.timeBonus}`],
      ['No detection', `+${b.noDetection}`],
      ['Decoy unused', `+${b.decoyBonus}`],
      ['LEVEL TOTAL', `${b.total}`],
    ],
    268,
  );
  text(ctx, `TOTAL SCORE  ${totalScore}`, 600, next + 14, 17, PALETTE.text, 800, 'center');
  const nextLine = isVictory
    ? 'Press R to run the heist again'
    : world.levelIndex === 2
      ? 'Press ENTER — see the final score    ·    R — replay this room'
      : 'Press ENTER — next room    ·    R — replay this room';
  text(
    ctx,
    nextLine,
    600,
    next + 48,
    14,
    PALETTE.muted,
    600,
    'center',
  );
}

function drawCaughtPanel(ctx, world) {
  panel(ctx, 350, 190, 500, 240);
  text(ctx, 'CAUGHT!', 600, 240, 38, PALETTE.danger, 800, 'center');
  text(ctx, 'The alarm hit 100% — the archive locks down.', 600, 282, 15, PALETTE.text, 600, 'center');
  text(ctx, `${world.level.name}  ·  alarm peaked at ${Math.round(world.maxAlarm)}%`, 600, 312, 14, PALETTE.muted, 600, 'center');
  text(ctx, 'Watch the cones. Use the coin. Press R to retry.', 600, 352, 14, PALETTE.muted, 600, 'center');
  text(ctx, 'R — RETRY THE ROOM', 600, 392, 15, PALETTE.exit, 800, 'center');
}

function drawPausedPanel(ctx) {
  panel(ctx, 400, 230, 400, 170);
  text(ctx, 'PAUSED', 600, 272, 30, PALETTE.text, 800, 'center');
  text(ctx, 'WASD move · E grab / exit · Click = decoy coin', 600, 312, 13, PALETTE.muted, 600, 'center');
  text(ctx, 'Esc — resume    ·    R — restart the room', 600, 340, 13, PALETTE.muted, 600, 'center');
}

export function drawScene(ctx, world, screen, totalScore) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawFloor(ctx);
  drawLoot(ctx, world);
  for (const g of world.guards) drawGuardCone(ctx, g);
  for (const cam of world.cameras) drawCameraCone(ctx, cam);
  drawWalls(ctx, world);
  drawPlinths(ctx, world);
  drawLoot(ctx, world);
  drawCoinAndRipples(ctx, world);
  drawCameras(ctx, world);
  drawGuards(ctx, world);
  drawThief(ctx, world);
  drawAlarmMood(ctx, world);
  drawHud(ctx, world, world.levelIndex);
  if (screen === 'play' || screen === 'title') drawPrompts(ctx, world);
  if (world.spottedTimer > 0 && (screen === 'play' || screen === 'title')) {
    ctx.fillStyle = 'rgba(255, 60, 50, 0.92)';
    roundRect(ctx, 520, 76, 160, 38, 8);
    ctx.fill();
    text(ctx, 'SPOTTED!', 600, 95, 20, '#ffffff', 800, 'center');
  }
  if (screen === 'title') drawTitlePanel(ctx, world);
  if (screen === 'paused') drawPausedPanel(ctx);
  if (screen === 'caught') drawCaughtPanel(ctx, world);
  if (screen === 'complete') drawCompletePanel(ctx, world, totalScore, false);
  if (screen === 'victory') drawCompletePanel(ctx, world, totalScore, true);
}
