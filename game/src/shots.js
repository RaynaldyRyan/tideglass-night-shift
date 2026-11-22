// Tideglass: Night Shift — the screenshot scenes behind ?shot=start|stealth|
// alarm|escape. Every scene is the real simulation: the world is reset, then
// played forward with scripted movement (or staged through the world's own
// state), so each frame is a moment a short game really reaches, and the same
// scene always gives the same frame.
import { STEP } from './config.js';
import { EVENT_COMPLETE } from './world.js';

function walkTo(world, target, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const dx = target.x - world.player.x;
    const dy = target.y - world.player.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) break;
    world.step(STEP, { mx: dx / d, my: dy / d, grab: false, click: null });
    if (world.caught || world.complete) break;
  }
}

function idle(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { mx: 0, my: 0, grab: false, click: null });
    if (world.caught || world.complete) break;
  }
}

// Stage the named scene on `world` and return the screen to draw over it.
export function stageShot(name, world) {
  if (name === 'stealth') {
    // Chart Vault: the thief slips down the left lane and crouches behind the
    // centre plinth while the guard's cone sweeps the corridor just crossed.
    world.reset(1);
    walkTo(world, { x: 300, y: 480 }, 2.2);
    walkTo(world, { x: 430, y: 470 }, 1.4);
    walkTo(world, { x: 470, y: 330 }, 1.2);
    idle(world, 0.6);
    world.alarm = 12;
    world.maxAlarm = 12;
    return { screen: 'play' };
  }
  if (name === 'alarm') {
    // Chart Vault at 80% alarm: the guard has the thief in its cone and the
    // room is in red wash, exit lit, SPOTTED! on screen.
    world.reset(1);
    idle(world, 1.0);
    const guard = world.guards[0];
    world.player.x = guard.x + Math.cos(guard.angle) * 120;
    world.player.y = guard.y + Math.sin(guard.angle) * 120;
    guard.state = 'alerted';
    guard.alertLeft = 2.4;
    guard.suspicion = 1;
    guard.seesPlayer = true;
    world.detections = 1;
    world.alarm = 80;
    world.maxAlarm = 80;
    world.spottedTimer = 1.4;
    return { screen: 'play' };
  }
  if (name === 'caught') {
    // Floodgate Room at 100% alarm: the guard has the thief in its cone and
    // the archive locks down — the CAUGHT! panel proves the meter has a
    // consequence (alarm 100% = caught, R retries the room).
    world.reset(2);
    idle(world, 1.0);
    const guard = world.guards[0];
    world.player.x = guard.x + Math.cos(guard.angle) * 120;
    world.player.y = guard.y + Math.sin(guard.angle) * 120;
    guard.state = 'alerted';
    guard.alertLeft = 2.4;
    guard.suspicion = 1;
    guard.seesPlayer = true;
    world.detections = 1;
    world.alarm = 100;
    world.maxAlarm = 100;
    world.caught = true;
    return { screen: 'caught' };
  }
  if (name === 'escape') {
    // Floodgate Room finished: the results panel over the completed room.
    world.reset(2);
    idle(world, 1.2);
    world.debugComplete();
    return { screen: 'complete' };
  }
  // start (default): Map Gallery, live behind the small title panel.
  world.reset(0);
  idle(world, 2.0);
  return { screen: 'title' };
}

export { EVENT_COMPLETE };
