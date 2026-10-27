const ISSUE_LABELS = {
  knee_depth: 'Limited knee bend during chair pose',
  knee_asymmetry: 'Uneven bend between the knees',
  torso_lean: 'Torso leaning forward',
  deep_knee_bend: 'Very deep knee bend',
  front_knee_depth: 'Front knee stayed relatively straight',
  rear_leg_bend: 'Rear leg stayed bent',
  deep_front_knee_bend: 'Very deep front knee bend',
  arm_alignment: 'Arms below shoulder height',
  stance_width: 'Narrow Warrior II stance',
  balance_alignment: 'Shoulders or hips tilted during balance',
  plank_alignment: 'Body line changed during push-ups',
  deep_elbow_bend: 'Very deep elbow bend',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createSessionMetrics(exerciseId, exerciseName) {
  return {
    exerciseId,
    exerciseName,
    startedAt: Date.now(),
    lastSampleAt: null,
    sampleCount: 0,
    scoreTotal: 0,
    lowFormMs: 0,
    angleRanges: {},
    issueTotals: {},
    issueStreaks: {},
  };
}

export function recordSessionSample(session, evaluation, timestamp = Date.now()) {
  if (!session || !evaluation) return;
  const elapsed = session.lastSampleAt == null
    ? 0
    : clamp(timestamp - session.lastSampleAt, 0, 2000);
  session.lastSampleAt = timestamp;

  if (!evaluation.detected || !Number.isFinite(evaluation.score)) {
    for (const streak of Object.values(session.issueStreaks)) streak.currentMs = 0;
    return;
  }
  session.sampleCount += 1;
  session.scoreTotal += clamp(evaluation.score, 0, 1);
  if (evaluation.score < 0.45 && evaluation.phase && !['setup', 'standing'].includes(evaluation.phase)) {
    session.lowFormMs += elapsed;
  }

  for (const [key, rawValue] of Object.entries(evaluation.angles || {})) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    const range = session.angleRanges[key] || { min: value, max: value, samples: 0 };
    range.min = Math.min(range.min, value);
    range.max = Math.max(range.max, value);
    range.samples += 1;
    session.angleRanges[key] = range;
  }

  const activeIssues = new Set(evaluation.issueKeys || []);
  const issueKeys = new Set([
    ...Object.keys(session.issueStreaks),
    ...activeIssues,
  ]);
  for (const key of issueKeys) {
    const streak = session.issueStreaks[key] || { currentMs: 0, longestMs: 0 };
    if (activeIssues.has(key)) {
      const issue = session.issueTotals[key] || { count: 0, durationMs: 0 };
      issue.count += 1;
      issue.durationMs += elapsed;
      session.issueTotals[key] = issue;
      streak.currentMs += elapsed;
      streak.longestMs = Math.max(streak.longestMs, streak.currentMs);
    } else {
      streak.currentMs = 0;
    }
    session.issueStreaks[key] = streak;
  }
}

export function getSessionRisk(session) {
  if (!session) {
    return { level: 'low', label: 'No repeated form signal', message: 'No sustained form pattern detected.' };
  }
  const leadingIssue = Object.entries(session.issueTotals || {})
    .sort((first, second) => (second[1].durationMs || 0) - (first[1].durationMs || 0))[0];
  const longestIssueMs = Math.max(0, ...Object.values(session.issueStreaks || {}).map(issue => issue.currentMs || 0));
  const repeatedIssueMs = leadingIssue?.[1]?.durationMs || 0;
  const lowFormMs = session.lowFormMs || 0;

  if (longestIssueMs >= 7000 || repeatedIssueMs >= 12000 || lowFormMs >= 9000) {
    return {
      level: 'elevated',
      label: 'Elevated strain-risk warning',
      message: leadingIssue
        ? 'Repeated form issue persisted: ' + (ISSUE_LABELS[leadingIssue[0]] || leadingIssue[0].replaceAll('_', ' ')) + '. Pause, reset and use a smaller comfortable range.'
        : 'Form deviations are persisting. Pause, reset and use a smaller comfortable range.',
    };
  }
  if (longestIssueMs >= 3000 || repeatedIssueMs >= 5000 || lowFormMs >= 5000) {
    return {
      level: 'watch',
      label: 'Possible strain-risk warning',
      message: 'Form is drifting repeatedly. Slow down and reset your position.',
    };
  }
  return {
    level: 'low',
    label: 'No repeated form signal',
    message: 'No sustained form pattern detected.',
  };
}

export function buildSessionSummary(session, endedAt = Date.now()) {
  if (!session) return null;
  const risk = getSessionRisk(session);
  const angleRanges = Object.fromEntries(
    Object.entries(session.angleRanges || {})
      .filter(([, range]) => range.samples >= 4)
      .map(([key, range]) => [key, {
        min: Math.round(range.min * 10) / 10,
        max: Math.round(range.max * 10) / 10,
        samples: range.samples,
      }]),
  );
  const formIssues = Object.entries(session.issueTotals || {})
    .filter(([, issue]) => issue.count > 0)
    .map(([key, issue]) => ({
      key,
      label: ISSUE_LABELS[key] || key.replaceAll('_', ' '),
      observations: issue.count,
      durationSeconds: Math.round((issue.durationMs / 1000) * 10) / 10,
    }))
    .sort((first, second) => second.durationSeconds - first.durationSeconds);

  return {
    schemaVersion: 1,
    exerciseName: session.exerciseName,
    durationSeconds: Math.max(0, Math.round((endedAt - session.startedAt) / 1000)),
    validSamples: session.sampleCount,
    averageFormScore: session.sampleCount
      ? Math.round((session.scoreTotal / session.sampleCount) * 100) / 100
      : null,
    rangeOfMotion: angleRanges,
    formIssues,
    risk: {
      level: risk.level,
      label: risk.label,
      message: risk.message,
    },
  };
}

function getRange(summary, keys, bound = 'min') {
  const ranges = summary?.rangeOfMotion || {};
  const values = keys.map(key => ranges[key]?.[bound]).filter(Number.isFinite);
  return values.length ? Math[bound === 'max' ? 'max' : 'min'](...values) : null;
}

function degreeText(value) {
  return String(Math.round(value)) + '°';
}

export function getMobilityInsight(exerciseName, summary) {
  const name = (exerciseName || summary?.exerciseName || '').toLowerCase();
  if (!summary?.validSamples || summary.validSamples < 8) {
    return {
      title: 'More movement data needed',
      detail: 'Try another short session with your full body in frame for a clearer range-of-motion summary.',
      exercises: [],
    };
  }

  const deepestKnee = name.includes('lunge') || name.includes('warrior')
    ? getRange(summary, ['front_knee', 'left_knee', 'right_knee'])
    : getRange(summary, ['knee_average', 'front_knee', 'left_knee', 'right_knee']);
  if (name.includes('tree')) {
    return {
      title: 'Hip rotation and balance need separate attention',
      detail: 'A camera view cannot reliably separate hip mobility from balance in Tree Pose. Use support and stay within a comfortable range.',
      exercises: ['Supported figure-four stretch', 'Gentle hip circles'],
    };
  }
  if ((name.includes('squat') || name.includes('chair')) && Number.isFinite(deepestKnee)) {
    if (deepestKnee > 125) {
      return {
        title: 'Knee and ankle range may be limiting squat depth',
        detail: 'The deepest camera-observed knee bend was about ' + degreeText(deepestKnee) + '. Strength, balance and camera angle can also affect this reading.',
        exercises: ['Knee-to-wall ankle rocks', 'Supported squat holds', 'Gentle hip-flexor stretch'],
      };
    }
    if (deepestKnee > 108) {
      return {
        title: 'Build comfortable squat depth gradually',
        detail: 'The deepest camera-observed knee bend was about ' + degreeText(deepestKnee) + '. Keep the range pain-free and supported.',
        exercises: ['Knee-to-wall ankle rocks', 'Supported squat holds'],
      };
    }
    return {
      title: 'Comfortable squat range recorded',
      detail: 'Your session reached a camera-observed knee bend near ' + degreeText(deepestKnee) + '. Keep building control gradually.',
      exercises: ['Supported squat holds', 'Ankle rocks'],
    };
  }
  if ((name.includes('lunge') || name.includes('warrior')) && Number.isFinite(deepestKnee)) {
    if (deepestKnee > 125) {
      return {
        title: 'Ankle and hip range may need gradual work',
        detail: 'The deepest front-knee bend observed was about ' + degreeText(deepestKnee) + '. Camera angle and balance also affect this estimate.',
        exercises: ['Supported split-squat holds', 'Knee-to-wall ankle rocks', 'Half-kneeling hip-flexor stretch'],
      };
    }
    return {
      title: 'Comfortable lunge range recorded',
      detail: 'Your session reached a front-knee bend near ' + degreeText(deepestKnee) + '. Continue gradually and stay pain-free.',
      exercises: ['Supported split-squat holds', 'Gentle calf stretch'],
    };
  }
  if (name.includes('push')) {
    return {
      title: 'No clear flexibility estimate for this movement',
      detail: 'Push-up range is more affected by setup and strength than the camera can separate reliably.',
      exercises: ['Wall push-ups', 'Gentle chest-opening stretch'],
    };
  }

  return {
    title: 'No clear range-of-motion limitation found',
    detail: 'This session did not capture enough of a specific joint range to suggest a targeted mobility focus.',
    exercises: [],
  };
}

