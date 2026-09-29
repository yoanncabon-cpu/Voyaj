import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const root = new URL("./", import.meta.url);
const manifest = new URL("generated/video-improvements.json", root);
const sources = JSON.parse(readFileSync(new URL("generated/scenes.json", root), "utf8"));
const localEnv = new URL(".env.local", root);
const auth = process.env.HF_CREDENTIALS || (existsSync(localEnv) ? parse(readFileSync(localEnv)).HF_CREDENTIALS : undefined);
if (!auth) throw new Error("HF_CREDENTIALS is not configured.");
let jobs = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : {};
const save = () => writeFileSync(manifest, JSON.stringify(jobs, null, 2));
const common = "Photorealistic, natural French countryside at golden hour, cinematic but understated human warmth, subtle film grain, balanced skin tones, controlled highlights, physically plausible movement and anatomy. Single continuous shot, no cuts, no titles, no logos, no watermarks, no audio. Composed as a website background: main subject on the right half, quieter darker negative space on the left for a text overlay. Do not reproduce any text from reference footage.";
const scenes = [
  { id: "hero", refs: [sources.hero], prompt: `${common} Use video 1 as the exact visual reference for the landscape, white compact hatchback and warm light. A slow, perfectly stabilized aerial tracking shot follows the same single car driving normally along the right-hand lane of a winding rural French road. Frame the road and car in the right third; left half shows softly shaded fields and trees. Gently advance at constant speed, no dramatic zoom, no horizon tilt, no acceleration. Consistent car geometry and wheels throughout. Start and end with similar composition for a gentle loop.` },
  { id: "driver_phone", refs: [sources.driver_phone], prompt: `${common} Preserve the adult blonde woman from video 1, the same face, hair and clothing. Medium wide passenger-side interior shot in her compact car safely PARKED in a roadside parking area, countryside outside remains completely stationary. Seat belt fastened. A phone is fixed in its dashboard holder. She glances briefly at it, gently taps once to accept a ride, then looks ahead with a small natural smile. Frame her face in the right third, dashboard on the lower right, generous negative space at left. Phone screen is out of focus, no readable UI. Natural hands with five fingers, no deformation, no driving while interacting with the phone. Slow subtle camera push, warm controlled light, relaxed authentic expression.` },
  { id: "ride_together", refs: [sources.driver_phone, sources.door_opens], prompt: `${common} Preserve the adult blonde female driver from video 1 and adult male backpack passenger from video 2. They are now seated in the same compact car, both seat belts correctly fastened. Medium-wide camera from the center of the rear seat, showing their profiles in the upper right and road ahead; foreground left gently defocused to leave space for website text. Driver keeps her gaze on the road and hands on the wheel; passenger smiles naturally while looking through the window. Countryside flows gently past at a realistic slow driving speed. No talking to camera, no exaggerated laugh, no distracting gestures, no changing faces. One smooth, stable shot, warm evening sunlight and believable reflections.` },
];

const action = process.argv[2];
if (action === "submit" && process.argv.includes("--retry-failed")) {
  const retryable = Object.values(jobs).some(job => ["failed", "rejected"].includes(job.status));
  if (retryable) {
    writeFileSync(new URL(`generated/video-improvements-${Date.now()}.json`, root), JSON.stringify(jobs, null, 2));
    jobs = Object.fromEntries(Object.entries(jobs).filter(([, job]) => !["failed", "rejected"].includes(job.status)));
    save();
  }
}
if (action === "submit") {
  for (const scene of scenes) {
    // An unknown submission is never retried automatically: it may be billable.
    if (jobs[scene.id]) { console.log(scene.id, "already recorded:", jobs[scene.id].status); continue; }
    jobs[scene.id] = { status: "submission_pending", original: sources[scene.id] ?? null, prompt: scene.prompt, createdAt: new Date().toISOString() };
    save();
    const response = await fetch("https://api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video", {
      method: "POST", headers: { Authorization: `Key ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: scene.prompt, video_urls: scene.refs, duration: 5, resolution: "720p", aspect_ratio: "16:9", output_format: "mp4", generate_audio: false }),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json();
    if (!response.ok) {
      jobs[scene.id].status = "rejected";
      jobs[scene.id].httpStatus = response.status;
      jobs[scene.id].error = result.detail ?? result.error ?? result.message ?? "Request rejected";
      save();
      console.log(scene.id, JSON.stringify({ status: response.status, error: jobs[scene.id].error }));
      break;
    }
    Object.assign(jobs[scene.id], { status: result.status, requestId: result.request_id, statusUrl: result.status_url });
    save();
    console.log(scene.id, JSON.stringify({ status: result.status, requestId: result.request_id }));
  }
} else if (action === "status") {
  for (const [id, job] of Object.entries(jobs)) {
    if (!job.requestId || ["completed", "failed", "moderated", "canceled"].includes(job.status)) { console.log(id, job.status); continue; }
    const url = job.statusUrl || `https://api.higgsfield.ai/requests/${job.requestId}/status`;
    if (!["api.higgsfield.ai", "platform.higgsfield.ai"].includes(new URL(url).hostname)) throw new Error("Unexpected status host");
    const response = await fetch(url, { headers: { Authorization: `Key ${auth}` }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) { console.log(id, "status HTTP", response.status); continue; }
    const result = await response.json();
    job.status = result.status;
    job.result = result;
    job.url = result.video?.url ?? result.videos?.[0]?.url ?? result.output?.url ?? null;
    save();
    console.log(id, JSON.stringify({ status: job.status, url: job.url }));
  }
} else {
  console.log("Use submit to create the three requested improvements once, or status to collect existing jobs.");
  console.log("Results are saved to", fileURLToPath(manifest), "for review before integration.");
}
