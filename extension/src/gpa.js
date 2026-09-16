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

function averageScore(block) {
  const outcomes = block.learningOutcomes || [];
  if (outcomes.length === 0) return null;
  const sum = outcomes.reduce((acc, outcome) => acc + (outcome.score || 0), 0);
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
      averageScore: averageScore(block),
      validatedCount: block.validatedCount ?? null,
      totalCount: block.totalCount ?? null,
    });
  }

  const totalCredits = included.reduce((sum, b) => sum + b.credits, 0);
  const weightedSum = included.reduce((sum, b) => sum + b.value * b.credits, 0);

  const gpa = totalCredits > 0 ? weightedSum / totalCredits : null;

  const priorCredits = validationsPayload?.totalAcquiredCredits
    ?? validationsPayload?.acquiredCredits
    ?? 0;

  return {
    gpa,
    totalCredits,
    priorCredits,
    includedModules: included,
    excludedModules: excluded.map((b) => ({ id: b.id, title: b.title })),
  };
}

function computeOverallGpa(currentPeriod, profile) {
  const officialGpa = profile?.gpa !== undefined && profile?.gpa !== null
    ? parseFloat(profile.gpa)
    : null;
  const priorCredits = currentPeriod.priorCredits ?? 0;

  const hasOfficial = officialGpa !== null && !Number.isNaN(officialGpa) && priorCredits > 0;
  const hasCurrent = currentPeriod.gpa !== null && currentPeriod.totalCredits > 0;

  if (!hasOfficial && !hasCurrent) {
    return { gpa: null, officialGpa, priorCredits, currentPeriod };
  }
  if (hasOfficial && !hasCurrent) {
    return { gpa: officialGpa, officialGpa, priorCredits, currentPeriod };
  }
  if (!hasOfficial && hasCurrent) {
    return { gpa: currentPeriod.gpa, officialGpa, priorCredits, currentPeriod };
  }

  const totalCredits = priorCredits + currentPeriod.totalCredits;
  const weightedSum = officialGpa * priorCredits + currentPeriod.gpa * currentPeriod.totalCredits;

  return {
    gpa: weightedSum / totalCredits,
    officialGpa,
    priorCredits,
    currentPeriod,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRealGpa, computeOverallGpa, GRADE_VALUES };
} else if (typeof window !== "undefined") {
  window.KronkGpa = window.KronkGpa || {};
  Object.assign(window.KronkGpa, { computeRealGpa, computeOverallGpa, GRADE_VALUES });
}
