import { PARITY_DIMENSION_IDS, validateParityReport } from './schema.js';

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

export function scoreTaskDimensions(dimensions = {}) {
  const total = PARITY_DIMENSION_IDS.reduce((sum, id) => sum + Number(dimensions[id] || 0), 0);
  return round((total / (PARITY_DIMENSION_IDS.length * 5)) * 100);
}

export function scoreCategory(categoryId, manifest, taskResults = []) {
  const category = manifest.categoryWeights.find(item => item.id === categoryId);
  const relevantTasks = taskResults.filter(task => task.categoryTargets.includes(categoryId));
  const rawScore = relevantTasks.length > 0
    ? round(relevantTasks.reduce((sum, task) => sum + task.scorePct, 0) / relevantTasks.length)
    : 0;
  const weightedScore = round((rawScore * Number(category?.weight || 0)) / 100);
  const thresholds = manifest.thresholds;
  const status = rawScore >= thresholds.criticalCategoryFloor
    ? 'meets'
    : rawScore >= thresholds.nearCategoryFloor
    ? 'near'
    : 'below';

  return {
    id: category?.id || categoryId,
    label: category?.label || categoryId,
    weight: Number(category?.weight || 0),
    rawScore,
    weightedScore,
    status,
    taskIds: relevantTasks.map(task => task.taskId),
  };
}

export function evaluateLiveBaselines(manifest, taskResults = []) {
  const adapterIds = new Set();
  for (const task of taskResults) {
    for (const adapterId of Object.keys(task.baselines || {})) adapterIds.add(adapterId);
  }

  return [...adapterIds].sort().map((adapterId) => {
    const shared = taskResults.filter(task => task.baselines?.[adapterId]?.status === 'completed' && typeof task.baselines?.[adapterId]?.scorePct === 'number');
    if (shared.length === 0) {
      const any = taskResults.find(task => task.baselines?.[adapterId]);
      const status = any?.baselines?.[adapterId]?.status || 'not_applicable';
      const summary = status === 'disabled'
        ? `${adapterId} baseline adapter is disabled.`
        : status === 'failed'
        ? `${adapterId} baseline adapter failed before scoring shared tasks.`
        : `${adapterId} baseline was not evaluated on any shared tasks.`;
      return {
        adapterId,
        status,
        deltaPct: null,
        thresholdPct: manifest.thresholds.liveBaselineDeltaPct,
        sharedTaskCount: 0,
        summary,
      };
    }

    const deltaPct = round(shared.reduce((sum, task) => {
      const baselineScore = Number(task.baselines[adapterId].scorePct || 0);
      return sum + Math.abs(task.scorePct - baselineScore);
    }, 0) / shared.length);
    const within = deltaPct <= manifest.thresholds.liveBaselineDeltaPct;

    return {
      adapterId,
      status: 'completed',
      deltaPct,
      thresholdPct: manifest.thresholds.liveBaselineDeltaPct,
      sharedTaskCount: shared.length,
      summary: within
        ? `${adapterId} stayed within the ${manifest.thresholds.liveBaselineDeltaPct}% parity delta across ${shared.length} shared task(s).`
        : `${adapterId} drifted ${deltaPct}% across ${shared.length} shared task(s), above the ${manifest.thresholds.liveBaselineDeltaPct}% threshold.`,
    };
  });
}

export function classifyParityStatus(manifest, overallScore, categoryScores = [], criticalFailures = [], liveBaselines = []) {
  const meetsCategories = categoryScores.every(category => category.rawScore >= manifest.thresholds.criticalCategoryFloor);
  const nearCategories = categoryScores.every(category => category.rawScore >= manifest.thresholds.nearCategoryFloor);
  const liveComparisons = liveBaselines.filter(item => item.status === 'completed');
  const meetsLiveDelta = liveComparisons.every(item => Number(item.deltaPct || 0) <= manifest.thresholds.liveBaselineDeltaPct);

  if (criticalFailures.length === 0
    && overallScore >= manifest.thresholds.overallScoreToMeetParity
    && meetsCategories
    && meetsLiveDelta) {
    return 'meets parity';
  }

  if (criticalFailures.length === 0
    && overallScore >= manifest.thresholds.overallScoreForNearParity
    && nearCategories) {
    return 'near parity';
  }

  return 'below parity';
}

export function buildParitySummary({ report, manifest }) {
  const criticalLine = report.criticalFailures.length > 0
    ? `${report.criticalFailures.length} critical failure(s) triggered automatic parity downgrade.`
    : 'No automatic critical failure rules were triggered.';
  const categoryLine = report.categoryScores
    .map(category => `${category.label}: ${category.rawScore}% (${category.status})`)
    .join(' | ');
  const liveLine = report.liveBaselines.length > 0
    ? report.liveBaselines.map(item => `${item.adapterId}: ${item.summary}`).join(' | ')
    : 'No live baseline adapters were evaluated.';

  return [
    `${manifest.title}`,
    '',
    `Run mode: ${report.runMode}`,
    `Status: ${report.status}`,
    `Overall score: ${report.overallScore}%`,
    criticalLine,
    categoryLine,
    liveLine,
  ].join('\n');
}

export function buildParityReport({ manifest, runId, runMode = 'full', startedAt, completedAt, generatedAt, taskResults, artifactPaths }) {
  const normalizedTaskResults = taskResults.map(task => ({
    ...task,
    scorePct: typeof task.scorePct === 'number' ? round(task.scorePct) : scoreTaskDimensions(task.dimensions),
  }));

  const categoryScores = manifest.categoryWeights.map(category => scoreCategory(category.id, manifest, normalizedTaskResults));
  const overallScore = round(categoryScores.reduce((sum, category) => sum + category.weightedScore, 0));
  const criticalFailures = normalizedTaskResults.flatMap(task => task.criticalFailures || []);
  const liveBaselines = evaluateLiveBaselines(manifest, normalizedTaskResults);
  const status = classifyParityStatus(manifest, overallScore, categoryScores, criticalFailures, liveBaselines);
  const draftReport = {
    schemaVersion: manifest.schemaVersion,
    suiteId: manifest.suiteId,
    runId,
    runMode,
    title: manifest.title,
    generatedAt,
    startedAt,
    completedAt,
    thresholds: manifest.thresholds,
    overallScore,
    status,
    criticalFailures,
    categoryScores,
    taskResults: normalizedTaskResults,
    liveBaselines,
    summary: '',
    artifactPaths,
  };

  draftReport.summary = buildParitySummary({ report: draftReport, manifest });
  return validateParityReport(draftReport);
}
