const MIN_LANDMARK_VISIBILITY = 0.4;
const FALLBACK_ASPECT_RATIO = 16 / 9;
const REQUIRED_TORSO_LANDMARKS = [11, 12, 23, 24];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function visibleLandmark(landmarks, index) {
  const landmark = landmarks[index];
  if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return false;
  const visibility = Number.isFinite(landmark.visibility) ? landmark.visibility : 1;
  return visibility >= MIN_LANDMARK_VISIBILITY;
}

function point(landmarks, index, aspectRatio) {
  if (!visibleLandmark(landmarks, index)) return null;
  return { x: landmarks[index].x * aspectRatio, y: landmarks[index].y };
}

function center(first, second) {
  if (!first || !second) return null;
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function angle(a, b, c) {
  if (!a || !b || !c) return null;
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const norm = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y);
  if (!norm) return null;
  const cosine = clamp((ba.x * bc.x + ba.y * bc.y) / norm, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

function angleAt(landmarks, triplet, aspectRatio) {
  const [a, b, c] = triplet.map(index => point(landmarks, index, aspectRatio));
  return angle(a, b, c);
}

function mean(values) {
  const available = values.filter(Number.isFinite);
  return available.length ? available.reduce((total, value) => total + value, 0) / available.length : null;
}

function scoreAtTarget(value, target, tolerance) {
  if (!Number.isFinite(value)) return 0.5;
  const outsideTolerance = Math.max(0, Math.abs(value - target) - tolerance);
  return clamp(1 - outsideTolerance / Math.max(tolerance * 2, 1));
}

function getMeasurements(landmarks, aspectRatio) {
  const leftKnee = angleAt(landmarks, [23, 25, 27], aspectRatio);
  const rightKnee = angleAt(landmarks, [24, 26, 28], aspectRatio);
  const leftElbow = angleAt(landmarks, [11, 13, 15], aspectRatio);
  const rightElbow = angleAt(landmarks, [12, 14, 16], aspectRatio);

  const leftHip = point(landmarks, 23, aspectRatio);
  const rightHip = point(landmarks, 24, aspectRatio);
  const leftShoulder = point(landmarks, 11, aspectRatio);
  const rightShoulder = point(landmarks, 12, aspectRatio);
  const leftAnkle = point(landmarks, 27, aspectRatio);
  const rightAnkle = point(landmarks, 28, aspectRatio);
  const shoulders = center(leftShoulder, rightShoulder);
  const hips = center(leftHip, rightHip);
  const ankles = center(leftAnkle, rightAnkle);

  const torsoTilt = shoulders && hips
    ? (Math.atan2(Math.abs(hips.x - shoulders.x), Math.abs(hips.y - shoulders.y)) * 180) / Math.PI
    : null;
  const shoulderSpan = leftShoulder && rightShoulder ? Math.abs(leftShoulder.x - rightShoulder.x) : null;
  const hipSpan = leftHip && rightHip ? Math.abs(leftHip.x - rightHip.x) : null;
  const armOffsets = [
    point(landmarks, 15, aspectRatio) && leftShoulder
      ? Math.abs(point(landmarks, 15, aspectRatio).y - leftShoulder.y)
      : null,
    point(landmarks, 16, aspectRatio) && rightShoulder
      ? Math.abs(point(landmarks, 16, aspectRatio).y - rightShoulder.y)
      : null,
  ].filter(Number.isFinite);
  const armLevelError = shoulders && shoulderSpan && armOffsets.length
    ? mean(armOffsets) / Math.max(shoulderSpan, 0.05)
    : null;

  const leftShoulderFlexion = angleAt(landmarks, [23, 11, 15], aspectRatio);
  const rightShoulderFlexion = angleAt(landmarks, [24, 12, 16], aspectRatio);
  const plankLine = angle(shoulders, hips, ankles);
  const raisedAnkleDiff = leftAnkle && rightAnkle ? Math.abs(leftAnkle.y - rightAnkle.y) : null;

  const angles = {};
  const entries = {
    left_knee: leftKnee,
    right_knee: rightKnee,
    knee_average: mean([leftKnee, rightKnee]),
    front_knee: leftKnee != null && rightKnee != null ? Math.min(leftKnee, rightKnee) : (leftKnee ?? rightKnee),
    back_knee: leftKnee != null && rightKnee != null ? Math.max(leftKnee, rightKnee) : null,
    left_elbow: leftElbow,
    right_elbow: rightElbow,
    elbow_average: mean([leftElbow, rightElbow]),
    torso_tilt: torsoTilt,
    shoulder_flexion_left: leftShoulderFlexion,
    shoulder_flexion_right: rightShoulderFlexion,
    plank_line: plankLine,
  };
  Object.entries(entries).forEach(([key, value]) => {
    if (Number.isFinite(value)) angles[key] = Math.round(value * 10) / 10;
  });

  const measuredLandmarks = new Set(REQUIRED_TORSO_LANDMARKS);
  if (Number.isFinite(leftKnee)) [23, 25, 27].forEach(index => measuredLandmarks.add(index));
  if (Number.isFinite(rightKnee)) [24, 26, 28].forEach(index => measuredLandmarks.add(index));
  if (Number.isFinite(leftElbow)) [11, 13, 15].forEach(index => measuredLandmarks.add(index));
  if (Number.isFinite(rightElbow)) [12, 14, 16].forEach(index => measuredLandmarks.add(index));
  const confidence = mean([...measuredLandmarks]
    .filter(index => visibleLandmark(landmarks, index))
    .map(index => landmarks[index].visibility ?? 1)) ?? 0;

  return {
    angles,
    leftKnee,
    rightKnee,
    kneeAverage: mean([leftKnee, rightKnee]),
    leftElbow,
    rightElbow,
    elbowAverage: mean([leftElbow, rightElbow]),
    torsoTilt,
    shoulderTilt: leftShoulder && rightShoulder
      ? (Math.atan2(Math.abs(leftShoulder.y - rightShoulder.y), Math.abs(leftShoulder.x - rightShoulder.x) || 0.001) * 180) / Math.PI
      : null,
    hipTilt: leftHip && rightHip
      ? (Math.atan2(Math.abs(leftHip.y - rightHip.y), Math.abs(leftHip.x - rightHip.x) || 0.001) * 180) / Math.PI
      : null,
    shoulderSpan,
    hipSpan,
    armLevelError,
    leftShoulderFlexion,
    rightShoulderFlexion,
    plankLine,
    raisedAnkleDiff,
    leftAnkle,
    rightAnkle,
    confidence,
    hasTorso: REQUIRED_TORSO_LANDMARKS.every(index => visibleLandmark(landmarks, index)),
  };
}

function result(exercise, metrics, details) {
  return {
    detected: true,
    exercise,
    confidence: clamp(metrics.confidence),
    stage: details.stage,
    totalStages: details.totalStages,
    progress: clamp(details.progress),
    score: clamp(details.score),
    phase: details.phase,
    angles: metrics.angles,
    issueKeys: details.issueKeys,
    suggestions: details.suggestions.length ? details.suggestions : ['Good control. Keep moving within a comfortable range.'],
  };
}

function noPose(suggestion, confidence = 0) {
  return {
    detected: false,
    exercise: '',
    confidence,
    stage: 0,
    totalStages: 1,
    progress: 0,
    score: 0,
    phase: 'unavailable',
    angles: {},
    issueKeys: [],
    suggestions: [suggestion],
  };
}

export function evaluatePose(exerciseName, landmarks = [], options = {}) {
  const name = (exerciseName || '').toLowerCase();
  const aspectRatio = Number.isFinite(options.aspectRatio) && options.aspectRatio > 0
    ? options.aspectRatio
    : FALLBACK_ASPECT_RATIO;

  if (!name) return noPose('Choose an exercise to start live coaching.');
  if (!Array.isArray(landmarks) || landmarks.length < 33) {
    return noPose('No full body pose detected. Step back until your head, hips, knees and feet are in frame.');
  }

  const metrics = getMeasurements(landmarks, aspectRatio);
  if (!metrics.hasTorso) {
    return noPose('Move into clear light and keep both shoulders and hips visible.', metrics.confidence);
  }

  if (name.includes('tree')) return evaluateTree(landmarks, metrics, aspectRatio);
  if (name.includes('warrior')) return evaluateWarrior(landmarks, metrics, aspectRatio);
  if (name.includes('lunge')) return evaluateLunge(metrics);
  if (name.includes('squat') || name.includes('chair')) return evaluateSquat(metrics, name.includes('chair'));
  if (name.includes('push')) return evaluatePushup(metrics);

  return noPose('Live coaching is not configured for this exercise yet.', metrics.confidence);
}

function evaluateSquat(metrics, isChair) {
  const { kneeAverage, leftKnee, rightKnee, torsoTilt } = metrics;
  if (!Number.isFinite(kneeAverage)) {
    return noPose('Turn slightly sideways and keep your hips, knees and ankles visible.', metrics.confidence);
  }

  const kneeDifference = Number.isFinite(leftKnee) && Number.isFinite(rightKnee) ? Math.abs(leftKnee - rightKnee) : 0;
  const standing = kneeAverage > 155;
  const bottom = kneeAverage <= 115;
  const phase = standing ? 'standing' : bottom ? 'depth' : 'lowering';
  const stage = standing ? 1 : bottom ? 3 : 2;
  const depthScore = standing ? 1 : scoreAtTarget(kneeAverage, isChair ? 100 : 95, 22);
  const symmetryScore = Number.isFinite(leftKnee) && Number.isFinite(rightKnee)
    ? scoreAtTarget(kneeDifference, 0, 18)
    : 0.72;
  const torsoScore = scoreAtTarget(torsoTilt, 10, 22);
  const score = isChair
    ? depthScore * 0.7 + torsoScore * 0.3
    : depthScore * 0.6 + symmetryScore * 0.25 + torsoScore * 0.15;

  const issueKeys = [];
  const suggestions = [];
  if (isChair && kneeAverage > 125) {
    issueKeys.push('knee_depth');
    suggestions.push('Bend your knees and sit your hips back to a comfortable chair-pose depth.');
  } else if (!standing && !bottom && kneeAverage > 125) {
    suggestions.push('Lower your hips gradually while keeping your balance.');
  }
  if (kneeDifference > 28) {
    issueKeys.push('knee_asymmetry');
    suggestions.push('Even out the bend between your left and right knees.');
  }
  if (torsoTilt > 40) {
    issueKeys.push('torso_lean');
    suggestions.push('Keep your chest lifted and your back comfortable.');
  }
  if (kneeAverage < 65) {
    issueKeys.push('deep_knee_bend');
    suggestions.push('Ease out of the deep bend and choose a comfortable depth.');
  }
  if (!isChair && standing && !issueKeys.length) {
    suggestions.push('Start by sending your hips back and bending your knees.');
  }
  if (!suggestions.length) suggestions.push('Good control. Keep your knees tracking over your feet.');

  return result(isChair ? 'chair' : 'squat', metrics, {
    stage,
    totalStages: 3,
    progress: stage / 3,
    score,
    phase,
    issueKeys,
    suggestions,
  });
}

function evaluateLunge(metrics) {
  const { leftKnee, rightKnee, torsoTilt } = metrics;
  const frontKnee = metrics.angles.front_knee;
  const backKnee = metrics.angles.back_knee;
  if (!Number.isFinite(frontKnee) || !Number.isFinite(backKnee)) {
    return noPose('Turn slightly sideways so the camera can see both knees and ankles.', metrics.confidence);
  }

  const standing = frontKnee > 150;
  const stage = standing ? 1 : frontKnee <= 105 && backKnee >= 140 ? 3 : 2;
  const frontScore = scoreAtTarget(frontKnee, 100, 25);
  const backScore = scoreAtTarget(backKnee, 160, 25);
  const torsoScore = scoreAtTarget(torsoTilt, 8, 22);
  const symmetryScore = Number.isFinite(leftKnee) && Number.isFinite(rightKnee) ? 1 : 0.75;
  const score = frontScore * 0.55 + backScore * 0.25 + torsoScore * 0.15 + symmetryScore * 0.05;
  const issueKeys = [];
  const suggestions = [];

  if (standing) suggestions.push('Step into a lunge, then lower only as far as you can stay balanced.');
  if (!standing && frontKnee > 125) {
    issueKeys.push('front_knee_depth');
    suggestions.push('Bend the front knee a little more while keeping the front foot planted.');
  }
  if (backKnee < 135) {
    issueKeys.push('rear_leg_bend');
    suggestions.push('Lengthen the stance and keep the rear leg comfortably extended.');
  }
  if (frontKnee < 65) {
    issueKeys.push('deep_front_knee_bend');
    suggestions.push('Reduce the depth and keep the front knee comfortable.');
  }
  if (torsoTilt > 35) {
    issueKeys.push('torso_lean');
    suggestions.push('Bring your torso back over your hips.');
  }
  if (!suggestions.length) suggestions.push('Good lunge alignment. Keep your front knee steady over your foot.');

  return result('lunge', metrics, {
    stage,
    totalStages: 3,
    progress: stage / 3,
    score,
    phase: standing ? 'setup' : stage === 3 ? 'depth' : 'lowering',
    issueKeys,
    suggestions,
  });
}

function evaluateWarrior(landmarks, metrics, aspectRatio) {
  const frontKnee = metrics.angles.front_knee;
  const backKnee = metrics.angles.back_knee;
  if (!Number.isFinite(frontKnee) || !Number.isFinite(backKnee)) {
    return noPose('Face the camera and keep both knees and ankles visible.', metrics.confidence);
  }

  const wrists = [point(landmarks, 15, aspectRatio), point(landmarks, 16, aspectRatio)];
  const shoulders = [point(landmarks, 11, aspectRatio), point(landmarks, 12, aspectRatio)];
  const elbows = [metrics.leftElbow, metrics.rightElbow].filter(Number.isFinite);
  const armOffsets = wrists.map((wrist, index) => (
    wrist && shoulders[index] ? Math.abs(wrist.y - shoulders[index].y) : null
  )).filter(Number.isFinite);
  const armError = metrics.shoulderSpan && armOffsets.length
    ? mean(armOffsets) / metrics.shoulderSpan
    : null;
  const frontScore = scoreAtTarget(frontKnee, 100, 28);
  const backScore = scoreAtTarget(backKnee, 165, 24);
  const armsScore = (armError == null ? 0.35 : scoreAtTarget(armError, 0, 0.2))
    * (elbows.length ? scoreAtTarget(mean(elbows), 175, 25) : 0.75);
  const torsoScore = scoreAtTarget(metrics.torsoTilt, 8, 20);
  const score = frontScore * 0.45 + backScore * 0.25 + armsScore * 0.2 + torsoScore * 0.1;
  const issueKeys = [];
  const suggestions = [];
  const ankleDistance = metrics.leftAnkle && metrics.rightAnkle
    ? Math.abs(metrics.leftAnkle.x - metrics.rightAnkle.x)
    : 0;

  if (frontKnee > 130) {
    issueKeys.push('front_knee_depth');
    suggestions.push('Bend the front knee while keeping the back leg long.');
  }
  if (backKnee < 140) {
    issueKeys.push('rear_leg_bend');
    suggestions.push('Press through the back foot and lengthen the rear leg.');
  }
  if (armError == null || armError > 0.28) {
    issueKeys.push('arm_alignment');
    suggestions.push('Reach both arms out at shoulder height.');
  }
  if (metrics.shoulderSpan && ankleDistance < metrics.shoulderSpan * 1.25) {
    issueKeys.push('stance_width');
    suggestions.push('Widen your stance so both feet are clearly separated.');
  }
  if (metrics.torsoTilt > 30) {
    issueKeys.push('torso_lean');
    suggestions.push('Stack your shoulders over your hips.');
  }
  if (!suggestions.length) suggestions.push('Strong Warrior II shape. Keep your shoulders relaxed.');

  return result('warrior', metrics, {
    stage: frontKnee > 150 ? 1 : frontKnee <= 110 && backKnee >= 145 ? 3 : 2,
    totalStages: 3,
    progress: frontKnee > 150 ? 1 / 3 : frontKnee <= 110 && backKnee >= 145 ? 1 : 2 / 3,
    score,
    phase: frontKnee > 150 ? 'setup' : 'hold',
    issueKeys: frontKnee > 150 ? [] : [...new Set(issueKeys)],
    suggestions,
  });
}

function evaluateTree(landmarks, metrics, aspectRatio) {
  const leftWrist = point(landmarks, 15, aspectRatio);
  const rightWrist = point(landmarks, 16, aspectRatio);
  const nose = point(landmarks, 0, aspectRatio);
  const wristsClose = leftWrist && rightWrist && Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y) < 0.16;
  const handsOverhead = wristsClose && nose && leftWrist.y < nose.y - 0.015 && rightWrist.y < nose.y - 0.015;
  const raisedLegAngle = metrics.angles.front_knee;
  const legRaised = Number.isFinite(metrics.raisedAnkleDiff)
    && metrics.raisedAnkleDiff > 0.13
    && Number.isFinite(raisedLegAngle)
    && raisedLegAngle < 135;
  const uprightScore = (
    scoreAtTarget(metrics.shoulderTilt, 0, 12) + scoreAtTarget(metrics.hipTilt, 0, 12)
  ) / 2;
  const armReachScore = handsOverhead ? 1 : 0.3;
  const balanceScore = legRaised ? scoreAtTarget(raisedLegAngle, 90, 35) : 0.25;
  const score = uprightScore * 0.25 + armReachScore * 0.25 + balanceScore * 0.5;
  const issueKeys = [];
  const suggestions = [];

  if (legRaised && (metrics.shoulderTilt > 18 || metrics.hipTilt > 18)) {
    issueKeys.push('balance_alignment');
    suggestions.push('Level your shoulders and hips, and keep your standing foot grounded.');
  }
  if (!handsOverhead) suggestions.push('Bring your hands together overhead, or rest them at your chest.');
  if (!legRaised) suggestions.push('Lift one foot to your inner calf or thigh; avoid pressing on the knee.');
  if (!suggestions.length) suggestions.push('Steady balance. Keep breathing and soften the standing knee.');

  return result('tree', metrics, {
    stage: legRaised ? 3 : handsOverhead ? 2 : 1,
    totalStages: 3,
    progress: (legRaised ? 1 : handsOverhead ? 2 : 1) / 3,
    score,
    phase: legRaised ? 'hold' : 'setup',
    issueKeys,
    suggestions,
  });
}

function evaluatePushup(metrics) {
  const elbow = metrics.elbowAverage;
  if (!Number.isFinite(elbow) || !Number.isFinite(metrics.plankLine)) {
    return noPose('Turn sideways and keep one shoulder, elbow, wrist, hip and ankle visible.', metrics.confidence);
  }

  const atTop = elbow >= 150;
  const atBottom = elbow <= 115;
  const phase = atTop ? 'top' : atBottom ? 'bottom' : 'lowering';
  const stage = atTop ? 1 : atBottom ? 3 : 2;
  const elbowScore = atTop ? 1 : scoreAtTarget(elbow, 100, 24);
  const bodyLineScore = scoreAtTarget(metrics.plankLine, 180, 18);
  const score = elbowScore * 0.55 + bodyLineScore * 0.45;
  const issueKeys = [];
  const suggestions = [];

  if (!atTop && !atBottom && elbow > 125) {
    suggestions.push('Lower your chest gradually while keeping your body in one line.');
  }
  if (Math.abs(180 - metrics.plankLine) > 25) {
    issueKeys.push('plank_alignment');
    suggestions.push('Keep your head, hips and heels in one line.');
  }
  if (elbow < 65) {
    issueKeys.push('deep_elbow_bend');
    suggestions.push('Reduce the depth and keep the movement comfortable.');
  }
  if (!suggestions.length) {
    suggestions.push(atTop
      ? 'Start from a steady plank; keep your hips in line with your shoulders.'
      : 'Good push-up alignment. Keep your elbows controlled.');
  }

  return result('pushup', metrics, {
    stage,
    totalStages: 3,
    progress: stage / 3,
    score,
    phase,
    issueKeys,
    suggestions,
  });
}

