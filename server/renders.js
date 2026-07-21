import OpenAI, { toFile } from "openai";

function decodeDataImage(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/);
  return match ? { mime: match[1], bytes: Buffer.from(match[2], "base64") } : null;
}

export function renderPrompt(fixes = []) {
  const treatments = fixes.map((fix) => fix.title).join(", ") || "the proposed safety treatments";
  return `Photorealistically edit this street photograph to show a completed, buildable safety redesign: ${treatments}. Preserve the exact camera, buildings, weather, traffic signals, and street identity. Change only the street treatments. No labels, text, watermark, construction scene, crash, or emergency.`;
}

export async function createPhotorealisticRenders(streetview = [], fixes = [], options = {}) {
  const source = streetview.find((item) => item.available && item.image);
  const decoded = decodeDataImage(source?.image);
  if (!decoded) return { available: false, reason: "A licensed street-level frame is required for live AI editing" };
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return { available: false, reason: "OPENAI_API_KEY is not configured" };
  try {
    const client = options.client || new OpenAI({ apiKey });
    const image = await toFile(decoded.bytes, "street-reference.jpg", { type: decoded.mime });
    const response = await client.images.edit({
      model: options.imageModel || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      image,
      prompt: renderPrompt(fixes),
      size: "1536x1024",
      quality: "high",
    });
    const after = response.data?.[0]?.b64_json;
    if (!after) throw new Error("The image edit returned no pixels");
    return {
      available: true,
      before: source.image,
      after: `data:image/png;base64,${after}`,
      model: options.imageModel || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      source: "Live Street View input edited by OpenAI Images",
      synthetic: false,
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
