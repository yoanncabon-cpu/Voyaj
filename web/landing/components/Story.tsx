"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { CHAPTERS } from "./chapters";
import Phone from "./Phone";

const ROUTE_D = "M0,44 C90,14 170,70 280,42 S470,12 560,40 S760,72 860,40 S960,24 1000,34";
const VB_W = 1000;
const VB_H = 80;
const N = CHAPTERS.length;

type Pt = { x: number; y: number };

export default function Story({ videos }: { videos: Record<string, string> }) {
  const rootRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const kmRef = useRef<HTMLSpanElement>(null);
  const vidRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [stops, setStops] = useState<Pt[]>([]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    setStops(CHAPTERS.map((_, i) => {
      const p = path.getPointAtLength(((i + 0.5) / N) * len);
      return { x: p.x, y: p.y };
    }));

    let raf = 0;
    const update = () => {
      raf = 0;
      const el = rootRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total));
      el.style.setProperty("--p", p.toFixed(4));
      const pt = path.getPointAtLength(p * len);
      if (carRef.current) {
        carRef.current.style.left = `${(pt.x / VB_W) * 100}%`;
        carRef.current.style.top = `${(pt.y / VB_H) * 100}%`;
      }
      if (kmRef.current) kmRef.current.textContent = (p * 12).toFixed(1).replace(".", ",").padStart(4, "0");
      setActive(Math.min(N - 1, Math.floor(p * N)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    vidRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) v.play().catch(() => {});
      else v.pause();
    });
  }, [active]);

  const goTo = (i: number) => {
    const el = rootRef.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || document.documentElement.dataset.motion === "paused";
    window.scrollTo({ top: top + ((i + 0.5) / N) * total, behavior: reduced ? "instant" : "smooth" });
  };

  const ch = CHAPTERS[active];

  return (
    <section id="histoire" ref={rootRef} className="story" style={{ height: `${N * 110}vh` }}>
      <div className="stage">
        <div className="stage-media">
          {CHAPTERS.map((c, i) => {
            const src = videos[c.video];
            const on = i === active;
            return src ? (
              <video
                key={c.video}
                ref={(v) => { vidRefs.current[i] = v; }}
                className={`stage-video${on ? " is-on" : ""}`}
                src={src}
                muted loop playsInline
                preload={Math.abs(i - active) <= 1 ? "auto" : "none"}
              />
            ) : (
              <div key={c.video} className={`stage-video stage-fallback${on ? " is-on" : ""}`} />
            );
          })}
        </div>
        <div className="stage-shade" />
        <div className="stage-grid" />
        <div className="viewfinder" aria-hidden="true"><i /><i /><i /><i /></div>

        <div className="hud hud-left mono">
          <span className="hud-chip">CH {String(active + 1).padStart(2, "0")}/{String(N).padStart(2, "0")}</span>
          <span className="hud-label">{ch.stop.toUpperCase()}</span>
        </div>
        <div className="hud hud-right mono">
          <span className="live-dot" /> EN DIRECT
          <span className="hud-sep" />
          <span ref={kmRef}>00,0</span>&nbsp;/ 12 KM
        </div>

        <div className="stage-copy" key={active}>
          <div className="kicker mono">{ch.kicker}</div>
          <h1 className="stage-title">
            {ch.title.split(" ").map((w, i) => (
              <Fragment key={i}>
                <span className="word" style={{ animationDelay: `${120 + i * 55}ms` }}>{w}</span>{" "}
              </Fragment>
            ))}
          </h1>
          <p className="stage-body">{ch.body}</p>
          {ch.hero && (
            <div className="stage-actions">
              <a className="btn btn-primary" href="#inscription">Être prévenu du lancement</a>
              <button className="btn btn-ghost" type="button" onClick={() => goTo(1)}>Découvrir l'histoire de Jo ↓</button>
            </div>
          )}
        </div>

        <div className="stage-phone">
          <Phone state={ch.phone} />
        </div>

        <div className="stage-toast" key={`t${active}`}>
          <span className="live-dot" />
          <span><b>{ch.toast[0]}</b>{ch.toast[1]}</span>
        </div>

        <div className="route">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden="true">
            <path className="route-base" d={ROUTE_D} />
            <path ref={pathRef} className="route-fill" d={ROUTE_D} pathLength={1} />
          </svg>
          {stops.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`route-stop${i === active ? " is-active" : ""}${i < active ? " is-done" : ""}`}
              style={{ left: `${(s.x / VB_W) * 100}%`, top: `${(s.y / VB_H) * 100}%` }}
              onClick={() => goTo(i)}
              aria-label={`Aller au chapitre ${CHAPTERS[i].stop}`}
            >
              <span className="route-label mono">{CHAPTERS[i].stop}</span>
            </button>
          ))}
          <div className="route-car" ref={carRef}><span /></div>
        </div>
      </div>
    </section>
  );
}
