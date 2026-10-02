import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { C, fontFamily } from './theme';
import T from './timeline.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const SCREEN_LEN = T.app.screenLen;

const Driver: React.FC<{ name: string; car: string; price: string; active?: boolean; delay: number }> = ({ name, car, price, active, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 150 } });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 20,
      background: active ? 'rgba(61,220,151,0.12)' : 'rgba(255,255,255,0.05)',
      border: `2px solid ${active ? C.green : 'rgba(255,255,255,0.08)'}`,
      transform: `translateX(${(1 - p) * 60}px)`, opacity: p,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 26, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22,
        color: C.night, background: `linear-gradient(135deg, ${C.sunTop}, ${C.sunBottom})`,
      }}>{name[0]}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 22 }}>{name}</div>
        <div style={{ fontSize: 16, color: C.muted }}>{car}</div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 22 }}>{price}</div>
    </div>
  );
};

function Search({ f }: { f: number }) {
  const word = 'Taverny';
  const typed = word.slice(0, Math.max(0, Math.floor((f - 6) / 2.5)));
  const showList = f > 24;
  return (
    <>
      <div style={{ fontSize: 18, color: C.muted }}>Bonjour Jo</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>Où allez-vous ?</div>
      <div style={{
        marginTop: 22, padding: '18px 20px', borderRadius: 20, fontSize: 22, display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,0.06)', border: `2px solid ${C.green}`, boxShadow: '0 0 0 6px rgba(61,220,151,0.15)',
      }}>
        <span style={{ fontWeight: 600 }}>{typed}</span>
        <span style={{ width: 3, height: 26, background: C.green, opacity: Math.floor(f / 8) % 2 ? 0.2 : 1 }} />
      </div>
      {showList && [['Taverny', '95150 · Val-d’Oise'], ['Gare de Taverny', 'Gare · Taverny']].map(([t, s], i) => {
        const o = interpolate(f, [24 + i * 5, 32 + i * 5], [0, 1], clamp);
        return (
          <div key={t} style={{ marginTop: 14, padding: '14px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)', opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
            <div style={{ fontWeight: 700, fontSize: 22 }}>{t}</div>
            <div style={{ fontSize: 17, color: C.muted }}>{s}</div>
          </div>
        );
      })}
    </>
  );
}

function Drivers({ f }: { f: number }) {
  const press = interpolate(f, [32, 36, 40], [1, 0.94, 1], clamp);
  const ripple = interpolate(f, [34, 46], [0, 1], clamp);
  return (
    <>
      <div style={{ fontSize: 18, color: C.muted }}>Taverny · 12 km</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, marginTop: 4, marginBottom: 18, whiteSpace: 'nowrap' }}>Conducteurs en ligne</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Driver name="Léa" car="Clio · vérifiée" price="4,20 €" active delay={2} />
        <Driver name="Marc" car="208 · vérifié" price="4,60 €" delay={6} />
        <Driver name="Sofia" car="Zoé · vérifiée" price="3,90 €" delay={10} />
      </div>
      <div style={{
        position: 'relative', overflow: 'hidden', marginTop: 26, padding: 20, borderRadius: 999, textAlign: 'center',
        fontWeight: 800, fontSize: 22, color: C.night, background: C.green, transform: `scale(${press})`,
        boxShadow: '0 12px 30px rgba(61,220,151,0.35)',
      }}>
        Demander à Léa
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 400, height: 400, marginLeft: -200, marginTop: -200, borderRadius: 200,
          background: 'rgba(255,255,255,0.5)', transform: `scale(${ripple})`, opacity: 1 - ripple,
        }} />
      </div>
    </>
  );
}

function Accepted({ f }: { f: number }) {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 11, stiffness: 160 } });
  const draw = interpolate(f, [6, 18], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ring = interpolate(f, [0, 26], [0.6, 1.6], clamp);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 26 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 70, border: `3px solid ${C.green}`, transform: `scale(${ring})`, opacity: 1.6 - ring }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 70, background: 'rgba(61,220,151,0.16)', transform: `scale(${pop})`, display: 'grid', placeItems: 'center' }}>
          <svg width="70" height="70" viewBox="0 0 24 24">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke={C.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
          </svg>
        </div>
      </div>
      <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Léa a accepté</div>
      <div style={{ fontSize: 20, color: C.muted, marginTop: 8 }}>Arrivée dans 3 min</div>
    </div>
  );
}

function Code({ f }: { f: number }) {
  const { fps } = useVideoConfig();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 20, color: C.muted, marginBottom: 22 }}>Code de prise en charge</div>
      <div style={{ display: 'flex', gap: 12 }}>
        {'4827'.split('').map((d, i) => {
          const p = spring({ frame: f - 4 - i * 5, fps, config: { damping: 12, stiffness: 180 } });
          return (
            <div key={i} style={{
              width: 66, height: 86, borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 800,
              background: 'rgba(255,255,255,0.06)', border: `2px solid ${C.green}`, boxShadow: '0 0 30px rgba(61,220,151,0.25)',
              transform: `translateY(${(1 - p) * 30}px) scale(${0.7 + p * 0.3})`, opacity: p,
            }}>{d}</div>
          );
        })}
      </div>
      <div style={{ fontSize: 18, color: C.muted, marginTop: 22 }}>Donnez-le à Léa en montant</div>
    </div>
  );
}

const SCREENS = [Search, Drivers, Accepted, Code];

export const Phone: React.FC<{ f: number }> = ({ f }) => {
  const idx = Math.min(SCREENS.length - 1, Math.floor(f / SCREEN_LEN));
  const local = f - idx * SCREEN_LEN;
  const enter = interpolate(local, [0, 8], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const Screen = SCREENS[idx];
  return (
    <div style={{
      width: 430, height: 880, borderRadius: 64, padding: 14, fontFamily, color: C.cream,
      background: 'linear-gradient(145deg, #3a3f72, #0c0d1c 60%)',
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.14), 0 60px 120px rgba(0,0,0,0.6), 0 0 120px rgba(61,220,151,0.18)',
    }}>
      <div style={{
        position: 'relative', height: '100%', borderRadius: 52, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: `linear-gradient(180deg, ${C.navy} 0%, ${C.night} 65%)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 34px 8px', fontSize: 18, fontWeight: 700 }}>
          <span>9:41</span>
          <span style={{ width: 120, height: 34, borderRadius: 20, background: '#000' }} />
          <span style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
            {[8, 12, 16].map((h) => <span key={h} style={{ width: 5, height: h, borderRadius: 1, background: C.cream }} />)}
          </span>
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 28px',
          opacity: 1 - enter, transform: `translateX(${enter * 60}px)`,
        }}>
          <Screen f={local} />
        </div>
      </div>
    </div>
  );
};
