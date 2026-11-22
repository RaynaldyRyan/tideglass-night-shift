// Tideglass: Night Shift — the game loop and screens. Owns the canvas, the
// screen state (title, play, pause, caught, level complete, victory) and the
// fixed-step simulation; the rules live in world.js, the drawing in render.js.
import { STEP, VIEW } from './config.js';
import { TideglassInput } from './input.js';
import { drawScene } from './render.js';
import { stageShot } from './shots.js';
import { EVENT_CAUGHT, EVENT_COMPLETE, EVENT_LOOT, EVENT_SPOTTED, TideglassWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const input = new TideglassInput(canvas);
const world = new TideglassWorld(0);
let screen = 'title';
let totalScore = 0;
let frozen = false;

function setScreen(next) {
  screen = next;
  statusEl.textContent =
    next === 'title'
      ? 'Tideglass Night Shift. Press Enter to start the heist.'
      : next === 'play'
        ? `Playing ${world.level.name}. Steal the lens, then reach the exit.`
        : next === 'caught'
          ? 'Caught. The alarm hit 100 percent. Press R to retry.'
          : next === 'complete'
            ? `Escaped ${world.level.name}.`
            : next === 'victory'
              ? 'Heist complete. All three rooms cleared.'
              : 'Paused.';
}

function startLevel(levelIndex) {
  world.reset(levelIndex);
  setScreen('play');
}

function nextLevel() {
  totalScore += world.breakdown ? world.breakdown.total : 0;
  if (world.levelIndex + 1 >= 3) {
    setScreen('victory');
  } else {
    startLevel(world.levelIndex + 1);
  }
}

input.onKey = (code) => {
  if (frozen) return;
  if (code === 'Escape') {
    if (screen === 'play') setScreen('paused');
    else if (screen === 'paused') setScreen('play');
    return;
  }
  if (code === 'Enter' || code === 'Space') {
    if (screen === 'title') setScreen('play');
    else if (screen === 'complete') nextLevel();
    else if (screen === 'victory') {
      totalScore = 0;
      startLevel(0);
    }
    return;
  }
  if (code === 'KeyR') {
    if (screen === 'victory') {
      totalScore = 0;
      startLevel(0);
    } else if (screen !== 'title') {
      startLevel(world.levelIndex);
    }
  }
};

function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) {
    drawScene(ctx, world, screen, totalScore + (world.breakdown ? world.breakdown.total : 0));
    return;
  }
  const dt = Math.min(0.1, (now - (frame.last || now)) / 1000);
  frame.last = now;
  if (screen === 'play') {
    frame.acc = (frame.acc || 0) + dt;
    let guard = 0;
    while (frame.acc >= STEP && guard < 8) {
      frame.acc -= STEP;
      guard += 1;
      const move = input.moveVector();
      const events = world.step(STEP, {
        mx: move.mx,
        my: move.my,
        grab: input.grab,
        click: input.takeClick(),
      });
      if (events & EVENT_SPOTTED) statusEl.textContent = 'Spotted! Break line of sight.';
      if (events & EVENT_LOOT) statusEl.textContent = 'Loot secured. Reach the exit.';
      if (events & EVENT_CAUGHT) setScreen('caught');
      if (events & EVENT_COMPLETE) setScreen('complete');
    }
  } else if (screen === 'title') {
    // The title screen plays the room live behind its panel.
    frame.acc = (frame.acc || 0) + dt;
    let guard = 0;
    while (frame.acc >= STEP && guard < 8) {
      frame.acc -= STEP;
      guard += 1;
      world.step(STEP, { mx: 0, my: 0, grab: false, click: null });
      if (world.caught) world.reset(world.levelIndex);
    }
  }
  const shown = screen === 'victory' ? totalScore : totalScore + (world.breakdown ? world.breakdown.total : 0);
  drawScene(ctx, world, screen, shown);
}

// A headless self-test (?selftest=1): drives the real rules through scripted
// play and reports the result in the status line, so a run can be verified
// without a human at the keyboard.
function selfTest() {
  const results = [];
  const check = (name, fn) => {
    try {
      results.push(`${name}:${fn() ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      results.push(`${name}:FAIL(${error.message})`);
    }
  };
  check('move', () => {
    const w = new TideglassWorld(0);
    const x0 = w.player.x;
    for (let i = 0; i < 60; i += 1) w.step(STEP, { mx: 1, my: 0, grab: false, click: null });
    return w.player.x > x0 + 100;
  });
  check('detect', () => {
    const w = new TideglassWorld(0);
    const g = w.guards[0];
    for (let i = 0; i < 150; i += 1) {
      // Keep the thief in the guard's cone while it patrols.
      w.player.x = g.x + Math.cos(g.angle) * 100;
      w.player.y = g.y + Math.sin(g.angle) * 100;
      w.step(STEP, { mx: 0, my: 0, grab: false, click: null });
      if (w.caught) break;
    }
    return w.detections >= 1 && w.alarm > 20;
  });
  check('loot', () => {
    const w = new TideglassWorld(0);
    w.player.x = w.loot.x;
    w.player.y = w.loot.y + 20;
    for (let i = 0; i < 150; i += 1) w.step(STEP, { mx: 0, my: 0, grab: true, click: null });
    return w.loot.taken === true;
  });
  check('decoy', () => {
    const w = new TideglassWorld(0);
    const g = w.guards[0];
    w.throwDecoy(g.x + 60, g.y);
    for (let i = 0; i < 60; i += 1) w.step(STEP, { mx: 0, my: 0, grab: false, click: null });
    return w.decoys === 0 && g.state === 'investigate';
  });
  check('escape', () => {
    const w = new TideglassWorld(0);
    w.player.x = w.loot.x;
    w.player.y = w.loot.y + 20;
    for (let i = 0; i < 150; i += 1) w.step(STEP, { mx: 0, my: 0, grab: true, click: null });
    if (!w.loot.taken) return false;
    w.player.x = w.exit.x + 35;
    w.player.y = w.exit.y + 40;
    let events = 0;
    for (let i = 0; i < 10; i += 1) {
      events |= w.step(STEP, { mx: 0, my: 0, grab: true, click: null });
      if (w.complete) break;
    }
    return (events & EVENT_COMPLETE) !== 0 && w.complete === true;
  });
  const passed = results.filter((r) => r.endsWith('PASS')).length;
  const line = `SELFTEST ${passed}/5 ${results.join(' ')}`;
  statusEl.textContent = line;
  document.title = line;
  return line;
}

if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  totalScore = 0;
  frozen = true;
  drawScene(ctx, world, screen, totalScore + (world.breakdown ? world.breakdown.total : 0));
} else if (params.get('selftest') === '1') {
  selfTest();
  setScreen('title');
  requestAnimationFrame(frame);
} else {
  setScreen('title');
  requestAnimationFrame(frame);
}

window.__tideglass = { world, get screen() { return screen; }, selfTest };
