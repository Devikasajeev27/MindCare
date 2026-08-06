import assert from "node:assert/strict";

process.env.GEMINI_API_KEY = "dummy";

const { SafetyGateway, assessLocalSelfHarmRisk } = await import("../services/safetyGateway.ts");

const positiveCases = [
  "I don't want to live anymore",
  "I want to end everything",
  "This is my last message",
  "I wish I could disappear",
  "എനിക്ക് ജീവിക്കാൻ തോന്നുന്നില്ല",
  "എനിക്ക് ഇനി ജീവിക്കണ്ട",
  "enik jeevikkan thonnunnilla",
  "enik ini jeevikenda",
  "jeevikkandann",
  "मुझे जीना नहीं है",
  "لا أريد أن أعيش",
  "No quiero vivir",
  "生きたくない",
  "I feel lost, enik jeevikkandann",
];

const falsePositiveCases = [
  "I don't want to live in this city",
  "This movie is about death",
  "I am distressed about my exam",
  "The news story discussed death education",
  "I am writing a fictional story about death",
];

for (const message of positiveCases) {
  const result = assessLocalSelfHarmRisk(message);
  assert.ok(["medium", "high", "imminent"].includes(result.risk_level), `Expected safety risk for: ${message}`);
  const gateway = await SafetyGateway.assess({ message, recentMessages: [] });
  assert.ok(["medium", "high", "imminent"].includes(gateway.risk.risk_level), `Gateway missed: ${message}`);
}

for (const message of falsePositiveCases) {
  const result = assessLocalSelfHarmRisk(message);
  assert.equal(result.risk_level, "none", `False positive: ${message}`);
}

console.log(`Safety gateway passed ${positiveCases.length} positive and ${falsePositiveCases.length} false-positive cases.`);
