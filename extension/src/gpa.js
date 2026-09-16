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

const AT_RISK_GRADES = new Set(["C", "D", "Fail"]);

function isAtRisk(grade) {
  return AT_RISK_GRADES.has(grade);
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
      atRisk: isAtRisk(block.projectedGrade),
    });
  }

  const totalCredits = included.reduce((sum, b) => sum + b.credits, 0);
  const weightedSum = included.reduce((sum, b) => sum + b.value * b.credits, 0);

  const gpa = totalCredits > 0 ? weightedSum / totalCredits : null;

  const priorCredits = validationsPayload?.totalAcquiredCredits
    ?? validationsPayload?.acquiredCredits
    ?? 0;

  const atRiskModules = included.filter((b) => b.atRisk);

  return {
    gpa,
    totalCredits,
    priorCredits,
    includedModules: included,
    excludedModules: excluded.map((b) => ({ id: b.id, title: b.title, credits: b.credits || 0 })),
    atRiskModules,
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

function simulateGpa(overall, overrides) {
  const currentPeriod = overall.currentPeriod;
  const activeOverrides = overrides || {};

  const simulatedModules = [];

  for (const m of currentPeriod.includedModules) {
    const overrideGrade = activeOverrides[m.id];
    const grade = overrideGrade !== undefined ? overrideGrade : m.projectedGrade;
    const value = gradeValue(grade);
    if (value === null) continue;
    simulatedModules.push({ ...m, projectedGrade: grade, value, simulated: overrideGrade !== undefined });
  }

  for (const m of currentPeriod.excludedModules) {
    const overrideGrade = activeOverrides[m.id];
    if (overrideGrade === undefined) continue;
    const value = gradeValue(overrideGrade);
    if (value === null || !m.credits) continue;
    simulatedModules.push({ ...m, projectedGrade: overrideGrade, value, simulated: true });
  }

  const totalCredits = simulatedModules.reduce((sum, m) => sum + m.credits, 0);
  const weightedSum = simulatedModules.reduce((sum, m) => sum + m.value * m.credits, 0);
  const simulatedCurrentGpa = totalCredits > 0 ? weightedSum / totalCredits : null;

  const simulatedCurrentPeriod = {
    ...currentPeriod,
    gpa: simulatedCurrentGpa,
    totalCredits,
    includedModules: simulatedModules,
  };

  const blended = computeOverallGpa(simulatedCurrentPeriod, {
    gpa: overall.officialGpa !== null && overall.officialGpa !== undefined ? String(overall.officialGpa) : null,
  });

  return { ...blended, currentPeriod: simulatedCurrentPeriod };
}

function requiredGradeForTarget(overall, targetGpa) {
  const currentPeriod = overall.currentPeriod;
  const priorCredits = overall.priorCredits ?? 0;
  const officialGpa = overall.officialGpa ?? 0;
  const currentGpa = currentPeriod.gpa ?? 0;
  const currentCredits = currentPeriod.totalCredits ?? 0;

  const remainingCredits = (currentPeriod.excludedModules || []).reduce(
    (sum, m) => sum + (m.credits || 0),
    0
  );

  if (remainingCredits <= 0) {
    return {
      remainingCredits: 0,
      requiredValue: null,
      requiredGrade: null,
      achievable: null,
      reason: "no-remaining-credits",
    };
  }

  const knownCredits = priorCredits + currentCredits;
  const knownWeightedSum = officialGpa * priorCredits + currentGpa * currentCredits;
  const totalCredits = knownCredits + remainingCredits;

  // targetGpa = (knownWeightedSum + x * remainingCredits) / totalCredits, solve for x.
  const requiredValue = (targetGpa * totalCredits - knownWeightedSum) / remainingCredits;

  const gradeEntries = Object.entries(GRADE_VALUES).sort((a, b) => a[1] - b[1]);
  let requiredGrade = null;
  for (const [grade, value] of gradeEntries) {
    if (value >= requiredValue) {
      requiredGrade = grade;
      break;
    }
  }

  const maxValue = Math.max(...Object.values(GRADE_VALUES));

  return {
    remainingCredits,
    requiredValue,
    requiredGrade,
    achievable: requiredValue <= maxValue,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRealGpa, computeOverallGpa, simulateGpa, requiredGradeForTarget, GRADE_VALUES };
} else if (typeof window !== "undefined") {
  window.MyGpa = window.MyGpa || {};
  Object.assign(window.MyGpa, {
    computeRealGpa,
    computeOverallGpa,
    simulateGpa,
    requiredGradeForTarget,
    GRADE_VALUES,
  });
}
