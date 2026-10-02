// Bande-son Voyaj (15 s) : musique + bruitages synthétisés, calés à l'image près.
// Usage : node audio/make-soundtrack.mjs  →  public/soundtrack.wav (48 kHz, stéréo, 16 bits)
import { readFileSync, writeFileSync } from 'node:fs';

const SR = 48000;
const FPS = 30;
const DUR = 23;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N); // envoi réverbération
const sendR = new Float32Array(N);

const fr = (f) => f / FPS; // image → secondes
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function put(i, l, r, rev = 0) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  if (rev) { sendL[i] += l * rev; sendR[i] += r * rev; }
}
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// ─── Instruments ──────────────────────────────────────────────────────────
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

/** Nappe : 3 dents de scie désaccordées, filtre passe-bas, attaque lente. */
function pad(notes, t0, t1, { gain = 0.05, cutoff = 1400, attack = 0.8, release = 1.2, rev = 0.6 } = {}) {
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t1 + release) * SR));
  notes.forEach((m, ni) => {
    const detunes = [-0.09, 0, 0.11];
    const phases = detunes.map(() => Math.random());
    let lp = 0;
    const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
    const [pl, pr] = panLR(((ni % 3) - 1) * 0.5);
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      const tt = i / SR;
      let s = 0;
      detunes.forEach((d, k) => {
        const f = hz(m + d);
        const dt = f / SR;
        phases[k] = (phases[k] + dt) % 1;
        s += 2 * phases[k] - 1 - polyblep(phases[k], dt);
      });
      lp += a * (s / 3 - lp);
      const env = Math.min(1, t / attack) * (tt < t1 ? 1 : Math.max(0, 1 - (tt - t1) / release));
      const v = lp * env * gain;
      put(i, v * pl, v * pr, rev);
    }
  });
}

/** Corde pincée (Karplus-Strong). */
function pluck(m, t, { gain = 0.22, decay = 0.996, pan = 0, rev = 0.35, len = 1.6, bright = 0.5 } = {}) {
  const f = hz(m);
  const P = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(P).map(() => rnd());
  let idx = 0;
  const i0 = Math.floor(t * SR);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < len * SR; i++) {
    const cur = buf[idx];
    const next = buf[(idx + 1) % P];
    buf[idx] = decay * (bright * cur + (1 - bright) * 0.5 * (cur + next));
    idx = (idx + 1) % P;
    const v = cur * gain;
    put(i0 + i, v * pl, v * pr, rev);
  }
}

/** Grosse caisse : sinus à hauteur descendante + clic. */
function kick(t, { gain = 0.9, sub = false } = {}) {
  const i0 = Math.floor(t * SR);
  let ph = 0;
  const len = sub ? 1.4 : 0.45;
  for (let i = 0; i < len * SR; i++) {
    const tt = i / SR;
    const f = (sub ? 38 : 48) + (sub ? 90 : 110) * Math.exp(-tt * 28);
    ph += 2 * Math.PI * f / SR;
    const env = Math.exp(-tt * (sub ? 2.6 : 7.5));
    const click = i < 90 ? rnd() * (1 - i / 90) * 0.35 : 0;
    const v = (Math.sin(ph) * env + click) * gain;
    put(i0 + i, v, v);
  }
}

/** Charleston : bruit passe-haut court. */
function hat(t, { gain = 0.06, len = 0.05, pan = 0.2 } = {}) {
  const i0 = Math.floor(t * SR);
  let prev = 0, hp = 0;
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < len * SR; i++) {
    const n = rnd();
    hp = 0.86 * (hp + n - prev); prev = n;
    const v = hp * Math.exp(-i / SR / (len / 4)) * gain;
    put(i0 + i, v * pl, v * pr, 0.1);
  }
}

/** Basse : sinus + harmonique douce, enveloppe courte. */
function bass(m, t, len, gain = 0.22) {
  const i0 = Math.floor(t * SR);
  const f = hz(m);
  for (let i = 0; i < len * SR; i++) {
    const tt = i / SR;
    const env = Math.min(1, tt / 0.01) * Math.exp(-tt * 1.6) * (tt > len - 0.05 ? (len - tt) / 0.05 : 1);
    const v = (Math.sin(2 * Math.PI * f * tt) + 0.25 * Math.sin(4 * Math.PI * f * tt)) * env * gain;
    put(i0 + i, v, v);
  }
}

/** Souffle filtré qui traverse l'image de gauche à droite. */
function whoosh(t, len = 0.75, gain = 0.32) {
  const i0 = Math.floor(t * SR);
  let low = 0, band = 0;
  for (let i = 0; i < len * SR; i++) {
    const x = i / (len * SR);
    const fc = 300 + 6500 * Math.sin(Math.PI * x) ** 2;
    const fq = 2 * Math.sin(Math.PI * fc / SR);
    const n = rnd();
    low += fq * band;
    const high = n - low - 0.6 * band;
    band += fq * high;
    const env = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.5;
    const v = band * env * gain;
    const [pl, pr] = panLR(-0.9 + 1.8 * x);
    put(i0 + i, v * pl, v * pr, 0.25);
  }
}

/** Montée avant le logo : bruit + sinus qui grimpent. */
function riser(t0, t1, gain = 0.16) {
  const i0 = Math.floor(t0 * SR), i1 = Math.floor(t1 * SR);
  let ph = 0, low = 0, band = 0;
  for (let i = i0; i < i1; i++) {
    const x = (i - i0) / (i1 - i0);
    const f = 180 * 2 ** (x * 3);
    ph += 2 * Math.PI * f / SR;
    const fc = 500 + 7000 * x * x;
    const fq = 2 * Math.sin(Math.PI * Math.min(fc, 12000) / SR);
    const n = rnd();
    low += fq * band;
    band += fq * (n - low - 0.7 * band);
    const env = x ** 2.2;
    const v = (band * 0.8 + Math.sin(ph) * 0.35) * env * gain;
    put(i, v, v, 0.3);
  }
}

/** Cloche (partiels inharmoniques). */
function bell(m, t, { gain = 0.12, len = 2.2, pan = 0, rev = 0.6 } = {}) {
  const i0 = Math.floor(t * SR);
  const f = hz(m);
  const parts = [[1, 1], [2.01, 0.5], [3.98, 0.25], [5.43, 0.12]];
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < len * SR; i++) {
    const tt = i / SR;
    let s = 0;
    parts.forEach(([r, a], k) => { s += a * Math.sin(2 * Math.PI * f * r * tt) * Math.exp(-tt * (2.2 + k * 1.6)); });
    const v = s * Math.min(1, tt / 0.004) * gain;
    put(i0 + i, v * pl, v * pr, rev);
  }
}

/** Clic d'interface : petit grain + ton aigu. */
function click(t, { gain = 0.1, tone = 2400, pan = 0.35 } = {}) {
  const i0 = Math.floor(t * SR);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 0.04 * SR; i++) {
    const tt = i / SR;
    const v = (Math.sin(2 * Math.PI * tone * tt) * 0.6 + rnd() * 0.4) * Math.exp(-tt * 140) * gain;
    put(i0 + i, v * pl, v * pr, 0.08);
  }
}

/** « Pop » tonal (bulle). */
function pop(m, t, { gain = 0.16, pan = 0.3 } = {}) {
  const i0 = Math.floor(t * SR);
  const f = hz(m);
  let ph = 0;
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 0.18 * SR; i++) {
    const tt = i / SR;
    ph += 2 * Math.PI * f * (1 + 0.6 * Math.exp(-tt * 60)) / SR;
    const v = Math.sin(ph) * Math.exp(-tt * 22) * gain;
    put(i0 + i, v * pl, v * pr, 0.3);
  }
}

// ─── Partition (repères partagés avec le montage : src/timeline.json) ──────
const T = JSON.parse(readFileSync(new URL('../src/timeline.json', import.meta.url), 'utf8'));
const at = (scene, f = 0) => fr(T[scene].from + f);
const BEAT = 0.5;
const HIT = at('logo'); // révélation du logo

// 1. Jo — si mineur, sombre et en suspens
pad([35, 47, 50, 54], 0, at('driver'), { gain: 0.085, cutoff: 1100, attack: 1.4, release: 0.6 });
T.jo.lines.forEach((f, k) => {
  pluck([66, 69, 71][k], at('jo', f), { gain: 0.3, pan: 0.15, bright: 0.35 });
  pluck([59, 62, 62][k], at('jo', f) + 0.02, { gain: 0.2, pan: -0.25, bright: 0.3 });
});

// 2. « Pourtant… » — sol majeur qui s'éclaire, puis montée vers le logo
pad([43, 47, 50, 55], at('driver'), HIT, { gain: 0.085, cutoff: 1500, attack: 0.5, release: 0.25 });
[0, 9, 18, 27].forEach((d, k) => pluck([67, 71, 74, 79][k], at('driver', T.driver.lines[1] + d), { gain: 0.24, pan: -0.3 + k * 0.2 }));
riser(at('driver', 30), HIT, 0.24);
for (let k = 0; k < 4; k++) kick(HIT - (4 - k) * BEAT, { gain: 0.25 + k * 0.1 }); // battement qui accélère vers le logo

// Balayages verts
T.wipes.forEach((f) => whoosh(fr(f) - 0.05));

// 3. Logo — impact + accord brillant
kick(HIT, { gain: 1, sub: true });
[62, 66, 69, 74, 78].forEach((m, k) => bell(m, HIT + k * 0.012, { gain: 0.07, pan: -0.6 + k * 0.3, len: 3 }));
pad([38, 50, 54, 57, 64], HIT, at('app'), { gain: 0.05, cutoff: 2200, attack: 0.05, release: 0.6 });
whoosh(at('logo', 10), 0.35, 0.12); // trait crème
whoosh(at('logo', 18), 0.35, 0.12); // trait vert
for (let k = 0; k < 6; k++) click(at('logo', 28 + k * 2.5), { gain: 0.05, tone: 1800 + k * 220, pan: -0.4 + k * 0.16 });
pop(81, at('logo', 46), { gain: 0.08, pan: 0 }); // slogan

// 4. L'app — groove complet, ré – la – si m – sol
const APP0 = at('app'), APP1 = at('app', T.app.len);
const CHORDS = [[50, 54, 57], [45, 49, 52], [47, 50, 54], [43, 47, 50]];
const ROOTS = [38, 33, 35, 31];
for (let k = 0; ; k++) {
  const t = HIT + k * BEAT;
  if (t >= APP1 - 0.01) break;
  if (t < APP0 - 0.02) continue;
  kick(t, { gain: 0.62 });
  hat(t + BEAT / 2, { gain: 0.07 });
  hat(t + BEAT / 4, { gain: 0.025, len: 0.03, pan: -0.25 });
}
for (let c = 0; ; c++) {
  const t = APP0 + c * 1.0;
  if (t >= APP1 - 0.05) break;
  const chord = CHORDS[c % 4];
  const end = Math.min(t + 1.0, APP1);
  pad(chord.map((m) => m + 12), t, end, { gain: 0.035, cutoff: 1800, attack: 0.08, release: 0.15 });
  bass(ROOTS[c % 4], t, Math.min(0.95, end - t));
  [0, 1, 2, 1].forEach((n, k) => { if (t + k * 0.25 < APP1) pluck(chord[n] + 24, t + k * 0.25, { gain: 0.07, pan: (k % 2 ? 0.4 : -0.4), len: 0.8, rev: 0.25 }); });
}
// Bruitages de l'écran du téléphone
const S = T.app.screenLen, P0 = T.app.phoneOffset;
const ui = (screen, f) => at('app', P0 + screen * S + f);
for (let k = 0; k < 7; k++) click(ui(0, 6 + k * 2.5), { gain: 0.06, tone: 2600 + (k % 3) * 300 }); // frappe « Taverny »
click(ui(1, 34), { gain: 0.14, tone: 1500, pan: 0.3 }); // appui « Demander à Léa »
whoosh(ui(1, 35), 0.3, 0.07);
pop(79, ui(2, 0), { gain: 0.12 }); pop(86, ui(2, 0) + 0.09, { gain: 0.12 }); // « Léa a accepté »
bell(86, ui(2, 0) + 0.09, { gain: 0.05, len: 1.2, pan: 0.3 });
[74, 76, 78, 81].forEach((m, i) => pop(m, ui(3, 4 + i * 5), { gain: 0.12, pan: 0.15 + i * 0.1 })); // code 4827

// 5. Promesses — montée sur la
pad([45, 52, 57, 61, 64], at('values'), at('end'), { gain: 0.075, cutoff: 2600, attack: 0.15, release: 0.2 });
bass(33, at('values'), 1.8, 0.2);
for (let t = at('values'); t < at('end') - 0.3; t += BEAT) { kick(t, { gain: 0.42 }); hat(t + BEAT / 2, { gain: 0.05 }); }
bass(33, at('values') + 2, 1.2, 0.16);
T.values.chips.forEach((f, i) => { pop([74, 78, 81][i], at('values', f), { gain: 0.13 }); pluck([86, 90, 93][i], at('values', f), { gain: 0.06, len: 0.7 }); });
riser(at('values', T.values.len - 34), at('end'), 0.08);

// 6. Carton final — ré majeur 9, longue réverbération
const END = at('end');
kick(END, { gain: 0.95, sub: true });
pad([26, 38, 45, 54, 57, 61, 64], END, DUR - 0.9, { gain: 0.05, cutoff: 2400, attack: 0.03, release: 0.85 });
[62, 66, 69, 73, 76].forEach((m, k) => bell(m, END + k * 0.015, { gain: 0.06, pan: -0.6 + k * 0.3, len: 1.8 }));
pluck(74, END + 0.3, { gain: 0.1, pan: -0.2 }); pluck(78, END + 0.6, { gain: 0.09, pan: 0.2 }); pluck(81, END + 0.9, { gain: 0.08 });

// ─── Réverbération (Freeverb simplifié) ───────────────────────────────────
function reverb(input, combs, aps) {
  const out = new Float32Array(N);
  const cb = combs.map((d) => ({ b: new Float32Array(d), i: 0, f: 0 }));
  const ab = aps.map((d) => ({ b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (const c of cb) {
      const y = c.b[c.i];
      c.f = y * 0.75 + c.f * 0.25;
      c.b[c.i] = input[n] * 0.02 + c.f * 0.86;
      c.i = (c.i + 1) % c.b.length;
      s += y;
    }
    for (const a of ab) {
      const y = a.b[a.i];
      a.b[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.b.length;
      s = y - s;
    }
    out[n] = s;
  }
  return out;
}
const sc = SR / 44100;
const revL = reverb(sendL, [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(d * sc)), [556, 441, 341, 225].map((d) => Math.round(d * sc)));
const revR = reverb(sendR, [1139, 1211, 1300, 1379, 1445, 1514, 1580, 1640].map((d) => Math.round(d * sc)), [579, 464, 364, 248].map((d) => Math.round(d * sc)));

// ─── Mixage, fondu final, saturation douce, normalisation ────────────────
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const fadeIn = Math.min(1, t / 0.15);
  const fadeOut = t > DUR - 0.6 ? Math.max(0, (DUR - t) / 0.6) : 1;
  L[n] = Math.tanh((L[n] + revL[n] * 1.1) * 1.4) * fadeIn * fadeOut;
  R[n] = Math.tanh((R[n] + revR[n] * 1.1) * 1.4) * fadeIn * fadeOut;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = 0.89 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * norm)) * 32767), 44 + n * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * norm)) * 32767), 46 + n * 4);
}
writeFileSync(new URL('../public/soundtrack.wav', import.meta.url), pcm);
console.log(`soundtrack.wav écrit — pic avant normalisation ${peak.toFixed(2)}`);
