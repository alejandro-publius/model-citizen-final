import { includesWholeWord, matchesAnyWholeWord } from "./datasf.js";

const VISUAL_GROUPS = {
  pedestrian: ["crosswalk", "crossing", "pedestrian", "curb", "refuge", "sidewalk", "pavement", "lighting"],
  bicycle: ["bike", "bicycle", "cyclist"],
  visibility: ["visibility", "sightline", "obstruction", "obstructed", "signal", "sign"],
  speed: ["speed", "speeding", "fast"],
};

const REPORT_GROUPS = {
  pedestrian: ["crosswalk", "crossing", "curb", "sidewalk", "pavement", "streetlight"],
  bicycle: ["bike", "bicycle", "traffic"],
  visibility: ["signal", "sign", "visibility", "tree", "parking"],
  speed: ["traffic", "speed", "speeding"],
};

function groupsFor(hazard) {
  return Object.entries(VISUAL_GROUPS)
    .filter(([, terms]) => matchesAnyWholeWord(hazard, terms))
    .map(([group]) => group);
}

function crashSupports(crash, groups) {
  const type = crash.type_of_collision || "";
  return (
    (groups.includes("pedestrian") && includesWholeWord(type, "pedestrian")) ||
    (groups.includes("bicycle") && includesWholeWord(type, "bicycle")) ||
    (groups.includes("visibility") && matchesAnyWholeWord(type, ["broadside", "head-on"])) ||
    (groups.includes("speed") && matchesAnyWholeWord(type, ["rear end", "broadside", "head-on"]))
  );
}

function reportSupports(report, groups) {
  const text = `${report.service_name || ""} ${report.service_subtype || ""} ${report.service_details || ""}`;
  return groups.some((group) => matchesAnyWholeWord(text, REPORT_GROUPS[group] || []));
}

export function corroborate(observations = [], crashes = [], reports311 = []) {
  const matchedCrashes = new Set();
  const matchedReports = new Set();

  const findings = observations.map((observation, index) => {
    const groups = groupsFor(`${observation.hazard || ""} ${observation.detail || ""}`);
    const crashIndices = [];
    const reportIndices = [];

    crashes.forEach((crash, crashIndex) => {
      if (crashSupports(crash, groups)) {
        crashIndices.push(crashIndex);
        matchedCrashes.add(crashIndex);
      }
    });
    reports311.forEach((report, reportIndex) => {
      if (reportSupports(report, groups)) {
        reportIndices.push(reportIndex);
        matchedReports.add(reportIndex);
      }
    });

    const evidenceCount = crashIndices.length + reportIndices.length;
    return {
      id: `finding-${index + 1}`,
      ...observation,
      status: evidenceCount ? "CONFIRMED" : "CANDIDATE",
      evidence: { crashIndices, reportIndices },
      evidenceCount,
    };
  });

  const reported = [
    ...crashes
      .map((record, index) => ({ record, index }))
      .filter(({ index }) => !matchedCrashes.has(index))
      .slice(0, 8)
      .map(({ record, index }) => ({
        id: `reported-crash-${index}`,
        status: "REPORTED",
        source: "Traffic crash",
        detail: `${record.type_of_collision || "Collision"} · ${record.collision_severity || "Injury"}`,
        date: record.collision_datetime,
        recordIndex: index,
      })),
    ...reports311
      .map((record, index) => ({ record, index }))
      .filter(({ index }) => !matchedReports.has(index))
      .slice(0, 5)
      .map(({ record, index }) => ({
        id: `reported-311-${index}`,
        status: "REPORTED",
        source: "311 report",
        detail: `${record.service_name || "Street report"} · ${record.service_details || record.service_subtype || ""}`,
        date: record.requested_datetime,
        recordIndex: index,
      })),
  ];

  return { findings, reported };
}
