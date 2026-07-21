const SAFE_MESSAGES = [
  [/intersection not found/i, "We couldn't find that San Francisco intersection. Please check the address and try again."],
  [/geocod|nominatim/i, "Location lookup is temporarily unavailable. Please try again."],
  [/datasf|data\.sfgov/i, "Official San Francisco data is temporarily unavailable."],
  [/openai|api key|model/i, "Visual analysis is temporarily unavailable."],
  [/google maps|street view|satellite/i, "Street and satellite imagery is temporarily unavailable."],
  [/overpass|openstreetmap/i, "Street geometry is temporarily unavailable."],
  [/legistar/i, "Legislative records are temporarily unavailable."],
  [/supervisor district/i, "District information is temporarily unavailable."],
  [/enter a san francisco intersection/i, "Enter a San Francisco intersection."],
];
const SAFE_MESSAGE_VALUES = new Set(SAFE_MESSAGES.map(([, message]) => message));

export function sanitizeError(error) {
  // Keep provider responses, request URLs, and stack traces out of client payloads.
  console.error("Internal error:", error);
  const message = error instanceof Error ? error.message : String(error || "");
  if (SAFE_MESSAGE_VALUES.has(message)) return message;
  const match = SAFE_MESSAGES.find(([pattern]) => pattern.test(message));
  return match?.[1] || "Analysis failed. Please try again.";
}
