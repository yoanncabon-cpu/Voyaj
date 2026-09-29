import { readFileSync } from "node:fs";
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

import { config, higgsfield } from "@higgsfield/client/v2";
config({ credentials: process.env.HF_CREDENTIALS });

console.log("🔍 Test avec prompt minimal …");
const res = await higgsfield.subscribe(
  "bytedance/seedance-2.5/text-to-video",
  {
    input: {
      prompt: "Car driving on road, sunny day, cinematic.",
      duration: 4,
      resolution: "720p",
      aspect_ratio: "16:9",
      output_format: "mp4",
      generate_audio: false,
    },
    withPolling: true,
  },
);

console.log("Statut :", res.status);
console.log("Réponse complète :", JSON.stringify(res, null, 2));
