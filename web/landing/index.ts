import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Charge .env.local manuellement (pas de dotenv pour garder les dépendances légères)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, ".env.local");
try {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {
  // pas de .env.local → les variables d'env du shell sont utilisées
}

import { config, higgsfield } from "@higgsfield/client/v2";

if (!process.env.HF_CREDENTIALS) {
  console.error("❌ HF_CREDENTIALS manquant — édite .env.local");
  process.exit(1);
}

config({ credentials: process.env.HF_CREDENTIALS });

console.log("🎬 Génération test Seedance 2.5 …");

const result = await higgsfield.subscribe(
  "bytedance/seedance-2.5/text-to-video",
  {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
      bitrate_mode: "high",
      output_format: "mp4",
      generate_audio: true,
    },
    withPolling: true,
  },
);

if (result.status === "completed") {
  const url = (result as any).video?.url ?? (result as any).videos?.[0]?.url;
  console.log("✅ Vidéo générée :", url);
} else if (result.status === "failed") {
  console.error("❌ Génération échouée :", (result as any).error);
  process.exit(1);
} else if (result.status === "canceled") {
  console.error("⚠️ Requête annulée");
  process.exit(1);
} else if (result.status === "moderated") {
  console.error("🚫 Contenu modéré");
  process.exit(1);
} else {
  console.error("❓ Statut inattendu :", result.status);
  process.exit(1);
}
