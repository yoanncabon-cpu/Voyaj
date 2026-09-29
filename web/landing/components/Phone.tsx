import type { PhoneState } from "./chapters";

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
);

function Driver({ name, car, price, active }: { name: string; car: string; price?: string; active?: boolean }) {
  return (
    <div className={`ps-driver${active ? " is-active" : ""}`}>
      <span className="ps-avatar">{name[0]}</span>
      <span className="ps-driver-meta">
        <b>{name}</b>
        <small>{car}</small>
      </span>
      {price && <span className="ps-price">{price}</span>}
    </div>
  );
}

function Screen({ state }: { state: PhoneState }) {
  switch (state) {
    case "home":
      return (
        <>
          <div className="ps-sub">Bonjour Jo</div>
          <div className="ps-h">Où allez-vous ?</div>
          <div className="ps-input">Rechercher une destination</div>
          <div className="ps-live"><span className="live-dot" />Conducteurs en ligne dans votre direction</div>
          <div className="ps-chips"><span>Centre-ville</span><span>Gare</span><span>Festival</span></div>
        </>
      );
    case "search":
      return (
        <>
          <div className="ps-h">Où allez-vous ?</div>
          <div className="ps-input is-focus">Centre-ville<span className="caret" /></div>
          <ul className="ps-list">
            <li><b>Centre-ville</b><span>12 km</span></li>
            <li><b>Centre médical</b><span>9 km</span></li>
            <li><b>Gare</b><span>15 km</span></li>
          </ul>
        </>
      );
    case "drivers":
      return (
        <>
          <div className="ps-sub">Centre-ville · 12 km</div>
          <div className="ps-h">Conducteurs en ligne</div>
          <Driver name="Léa" car="Clio · vérifiée" price="4,20 €" active />
          <Driver name="Marc" car="208 · vérifié" price="4,60 €" />
          <Driver name="Sofia" car="Zoé · vérifiée" price="3,90 €" />
          <div className="ps-btn">Demander à Léa</div>
        </>
      );
    case "accepted":
      return (
        <div className="ps-center">
          <div className="ps-check"><Check /></div>
          <div className="ps-h">Léa a accepté</div>
          <div className="ps-sub">Arrivée dans 3 min</div>
          <div className="ps-card">
            <div className="ps-row"><span>Destination</span><b>Centre-ville</b></div>
            <div className="ps-row"><span>Prix</span><b>4,20 €</b></div>
          </div>
        </div>
      );
    case "approach":
      return (
        <>
          <div className="ps-sub">Léa arrive</div>
          <div className="ps-eta"><b>1</b> min</div>
          <Driver name="Léa" car="Clio grise" />
          <ul className="ps-verif">
            <li><Check />Identité vérifiée</li>
            <li><Check />Permis vérifié</li>
            <li><Check />Carte grise vérifiée</li>
          </ul>
        </>
      );
    case "code":
      return (
        <div className="ps-center">
          <div className="ps-sub">Code de prise en charge</div>
          <div className="ps-code">{"4827".split("").map((d, i) => <span key={i} style={{ animationDelay: `${i * 90}ms` }}>{d}</span>)}</div>
          <div className="ps-sub">Donnez ce code à Léa en montant.</div>
        </div>
      );
    case "onboard":
      return (
        <div className="ps-center">
          <div className="ps-check"><Check /></div>
          <div className="ps-h">Code validé</div>
          <div className="ps-sub">Trajet démarré</div>
          <div className="ps-progress"><i style={{ width: "6%" }} /></div>
        </div>
      );
    case "ride":
      return (
        <>
          <div className="ps-sub">En route vers</div>
          <div className="ps-h">Centre-ville</div>
          <div className="ps-progress"><i style={{ width: "58%" }} /></div>
          <div className="ps-row ps-row-mono"><span>7 km</span><span>12 km</span></div>
          <Driver name="Léa" car="Clio grise" />
        </>
      );
    case "arrived":
      return (
        <>
          <div className="ps-h">Vous êtes arrivé</div>
          <div className="ps-card">
            <div className="ps-row"><span>Carburant</span><b>1,90 €</b></div>
            <div className="ps-row"><span>Usure du véhicule</span><b>1,30 €</b></div>
            <div className="ps-row"><span>Frais de service</span><b>1,00 €</b></div>
            <div className="ps-row ps-total"><span>Total · 12 km</span><b>4,20 €</b></div>
          </div>
          <div className="ps-stars">★★★★★</div>
          <div className="ps-sub ps-mid">Notez Léa</div>
        </>
      );
  }
}

export function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone-screen">
        <div className="phone-status"><span>9:41</span><span className="phone-island" /><span className="phone-bars"><i /><i /><i /></span></div>
        {children}
      </div>
    </div>
  );
}

export default function Phone({ state }: { state: PhoneState }) {
  return (
    <PhoneFrame>
      <div className="phone-app" key={state}>
        <Screen state={state} />
      </div>
    </PhoneFrame>
  );
}
