export const AGENTS = [
  { id: "imagery", name: "Imagery agent", task: "Street View + satellite isolation" },
  { id: "records", name: "Records agent", task: "Crash, 311, news, and minutes" },
  { id: "civic", name: "Civic agent", task: "District official + legislative trail" },
  { id: "design", name: "Design agent", task: "Treatments, costs, and visual renders" },
];

export function activityEvent(agentId, status, message, extra = {}) {
  const agent = AGENTS.find((item) => item.id === agentId) || { id: agentId, name: agentId };
  return { type: "agent", agent: agent.id, agentName: agent.name, status, message, at: new Date().toISOString(), ...extra };
}

export async function dispatchUAgent(task, payload, options = {}) {
  const baseUrl = options.baseUrl || process.env.UAGENTS_URL;
  if (!baseUrl) return { delegated: false, runtime: "local-node", task };
  const response = await (options.fetchImpl || fetch)(`${baseUrl.replace(/\/$/, "")}/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload }),
  });
  if (!response.ok) throw new Error(`uAgents bridge failed (${response.status})`);
  return { delegated: true, runtime: "fetch-ai-uagents", task, response: await response.json() };
}
