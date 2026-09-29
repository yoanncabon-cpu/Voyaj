"use client";

import { useEffect, useState } from "react";

/** Keep decorative media quiet off screen and honour the visitor's motion preference. */
export default function MotionControls() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const stopped = paused || reduced;
    document.documentElement.dataset.motion = stopped ? "paused" : "running";
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video:not([data-scroll-driven])"));
    const visible = new Set<HTMLVideoElement>();
    let disposed = false;
    const canPlay = (video: HTMLVideoElement) => !disposed && !stopped && !document.hidden
      && visible.has(video) && (!video.classList.contains("stage-video") || video.classList.contains("is-on"));
    const syncVideo = (video: HTMLVideoElement) => {
      if (!canPlay(video)) video.pause();
      else if (video.paused) void video.play().then(() => {
        if (!canPlay(video)) video.pause();
      }).catch(() => {});
    };
    const sync = () => videos.forEach(syncVideo);
    const guard = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (!canPlay(video)) video.pause();
    };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) visible.add(video);
        else visible.delete(video);
        syncVideo(video);
      });
    }, { threshold: 0.05 });
    const mutations = new MutationObserver(sync);
    videos.forEach(video => {
      video.addEventListener("play", guard);
      observer.observe(video);
      mutations.observe(video, { attributes: true, attributeFilter: ["class"] });
    });
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("visibilitychange", sync);
      videos.forEach(video => { video.removeEventListener("play", guard); video.pause(); });
      delete document.documentElement.dataset.motion;
    };
  }, [paused, reduced]);

  if (reduced) return null;
  return (
    <button type="button" className="motion-control" aria-pressed={paused}
      onClick={() => setPaused(value => !value)}>
      <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
      {paused ? "Reprendre les animations" : "Pause animations"}
    </button>
  );
}
