export type PhoneState =
  | "home" | "search" | "drivers" | "accepted" | "approach"
  | "code" | "onboard" | "ride" | "arrived";

export interface Chapter {
  video: string;
  stop: string;
  kicker: string;
  title: string;
  body: string;
  phone: PhoneState;
  toast: [string, string];
  hero?: boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    video: "hero", stop: "Départ", hero: true,
    kicker: "Application en test final",
    title: "Les voitures roulent déjà. Il suffit de monter.",
    body: "Voyaj relie en temps réel les conducteurs qui prennent la route et ceux qui vont dans la même direction. Les frais sont partagés, simplement.",
    phone: "home", toast: ["Voyaj", "Conducteurs en ligne dans votre direction"],
  },
  {
    video: "jo_alone", stop: "Jo",
    kicker: "Voici Jo",
    title: "Pas de permis, pas de bus, personne à qui demander.",
    body: "Il vit à la campagne. Un voisin, un cousin, une amie, un étudiant, une personne âgée : on connaît tous un Jo. Voyaj est fait pour eux.",
    phone: "search", toast: ["Où allez-vous ?", "Centre-ville · 12 km"],
  },
  {
    video: "driver_phone", stop: "Demande",
    kicker: "Étape 1 — Vous demandez",
    title: "Vous demandez votre trajet.",
    body: "Indiquez où vous allez : Voyaj vous montre les conducteurs en ligne qui vont dans votre direction, avec le prix.",
    phone: "drivers", toast: ["Conducteurs en ligne", "Léa · Clio · 4,20 €"],
  },
  {
    video: "driver_spots", stop: "Réponse",
    kicker: "Étape 2 — Le conducteur répond",
    title: "Il accepte. Vous rapproche. Ou vous l'offre.",
    body: "Le conducteur accepte, propose de vous rapprocher sur sa route, ou refuse. Il peut même vous offrir le trajet.",
    phone: "accepted", toast: ["Léa a accepté", "Arrivée dans 3 min"],
  },
  {
    video: "car_stops", stop: "Approche",
    kicker: "Étape 3 — En route",
    title: "Il garde son GPS habituel.",
    body: "Le conducteur suit Google Maps, Waze… Voyaj s'occupe de la mise en relation, du prix et de la sécurité.",
    phone: "approach", toast: ["Léa arrive", "Clio grise · 1 min"],
  },
  {
    video: "code_scan", stop: "Code",
    kicker: "Sécurité",
    title: "Le bon code, la bonne voiture.",
    body: "Un code unique pour monter dans la bonne voiture. Identité, permis et carte grise de chaque conducteur sont vérifiés par notre équipe.",
    phone: "code", toast: ["Votre code", "4 8 2 7"],
  },
  {
    video: "door_opens", stop: "À bord",
    kicker: "Prise en charge",
    title: "Code validé. En route.",
    body: "Tout se règle dans l'app, rien au bord de la route. Les frais sont partagés, simplement.",
    phone: "onboard", toast: ["Code validé", "Trajet démarré"],
  },
  {
    video: "ride_together", stop: "Ensemble",
    kicker: "Plus qu'un trajet",
    title: "Quelqu'un qui passait par là.",
    body: "Certains trajets valent bien plus que quelques euros. Chaque conducteur peut offrir la route à celui qui en a besoin.",
    phone: "ride", toast: ["En route", "Centre-ville · 5 km restants"],
  },
  {
    video: "arrival", stop: "Arrivée",
    kicker: "Arrivée",
    title: "Jo est arrivé.",
    body: "À son rendez-vous médical, à son entretien, à son festival. 12 km avec Léa, 4,20 €. Conducteur et passager se notent mutuellement.",
    phone: "arrived", toast: ["Vous êtes arrivé", "12 km · 4,20 €"],
  },
];
