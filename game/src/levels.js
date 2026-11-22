// Tideglass: Night Shift — the three rooms. Each level is one compact room the
// thief crosses: a spawn, a loot case, an exit door, display plinths that block
// movement and sight, guards on waypoint loops and cameras sweeping the floor.
// Waypoints sit in open lanes so patrols never cross a plinth.
export const LEVELS = [
  {
    name: '1 · MAP GALLERY',
    par: 75,
    holdTime: 1.5,
    spawn: { x: 120, y: 590 },
    exit: { x: 30, y: 560, w: 70, h: 80 },
    loot: { x: 1085, y: 130 },
    plinths: [
      { x: 280, y: 200, w: 130, h: 64 },
      { x: 280, y: 430, w: 130, h: 64 },
      { x: 640, y: 300, w: 150, h: 70 },
      { x: 880, y: 470, w: 130, h: 64 },
      { x: 560, y: 520, w: 120, h: 60 },
    ],
    guards: [
      {
        waypoints: [
          { x: 620, y: 150 },
          { x: 620, y: 450 },
          { x: 980, y: 450 },
          { x: 980, y: 150 },
        ],
        speed: 68,
        pause: 0.9,
      },
    ],
    cameras: [{ x: 1185, y: 360, baseAngle: Math.PI, sweep: 0.55, period: 5, phase: 0 }],
  },
  {
    name: '2 · CHART VAULT',
    par: 90,
    holdTime: 1.8,
    spawn: { x: 120, y: 590 },
    exit: { x: 30, y: 560, w: 70, h: 80 },
    loot: { x: 1085, y: 130 },
    plinths: [
      { x: 450, y: 220, w: 130, h: 60 },
      { x: 450, y: 420, w: 130, h: 60 },
      { x: 950, y: 180, w: 110, h: 56 },
      { x: 200, y: 470, w: 120, h: 60 },
      { x: 700, y: 520, w: 120, h: 56 },
    ],
    guards: [
      {
        waypoints: [
          { x: 300, y: 140 },
          { x: 880, y: 140 },
          { x: 880, y: 330 },
          { x: 300, y: 330 },
        ],
        speed: 78,
        pause: 0.7,
      },
      {
        waypoints: [
          { x: 1105, y: 220 },
          { x: 1105, y: 560 },
        ],
        speed: 82,
        pause: 0.6,
      },
    ],
    cameras: [
      { x: 15, y: 200, baseAngle: 0, sweep: 0.5, period: 4.5, phase: 0 },
      { x: 1185, y: 540, baseAngle: Math.PI, sweep: 0.5, period: 6, phase: 1.2 },
    ],
  },
  {
    name: '3 · FLOODGATE ROOM',
    par: 105,
    holdTime: 2.5,
    spawn: { x: 120, y: 590 },
    exit: { x: 30, y: 560, w: 70, h: 80 },
    loot: { x: 600, y: 130 },
    plinths: [
      { x: 300, y: 200, w: 130, h: 64 },
      { x: 770, y: 200, w: 130, h: 64 },
      { x: 300, y: 440, w: 130, h: 64 },
      { x: 770, y: 440, w: 130, h: 64 },
      { x: 540, y: 380, w: 120, h: 56 },
    ],
    guards: [
      {
        waypoints: [
          { x: 480, y: 150 },
          { x: 720, y: 150 },
          { x: 720, y: 550 },
          { x: 480, y: 550 },
        ],
        speed: 95,
        pause: 0.5,
      },
      {
        waypoints: [
          { x: 200, y: 320 },
          { x: 1000, y: 320 },
        ],
        speed: 105,
        pause: 0.5,
      },
    ],
    cameras: [
      { x: 600, y: 66, baseAngle: Math.PI / 2, sweep: 0.7, period: 5, phase: 0 },
      { x: 1185, y: 320, baseAngle: Math.PI, sweep: 0.6, period: 4, phase: 2.0 },
    ],
  },
];
