const { TemplateType } = require('./enums');

function sectionWeightsFor(type) {
  switch (type) {
    case TemplateType.EmployeeSelf:
    case TemplateType.ManagerSelf:
    case TemplateType.ManagerToEmployee:
    case TemplateType.DirectorGeneralToManager:
      return { tasks: 70, behaviors: 30 };
    case TemplateType.ProbationEmployeeSelf:
    case TemplateType.ManagerToProbationEmployee:
      return { tasks: 30, behaviors: 70 };
    case TemplateType.EmployeeToManager:
    case TemplateType.ManagerToManager:
    case TemplateType.EmployeeToEmployee:
    case TemplateType.ProbationEmployeeToManager:
      return { tasks: 0, behaviors: 100 };
    default:
      return { tasks: 0, behaviors: 100 };
  }
}

function normalizeScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('العلامة يجب أن تكون بين 0 و 100');
  return n;
}

function weightedAverage(items, scores, isTask) {
  const selected = items.filter(i => Boolean(i.isTask) === Boolean(isTask));
  const totalWeight = selected.reduce((sum, i) => sum + Number(i.weight || 0), 0);
  if (!selected.length || totalWeight <= 0) return 0;
  return selected.reduce((sum, i) => {
    const score = normalizeScore(scores[i.id] ?? 0);
    return sum + score * Number(i.weight || 0) / totalWeight;
  }, 0);
}

function calculateEvaluationScore(template, items, scores) {
  const taskScore = weightedAverage(items, scores, true);
  const behaviorScore = weightedAverage(items, scores, false);
  const tasksWeight = Number(template.tasksSectionWeight ?? sectionWeightsFor(template.type).tasks);
  const behaviorsWeight = Number(template.behaviorsSectionWeight ?? sectionWeightsFor(template.type).behaviors);
  const total = taskScore * tasksWeight / 100 + behaviorScore * behaviorsWeight / 100;
  return {
    tasksScore: round2(taskScore),
    behaviorsScore: round2(behaviorScore),
    totalScore: round2(total)
  };
}

function calculateFinalResult({ managerScore = null, selfScore = null, peerScores = [] }, settings = {}) {
  const managerWeight = Number(settings.finalManagerWeight ?? 70);
  const selfWeight = Number(settings.finalSelfWeight ?? 10);
  const peerWeight = Number(settings.finalPeerWeight ?? 20);
  const peerAverage = peerScores.length ? peerScores.reduce((a, b) => a + Number(b), 0) / peerScores.length : null;
  const parts = [];
  if (managerScore !== null) parts.push({ score: Number(managerScore), weight: managerWeight });
  if (selfScore !== null) parts.push({ score: Number(selfScore), weight: selfWeight });
  if (peerAverage !== null) parts.push({ score: Number(peerAverage), weight: peerWeight });
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return totalWeight ? round2(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight) : null;
}

function round2(n) { return Math.round(Number(n) * 100) / 100; }

module.exports = { sectionWeightsFor, calculateEvaluationScore, calculateFinalResult, normalizeScore, round2 };
