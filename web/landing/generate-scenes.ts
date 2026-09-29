import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));

try {
  const lines = readFileSync(resolve(__dir, ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch { /* shell env */ }

const HF_CREDENTIALS = process.env.HF_CREDENTIALS ?? "";
if (!HF_CREDENTIALS) { console.error("❌ HF_CREDENTIALS manquant"); process.exit(1); }

// ─── API HTTP directe (timeout 15 min au lieu de 5) ───────────────────────────

const API_BASE = "https://api.higgsfield.ai";
const AUTH = `Key ${HF_CREDENTIALS}`;
const POLL_INTERVAL_MS = 8_000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

async function submit(prompt: string, duration: number, aspect_ratio: string): Promise<string> {
  const res = await fetch(`${API_BASE}/bytedance/seedance-2.5/text-to-video`, {
    method: "POST",
    headers: { "Authorization": AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt, duration, aspect_ratio,
      resolution: "720p",
      bitrate_mode: "high",
      output_format: "mp4",
      generate_audio: false,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Submit HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json() as { request_id?: string; error?: string };
  if (data.error) throw new Error(data.error);
  if (!data.request_id) throw new Error("Pas de request_id dans la réponse");
  return data.request_id;
}

async function pollUntilDone(requestId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  const statusUrl = `https://platform.higgsfield.ai/requests/${requestId}/status`;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(statusUrl, { headers: { "Authorization": AUTH } });
    if (!res.ok) continue;

    const data = await res.json() as any;
    const status: string = data.status ?? "";

    if (status === "completed") {
      return data.video?.url ?? data.videos?.[0]?.url ?? data.output?.url ?? "";
    }
    if (["failed", "nsfw", "moderated"].includes(status)) {
      throw new Error(`Statut ${status}: ${data.error ?? ""}`);
    }
    // queued / in_progress → on continue de poller
    process.stdout.write(".");
  }
  throw new Error(`Timeout 15 min dépassé (request_id: ${requestId})`);
}

// ─── SCÈNES ───────────────────────────────────────────────────────────────────

const SCENES = [
  { id: "hero",          label: "Route française aérienne",  prompt: "Aerial drone shot, compact car drives on winding rural French road, golden hour, green hills, cinematic.", duration: 5, aspect_ratio: "16:9" },
  { id: "jo_alone",      label: "Jo seul au bord",            prompt: "Young man with backpack stands alone at edge of empty rural road, golden afternoon light, lonely mood, cinematic.", duration: 5, aspect_ratio: "16:9" },
  { id: "driver_phone",  label: "Conductrice, notif app",     prompt: "Young woman driving on country road, glances at phone notification on dashboard and smiles, warm sunlight, cinematic.", duration: 5, aspect_ratio: "16:9" },
  { id: "driver_spots",  label: "Aperçoit le passager",       prompt: "Driver POV inside car on rural road, young man on roadside ahead with arm raised, car slowly approaches, golden hour.", duration: 5, aspect_ratio: "16:9" },
  { id: "car_stops",     label: "Voiture s'arrête",            prompt: "Modern compact car pulls over on French country road near young man with backpack, golden afternoon light, cinematic.", duration: 5, aspect_ratio: "16:9" },
  { id: "door_opens",    label: "Passager monte",              prompt: "Car door opens, young man with backpack gets in smiling, friendly driver greets him, French countryside visible, cinematic.", duration: 5, aspect_ratio: "16:9" },
  { id: "code_scan",     label: "Code 4 chiffres",            prompt: "Close-up smartphone screen with 4-digit code on blue app, inside car, countryside bokeh background, cinematic macro.", duration: 4, aspect_ratio: "16:9" },
  { id: "ride_together", label: "Trajet ensemble",            prompt: "Two people talking and laughing inside moving car, French countryside passing by windows, warm sunlight, cinematic.", duration: 6, aspect_ratio: "16:9" },
  { id: "arrival",       label: "Arrivée en ville",           prompt: "Car arrives in French town center, passenger steps out smiling and waves goodbye to driver, warm amber light, cinematic.", duration: 5, aspect_ratio: "16:9" },
  { id: "cta",           label: "App sur téléphone",          prompt: "Hand holds smartphone showing a dark app screen with a green confirmation check, inside car, blurred golden countryside behind, cinematic product shot.", duration: 4, aspect_ratio: "9:16" },
] as const;

// ─── GÉNÉRATION SÉQUENTIELLE (1 par 1 pour maîtriser les crédits) ─────────────

mkdirSync(resolve(__dir, "generated"), { recursive: true });

let existing: Record<string, string> = {};
try {
  existing = JSON.parse(readFileSync(resolve(__dir, "generated/scenes.json"), "utf-8"));
} catch { /* pas encore de fichier */ }

for (const scene of SCENES) {
  if (existing[scene.id]) {
    console.log(`⏭  [${scene.id}] déjà généré`);
    continue;
  }

  console.log(`\n🎬 [${scene.id}] ${scene.label} …`);
  try {
    const requestId = await submit(scene.prompt, scene.duration, scene.aspect_ratio);
    console.log(`   📤 request_id: ${requestId}`);
    const url = await pollUntilDone(requestId);
    console.log(`\n   ✅ ${url}`);
    existing[scene.id] = url;
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error(`\n   ❌ ${msg}`);
    if (msg.toLowerCase().includes("credit")) {
      console.error("   💳 Solde insuffisant — recharge sur https://console.higgsfield.ai");
      console.error("   ℹ️  Les scènes déjà générées sont sauvegardées. Relancez après recharge.");
      break;
    }
  }

  // Sauvegarde après chaque scène
  writeFileSync(resolve(__dir, "generated/scenes.json"), JSON.stringify(existing, null, 2), "utf-8");
}

const ok = Object.values(existing).filter(Boolean).length;
console.log(`\n✅ ${ok}/${SCENES.length} scènes dans generated/scenes.json`);
