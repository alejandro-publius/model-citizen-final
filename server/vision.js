import OpenAI from "openai";

export const ZONES = [
  "NW corner", "NE corner", "SW corner", "SE corner",
  "north crosswalk", "south crosswalk", "east crosswalk", "west crosswalk",
  "center of intersection", "north approach", "south approach", "east approach", "west approach",
];

export function visionPrompt(imageCount, hasSatellite = false) {
  return `You are a traffic-safety engineer conducting a visual site survey. You are looking at
${imageCount} Street View photographs of one intersection, taken facing north (heading 0),
east (90), south (180), and west (270).${hasSatellite ? " You also have one north-up satellite image of the same intersection for crossing geometry only." : ""} You have NO other information about this
location — no crash history, no complaints. Report only what the camera shows.

Assign every finding to a named zone from this fixed list:
${ZONES.join(", ")}.

Look for faded or missing crosswalk markings; missing or obstructed signals and signs;
long uncontrolled crossing distances; missing curb ramps; sightline obstructions;
missing pedestrian refuge on wide roads; absent bike infrastructure where cyclists are
visible; poor lighting indicators; and visible pavement damage.

Respond ONLY with JSON, no markdown fences:
{"observations":[{"zone":"<zone from list>","hazard":"<short name>",
"detail":"<one sentence of visual evidence>","severity":"low|medium|high",
"confidence":0.0}],"overall_impression":"<two sentences>"}

Only report what is visually evident. If an image is unclear, lower confidence rather
than guessing. An empty observations array is valid.`;
}

export function parseModelJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function skipped(reason) {
  return {
    observations: [],
    overall_impression: "The blind visual survey is unavailable for this run. Official records and street geometry are still shown independently.",
    skipped: true,
    reason,
  };
}

export async function runBlindVision(images, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const usable = images.filter((image) => image.available && image.image);
  const satellite = options.satellite?.available && options.satellite.image ? options.satellite : null;
  if (!apiKey) return skipped("OPENAI_API_KEY is not configured");
  if (!usable.length && !satellite) return skipped("No street-level or satellite images were available");

  const client = options.client || new OpenAI({ apiKey });
  const content = [
    { type: "input_text", text: visionPrompt(usable.length, Boolean(satellite)) },
    ...usable.flatMap((image) => [
      { type: "input_text", text: `Street View heading ${image.heading} degrees.` },
      { type: "input_image", image_url: image.image, detail: "low" },
    ]),
    ...(satellite ? [
      { type: "input_text", text: "North-up satellite image. Use it only for visible street and crossing geometry." },
      { type: "input_image", image_url: satellite.image, detail: "low" },
    ] : []),
  ];

  const request = (requestContent) => client.responses.create({
    model: options.model || process.env.OPENAI_MODEL || "gpt-5.6",
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
    input: [{ role: "user", content: requestContent }],
  });

  let response = await request(content);
  let payload;
  try {
    payload = parseModelJson(response.output_text);
  } catch {
    response = await request([
      ...content,
      { type: "input_text", text: "Your previous reply was not valid JSON. Reply with ONLY the requested JSON object." },
    ]);
    payload = parseModelJson(response.output_text);
  }
  payload.observations = (payload.observations || []).filter((item) => ZONES.includes(item.zone));
  payload.model = response.model;
  return payload;
}
