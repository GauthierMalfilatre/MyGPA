const assert = require("node:assert/strict");
const test = require("node:test");
const { computeRealGpa } = require("../src/gpa.js");
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
