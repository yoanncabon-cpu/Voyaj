import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { FilmLook, Footage, GreenWipe, Kicker, LogoMark, RevealLine, Wordmark } from './components';
import { Phone } from './Phone';

const SCREEN_LEN = T.app.screenLen;
import { C, fontFamily } from './theme';
import T from './timeline.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Fondu d'entrée / de sortie d'une scène (en images locales). */
const Fade: React.FC<{ len: number; fadeIn?: number; fadeOut?: number; children: React.ReactNode }> = ({ len, fadeIn = 0, fadeOut = 0, children }) => {
  const f = useCurrentFrame();
  const a = fadeIn ? interpolate(f, [0, fadeIn], [0, 1], clamp) : 1;
  const b = fadeOut ? interpolate(f, [len - fadeOut, len], [1, 0], clamp) : 1;
  return <AbsoluteFill style={{ opacity: a * b }}>{children}</AbsoluteFill>;
};

const leftShade = 'linear-gradient(90deg, rgba(21,22,42,0.85) 0%, rgba(21,22,42,0.45) 45%, rgba(21,22,42,0) 75%)';

// ─── 1. Jo au bord de la route ─────────────────────────────────────────────
const SceneJo: React.FC = () => (
  <AbsoluteFill>
    <Footage src="jo_alone.mp4" duration={T.jo.len} zoom={[1.06, 1.2]} origin="62% 40%" darken={0.2} />
    <AbsoluteFill style={{ background: leftShade }} />
    <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center', gap: 18 }}>
      <Kicker text="Voici Jo" delay={4} />
      <div style={{ height: 10 }} />
      <RevealLine text="Pas de permis." delay={T.jo.lines[0]} size={104} />
      <RevealLine text="Pas de bus." delay={T.jo.lines[1]} size={104} />
      <RevealLine text="Personne pour l'emmener." delay={T.jo.lines[2]} size={104} color={C.muted} />
    </AbsoluteFill>
  </AbsoluteFill>
);

// ─── 2. La conductrice : « Pourtant… » ─────────────────────────────────────
const SceneDriver: React.FC = () => {
  const f = useCurrentFrame();
  const zoomOut = interpolate(f, [T.driver.len - 16, T.driver.len], [1, 1.25], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ transform: `scale(${zoomOut})`, filter: `blur(${interpolate(f, [T.driver.len - 10, T.driver.len], [0, 14], clamp)}px)` }}>
      <Footage src="car_stops.mp4" startFrom={60} duration={T.driver.len} zoom={[1.14, 1.04]} origin="65% 55%" darken={0.12} />
      <AbsoluteFill style={{ background: leftShade }} />
      <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center', gap: 8 }}>
        <RevealLine text="Pourtant," delay={T.driver.lines[0]} size={70} weight={600} color={C.muted} />
        <RevealLine text="les voitures roulent déjà." delay={T.driver.lines[1]} size={118} highlight={['déjà']} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── 3. Révélation du logo ─────────────────────────────────────────────────
const SceneLogo: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glow = interpolate(f, [0, 40], [0.2, 1], clamp);
  const drift = spring({ frame: f - 30, fps, config: { damping: 20, stiffness: 60 } });
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 50% 42%, rgba(247,161,94,${0.28 * glow}) 0%, ${C.navy} 38%, ${C.night} 78%)`,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ transform: `translateY(${-drift * 40}px)` }}>
        <LogoMark size={330} delay={2} />
      </div>
      <div style={{ marginTop: -10 }}>
        <Wordmark size={170} delay={28} />
      </div>
      <div style={{ marginTop: 26, opacity: interpolate(f, [46, 58], [0, 1], clamp), transform: `translateY(${interpolate(f, [46, 58], [20, 0], clamp)}px)` }}>
        <span style={{ fontFamily, fontWeight: 600, fontSize: 46, color: C.muted, letterSpacing: -0.5 }}>
          Le covoiturage instantané, <span style={{ color: C.green }}>pour tous les Jo.</span>
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── 4. L'app en action ────────────────────────────────────────────────────
const ROUTE = 'M 120 990 C 420 900, 560 1040, 860 960 S 1300 880, 1520 960 S 1780 1010, 1860 940';
const STEPS = [
  { n: '01', t: 'Vous demandez', s: 'Les conducteurs qui vont dans votre direction, avec le prix.' },
  { n: '02', t: 'Il accepte', s: 'En quelques secondes. Il peut même vous offrir le trajet.' },
  { n: '03', t: 'Vous montez', s: 'Un code unique pour la bonne voiture. Frais partagés.' },
];

const SceneApp: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: f - 2, fps, config: { damping: 15, stiffness: 90 } });
  const phoneF = Math.max(0, f - T.app.phoneOffset);
  const active = phoneF < SCREEN_LEN * 2 ? 0 : phoneF < SCREEN_LEN * 3 ? 1 : 2;
  const progress = interpolate(f, [4, T.app.len - 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const len = getLength(ROUTE);
  const car = getPointAtLength(ROUTE, progress * len) ?? { x: 120, y: 990 };
  const route = evolvePath(progress, ROUTE);
  return (
    <AbsoluteFill>
      <Footage src="hero.mp4" duration={T.app.len} playbackRate={0.62} zoom={[1.08, 1.22]} darken={0.62} blur={5} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 72% 45%, rgba(61,220,151,0.16), transparent 55%)' }} />

      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d={ROUTE} stroke="rgba(255,244,226,0.22)" strokeWidth={4} strokeDasharray="14 18" fill="none" />
        <path d={ROUTE} stroke={C.green} strokeWidth={7} strokeLinecap="round" fill="none"
          strokeDasharray={route.strokeDasharray} strokeDashoffset={route.strokeDashoffset}
          style={{ filter: 'drop-shadow(0 0 12px rgba(61,220,151,0.9))' }} />
        <circle cx={car.x} cy={car.y} r={30} fill="rgba(61,220,151,0.25)" />
        <circle cx={car.x} cy={car.y} r={14} fill={C.cream} stroke={C.green} strokeWidth={6} />
      </svg>

      <AbsoluteFill style={{ padding: '120px 0 0 140px' }}>
        <Kicker text="Comment ça marche" delay={2} />
        <div style={{ marginTop: 46, display: 'flex', flexDirection: 'column', gap: 34, width: 820 }}>
          {STEPS.map((st, i) => {
            const on = i === active;
            const appear = spring({ frame: f - 6 - i * 5, fps, config: { damping: 18, stiffness: 120 } });
            const lit = interpolate(on ? 1 : 0, [0, 1], [0.35, 1]);
            return (
              <div key={st.n} style={{
                display: 'flex', gap: 30, alignItems: 'flex-start', fontFamily,
                opacity: appear * lit, transform: `translateX(${(1 - appear) * -60 + (on ? 18 : 0)}px)`,
              }}>
                <div style={{
                  minWidth: 92, height: 92, borderRadius: 28, display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 800,
                  color: on ? C.night : C.cream, background: on ? C.green : 'rgba(255,255,255,0.08)',
                  boxShadow: on ? '0 14px 40px rgba(61,220,151,0.45)' : 'none',
                }}>{st.n}</div>
                <div>
                  <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, color: C.cream, lineHeight: 1.05 }}>{st.t}</div>
                  <div style={{ fontSize: 28, color: C.muted, marginTop: 8, maxWidth: 640 }}>{st.s}</div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'center', paddingRight: 190 }}>
        <div style={{
          transform: `translateY(${(1 - phoneIn) * 700}px) rotate(${(1 - phoneIn) * 10 - 4}deg) scale(0.98)`,
        }}>
          <Phone f={phoneF} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── 5. Les promesses ──────────────────────────────────────────────────────
const CHIPS = [
  { t: 'Prix juste, au kilomètre', s: '12 km = 4,20 €' },
  { t: 'Conducteurs vérifiés', s: 'Identité, permis, carte grise' },
  { t: 'Trajets solidaires', s: 'Offrir la route à qui en a besoin' },
];

const SceneValues: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Footage src="door_opens.mp4" startFrom={20} duration={T.values.len} zoom={[1.05, 1.15]} origin="50% 55%" darken={0.25} />
      <AbsoluteFill style={{ background: leftShade }} />
      <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center' }}>
        <RevealLine text="Plus qu'un trajet." delay={T.values.title} size={110} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 40 }}>
          {CHIPS.map((c, i) => {
            const p = spring({ frame: f - T.values.chips[i], fps, config: { damping: 13, stiffness: 170 } });
            return (
              <div key={c.t} style={{
                display: 'flex', alignItems: 'center', gap: 22, alignSelf: 'flex-start', fontFamily,
                padding: '18px 34px 18px 18px', borderRadius: 999,
                background: 'rgba(21,22,42,0.62)', border: '2px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
                transform: `translateX(${(1 - p) * -80}px) scale(${0.85 + p * 0.15})`, opacity: p,
              }}>
                <div style={{ width: 58, height: 58, borderRadius: 29, background: C.green, display: 'grid', placeItems: 'center' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke={C.night} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <span style={{ fontSize: 40, fontWeight: 800, color: C.cream, letterSpacing: -1 }}>{c.t}</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: C.green }}>{c.s}</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── 6. Carton final ───────────────────────────────────────────────────────
const SceneEnd: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const pill = spring({ frame: f - 16, fps, config: { damping: 14, stiffness: 150 } });
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 50% 40%, rgba(247,161,94,0.22) 0%, ${C.navy} 40%, ${C.night} 80%)`,
      alignItems: 'center', justifyContent: 'center', fontFamily,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, transform: `scale(${0.85 + pop * 0.15})`, opacity: pop }}>
        <LogoMark size={210} delay={-40} />
        <Wordmark size={190} delay={0} />
      </div>
      <div style={{ marginTop: 34, opacity: interpolate(f, [8, 18], [0, 1], clamp), fontSize: 52, fontWeight: 700, color: C.cream, letterSpacing: -1 }}>
        Les voitures roulent déjà. <span style={{ color: C.green }}>Il suffit de monter.</span>
      </div>
      <div style={{
        marginTop: 44, display: 'flex', gap: 22, alignItems: 'center',
        transform: `translateY(${(1 - pill) * 30}px)`, opacity: pill,
      }}>
        <div style={{ padding: '16px 34px', borderRadius: 999, background: C.green, color: C.night, fontSize: 34, fontWeight: 800 }}>voyajapp.com</div>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.muted }}>Bientôt sur iPhone et Android</div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Montage ───────────────────────────────────────────────────────────────
export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.night }}>
    <Sequence from={T.jo.from} durationInFrames={T.jo.len}><SceneJo /></Sequence>
    <Sequence from={T.driver.from} durationInFrames={T.driver.len}><SceneDriver /></Sequence>
    <Sequence from={T.logo.from} durationInFrames={T.logo.len}><Fade len={T.logo.len} fadeIn={8}><SceneLogo /></Fade></Sequence>
    <Sequence from={T.app.from} durationInFrames={T.app.len}><SceneApp /></Sequence>
    <Sequence from={T.values.from} durationInFrames={T.values.len}><SceneValues /></Sequence>
    <Sequence from={T.end.from} durationInFrames={T.end.len}><Fade len={T.end.len} fadeIn={6}><SceneEnd /></Fade></Sequence>

    {T.wipes.map((w) => <Sequence key={w} from={w} durationInFrames={24}><GreenWipe /></Sequence>)}

    <Audio src={staticFile('soundtrack.wav')} />
    <FilmLook />
  </AbsoluteFill>
);
