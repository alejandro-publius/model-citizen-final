const RULES = [
  {
    match: /faded|unmarked|missing.*crosswalk|crosswalk.*marking/i,
    type: "crosswalk",
    title: "High-visibility continental crosswalk",
    cost: "$4k",
    grant: "SS4A Demonstration",
  },
  {
    match: /uncontrolled.*cross|crossing.*uncontrolled|wide road/i,
    type: "beacon",
    title: "Rapid-flashing beacon (RRFB)",
    cost: "$30k",
    grant: "HSIP",
  },
  {
    match: /missing.*signal|obstructed.*signal|signal.*obstruct/i,
    type: "signal",
    title: "New signal or interim all-way stop",
    cost: "$350k",
    grant: "SS4A Implementation",
  },
  {
    match: /speed|speeding/i,
    type: "cushions",
    title: "Speed cushions",
    cost: "$15k",
    grant: "CA Active Transportation Program",
  },
  {
    match: /long.*crossing|crossing.*distance/i,
    type: "bulbout",
    title: "Corner bulb-outs",
    cost: "$90k",
    grant: "SS4A Implementation",
  },
  {
    match: /missing.*bike|absent.*bike|bike infrastructure|protected bike/i,
    type: "bike-lane",
    title: "Protected bike lane segment",
    cost: "$120k/block",
    grant: "CA Active Transportation Program",
  },
];

export function mapFixes(findings = []) {
  const fixes = [];
  for (const finding of findings) {
    const text = `${finding.hazard || ""} ${finding.detail || ""}`;
    const rule = RULES.find((candidate) => candidate.match.test(text));
    if (!rule) continue;
    fixes.push({
      id: `fix-${fixes.length + 1}`,
      findingId: finding.id,
      zone: finding.zone,
      status: finding.status,
      type: rule.type,
      title: rule.title,
      cost: rule.cost,
      grant: rule.grant,
    });
  }
  return fixes;
}

export { RULES as FIX_RULES };
