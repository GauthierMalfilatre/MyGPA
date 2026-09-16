const assert = require("node:assert/strict");
const test = require("node:test");
const { computeRealGpa, computeOverallGpa, simulateGpa, requiredGradeForTarget } = require("../src/gpa.js");
const fixture = require("./fixtures/validations-me.json");

test("excludes modules with zero acquired points", () => {
  const result = computeRealGpa(fixture);
  const includedIds = result.includedModules.map((m) => m.id);
  assert.deepEqual(includedIds, [244]);
});

test("computes credit-weighted GPA from included modules only", () => {
  const result = computeRealGpa(fixture);
  // Only block 244 (G-SVR-500) has acquired points: grade A, 4 credits.
  assert.equal(result.totalCredits, 4);
  assert.equal(result.gpa, 4.0);
});

test("returns null gpa when no module has started", () => {
  const emptyFixture = {
    blocks: fixture.blocks.filter((b) => b.id !== 244),
  };
  const result = computeRealGpa(emptyFixture);
  assert.equal(result.gpa, null);
  assert.equal(result.includedModules.length, 0);
});

test("mixed progress: weights multiple started modules by credits", () => {
  const mixed = {
    blocks: [
      { id: 1, title: "A", learningOutcomes: [{ acquiredPoints: 5 }], projectedGrade: "A", credits: 2 },
      { id: 2, title: "B", learningOutcomes: [{ acquiredPoints: 3 }], projectedGrade: "C", credits: 6 },
      { id: 3, title: "C", learningOutcomes: [], projectedGrade: "Fail", credits: 10 },
    ],
  };
  const result = computeRealGpa(mixed);
  // (4.0*2 + 2.0*6) / (2+6) = (8+12)/8 = 2.5
  assert.equal(result.totalCredits, 8);
  assert.equal(result.gpa, 2.5);
});

test("computes average score (0-500 scale) per included module", () => {
  const result = computeRealGpa(fixture);
  // (450 + 500 + 500 + 267 + 350) / 5 = 2067 / 5 = 413.4
  const module = result.includedModules.find((m) => m.id === 244);
  assert.ok(Math.abs(module.averageScore - 413.4) < 1e-9);
});

test("computeRealGpa reads prior credits from the validations payload", () => {
  const payload = { ...fixture, totalAcquiredCredits: 120 };
  const result = computeRealGpa(payload);
  assert.equal(result.priorCredits, 120);
});

test("computeOverallGpa blends official GPA with current-period GPA by credits", () => {
  const currentPeriod = { gpa: 2.5, totalCredits: 8, priorCredits: 120 };
  const profile = { gpa: "3.65" };
  const result = computeOverallGpa(currentPeriod, profile);
  // (3.65*120 + 2.5*8) / (120+8) = (438+20)/128 = 3.578125
  assert.equal(result.priorCredits, 120);
  assert.equal(result.officialGpa, 3.65);
  assert.ok(Math.abs(result.gpa - 3.578125) < 1e-9);
});

test("computeOverallGpa falls back to official GPA when nothing started yet", () => {
  const currentPeriod = { gpa: null, totalCredits: 0, priorCredits: 120 };
  const profile = { gpa: "3.65" };
  const result = computeOverallGpa(currentPeriod, profile);
  assert.equal(result.gpa, 3.65);
});

test("computeOverallGpa falls back to current-period GPA when no prior credits", () => {
  const currentPeriod = { gpa: 2.5, totalCredits: 8, priorCredits: 0 };
  const profile = { gpa: "0.00" };
  const result = computeOverallGpa(currentPeriod, profile);
  assert.equal(result.gpa, 2.5);
});

test("computeOverallGpa returns null when no data at all", () => {
  const currentPeriod = { gpa: null, totalCredits: 0, priorCredits: 0 };
  const profile = { gpa: null };
  const result = computeOverallGpa(currentPeriod, profile);
  assert.equal(result.gpa, null);
});

function buildOverall() {
  const currentPeriod = computeRealGpa({ ...fixture, totalAcquiredCredits: 120 });
  return computeOverallGpa(currentPeriod, { gpa: "3.65" });
}

test("simulateGpa keeps real result unchanged with no overrides", () => {
  const overall = buildOverall();
  const simulated = simulateGpa(overall, {});
  assert.equal(simulated.gpa, overall.gpa);
  assert.equal(simulated.currentPeriod.totalCredits, overall.currentPeriod.totalCredits);
});

test("simulateGpa overrides the grade of an already-included module", () => {
  const overall = buildOverall();
  // block 244 currently has grade A (value 4.0); force it down to C.
  const simulated = simulateGpa(overall, { 244: "C" });
  assert.equal(simulated.currentPeriod.gpa, 2.0);
});

test("simulateGpa adds a not-yet-started module with a hypothetical grade", () => {
  const overall = buildOverall();
  // block 231 (G-AIA-500, 6 credits) is excluded in the real computation.
  const withoutOverride = overall.currentPeriod.includedModules.some((m) => m.id === 231);
  assert.equal(withoutOverride, false);

  const simulated = simulateGpa(overall, { 231: "B", 244: "A" });
  const included = simulated.currentPeriod.includedModules;
  assert.ok(included.some((m) => m.id === 231 && m.simulated));
  // (4.0*4 + 3.0*6) / (4+6) = (16+18)/10 = 3.4
  assert.equal(simulated.currentPeriod.gpa, 3.4);
});

test("simulateGpa still blends with the official prior GPA", () => {
  const overall = buildOverall();
  const simulated = simulateGpa(overall, { 231: "A", 244: "A" });
  // current period: (4*4 + 4*6)/10 = 4.0; blended with 3.65 over 120 credits.
  // (3.65*120 + 4.0*10) / 130 = (438+40)/130 = 3.6769...
  assert.ok(Math.abs(simulated.gpa - 3.676923077) < 1e-6);
});

test("flags included modules at grade C/D/Fail as at-risk", () => {
  const mixed = {
    blocks: [
      { id: 1, title: "A", learningOutcomes: [{ acquiredPoints: 5 }], projectedGrade: "A", credits: 2 },
      { id: 2, title: "B", learningOutcomes: [{ acquiredPoints: 3 }], projectedGrade: "C", credits: 6 },
      { id: 3, title: "D", learningOutcomes: [{ acquiredPoints: 1 }], projectedGrade: "D", credits: 3 },
    ],
  };
  const result = computeRealGpa(mixed);
  assert.deepEqual(result.atRiskModules.map((m) => m.id), [2, 3]);
});

test("requiredGradeForTarget returns no-remaining-credits when the semester is fully accounted for", () => {
  const overall = buildOverall();
  const fullyAccounted = {
    ...overall,
    currentPeriod: { ...overall.currentPeriod, excludedModules: [] },
  };
  const result = requiredGradeForTarget(fullyAccounted, 3.8);
  assert.equal(result.remainingCredits, 0);
  assert.equal(result.requiredGrade, null);
  assert.equal(result.reason, "no-remaining-credits");
});

test("requiredGradeForTarget computes the grade value needed on remaining credits", () => {
  const overall = buildOverall();
  // priorCredits=120 @3.65, current period 4 credits @4.0 (module 244),
  // remaining credits = 2+6+6+2 = 16 (modules 322, 232, 231, 238).
  // target 3.7: (3.7*140 - (3.65*120 + 4.0*4)) / 16 = (518 - (438+16)) / 16 = 64/16 = 4.0
  const result = requiredGradeForTarget(overall, 3.7);
  assert.equal(result.remainingCredits, 16);
  assert.ok(Math.abs(result.requiredValue - 4.0) < 1e-9);
  assert.equal(result.requiredGrade, "A");
  assert.equal(result.achievable, true);
});

test("requiredGradeForTarget reports unachievable targets", () => {
  const overall = buildOverall();
  // An unreasonably high target requires more than grade A (value > 4.0) on remaining credits.
  const result = requiredGradeForTarget(overall, 3.99);
  assert.equal(result.achievable, false);
});

test("requiredGradeForTarget picks the lowest grade that still meets the target", () => {
  const overall = buildOverall();
  // target 3.66: required value = (3.66*140 - 454) / 16 = 3.65, which sits
  // between B (3.0) and A (4.0), so A is the lowest grade that clears it.
  const result = requiredGradeForTarget(overall, 3.66);
  assert.equal(result.requiredGrade, "A");
});
