"use client";
import { useRef } from "react";

export default function Spotlight({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    ref.current?.querySelectorAll<HTMLElement>(".card").forEach((card) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  };

  return (
    <div ref={ref} className={className} onPointerMove={onMove}>
      {children}
    </div>
  );
}
