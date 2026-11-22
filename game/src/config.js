// Tideglass: Night Shift — every tuning number and colour in one place.
// The playfield is a fixed 1200x675 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const VIEW = { width: 1200, height: 675 };
export const HUD_H = 64;
export const STEP = 1 / 60;

export const PLAYER = { radius: 13, speed: 190 };

// The room walls: the play area inside the HUD bar and the outer border.
export const ROOM = { left: 30, top: 78, right: 1170, bottom: 661 };

export const GUARD = {
  radius: 13,
  // Vision cone half-angles (radians) per guard state.
  halfAngleUnaware: 0.96,
  halfAngleSuspicious: 0.7,
  halfAngleAlerted: 0.52,
  range: 250,
  // Seconds of continuous sight before a guard goes from suspicious to alerted.
  suspicionTime: 0.8,
  alertChaseTime: 2.6,
  investigateTime: 3.0,
};

export const CAMERA = { range: 275, halfAngle: 0.42 };

export const ALARM = {
  guardRate: 34, // points per second while a guard sees the thief
  cameraRate: 24, // points per second while a camera sees the thief
  alertRate: 46, // points per second while an alerted guard sees the thief
  drainRate: 9, // points per second while nobody sees the thief
  warmAt: 33, // past this the room lighting warms and guards hurry
  redAt: 66, // past this the red wash, warning light and lit exit appear
};

export const LOOT_POINTS = 500;
export const NO_DETECTION_POINTS = 300;
export const UNUSED_DECOY_POINTS = 100;
export const TIME_BONUS_PER_SECOND = 10;

export const PALETTE = {
  page: '#060d10',
  floor: '#0d1b20',
  floorGrid: '#12262c',
  wall: '#274b52',
  wallTop: '#3a6b74',
  plinth: '#22414a',
  plinthTop: '#c9a24b',
  thief: '#ff8c1a',
  thiefRing: '#ffd9a0',
  guard: '#31435c',
  guardTrim: '#9fb4cc',
  loot: '#ffd94d',
  lootGlow: '#ffef9e',
  exit: '#2fd6a3',
  coneUnaware: '190,225,255',
  coneSuspicious: '255,176,32',
  coneAlerted: '255,60,50',
  cameraCone: '255,230,140',
  hud: '#0a1418',
  hudLine: '#1e3a42',
  text: '#eef6f4',
  muted: '#8fb0b5',
  danger: '#ff5040',
  panel: 'rgba(8, 20, 24, 0.88)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
