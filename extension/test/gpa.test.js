const assert = require("node:assert/strict");
const test = require("node:test");
const { computeRealGpa, computeOverallGpa } = require("../src/gpa.js");
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
