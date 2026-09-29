import Story from "@/components/InteractiveStory";
import ProgressBar from "@/components/ProgressBar";
import Reveal from "@/components/Reveal";
import Spotlight from "@/components/Spotlight";
import PriceTicker from "@/components/PriceTicker";
import SignupForm from "@/components/SignupForm";
import scenes from "@/generated/scenes.json";

const V = scenes as Record<string, string>;

const TRUST = [
  ["Identité et permis vérifiés", "Chaque conducteur est vérifié par notre équipe avant son premier trajet."],
  ["Véhicule contrôlé", "La carte grise est vérifiée : la voiture annoncée est la bonne."],
  ["Code de prise en charge", "Un code unique pour monter dans la bonne voiture."],
  ["Avis après chaque trajet", "Conducteurs et passagers se notent mutuellement."],
  ["Paiement sécurisé", "Tout se règle dans l'app, rien au bord de la route."],
];

const BUDGET = [
  { label: "Technique et version iPhone", amount: 1800, color: "var(--green)" },
  { label: "Juridique et assurance", amount: 1400, color: "var(--amber)" },
  { label: "Communication", amount: 1300, color: "var(--coral)" },
  { label: "Commission Ulule", amount: 500, color: "var(--muted)" },
];

const FAQ = [
  ["Quand l'application sera-t-elle disponible ?", "Voyaj est en phase de test final. Le lancement officiel suivra la campagne Ulule. Inscrivez-vous pour être prévenu."],
  ["Et sur iPhone ?", "Oui : une partie des fonds de la campagne sert justement à sortir la version iPhone."],
  ["Le conducteur gagne-t-il de l'argent ?", "Non. Il partage ses frais : le prix couvre le carburant et l'usure du véhicule sur la distance faite ensemble. C'est le principe du covoiturage."],
  ["Qu'est-ce qu'un trajet solidaire ?", "Un trajet que le conducteur choisit d'offrir. Le passager ne paie rien, et le conducteur reçoit des points Voyaj en remerciement."],
  ["Y a-t-il une carte ou un GPS dans l'application ?", "Non, et c'est volontaire. Le conducteur garde son GPS habituel (Google Maps, Waze…). Voyaj s'occupe de la mise en relation, du prix et de la sécurité."],
  ["Comment les conducteurs sont-ils vérifiés ?", "Avant son premier trajet, chaque conducteur envoie sa pièce d'identité, son permis et la carte grise de son véhicule, vérifiés par notre équipe."],
];

const Check = () => (
  <svg className="icon-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
);

export default function Home() {
  return (
    <>
      <ProgressBar />

      <nav className="navbar">
        <a className="navbar-logo" href="#histoire">Voyaj<span>.</span></a>
        <div className="navbar-links">
          <a href="#histoire">L'histoire</a>
          <a href="#coeur">Au cœur</a>
          <a href="#campagne">Campagne</a>
          <a href="#faq">FAQ</a>
        </div>
        <a className="btn btn-primary btn-sm" href="#inscription">Être prévenu</a>
      </nav>

      <Story videos={V} />

      {/* ── Au cœur de Voyaj : bento ── */}
      <section id="coeur" className="section">
        <div className="wrap">
          <Reveal><div className="eyebrow mono">// Au cœur de Voyaj</div></Reveal>
          <Reveal delay={80}><h2 className="section-title">Du covoiturage, <em>sans détour.</em></h2></Reveal>

          <Spotlight className="bento">
            <Reveal className="b-solid" delay={60}>
              <article className="card">
                <div className="card-tag mono">01 · Trajet solidaire</div>
                <h3>Offrir la route à celui qui en a besoin.</h3>
                <p>Certains trajets valent bien plus que quelques euros. Chaque conducteur peut offrir la route à celui qui en a besoin.</p>
                <ol className="flow">
                  <li><span className="mono">A</span><div><b>Le conducteur offre le trajet</b>Un simple bouton, au moment d'accepter la demande.</div></li>
                  <li><span className="mono">B</span><div><b>Le passager voyage gratuitement</b>Pour un entretien, un rendez-vous médical, ou simplement voir du monde.</div></li>
                  <li><span className="mono">C</span><div><b>Voyaj récompense le conducteur</b>Des points, à échanger contre des bons d'achat.</div></li>
                </ol>
              </article>
            </Reveal>

            <Reveal className="b-price" delay={140}>
              <article className="card">
                <div className="card-tag mono">02 · Prix au kilomètre</div>
                <h3>Un prix juste.</h3>
                <p>Pas de tarif qui s'envole à l'heure de pointe. Le conducteur partage ses frais, il ne gagne pas d'argent : c'est ça, le covoiturage.</p>
                <PriceTicker />
              </article>
            </Reveal>

            <Reveal className="b-trust" delay={80}>
              <article className="card">
                <div className="card-tag mono">03 · Confiance</div>
                <h3>La confiance, dès le premier kilomètre.</h3>
                <ul className="trust">
                  {TRUST.map(([t, d]) => (
                    <li key={t}><Check /><div><b>{t}</b><span>{d}</span></div></li>
                  ))}
                </ul>
              </article>
            </Reveal>

            <Reveal className="b-fest" delay={60}>
              <article className="card card-warm">
                <div className="card-tag mono">04 · Événements</div>
                <h3>Tous au festival, ensemble.</h3>
                <p>Le plus dur, quand on n'a pas de voiture, ce n'est pas toujours d'aller au concert. C'est de rentrer. Chaque événement a sa page : on y voit les conducteurs qui y vont, et ceux qui en repartent.</p>
                <div className="pills">
                  <span>Aller et retour sans voiture</span>
                  <span>Rencontrer les autres participants</span>
                  <span>Moins de voitures sur le parking</span>
                </div>
              </article>
            </Reveal>

            <Reveal className="b-terr" delay={140}>
              <article className="card">
                <div className="card-tag mono">05 · Territoires</div>
                <h3>Faites bouger votre territoire.</h3>
                <div className="audience">
                  <a href="https://voyajapp.com" target="_blank" rel="noopener noreferrer">
                    <b>Collectivités</b>
                    <span>Une solution de mobilité pour les habitants sans voiture, sans infrastructure lourde.</span>
                    <i>→</i>
                  </a>
                  <a href="https://voyajapp.com" target="_blank" rel="noopener noreferrer">
                    <b>Festivals et événements</b>
                    <span>Des trajets aller et retour pour votre public, et moins de voitures sur vos parkings.</span>
                    <i>→</i>
                  </a>
                </div>
              </article>
            </Reveal>
          </Spotlight>
        </div>
      </section>

      {/* ── Campagne ── */}
      <section id="campagne" className="section section-campaign">
        <div className="wrap campaign">
          <div>
            <Reveal><div className="eyebrow mono">// Campagne de financement participatif</div></Reveal>
            <Reveal delay={80}><h2 className="section-title">Aidez-nous à lancer <em>Voyaj.</em></h2></Reveal>
            <Reveal delay={160}>
              <p className="lead">L'application est en test final. Avec 5 000 €, elle passe au lancement officiel, partout en France, sur Android et iPhone.</p>
              <p className="fine">En contrepartie : crédits trajets, badge Membre fondateur, pack conducteur, partenariats commerçants et entreprises.</p>
              <a className="btn btn-primary" href="#inscription">Bientôt sur Ulule : être prévenu</a>
            </Reveal>
          </div>
          <Reveal delay={120} className="budget-wrap">
            <div className="budget">
              <div className="budget-goal"><span className="mono">OBJECTIF</span><b>5 000 €</b></div>
              <div className="alloc">
                {BUDGET.map((b) => (
                  <i key={b.label} style={{ ["--w" as string]: `${(b.amount / 5000) * 100}%`, background: b.color }} />
                ))}
              </div>
              <ul className="budget-legend">
                {BUDGET.map((b) => (
                  <li key={b.label}>
                    <span className="swatch" style={{ background: b.color }} />
                    <span>{b.label}</span>
                    <b className="mono">{b.amount.toLocaleString("fr-FR")} €</b>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="section">
        <div className="wrap faq-wrap">
          <Reveal><div className="eyebrow mono">// Questions fréquentes</div></Reveal>
          <Reveal delay={80}><h2 className="section-title">Vous vous demandez sûrement…</h2></Reveal>
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <Reveal key={q} delay={i * 50}>
                <details>
                  <summary><span className="mono">{String(i + 1).padStart(2, "0")}</span>{q}<i /></summary>
                  <p>{a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Inscription ── */}
      <section id="inscription" className="section section-cta">
        <div className="wrap cta">
          <div>
            <Reveal><div className="eyebrow mono">// Inscription</div></Reveal>
            <Reveal delay={80}><h2 className="cta-title">Soyez parmi <em>les premiers.</em></h2></Reveal>
            <Reveal delay={160}>
              <p className="lead">Inscrivez-vous : on vous prévient dès le lancement de la campagne et de l'application dans votre commune.</p>
              <p className="fine">Conducteur ou passager, votre inscription nous aide à savoir où lancer Voyaj en premier.</p>
            </Reveal>
          </div>
          <Reveal delay={200} className="signup-panel">
            <SignupForm />
          </Reveal>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-in">
          <span className="navbar-logo">Voyaj<span>.</span></span>
          <span className="mono">Application en test final — bientôt sur Android et iPhone.</span>
          <span>
            <a href="/legal">Mentions légales</a> · <a href="mailto:contact@voyajapp.com">contact@voyajapp.com</a> · © 2026
          </span>
        </div>
      </footer>
    </>
  );
}
