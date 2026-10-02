import React from 'react';
import {
  AbsoluteFill, Easing, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { C, fontFamily } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Plan vidéo plein cadre avec lent zoom « Ken Burns ». */
export const Footage: React.FC<{
  src: string; startFrom?: number; zoom?: [number, number]; duration: number;
  darken?: number; blur?: number; origin?: string;
}> = ({ src, startFrom = 0, zoom = [1.04, 1.14], duration, darken = 0.35, blur = 0, origin = '50% 50%' }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], zoom, { ...clamp, easing: Easing.out(Easing.quad) });
  return (
    <AbsoluteFill style={{ backgroundColor: C.night, overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={startFrom}
        muted
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${scale})`, transformOrigin: origin,
          filter: blur ? `blur(${blur}px) saturate(1.1)` : 'saturate(1.12) contrast(1.04)',
        }}
      />
      <AbsoluteFill style={{ backgroundColor: `rgba(21, 22, 42, ${darken})` }} />
    </AbsoluteFill>
  );
};

/** Ligne de texte qui monte derrière un masque, mot par mot. */
export const RevealLine: React.FC<{
  text: string; delay: number; size: number; color?: string; weight?: number;
  stagger?: number; italicWords?: string[]; highlight?: string[];
}> = ({ text, delay, size, color = C.cream, weight = 800, stagger = 3, highlight = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.26, lineHeight: 1.04 }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 18, stiffness: 140, mass: 0.7 } });
        const hl = highlight.includes(w.replace(/[.,]/g, ''));
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span style={{
              display: 'inline-block', fontFamily, fontWeight: weight, fontSize: size, letterSpacing: -size * 0.035,
              color: hl ? C.green : color,
              transform: `translateY(${(1 - p) * 115}%) rotate(${(1 - p) * 4}deg)`,
              opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
            }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Bande verte diagonale qui balaie l'écran (transition). */
export const GreenWipe: React.FC<{ duration?: number }> = ({ duration = 22 }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, duration], [-130, 130], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: '-30%', bottom: '-30%', left: `${x}%`, width: '75%',
        transform: 'skewX(-18deg)',
        background: `linear-gradient(90deg, ${C.green} 0%, ${C.green} 62%, ${C.night} 62%, ${C.night} 100%)`,
        boxShadow: `0 0 120px 30px rgba(61,220,151,0.35)`,
      }} />
    </AbsoluteFill>
  );
};

/** Grain pellicule animé + vignette. */
export const FilmLook: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = frame % 6;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{
        opacity: 0.09, mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' seed='${seed}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
      }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(10,10,25,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

/** Symbole Voyaj : le soleil se lève, puis les deux traits du V se dessinent. */
export const LogoMark: React.FC<{ size: number; delay?: number }> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sun = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 70 } });
  const cream = interpolate(frame - delay, [8, 26], [1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const green = interpolate(frame - delay, [16, 34], [1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <svg width={size} height={size} viewBox="10 10 80 80" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.sunTop} />
          <stop offset="1" stopColor={C.sunBottom} />
        </linearGradient>
        <clipPath id="horizon"><rect x="0" y="-40" width="100" height="99" /></clipPath>
        <filter id="glow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <g clipPath="url(#horizon)">
        <circle cx="50" cy={interpolate(sun, [0, 1], [80, 43])} r={15.5 * interpolate(sun, [0, 1], [0.7, 1])} fill="url(#sun)" opacity={0.6} filter="url(#glow)" />
        <circle cx="50" cy={interpolate(sun, [0, 1], [80, 43])} r={15.5 * interpolate(sun, [0, 1], [0.7, 1])} fill="url(#sun)" />
      </g>
      <path d="M24 24 L50 75" pathLength={1} strokeDasharray={1} strokeDashoffset={cream}
        stroke={C.cream} strokeWidth={13} strokeLinecap="round" fill="none" />
      <path d="M76 24 L50 75" pathLength={1} strokeDasharray={1} strokeDashoffset={green}
        stroke={C.green} strokeWidth={13} strokeLinecap="round" fill="none" />
    </svg>
  );
};

/** « Voyaj. » lettre par lettre. */
export const Wordmark: React.FC<{ size: number; delay: number }> = ({ size, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', fontFamily, fontWeight: 800, fontSize: size, letterSpacing: -size * 0.045, color: C.cream, lineHeight: 1 }}>
      {'Voyaj.'.split('').map((ch, i) => {
        const p = spring({ frame: frame - delay - i * 2.5, fps, config: { damping: 14, stiffness: 160 } });
        return (
          <span key={i} style={{
            display: 'inline-block', color: ch === '.' ? C.green : C.cream,
            transform: `translateY(${(1 - p) * 60}%) scale(${0.6 + p * 0.4})`, opacity: p,
          }}>{ch}</span>
        );
      })}
    </div>
  );
};

/** Petite étiquette technique en majuscules espacées. */
export const Kicker: React.FC<{ text: string; delay: number; color?: string }> = ({ text, delay, color = C.green }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame - delay, [0, 14], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily, fontWeight: 700, fontSize: 24, letterSpacing: 6, textTransform: 'uppercase', color }}>
      <div style={{ width: w * 0.6, height: 3, backgroundColor: color, borderRadius: 2 }} />
      <span style={{ clipPath: `inset(0 ${100 - w}% 0 0)` }}>{text}</span>
    </div>
  );
};
