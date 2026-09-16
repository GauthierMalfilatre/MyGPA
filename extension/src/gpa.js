const GRADE_VALUES = {
  A: 4.0,
  B: 3.0,
  C: 2.0,
  D: 1.0,
  Fail: 0.0,
};

function hasStarted(block) {
  const outcomes = block.learningOutcomes || [];
  return outcomes.some((outcome) => (outcome.acquiredPoints || 0) > 0);
}

function gradeValue(grade) {
  return Object.prototype.hasOwnProperty.call(GRADE_VALUES, grade)
    ? GRADE_VALUES[grade]
    : null;
}

function averageLevel(block) {
  const outcomes = block.learningOutcomes || [];
  if (outcomes.length === 0) return null;
  const sum = outcomes.reduce((acc, outcome) => acc + (outcome.level || 0), 0);
  return sum / outcomes.length;
}

function computeRealGpa(validationsPayload) {
  const blocks = validationsPayload?.blocks || [];

  const included = [];
  const excluded = [];

  for (const block of blocks) {
    if (!hasStarted(block)) {
      excluded.push(block);
      continue;
    }

    const value = gradeValue(block.projectedGrade);
    if (value === null || !block.credits) {
      excluded.push(block);
      continue;
    }

    included.push({
      id: block.id,
      title: block.title,
      credits: block.credits,
      projectedGrade: block.projectedGrade,
      value,
      averageLevel: averageLevel(block),
      validatedCount: block.validatedCount ?? null,
      totalCount: block.totalCount ?? null,
    });
  }

  const totalCredits = included.reduce((sum, b) => sum + b.credits, 0);
  const weightedSum = included.reduce((sum, b) => sum + b.value * b.credits, 0);

  const gpa = totalCredits > 0 ? weightedSum / totalCredits : null;

  return {
    gpa,
    totalCredits,
    includedModules: included,
    excludedModules: excluded.map((b) => ({ id: b.id, title: b.title })),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRealGpa, GRADE_VALUES };
} else if (typeof window !== "undefined") {
  window.KronkGpa = window.KronkGpa || {};
  Object.assign(window.KronkGpa, { computeRealGpa, GRADE_VALUES });
}
