"use client";
import { useEffect, useRef, useState } from "react";

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export default function PriceTicker() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
          || document.documentElement.dataset.motion === "paused") {
          setT(1);
          return;
        }
        const k = Math.min(1, (now - start) / 2200);
        setT(1 - Math.pow(1 - k, 3));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const service = t > 0.97 ? 1 : 0;
  const total = 1.9 * t + 1.3 * t + service;

  return (
    <div className="ticker" ref={ref}>
      <div className="ticker-head mono">
        <span>12 km avec Léa</span>
        <span>{(12 * t).toFixed(1).replace(".", ",")} km</span>
      </div>
      <div className="ticker-bar"><i style={{ width: `${t * 100}%` }} /></div>
      <div className="ticker-row"><span>Carburant</span><b className="mono">{eur(1.9 * t)}</b></div>
      <div className="ticker-row"><span>Usure du véhicule</span><b className="mono">{eur(1.3 * t)}</b></div>
      <div className={`ticker-row${service ? "" : " is-pending"}`}><span>Frais de service</span><b className="mono">{eur(service)}</b></div>
      <div className="ticker-total"><span>Total</span><b className="mono">{eur(total)}</b></div>
      <div className="ticker-note">Exemple indicatif</div>
    </div>
  );
}
