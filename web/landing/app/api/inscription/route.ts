import { createHash } from "node:crypto";

export const runtime = "nodejs";

const roles: Record<string, string> = {
  passenger: "Passager", driver: "Conducteur", both: "Conducteur et passager",
};
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const cleanText = (value: unknown, max: number) => typeof value === "string"
  && value.trim().length > 0 && value.length <= max && !/[\r\n\x00-\x1f]/.test(value);
const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      const host = request.headers.get("host") || new URL(request.url).host;
      if (source.host !== host || !["http:", "https:"].includes(source.protocol)) {
        return error("Origine de la demande non autorisée.", 403);
      }
    } catch { return error("Origine de la demande non autorisée.", 403); }
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Format de demande invalide.", 415);

  // Bound the actual stream, including requests without Content-Length.
  let input: Record<string, unknown>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error("Demande vide.", 400);
    const decoder = new TextDecoder();
    let length = 0;
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); return error("Demande trop volumineuse.", 413); }
      text += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(text + decoder.decode());
    if (!input || Array.isArray(input) || typeof input !== "object") return error("Demande invalide.", 400);
  } catch { return error("Demande invalide.", 400); }

  if (input.website) return error("L’envoi n’a pas pu être validé.", 400);
  if (!cleanText(input.name, 80) || !cleanText(input.city, 120)
    || !cleanText(input.email, 254) || !emailPattern.test(input.email as string)
    || typeof input.role !== "string" || !Object.hasOwn(roles, input.role)
    || input.consent !== true
    || typeof input.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.requestId)) {
    return error("Vérifiez les champs du formulaire et votre accord pour être recontacté.", 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.REGISTRATION_TO;
  const sender = process.env.MAIL_FROM;
  if (!apiKey || !recipient || !sender || !emailPattern.test(recipient)) {
    return error("Le formulaire n’est pas encore ouvert aux inscriptions. Revenez très bientôt.", 503);
  }

  const email = (input.email as string).trim();
  const text = [
    "Nouvelle demande d’inscription au lancement de Voyaj", "",
    `Prénom : ${(input.name as string).trim()}`,
    `E-mail : ${email}`,
    `Commune : ${(input.city as string).trim()}`,
    `Profil : ${roles[input.role]}`, "",
    "Accord donné pour être prévenu du lancement de la campagne et de l’application.",
  ].join("\n");
  const idempotency = createHash("sha256").update(`${input.requestId}:${text}`).digest("hex");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `voyaj-${idempotency}` },
      body: JSON.stringify({ from: sender, to: [recipient], reply_to: email, subject: "Voyaj — Nouvelle inscription", text }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return error("L’envoi est momentanément indisponible. Merci de réessayer plus tard.", 502);
    const result = await response.json();
    if (typeof result.id !== "string" || !result.id) return error("L’envoi n’a pas pu être confirmé. Réessayez plus tard.", 502);
    return Response.json({ ok: true });
  } catch {
    return error("L’envoi n’a pas pu être confirmé. Vos informations restent dans le formulaire pour réessayer.", 502);
  }
}
