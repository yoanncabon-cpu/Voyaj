"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "./Phone";
import LocalJourney from "./LocalJourney";
import { CHAPTER_COUNT, CHAPTER_LABELS, chapterProgress, journeyChapter, timelinePosition, type Perspective, type RideChoice } from "./journey-model";

export default function InteractiveStory({ videos }: { videos: Record<string, string> }) {
  const root = useRef<HTMLElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const fraction = useRef(0);
  const position = useRef<HTMLSpanElement>(null);
  const seek = useRef<() => void>(() => {});
  const [active, setActive] = useState(0);
  const [perspective, setPerspective] = useState<Perspective>("passenger");
  const [choice, setChoice] = useState<RideChoice>(null);
  const [motion, setMotion] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [failedMedia, setFailedMedia] = useState<string[]>([]);
  const ch = journeyChapter(active, perspective, choice);
  const src = videos[ch.video];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!preference.matches && document.documentElement.dataset.motion !== "paused");
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    preference.addEventListener("change", sync);
    sync();
    return () => { observer.disconnect(); preference.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = root.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const stage = el.querySelector<HTMLElement>(".journey-stage");
      const travel = Math.max(1, el.offsetHeight - (stage?.offsetHeight || window.innerHeight));
      const next = timelinePosition(-rect.top / travel);
      fraction.current = next.fraction;
      el.style.setProperty("--journey-progress", String(next.progress));
      if (position.current) position.current.textContent = `${Math.round(next.progress * 12)} / 12 km`;
      setActive(next.chapter);
      if (rect.bottom > 0 && rect.top < window.innerHeight) seek.current();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);

  useEffect(() => {
    const video = film.current;
    if (!video) return;
    setMediaReady(video.readyState >= 2);
    // Scroll owns the clock. Never autoplay; wait for a seek to finish before another.
    const sync = () => {
      video.pause();
      if (video.readyState >= 2) setMediaReady(true);
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 1 || video.seeking || document.hidden) return;
      const target = motion ? fraction.current * Math.max(0, video.duration - 0.08) : 0.08;
      if (Math.abs(video.currentTime - target) > 0.045) video.currentTime = target;
    };
    seek.current = sync;
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("canplay", sync);
    video.addEventListener("seeked", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    if (video.readyState >= 2) setMediaReady(true);
    return () => {
      seek.current = () => {};
      video.pause();
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("canplay", sync);
      video.removeEventListener("seeked", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [src, motion, active, failedMedia]);

  function goTo(chapter: number) {
    const el = root.current;
    if (!el) return;
    const height = el.querySelector<HTMLElement>(".journey-stage")?.offsetHeight || window.innerHeight;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + chapterProgress(chapter) * (el.offsetHeight - height), behavior: "instant" });
  }

  return (<>
    <section id="histoire" ref={root} className="interactive-journey" data-perspective={perspective} data-choice={choice || "undecided"} aria-label="Une route, deux histoires">
      <div className="journey-stage">
        <div className="journey-backdrop" aria-hidden="true">
          {src && !failedMedia.includes(src) && <video key={src} ref={film} src={src} className={mediaReady ? "is-ready" : ""} data-scroll-driven="true"
            muted playsInline preload="auto" disablePictureInPicture onLoadedData={() => setMediaReady(true)}
            onError={() => setFailedMedia(previous => [...previous, src])} />}
        </div>
        <div className="journey-shade" aria-hidden="true" />
        <div className="journey-topline">
          <span className="journey-edition mono"><i /> VOYAJ / UNE PLACE CHANGE TOUT</span>
          <a href="#pres-de-vous">Passer l’expérience ↗</a>
        </div>
        <div className="journey-perspective" role="group" aria-label="Choisir votre point de vue">
          <button type="button" aria-pressed={perspective === "passenger"} onClick={() => setPerspective("passenger")}><span>J</span><b>Avec Jo<small>Je cherche un trajet</small></b></button>
          <button type="button" aria-pressed={perspective === "driver"} onClick={() => setPerspective("driver")}><span>L</span><b>Avec Léa<small>Je prends la route</small></b></button>
        </div>

        <div className="journey-composition">
          <div className="journey-copy" key={`${active}-${perspective}`}>
            <div className="journey-eyebrow mono"><span>{String(active + 1).padStart(2, "0")}</span> {ch.eyebrow}</div>
            {active === 0 ? <h1>{ch.title}</h1> : <h2>{ch.title}</h2>}
            <p className="journey-body">{ch.body}</p>
            {active === 0 && <button className="journey-start" type="button" onClick={() => goTo(1)}>Entrer dans l’histoire <span aria-hidden="true">↗</span></button>}
            {active === 2 && <div className="journey-decisions" role="group" aria-label="Choisir la suite du trajet">
              <button type="button" aria-pressed={choice === "shared"} onClick={() => setChoice("shared")}><span>01 / Partager les frais</span><b>4,20 € <small>pour Jo</small></b></button>
              <button type="button" aria-pressed={choice === "gift"} onClick={() => setChoice("gift")}><span>02 / Offrir ce trajet</span><b>0 € <small>pour Jo</small></b></button>
            </div>}
            {active === 2 && <p className="journey-choice-feedback" role="status">{choice ? (choice === "gift" ? "Trajet offert : la suite de l’histoire a changé." : "Frais partagés : la suite de l’histoire a changé.") : "Vous pouvez aussi poursuivre avec l’exemple à 4,20 €."}</p>}
            {active === 5 && <a className="journey-start" href="#pres-de-vous">Imaginer mon trajet <span aria-hidden="true">↗</span></a>}
            <p className="journey-footnote">{ch.note}</p>
          </div>

          <div className="journey-object" aria-label="Illustration du trajet">
            {active === 0 || active === 1 ? <div className="meeting-orbits" aria-hidden="true">
              <div className="meeting-ring ring-one" /><div className="meeting-ring ring-two" />
              <div className="meeting-person person-jo"><span>J</span><b>Jo</b><small>Une destination.</small></div>
              <div className="meeting-person person-lea"><span>L</span><b>Léa</b><small>Une place libre.</small></div>
              <div className="meeting-center"><span>12</span><small>kilomètres pour se rencontrer</small></div>
            </div> : active === 5 ? <div className="journey-final-art" aria-hidden="true">
              <svg viewBox="0 0 400 400" fill="none"><path d="M25 360C25 140 350 290 370 30" /><path d="M20 60C220 20 100 360 370 340" /><path d="M10 230C230 380 200 20 380 160" /><circle cx="220" cy="210" r="58" /></svg>
              <span>Et vous<span>sur quelle route ?</span></span>
            </div> : <div className="journey-phone-wrap"><PhoneFrame>
              <div className="journey-phone-screen">
                <span className="mono">DÉMONSTRATION VOYAJ</span>
                <div className="journey-phone-avatar">{perspective === "driver" ? "J" : "L"}</div>
                <h3>{active === 2 ? (perspective === "driver" ? "Jo veut vous rejoindre" : "Léa prend votre route") : active === 3 ? "On se retrouve." : "Ensemble, en route."}</h3>
                {active === 3 ? <div className="journey-code">4827</div> : <div className="journey-fare"><b>{ch.price}</b><span>{ch.gift ? "Trajet offert à Jo" : "Participation de Jo"}</span></div>}
                <div className="journey-phone-route"><i /><span>La campagne</span><span>Le centre-ville</span><i /></div>
                <p>{active === 3 ? "Un code pour monter dans la bonne voiture." : ch.gift ? "Un petit geste. Une journée qui change." : "12 km · un trajet que Léa faisait déjà"}</p>
              </div>
            </PhoneFrame></div>}
          </div>
        </div>

        <div className="journey-bottom">
          <div className="journey-timeline" aria-label="Chapitres de l’histoire">
            <div className="journey-track" aria-hidden="true"><i /></div>
            {CHAPTER_LABELS.map((label, index) => <button key={label} type="button" onClick={() => goTo(index)} aria-current={active === index ? "step" : undefined} aria-label={`Chapitre ${index + 1} : ${label}`}><i /><span>{label}</span></button>)}
          </div>
          <div className="journey-transport"><span className="mono" ref={position}>0 / 12 km</span><span className="journey-scroll-note">{motion ? "Défilez pour avancer. Remontez pour revivre." : "Explorez à votre rythme · animations en pause"}</span><div>
            <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Chapitre précédent">←</button>
            <button type="button" onClick={() => goTo(active + 1)} disabled={active === CHAPTER_COUNT - 1} aria-label="Chapitre suivant">→</button>
          </div></div>
        </div>
      </div>
    </section>
    <LocalJourney perspective={perspective} choice={choice} />
    </>
  );
}
