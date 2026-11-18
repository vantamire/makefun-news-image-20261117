// World news of Tuesday 17 November 2026, drawn as one newspaper front page.
// Pure Node 22 standard library only: no network, no randomness, no Date.
// Writes a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png (default /output).
// Two runs write byte-identical bytes.
//
// Layout: masthead naming the day, then a full-width lead, two wide mid
// panels and three compact panels, plus a footer strip with two more stories.
// Every story was checked against several news sources for 17 Nov 2026
// (Reuters, AP, CNN, BBC, PAHO, UN News, Kyodo) before drawing:
//
//   LEAD  Ukraine hits the Kerch Bridge for a second day; the road arch
//         collapses into the strait. Two killed; rail back by afternoon.
//   MID   US jets hit an Iranian missile site on Qeshm Island after Iran
//         drones a US radar in Bahrain, its third attack in five days.
//   MID   Nvidia reports $115.8bn revenue, double a year ago; first report
//         since Jensen Huang resigned. Interim chief Colette Kress.
//   SMALL Leaders gather in Shenzhen for APEC; Xi, Putin and Trump meet
//         in a first trilateral on Thursday.
//   SMALL The US loses its measles-free status after 26 years: 5,400 cases
//         in 2026, the most since 1991, and 10 deaths.
//   SMALL Two suspected Russian planes enter Japanese airspace for three
//         minutes each, the first breach since September 2024.
//   ALSO  France strikes over pay (146,000 march) and Ebola cases pass
//         11,000 in DR Congo.
//
// All text uses a small embedded 5x7 bitmap font, stored as 5-bit rows so
// the file stays small; it is scaled up so it stays legible when small.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 4);

// ------------------------------------------------------------------ colours
type RGBA = [number, number, number, number];
const PAPER: RGBA = [246, 239, 221, 1];
const INK: RGBA = [26, 26, 26, 1];
const WHITE: RGBA = [255, 255, 255, 1];
const GREY: RGBA = [110, 104, 90, 1];
const CARD: RGBA = [255, 253, 247, 1];
const BLUE: RGBA = [30, 90, 160, 1];
const TEAL: RGBA = [0, 120, 110, 1];
const RED: RGBA = [180, 40, 30, 1];
const ORANGE: RGBA = [190, 90, 20, 1];
const GREEN: RGBA = [20, 130, 60, 1];
const PURPLE: RGBA = [90, 70, 160, 1];
const GOLD: RGBA = [220, 160, 40, 1];
const SKY: RGBA = [120, 180, 220, 1];
const SEA: RGBA = [40, 110, 170, 1];

// --------------------------------------------------------- pixel primitives
function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const idx = (y * W + x) * 4;
  const inv = 1 - a;
  img[idx] = Math.round(r * a + img[idx] * inv);
  img[idx + 1] = Math.round(g * a + img[idx + 1] * inv);
  img[idx + 2] = Math.round(b * a + img[idx + 2] * inv);
  img[idx + 3] = 255;
}

// Coverage from a signed distance (negative inside): 1 inside, fading to
// 0 over ~1.6 px outside the edge, for clean anti-aliased edges.
function cov(d: number): number {
  const t = 0.5 - d / 1.6;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

function rect(x: number, y: number, w: number, h: number, c: RGBA, alpha = 1): void {
  const xa = Math.max(0, Math.floor(x));
  const xb = Math.min(W - 1, Math.ceil(x + w) - 1);
  const ya = Math.max(0, Math.floor(y));
  const yb = Math.min(H - 1, Math.ceil(y + h) - 1);
  for (let yy = ya; yy <= yb; yy++) {
    for (let xx = xa; xx <= xb; xx++) blend(xx, yy, c[0], c[1], c[2], alpha * c[3]);
  }
}

function circle(cx: number, cy: number, r: number, c: RGBA, alpha = 1): void {
  const xa = Math.max(0, Math.floor(cx - r - 2));
  const xb = Math.min(W - 1, Math.ceil(cx + r + 2));
  const ya = Math.max(0, Math.floor(cy - r - 2));
  const yb = Math.min(H - 1, Math.ceil(cy + r + 2));
  for (let yy = ya; yy <= yb; yy++) {
    for (let xx = xa; xx <= xb; xx++) {
      const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) - r;
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(xx, yy, c[0], c[1], c[2], a);
    }
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA, alpha = 1): void {
  const xa = Math.max(0, Math.floor(cx - rx - 2));
  const xb = Math.min(W - 1, Math.ceil(cx + rx + 2));
  const ya = Math.max(0, Math.floor(cy - ry - 2));
  const yb = Math.min(H - 1, Math.ceil(cy + ry + 2));
  const m = Math.min(rx, ry);
  for (let yy = ya; yy <= yb; yy++) {
    for (let xx = xa; xx <= xb; xx++) {
      const nx = (xx + 0.5 - cx) / rx;
      const ny = (yy + 0.5 - cy) / ry;
      const d = (Math.hypot(nx, ny) - 1) * m;
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(xx, yy, c[0], c[1], c[2], a);
    }
  }
}

function segDist(pxx: number, pyy: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((pxx - ax) * dx + (pyy - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(pxx - (ax + t * dx), pyy - (ay + t * dy));
}

function triDist(x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const d1 = segDist(x, y, ax, ay, bx, by);
  const d2 = segDist(x, y, bx, by, cx, cy);
  const d3 = segDist(x, y, cx, cy, ax, ay);
  const d = Math.min(d1, d2, d3);
  const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  const s3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  return inside ? -d : d;
}

function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGBA, alpha = 1): void {
  const xa = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 2));
  const xb = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) + 2));
  const ya = Math.max(0, Math.floor(Math.min(ay, by, cy) - 2));
  const yb = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) + 2));
  for (let yy = ya; yy <= yb; yy++) {
    for (let xx = xa; xx <= xb; xx++) {
      const d = triDist(xx + 0.5, yy + 0.5, ax, ay, bx, by, cx, cy);
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(xx, yy, c[0], c[1], c[2], a);
    }
  }
}

// A thick line with round caps.
function line(x1: number, y1: number, x2: number, y2: number, w: number, c: RGBA, alpha = 1): void {
  const r = w / 2;
  const xa = Math.max(0, Math.floor(Math.min(x1, x2) - r - 2));
  const xb = Math.min(W - 1, Math.ceil(Math.max(x1, x2) + r + 2));
  const ya = Math.max(0, Math.floor(Math.min(y1, y2) - r - 2));
  const yb = Math.min(H - 1, Math.ceil(Math.max(y1, y2) + r + 2));
  for (let yy = ya; yy <= yb; yy++) {
    for (let xx = xa; xx <= xb; xx++) {
      const d = segDist(xx + 0.5, yy + 0.5, x1, y1, x2, y2) - r;
      const a = cov(d) * alpha * c[3];
      if (a > 0) blend(xx, yy, c[0], c[1], c[2], a);
    }
  }
}

// A thick quadratic bezier stroke, drawn as overlapping discs.
function bezier(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number, c: RGBA, alpha = 1): void {
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const bx = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const by = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    circle(bx, by, w / 2, c, alpha);
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows of 5 bits, stored as one number per row: the top
// bit is the leftmost cell. Bit 4 is column 0, bit 0 is column 4.
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '$': [4, 15, 20, 14, 5, 30, 4],
  '%': [25, 26, 2, 4, 8, 22, 19],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '?': [14, 17, 1, 6, 4, 0, 4],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 21, 14, 31, 14, 21, 0],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGBA): void {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS['?'];
    for (let r = 0; r < 7; r++) {
      const bits = g[r];
      for (let col = 0; col < 5; col++) {
        if ((bits >> (4 - col)) & 1) rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawCentered(cx: number, y: number, text: string, scale: number, c: RGBA): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap to a maximum pixel width; returns the lines.
function wrap(text: string, scale: number, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textWidth(next, scale) <= maxW) {
      cur = next;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------- icons
// The lead icon is drawn inside a 280 x 220 box centred on (cx, cy); the
// mid icons inside a 128 x 140 box; the compact icons inside a 301 x 92
// band. Each one is a small pictorial scene for its own story.

function iconBridgeBig(cx: number, cy: number): void {
  // Water at the bottom.
  line(cx - 128, cy + 84, cx + 128, cy + 84, 4, SEA);
  line(cx - 110, cy + 96, cx + 110, cy + 96, 4, SEA);
  // Towers.
  rect(cx - 118, cy - 60, 12, 130, INK);
  rect(cx + 106, cy - 60, 12, 130, INK);
  // Deck in two pieces with a wide gap where the arch fell.
  line(cx - 132, cy + 58, cx - 34, cy + 58, 9, INK);
  line(cx + 34, cy + 58, cx + 132, cy + 58, 9, INK);
  // The fallen arch: a broken arc dropping into the water.
  bezier(cx - 34, cy + 58, cx - 10, cy + 30, cx + 6, cy + 78, 7, GREY);
  line(cx - 34, cy + 58, cx - 6, cy + 80, 6, GREY);
  // Arch cable over the left half.
  bezier(cx - 118, cy - 60, cx - 76, cy + 10, cx - 34, cy + 58, 4, INK);
  // Blast star above the gap.
  circle(cx, cy - 30, 14, GOLD);
  triangle(cx - 5, cy - 52, cx + 5, cy - 52, cx, cy - 24, GOLD);
  triangle(cx - 26, cy - 34, cx - 8, cy - 26, cx - 18, cy - 12, ORANGE);
  triangle(cx + 26, cy - 34, cx + 8, cy - 26, cx + 18, cy - 12, ORANGE);
  // Smoke puffs.
  circle(cx - 18, cy - 58, 10, GREY, 0.7);
  circle(cx + 12, cy - 66, 12, GREY, 0.7);
  circle(cx + 30, cy - 52, 8, GREY, 0.7);
}

function iconStrike(cx: number, cy: number): void {
  // Sea and island.
  line(cx - 58, cy + 52, cx + 58, cy + 52, 4, SEA);
  ellipse(cx - 6, cy + 48, 46, 16, GREEN);
  // Missile launcher on the island, tube angled up.
  rect(cx - 22, cy + 30, 34, 10, INK);
  line(cx + 10, cy + 34, cx + 34, cy + 6, 7, INK);
  triangle(cx + 34, cy + 2, cx + 40, cy + 12, cx + 30, cy + 14, RED);
  // Jet above, nose to the right, diving at the launcher.
  rect(cx - 52, cy - 46, 44, 12, INK);
  triangle(cx - 8, cy - 46, cx - 8, cy - 34, cx + 26, cy - 40, INK);
  triangle(cx - 30, cy - 44, cx - 52, cy - 66, cx - 40, cy - 44, GREY);
  triangle(cx - 30, cy - 36, cx - 52, cy - 14, cx - 40, cy - 36, GREY);
  // Burst where the strike lands.
  circle(cx + 22, cy + 18, 9, GOLD);
  triangle(cx + 19, cy + 4, cx + 25, cy + 4, cx + 22, cy + 14, GOLD);
}

function iconChip(cx: number, cy: number): void {
  // Chip body, pins on all four sides, inner die.
  rect(cx - 34, cy - 34, 68, 68, INK);
  rect(cx - 22, cy - 22, 44, 44, GREEN);
  rect(cx - 12, cy - 12, 24, 24, INK);
  for (const off of [-20, 0, 20]) {
    rect(cx + off - 3, cy - 46, 6, 12, INK);
    rect(cx + off - 3, cy + 34, 6, 12, INK);
    rect(cx - 46, cy + off - 3, 12, 6, INK);
    rect(cx + 34, cy + off - 3, 12, 6, INK);
  }
  // Rising bars above the chip, with a trend arrow.
  const bars = [12, 20, 28, 36];
  for (let b = 0; b < 4; b++) {
    rect(cx - 44 + b * 22, cy - 62 - (bars[b] - 12), 10, bars[b], GREEN);
  }
  line(cx - 48, cy - 88, cx + 36, cy - 92, 4, GREEN);
  triangle(cx + 36, cy - 98, cx + 36, cy - 84, cx + 50, cy - 91, GREEN);
}

function iconGlobePins(cx: number, cy: number): void {
  // Small globe with three pins for the three powers meeting.
  circle(cx, cy, 34, INK);
  circle(cx, cy, 30, SEA);
  circle(cx - 11, cy - 9, 10, GREEN);
  circle(cx + 11, cy + 9, 9, GREEN);
  line(cx - 28, cy, cx + 28, cy, 3, WHITE, 0.8);
  for (const [dx, col] of [[-16, RED], [0, BLUE], [16, GOLD]] as [number, RGBA][]) {
    line(cx + dx, cy - 22, cx + dx, cy - 36, 3, INK);
    circle(cx + dx, cy - 40, 4, col);
  }
}

function iconVirus(cx: number, cy: number): void {
  // Spiky virus ball on the left.
  const vx = cx - 64;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(vx + Math.cos(a) * 26, cy + Math.sin(a) * 26, vx + Math.cos(a) * 38, cy + Math.sin(a) * 38, 4, RED);
    circle(vx + Math.cos(a) * 40, cy + Math.sin(a) * 40, 4, RED);
  }
  circle(vx, cy, 26, RED);
  circle(vx - 8, cy - 6, 5, WHITE, 0.9);
  circle(vx + 8, cy + 8, 4, WHITE, 0.9);
  // Shield on the right, cracked.
  const sx = cx + 64;
  line(sx - 24, cy - 30, sx + 24, cy - 30, 5, INK);
  line(sx - 24, cy - 30, sx - 24, cy + 6, 5, INK);
  line(sx + 24, cy - 30, sx + 24, cy + 6, 5, INK);
  line(sx - 24, cy + 6, sx, cy + 30, 5, INK);
  line(sx + 24, cy + 6, sx, cy + 30, 5, INK);
  line(sx - 12, cy - 26, sx + 8, cy + 22, 4, RED);
}

function iconJetWide(cx: number, cy: number): void {
  // Contrails behind the jet.
  line(cx - 138, cy - 10, cx - 60, cy - 10, 3, SKY);
  line(cx - 138, cy + 12, cx - 60, cy + 12, 3, SKY);
  // Fuselage, nose to the right.
  rect(cx - 60, cy - 8, 64, 16, INK);
  triangle(cx + 4, cy - 8, cx + 4, cy + 8, cx + 52, cy, INK);
  // Swept wings.
  triangle(cx - 18, cy - 6, cx - 48, cy - 40, cx - 32, cy - 6, GREY);
  triangle(cx - 18, cy + 6, cx - 48, cy + 40, cx - 32, cy + 6, GREY);
  // Tail fin.
  triangle(cx - 60, cy - 6, cx - 74, cy - 26, cx - 66, cy - 6, INK);
  // Cockpit window.
  ellipse(cx + 18, cy - 2, 11, 4, SKY);
  // Warning star above the jet.
  circle(cx + 20, cy - 36, 6, RED);
}

// ------------------------------------------------------------------ stories
interface Lead {
  kicker: string;
  head1: string;
  head2: string;
  body: string;
  place: string;
  accent: RGBA;
  tint: RGBA;
}

interface Mid {
  kicker: string;
  head1: string;
  head2: string;
  body: string;
  place: string;
  accent: RGBA;
  tint: RGBA;
  icon: (cx: number, cy: number) => void;
}

interface Small {
  kicker: string;
  head1: string;
  head2: string;
  body: string;
  fact: string;
  accent: RGBA;
  tint: RGBA;
  icon: (cx: number, cy: number) => void;
}

const LEAD: Lead = {
  kicker: 'CRIMEA - WAR',
  head1: 'BRIDGE ARCH',
  head2: 'INTO THE SEA',
  body: 'UKRAINE HITS THE KERCH BRIDGE FOR A SECOND DAY. THE ROAD ARCH COLLAPSES INTO THE STRAIT. TWO KILLED.',
  place: 'KERCH STRAIT, CRIMEA',
  accent: RED,
  tint: [244, 214, 210, 1],
};

const MIDS: Mid[] = [
  {
    kicker: 'GULF - TENSION',
    head1: 'US STRIKES',
    head2: 'QESHM ISLAND',
    body: 'US JETS HIT A MISSILE SITE ON QESHM ISLAND AFTER IRAN HIT A US RADAR.',
    place: 'QESHM - BAHRAIN',
    accent: ORANGE,
    tint: [244, 226, 208, 1],
    icon: iconStrike,
  },
  {
    kicker: 'TECH - MARKETS',
    head1: 'NVIDIA SAYS',
    head2: 'NO TO HUANG',
    body: 'REVENUE $115.8BN, DOUBLE A YEAR AGO. FIRST REPORT SINCE HUANG RESIGNED.',
    place: 'AI CHIPS - USA',
    accent: GREEN,
    tint: [210, 238, 220, 1],
    icon: iconChip,
  },
];

const SMALLS: Small[] = [
  {
    kicker: 'CHINA - APEC',
    head1: 'TRUMP HEADS',
    head2: 'TO SHENZHEN',
    body: 'XI, PUTIN AND TRUMP MEET THURSDAY IN SHENZHEN.',
    fact: 'FIRST TRILATERAL MEETING',
    accent: BLUE,
    tint: [214, 230, 244, 1],
    icon: iconGlobePins,
  },
  {
    kicker: 'USA - HEALTH',
    head1: 'MEASLES BACK',
    head2: 'AFTER 26 YEARS',
    body: 'US LOSES MEASLES-FREE STATUS. 5,400 CASES.',
    fact: 'MOST CASES SINCE 1991',
    accent: PURPLE,
    tint: [226, 220, 244, 1],
    icon: iconVirus,
  },
  {
    kicker: 'JAPAN - AIRSPACE',
    head1: 'JETS SCRAMBLE',
    head2: 'OVER JAPAN',
    body: 'SUSPECTED RUSSIAN PLANES IN FOR 3 MINUTES.',
    fact: 'FIRST SINCE SEPT 2024',
    accent: TEAL,
    tint: [208, 236, 232, 1],
    icon: iconJetWide,
  },
];

const FOOT1 = 'ALSO: FRANCE STRIKES OVER PAY - 146,000 MARCH';
const FOOT2 = 'EBOLA CASES PASS 11,000 IN DR CONGO - WHO';

// ------------------------------------------------------------- draw the page
for (let i = 0; i < W * H; i++) {
  img[i * 4] = PAPER[0];
  img[i * 4 + 1] = PAPER[1];
  img[i * 4 + 2] = PAPER[2];
  img[i * 4 + 3] = 255;
}

// Thin double border around the whole page.
rect(10, 10, W - 20, 4, INK);
rect(10, H - 14, W - 20, 4, INK);
rect(10, 10, 4, H - 20, INK);
rect(W - 14, 10, 4, H - 20, INK);

// Masthead.
drawCentered(512, 28, 'WORLD NEWS', 9, INK);
rect(24, 106, 976, 5, INK);
rect(24, 116, 976, 2, INK);
drawCentered(512, 130, 'TUESDAY 17 NOVEMBER 2026', 4, INK);
drawCentered(512, 164, 'SIX STORIES FROM ONE DAY AROUND THE WORLD', 2, GREY);
rect(24, 188, 976, 3, INK);

// Lead panel: full width, big pictorial scene on the left.
const LX = 24;
const LY = 200;
const LW = 976;
const LH = 256;
rect(LX, LY, LW, LH, CARD);
rect(LX, LY, LW, 12, LEAD.accent);
rect(LX, LY, LW, 3, INK);
rect(LX, LY + LH - 3, LW, 3, INK);
rect(LX, LY, 3, LH, INK);
rect(LX + LW - 3, LY, 3, LH, INK);
rect(LX + 14, LY + 16, 280, 224, LEAD.tint);
iconBridgeBig(LX + 154, LY + 128);
drawText(LX + 310, LY + 22, LEAD.kicker, 2, LEAD.accent);
drawText(LX + 310, LY + 50, LEAD.head1, 6, INK);
drawText(LX + 310, LY + 98, LEAD.head2, 6, INK);
rect(LX + 310, LY + 152, 642, 2, INK);
const leadLines = wrap(LEAD.body, 3, 642);
for (let li = 0; li < leadLines.length && li < 3; li++) {
  drawText(LX + 310, LY + 164 + li * 24, leadLines[li], 3, INK);
}
drawCentered(LX + 310 + 321, LY + 238, LEAD.place, 2, GREY);

// Mid panels: two wide columns.
const MW = 480;
const MH = 232;
const MX0 = [24, 520];
const MY = 468;
for (let s = 0; s < MIDS.length; s++) {
  const st = MIDS[s];
  const x = MX0[s];
  const y = MY;
  rect(x, y, MW, MH, CARD);
  rect(x, y, MW, 12, st.accent);
  rect(x, y, MW, 3, INK);
  rect(x, y + MH - 3, MW, 3, INK);
  rect(x, y, 3, MH, INK);
  rect(x + MW - 3, y, 3, MH, INK);
  rect(x + 14, y + 24, 128, 140, st.tint);
  st.icon(x + 78, y + 94);
  drawText(x + 156, y + 28, st.kicker, 2, st.accent);
  drawText(x + 156, y + 54, st.head1, 3, INK);
  drawText(x + 156, y + 82, st.head2, 3, INK);
  rect(x + 156, y + 112, 310, 2, INK);
  const lines = wrap(st.body, 2, 310);
  for (let li = 0; li < lines.length && li < 3; li++) {
    drawText(x + 156, y + 124 + li * 20, lines[li], 2, INK);
  }
  drawCentered(x + 240, y + 206, st.place, 2, GREY);
}

// Compact panels: three across, one fact line each.
const SW = 317;
const SH = 236;
const SX0 = [24, 349, 674];
const SY = 712;
for (let s = 0; s < SMALLS.length; s++) {
  const st = SMALLS[s];
  const x = SX0[s];
  const y = SY;
  rect(x, y, SW, SH, CARD);
  rect(x, y, SW, 12, st.accent);
  rect(x, y, SW, 3, INK);
  rect(x, y + SH - 3, SW, 3, INK);
  rect(x, y, 3, SH, INK);
  rect(x + SW - 3, y, 3, SH, INK);
  rect(x + 8, y + 10, 301, 92, st.tint);
  st.icon(x + 158, y + 56);
  drawText(x + 14, y + 110, st.kicker, 2, st.accent);
  drawText(x + 14, y + 128, st.head1, 3, INK);
  drawText(x + 14, y + 152, st.head2, 3, INK);
  const lines = wrap(st.body, 2, 289);
  for (let li = 0; li < lines.length && li < 2; li++) {
    drawText(x + 14, y + 178 + li * 18, lines[li], 2, INK);
  }
  drawText(x + 14, y + 216, st.fact, 2, st.accent);
}

// Footer strip with two more stories.
rect(24, 960, 976, 2, INK);
drawCentered(512, 970, FOOT1, 2, INK);
drawCentered(512, 990, FOOT2, 2, INK);

// ------------------------------------------------------------- PNG encode
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crcOf(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crcOf(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function paethPick(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(W, 0);
header.writeUInt32BE(H, 4);
header[8] = 8; // bit depth
header[9] = 6; // colour type RGBA
header[10] = 0; // compression
header[11] = 0; // filter
header[12] = 0; // interlace

// Filter each scanline with the best of the five PNG filters (deterministic).
const stride = W * 4;
const scan = Buffer.alloc(H * (stride + 1));
for (let y = 0; y < H; y++) {
  const row = img.subarray(y * stride, (y + 1) * stride);
  const prev = y === 0 ? null : img.subarray((y - 1) * stride, y * stride);
  let bestId = 0;
  let best: Buffer | null = null;
  let bestScore = Infinity;
  for (let f = 0; f <= 4; f++) {
    const cand = Buffer.alloc(stride);
    let score = 0;
    for (let i = 0; i < stride; i++) {
      const v = row[i];
      const a = i >= 4 ? row[i - 4] : 0;
      const b = prev ? prev[i] : 0;
      const cc = prev && i >= 4 ? prev[i - 4] : 0;
      let fv: number;
      if (f === 0) fv = v;
      else if (f === 1) fv = (v - a) & 0xff;
      else if (f === 2) fv = (v - b) & 0xff;
      else if (f === 3) fv = (v - ((a + b) >> 1)) & 0xff;
      else fv = (v - paethPick(a, b, cc)) & 0xff;
      cand[i] = fv;
      score += Math.abs(fv < 128 ? fv : fv - 256);
    }
    if (score < bestScore) {
      bestScore = score;
      bestId = f;
      best = cand;
    }
  }
  scan[y * (stride + 1)] = bestId;
  scan.set(best as Buffer, y * (stride + 1) + 1);
}

const data = deflateSync(scan, { level: 9 });
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', header),
  pngChunk('IDAT', data),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
