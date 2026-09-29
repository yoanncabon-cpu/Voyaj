export type Perspective = "passenger" | "driver";
export type RideChoice = "shared" | "gift" | null;
export const CHAPTER_COUNT = 6;
export const CHAPTER_LABELS = ["La route", "Deux vies", "Votre choix", "La rencontre", "Ensemble", "Et vous ?"];

export function timelinePosition(progress: number) {
  const bounded = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const scaled = bounded * CHAPTER_COUNT;
  return { progress: bounded, chapter: Math.min(CHAPTER_COUNT - 1, Math.floor(scaled)), fraction: bounded === 1 ? 1 : scaled % 1 };
}

export function chapterProgress(chapter: number) {
  return (Math.max(0, Math.min(CHAPTER_COUNT - 1, chapter)) + 0.18) / CHAPTER_COUNT;
}

export function journeyChapter(index: number, perspective: Perspective, choice: RideChoice) {
  const driver = perspective === "driver";
  const gift = choice === "gift";
  const chapters = [
    { video: "hero", eyebrow: "Une route. Deux histoires.", title: "Vous passez sur la route de quelqu’un.", body: "Une place libre pour Léa. Un départ possible pour Jo. Faites défiler : c’est vous qui faites avancer leur histoire.", note: "Une expérience à vivre en 45 secondes", phone: "home" },
    { video: driver ? "driver_phone" : "jo_alone", eyebrow: driver ? "Dans la vie de Léa" : "Dans la vie de Jo", title: driver ? "Vous y allez déjà. Une place est libre." : "Douze kilomètres. Tout un monde.", body: driver ? "Vous partez au centre-ville. Au même moment, Jo cherche à faire ce trajet. Vos journées sont différentes. Votre route peut être la même." : "Un rendez-vous en ville. Pas de voiture, pas de bus. Léa prend justement cette route. Vous ne vous connaissez pas encore.", note: driver ? "Léa · conductrice · un siège disponible" : "Jo · passager · une destination", phone: driver ? "request" : "search" },
    { video: "driver_phone", eyebrow: "Un petit choix. Une vraie différence.", title: gift ? "Aujourd’hui, vous offrez la route." : choice === "shared" ? "La route et les frais se partagent." : "Et si vous changiez la suite ?", body: gift ? "Dans cette histoire, Léa offre le trajet. Pour Jo, c’est un départ à 0 €. Le rendez-vous devient accessible." : choice === "shared" ? "Dans cet exemple, Jo participe à hauteur de 4,20 €. Léa partage ses frais sur un trajet qu’elle faisait déjà." : "Glissez-vous un instant à la place de Léa. Jo demande à monter. Comment souhaitez-vous l’accueillir ?", note: "Votre choix agit uniquement sur cette démonstration", phone: "request" },
    { video: "car_stops", eyebrow: "Deux routes se rejoignent", title: driver ? "Ce n’est plus un siège vide." : "Cette fois, la voiture s’arrête pour vous.", body: driver ? "Jo vous rejoint. Un code de prise en charge confirme la rencontre. Derrière une demande, il y a maintenant un visage." : "Léa arrive au point de rencontre. Vous échangez le code 4827, puis vous montez. La route devient un peu moins solitaire.", note: gift ? "Trajet offert · 0 € pour Jo" : "Exemple de participation · 4,20 €", phone: "code" },
    { video: "door_opens", eyebrow: gift ? "La solidarité prend la route" : "La route prend un autre sens", title: "Même destination. Une autre journée.", body: gift ? "Le trajet est offert. Jo garde son budget pour le reste de sa journée. Léa a fait bien plus que parcourir douze kilomètres." : "Les frais sont partagés. Jo peut rejoindre son rendez-vous. Léa a transformé une place libre en rencontre.", note: "12 km ensemble · une place qui change tout", phone: "ride" },
    { video: "hero", eyebrow: "Ce trajet pourrait commencer près de chez vous", title: "Et si la prochaine rencontre, c’était vous ?", body: "Vous passez peut-être déjà sur la route de quelqu’un. Imaginez maintenant un départ depuis votre commune.", note: "Une histoire fictive. Une possibilité bien réelle.", phone: "arrived" },
  ];
  return { ...chapters[Math.max(0, Math.min(5, index))], gift, price: gift ? "0 €" : "4,20 €" };
}
