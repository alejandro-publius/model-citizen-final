import OpenAI from "openai";
import { sanitizeError } from "./errors.js";
import { parseModelJson } from "./vision.js";

function promptFor(data) {
  return `Write two documents for a resident advocating to fix this intersection. Ground every
claim in the data provided; do not invent statistics.

1. "letter": about 250 words to the San Francisco Board of Supervisors member for this
district. Address the named current supervisor when civic data includes one. Explain the intersection, strongest confirmed finding and evidence, requested
fix, cost and named grant program, then close respectfully and urgently.
2. "post": under 280 characters, ending with a call to action.

Plain language, no melodrama. Respond ONLY with JSON: {"letter":"...","post":"..."}
Data: ${JSON.stringify(data)}`;
}

export function fallbackLastMile({ location, civic, findings, crashes, reports311, fixes, summary }) {
  const strongest = findings.find((item) => item.status === "CONFIRMED") || findings[0];
  const fix = fixes.find((item) => item.findingId === strongest?.id) || fixes[0];
  const fatal = crashes.find((item) => /fatal/i.test(item.collision_severity || ""));
  const place = location.shortLabel || location.query || "this intersection";
  const evidence = fatal
    ? `Official DataSF records include a fatal ${fatal.type_of_collision || "collision"} on ${new Date(fatal.collision_datetime).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}.`
    : `Official records show ${crashes.length} injury crash record${crashes.length === 1 ? "" : "s"} within 100 meters.`;
  const request = fix
    ? `I am asking the City to advance a ${fix.title.toLowerCase()} (${fix.cost}) and pursue ${fix.grant} funding.`
    : "I am asking the City to complete a prompt engineering review and advance the highest-impact treatment.";
  const hazard = strongest
    ? `The independent visual survey identified ${strongest.hazard.toLowerCase()} at the ${strongest.zone}.`
    : "The visual survey could not run without imagery, but the official crash record still warrants prompt review.";
  const reportCount = summary?.reportCount ?? reports311.length;
  const salutation = civic?.supervisor ? `Dear Supervisor ${civic.supervisor.split(" ").at(-1)},` : "Dear Supervisor,";

  return {
    letter: `${salutation}\n\nI am writing as a San Francisco resident to request prompt safety action at ${place}. This is a busy neighborhood intersection used every day by people walking, riding transit, biking, and driving.\n\n${hazard} ${evidence} Nearby 311 data also includes ${reportCount} street-safety-related report${reportCount === 1 ? "" : "s"} in the review area. These are independent signals: the visual survey is conducted without access to complaint or crash records, and only afterward are the results compared.\n\n${request} This is a concrete, fundable response that can shorten exposure, clarify priority, or improve visibility for people crossing. I also ask that SFMTA verify field conditions, preserve the source records, and publish a delivery timeline so neighbors can follow the work.\n\nPlease treat the official crash history with the urgency and respect it deserves. I would welcome the opportunity to support a site visit and help share the final plan with neighbors.\n\nRespectfully,\nA concerned San Francisco resident`,
    post: `${place} deserves a safer crossing. Independent street review + official records point to a fix${fix ? `: ${fix.title.toLowerCase()}` : ""}. Ask the City for a funded delivery timeline.`,
    generatedBy: "deterministic fallback",
  };
}

export async function generateLastMile(data, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackLastMile(data);
  try {
    const client = options.client || new OpenAI({ apiKey });
    const request = (input) => client.responses.create({
      model: options.model || process.env.OPENAI_MODEL || "gpt-5.6",
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      input,
    });
    let response = await request(promptFor(data));
    try {
      return { ...parseModelJson(response.output_text), generatedBy: response.model };
    } catch {
      response = await request(`${promptFor(data)}\n\nYour previous reply was not valid JSON. Reply with ONLY the requested JSON object.`);
    }
    return { ...parseModelJson(response.output_text), generatedBy: response.model };
  } catch (error) {
    return { ...fallbackLastMile(data), warning: sanitizeError(new Error("OpenAI advocacy request failed", { cause: error })) };
  }
}
