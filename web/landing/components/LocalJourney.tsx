"use client";
import { useState } from "react";
import type { Perspective, RideChoice } from "./journey-model";

export default function LocalJourney({ perspective, choice }: { perspective: Perspective; choice: RideChoice }) {
  const [trip, setTrip] = useState<{ city: string; destination: string } | null>(null);
  function imagine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const city = String(data.get("city") || "").trim();
    const destination = String(data.get("destination") || "").trim();
    if (city && destination) setTrip({ city, destination });
  }
  return <section className="local-journey" id="pres-de-vous" aria-labelledby="local-journey-title">
    <div className="local-journey-inner">
      <div className="local-journey-copy">
        <p className="local-eyebrow mono">L’histoire continue près de chez vous</p>
        <h2 id="local-journey-title">Votre commune.<br /><em>Votre prochain départ.</em></h2>
        <p>Un entretien, la gare, un café avec un ami. Imaginez le trajet qui vous rapprocherait de votre prochaine envie.</p>
        <form onSubmit={imagine} className="local-journey-form" aria-label="Imaginer un trajet">
          <label>Je pars de<input name="city" autoComplete="address-level2" placeholder="Votre commune" required maxLength={120} pattern=".*\S.*" /></label>
          <label>J’aimerais rejoindre<input name="destination" placeholder="La gare, le centre-ville…" required maxLength={100} pattern=".*\S.*" /></label>
          <button type="submit">Imaginer cette rencontre <span aria-hidden="true">↗</span></button>
        </form>
        <p className="local-disclaimer">Simulation illustrative : aucune recherche de conducteurs, aucun calcul de distance ni réservation.</p>
      </div>
      <div className={`local-trip-card${trip ? " has-trip" : ""}`}>
        <div className="local-trip-heading"><span className="mono">{trip ? "VOTRE SCÉNARIO" : "UNE ROUTE POSSIBLE"}</span><span>Illustration</span></div>
        <div className="local-map" aria-hidden="true">
          <div className="local-map-grid" />
          <svg viewBox="0 0 500 300" fill="none"><path className="local-road-shadow" d="M55 230C110 80 210 270 255 120S390 190 445 60" /><path className="local-road" d="M55 230C110 80 210 270 255 120S390 190 445 60" pathLength="1" /><circle cx="55" cy="230" r="9" /><circle cx="445" cy="60" r="9" /></svg>
          <span className="local-pin from">{trip?.city || "Chez vous"}</span><span className="local-pin to">{trip?.destination || "Votre prochaine envie"}</span><span className="local-map-car">↗</span>
        </div>
        <div className="local-trip-summary" aria-live="polite" aria-atomic="true">
          {trip ? <>
            <h3>{perspective === "driver" ? "Une place libre sur votre route." : "Votre prochain départ commence ici."}</h3>
            <p>De <b>{trip.city}</b> vers <b>{trip.destination}</b>. Imaginez quelqu’un qui prend la même direction.</p>
            <div className="local-trip-fare"><span>Si ce trajet faisait 12 km<br /><small>Exemple fictif, sans valeur de devis</small></span><b>{choice === "gift" ? "0 €" : "4,20 €"}<small>{choice === "gift" ? "si le trajet est offert" : "exemple de participation"}</small></b></div>
            <a href="#inscription" onClick={() => window.dispatchEvent(new CustomEvent("voyaj-prefill", { detail: { city: trip.city, role: perspective } }))}>Être prévenu dans ma commune <span aria-hidden="true">→</span></a>
          </> : <><h3>Il suffit parfois d’une place libre.</h3><p>Choisissez un départ et une destination pour donner à cette histoire un air de chez vous.</p></>}
        </div>
      </div>
    </div>
  </section>;
}
