export function planningCost(fixes = []) {
  const total = fixes.reduce((sum, fix) => {
    const match = String(fix.cost || "").match(/\$([\d,.]+)\s*(k|m)?/i);
    if (!match) return sum;
    const amount = Number(match[1].replaceAll(",", ""));
    const multiplier = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2]?.toLowerCase() === "k" ? 1_000 : 1;
    return sum + amount * multiplier;
  }, 0);
  return total;
}

export function compactMoney(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

export function slugify(value) {
  return String(value || "model-citizen")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "model-citizen";
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render the 3D postcard image."));
    image.src = source;
  });
}

function cover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

export async function exportPostcard({ pair, data, title }) {
  const [today, proposed] = await Promise.all([loadImage(pair.today), loadImage(pair.proposed)]);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f4f0e6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#142e2d";
  context.fillRect(0, 0, canvas.width, 176);
  context.fillStyle = "#c7ef42";
  context.font = "800 24px Arial, sans-serif";
  context.fillText("MODEL CITIZEN · EVIDENCE-TO-ACTION POSTCARD", 70, 58);
  context.fillStyle = "#ffffff";
  context.font = "700 54px Georgia, serif";
  context.fillText(title, 70, 126);
  context.font = "20px Arial, sans-serif";
  context.fillStyle = "#c7d3cf";
  context.fillText(`District ${data.civic?.district || "—"} · Supervisor ${data.civic?.supervisor || "unresolved"}`, 70, 158);

  const panelY = 215;
  const panelWidth = 705;
  const panelHeight = 500;
  cover(context, today, 70, panelY, panelWidth, panelHeight);
  cover(context, proposed, 825, panelY, panelWidth, panelHeight);
  context.fillStyle = "rgba(20,46,45,.92)";
  context.fillRect(70, panelY, 145, 46);
  context.fillRect(825, panelY, 190, 46);
  context.fillStyle = "#ffffff";
  context.font = "800 20px Arial, sans-serif";
  context.fillText("TODAY", 92, panelY + 30);
  context.fillStyle = "#c7ef42";
  context.fillText("PROPOSED", 847, panelY + 30);

  const cost = compactMoney(planningCost(data.fixes));
  context.fillStyle = "#142e2d";
  context.font = "700 29px Georgia, serif";
  context.fillText(`${data.summary?.fatalCount || 0} fatal · ${data.summary?.crashCount || 0} injury-crash records · ${data.summary?.confirmedCount || 0} confirmed findings`, 70, 785);
  context.fillStyle = "#3e5b56";
  context.font = "20px Arial, sans-serif";
  context.fillText(`${data.fixes?.length || 0} grant-matched fixes · ${cost} planning package`, 70, 824);

  (data.fixes || []).slice(0, 3).forEach((fix, index) => {
    const y = 875 + index * 36;
    context.fillStyle = index === 0 ? "#eb5b48" : "#2e7b68";
    context.fillRect(70, y - 17, 12, 12);
    context.fillStyle = "#142e2d";
    context.font = "700 18px Arial, sans-serif";
    context.fillText(`${fix.title} · ${fix.cost} · ${fix.grant}`, 98, y - 4);
  });
  context.fillStyle = "#60736e";
  context.font = "15px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("Planning-level costs · verify field conditions before delivery", 1530, 965);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode the postcard.")), "image/png");
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${slugify(title)}-model-citizen-postcard.png`;
  link.href = objectUrl;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
