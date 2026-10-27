import { useCallback, useEffect, useRef, useState } from 'react';
import { createLog, fetchExercises, getTtsStatus } from '../services/api';
import CanvasOverlay from '../components/CanvasOverlay';
import { evaluatePose } from '../utils/poseStages';
import {
  buildSessionSummary,
  createSessionMetrics,
  getSessionRisk,
  recordSessionSample,
} from '../utils/sessionMetrics';
import {
  findSpeechVoice,
  getLanguageOption,
  LANGUAGE_OPTIONS,
  translateCoachText,
} from '../utils/language';
import { cancelCoachSpeech, getInstalledSpeechVoices, isCoachSpeechActive, speakCoachText, unlockCoachAudio } from '../utils/speech';

const POSE_INTERVAL_MS = 100;
const MODEL_WASM_VERSION = '0.10.22-rc.20250304';
const SMOOTH_ALPHA = 0.35;
const FULL_BODY_LANDMARKS = [0, 11, 12, 23, 24, 25, 26, 27, 28];
const EXERCISE_REFERENCES = {
  warrior: 'https://tse2.mm.bing.net/th/id/OIP.UME09AOxLsE6SNsBMT05cgHaEK?pid=Api&P=0&h=180',
  tree: 'https://bod-blog-assets.prod.cd.beachbodyondemand.com/bod-blog/wp-content/uploads/2024/04/30135217/tree-pose-960.png',
  chair: 'https://i.pinimg.com/originals/96/9d/bf/969dbfeedc6dc79234bf56acacf59650.jpg',
  squat: 'https://musculation-nutrition.fr/wp-content/uploads/2021/04/position-squat.jpeg',
  lunge: 'https://beyogi.com/wp-content/uploads/2015/03/Low-Lunge-Pose-Anjaneyasana.png',
  pushup: 'https://as2.ftcdn.net/v2/jpg/01/11/89/51/1000_F_111895122_s77Gn99UZqsc3XPwjJDVC8VhnE61id5R.jpg',
};

function hasFullBodyPose(landmarks) {
  return Array.isArray(landmarks)
    && landmarks.length >= 33
    && FULL_BODY_LANDMARKS.every(index => {
      const landmark = landmarks[index];
      const visibility = landmark?.visibility ?? landmark?.presence ?? 0;
      return Number.isFinite(landmark?.x)
        && Number.isFinite(landmark?.y)
        && landmark.x >= 0 && landmark.x <= 1
        && landmark.y >= 0 && landmark.y <= 1
        && visibility >= (index === 0 ? 0.35 : 0.45);
    });
}

function hasStartedExercisePose(exerciseName, evaluation) {
  if (!evaluation?.detected) return false;
  const name = (exerciseName || '').toLowerCase();
  if (name.includes('squat') || name.includes('chair') || name.includes('lunge')) {
    return ['lowering', 'depth'].includes(evaluation.phase);
  }
  if (name.includes('warrior') || name.includes('tree')) return evaluation.phase === 'hold';
  if (name.includes('push')) return ['top', 'bottom', 'lowering'].includes(evaluation.phase);
  return false;
}

export default function ExercisesPage({ language = 'en', onLanguageChange = () => {}, voiceStyle = 'female', onVoiceStyleChange = () => {} }) {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [running, setRunning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [modelStatus, setModelStatus] = useState('Choose an exercise, then start your camera.');
  const [exercises, setExercises] = useState([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState(getInstalledSpeechVoices);
  const [ttsConfigured, setTtsConfigured] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [risk, setRisk] = useState(getSessionRisk(null));

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastPoseRef = useRef(0);
  const landmarkerRef = useRef(null);
  const sessionRef = useRef(null);
  const startInProgressRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const cameraStartVersionRef = useRef(0);
  const lastSpokenRef = useRef({ text: '', timestamp: 0 });
  const smoothedScoreRef = useRef(null);
  const speechGateRef = useRef(false);
  const posingFramesRef = useRef(0);
  const latestCueRef = useRef('');

  voiceEnabledRef.current = voiceEnabled;

  const SpeechUtterance = typeof window !== 'undefined'
    ? window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance
    : null;
  const speechSupported = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechUtterance === 'function';
  const selectedVoice = findSpeechVoice(availableVoices, language);
  const browserDefaultIsEnglish = language === 'en'
    && speechSupported
    && availableVoices.length === 0
    && typeof navigator !== 'undefined'
    && navigator.language?.toLowerCase().startsWith('en');
  const localVoiceAvailable = Boolean(selectedVoice) || browserDefaultIsEnglish;
  const voiceAvailable = ttsConfigured || localVoiceAvailable;
  const voiceAvailabilityMessage = ttsConfigured
    ? language === 'bho'
      ? 'Natural coaching speech is ready. Bhojpuri uses the Hindi speech model as a fallback.'
      : `Natural ${getLanguageOption(language).label.split(' (')[0]} speech is ready.`
    : localVoiceAvailable
      ? 'Using an installed device voice. Configure a server voice provider for consistent language support.'
      : `No ${getLanguageOption(language).label.split(' (')[0]} voice is installed on this device. Configure a server voice provider to enable it.`;

  useEffect(() => {
    if (!speechSupported) return undefined;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      const voices = getInstalledSpeechVoices();
      if (!voices.length) return;
      const signature = voices.map(voice => [voice.name, voice.lang, voice.default].join(':')).join('|');
      setAvailableVoices(current => (
        current.map(voice => [voice.name, voice.lang, voice.default].join(':')).join('|') === signature
          ? current
          : voices
      ));
    };
    refreshVoices();
    const retryTimers = [250, 1000].map(delay => window.setTimeout(refreshVoices, delay));
    const supportsVoiceEvents = typeof synthesis.addEventListener === 'function';
    if (supportsVoiceEvents) synthesis.addEventListener('voiceschanged', refreshVoices);
    else synthesis.onvoiceschanged = refreshVoices;
    return () => {
      retryTimers.forEach(timer => window.clearTimeout(timer));
      if (supportsVoiceEvents) synthesis.removeEventListener('voiceschanged', refreshVoices);
      else if (synthesis.onvoiceschanged === refreshVoices) synthesis.onvoiceschanged = null;
    };
  }, [speechSupported]);

  useEffect(() => {
    let active = true;
    getTtsStatus()
      .then(status => {
        if (active) setTtsConfigured(Boolean(
          status?.configured && (status?.provider === 'Sarvam Bulbul v3' || status?.reachable),
        ));
      })
      .catch(() => { if (active) setTtsConfigured(false); });
    return () => { active = false; };
  }, []);

  const speakCoach = useCallback((text, force = false) => {
    if (!speechGateRef.current || !voiceEnabledRef.current || !text) return;
    const spokenText = translateCoachText(text, language);
    if (!spokenText) return;
    const now = Date.now();
    const previous = lastSpokenRef.current;
    if (!force && now - previous.timestamp < 4200) return;
    if (!force && previous.text === spokenText && now - previous.timestamp < 12000) return;
    if (isCoachSpeechActive()) return;
    lastSpokenRef.current = { text: spokenText, timestamp: now };
    speakCoachText(spokenText, { language, voiceStyle, ttsConfigured, voices: availableVoices })
      .then(result => setSpeechMessage(result?.message || ''))
      .catch(error => setSpeechMessage(error?.message || 'Voice feedback could not be played.'));
  }, [language, voiceStyle, ttsConfigured, availableVoices]);

  const updateSpeechGate = useCallback((active, cue = '') => {
    const wasActive = speechGateRef.current;
    if (!active) {
      speechGateRef.current = false;
      posingFramesRef.current = 0;
      latestCueRef.current = '';
      if (wasActive) cancelCoachSpeech();
      return;
    }

    speechGateRef.current = true;
    if (cue) latestCueRef.current = cue;
    if (cue) speakCoach(cue, !wasActive);
  }, [speakCoach]);

  useEffect(() => {
    fetchExercises().then(setExercises).catch(() => setExercises([]));
  }, []);

  useEffect(() => {
    setAnalysis(null);
    setRisk(getSessionRisk(null));
    smoothedScoreRef.current = null;
    updateSpeechGate(false);
  }, [selectedExerciseId, updateSpeechGate]);

  const previousLanguageRef = useRef(language);
  useEffect(() => {
    const changed = previousLanguageRef.current !== language;
    previousLanguageRef.current = language;
    if (!changed) return;
    lastSpokenRef.current = { text: '', timestamp: 0 };
    cancelCoachSpeech();
  }, [language]);

  function finishSession() {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session || session.sampleCount < 8) return null;

    const summary = buildSessionSummary(session);
    const token = localStorage.getItem('auth_token');
    if (!token || !summary) return Promise.resolve(false);

    return createLog(token, {
      exercise_id: session.exerciseId,
      score: summary.averageFormScore ?? 0,
      suggestions: summary.formIssues.map(issue => issue.label).slice(0, 5),
      landmarks: summary,
    }).then(() => true).catch(() => false);
  }

  function updateRisk(nextRisk) {
    setRisk(previous => previous.level === nextRisk.level ? previous : nextRisk);
  }

  function stopCamera() {
    cameraStartVersionRef.current += 1;
    startInProgressRef.current = false;
    updateSpeechGate(false);
    const savePromise = finishSession();
    cancelCoachSpeech();
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close(); } catch { /* The tracker may already be closed. */ }
      landmarkerRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    if (savePromise) {
      setModelStatus('Saving your movement summary...');
      savePromise.then(saved => {
        if (streamRef.current) return;
        setModelStatus(saved
          ? 'Session summary saved to Profile history.'
          : 'Session ended, but the summary could not be saved. Check the server connection.');
      });
    } else {
      setModelStatus('Session stopped. Keep your full body visible for a movement summary next time.');
    }
  }

  useEffect(() => () => {
    cameraStartVersionRef.current += 1;
    speechGateRef.current = false;
    cancelCoachSpeech();
    finishSession();
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close(); } catch { /* The tracker may already be closed. */ }
    }
    cancelAnimationFrame(rafRef.current);
  }, []);

  async function startCamera() {
    unlockCoachAudio();
    if (running || startInProgressRef.current) return;
    if (!selectedExerciseId) {
      setCameraError('Choose an exercise before starting your session.');
      return;
    }

    const startVersion = cameraStartVersionRef.current + 1;
    cameraStartVersionRef.current = startVersion;
    startInProgressRef.current = true;
    try {
      setCameraError('');
      setModelStatus('Starting camera and loading the on-device pose model...');
      updateSpeechGate(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is unavailable in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      if (startVersion !== cameraStartVersionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        return;
      }

      video.srcObject = stream;
      await video.play();
      if (startVersion !== cameraStartVersionRef.current) return;

      try {
        const vision = await import('@mediapipe/tasks-vision');
        const { FilesetResolver, PoseLandmarker } = vision;
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MODEL_WASM_VERSION + '/wasm',
        );
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/pose_landmarker_full.task' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.65,
          minPosePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (startVersion !== cameraStartVersionRef.current) {
          try { landmarker.close(); } catch { /* The tracker may already be closed. */ }
          return;
        }
        landmarkerRef.current = landmarker;
      } catch {
        if (startVersion !== cameraStartVersionRef.current) return;
        throw new Error('The on-device pose model could not load. Check your connection and try again.');
      }

      const exercise = exercises.find(item => String(item.id) === String(selectedExerciseId));
      sessionRef.current = createSessionMetrics(
        /^\d+$/.test(selectedExerciseId) ? Number(selectedExerciseId) : null,
        exercise?.name || 'Exercise',
      );
      lastPoseRef.current = 0;
      smoothedScoreRef.current = null;
      setRisk(getSessionRisk(null));
      setModelStatus('On-device MediaPipe full model is ready.');
      setRunning(true);
    } catch (error) {
      if (startVersion !== cameraStartVersionRef.current) return;
      setCameraError(error?.message || 'Camera permission denied or unavailable.');
      setModelStatus('Camera could not be started.');
      setRunning(false);
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
      if (landmarkerRef.current) {
        try { landmarkerRef.current.close(); } catch { /* The model may not have finished initializing. */ }
        landmarkerRef.current = null;
      }
      sessionRef.current = null;
    } finally {
      if (startVersion === cameraStartVersionRef.current) startInProgressRef.current = false;
    }
  }

  function handleExerciseChange(event) {
    if (running || startInProgressRef.current) stopCamera();
    setSelectedExerciseId(event.target.value);
  }

  function toggleVoice() {
    const nextEnabled = !voiceEnabledRef.current;
    voiceEnabledRef.current = nextEnabled;
    setVoiceEnabled(nextEnabled);
    if (nextEnabled && speechGateRef.current && latestCueRef.current) speakCoach(latestCueRef.current, true);
    else cancelCoachSpeech();
  }

  useEffect(() => {
    function loop(timestamp) {
      if (!running) return;
      const video = videoRef.current;

      if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const landmarker = landmarkerRef.current;
        if (landmarker && timestamp - lastPoseRef.current >= POSE_INTERVAL_MS) {
          lastPoseRef.current = timestamp;
          try {
            const detected = landmarker.detectForVideo(video, timestamp);
            const rawLandmarks = detected?.landmarks?.[0] || [];
            const landmarks = rawLandmarks.map(point => ({
              x: point.x,
              y: point.y,
              z: point.z || 0,
              visibility: point.visibility ?? point.presence ?? 1,
            }));
            const exerciseName = exercises.find(item => String(item.id) === String(selectedExerciseId))?.name || '';
            const evaluation = evaluatePose(exerciseName, landmarks, {
              aspectRatio: video.videoWidth / video.videoHeight,
            });
            const fullBodyVisible = hasFullBodyPose(landmarks);
            const posing = fullBodyVisible && hasStartedExercisePose(exerciseName, evaluation);
            posingFramesRef.current = posing ? posingFramesRef.current + 1 : 0;
            const speechReady = posing && posingFramesRef.current >= 5;

            if (evaluation.detected && fullBodyVisible) {
              recordSessionSample(sessionRef.current, evaluation, Date.now());
              const previousScore = smoothedScoreRef.current;
              smoothedScoreRef.current = previousScore == null
                ? evaluation.score
                : SMOOTH_ALPHA * evaluation.score + (1 - SMOOTH_ALPHA) * previousScore;
              const currentRisk = getSessionRisk(sessionRef.current);
              updateRisk(currentRisk);
              const score = smoothedScoreRef.current;
              setAnalysis({
                ...evaluation,
                overall_score: score,
                client_progress: evaluation.progress,
                landmarks,
              });
              const cue = currentRisk.level === 'elevated' ? currentRisk.message : evaluation.suggestions[0];
              if (speechReady) updateSpeechGate(true, cue);
              else if (!posing) updateSpeechGate(false);
            } else {
              recordSessionSample(sessionRef.current, { ...evaluation, detected: false }, Date.now());
              updateRisk(getSessionRisk(sessionRef.current));
              setAnalysis({
                ...evaluation,
                detected: false,
                overall_score: 0,
                phase: 'unavailable',
                suggestions: fullBodyVisible
                  ? evaluation.suggestions
                  : ['No full body pose detected. Step back until your head, hips, knees and feet are in frame.'],
                landmarks: fullBodyVisible ? landmarks : [],
              });
              updateSpeechGate(false);
            }
          } catch {
            updateSpeechGate(false);
            setModelStatus('Pose tracking paused briefly. Keep your full body in view.');
          }
        }

      }
      rafRef.current = requestAnimationFrame(loop);
    }

    if (running) {
      rafRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [running, selectedExerciseId, exercises, language, voiceStyle, ttsConfigured, availableVoices, updateSpeechGate]);

  const selectedExercise = exercises.find(item => String(item.id) === String(selectedExerciseId));
  const selectedName = (selectedExercise?.name || '').toLowerCase();
  const referenceKey = selectedName.includes('warrior') ? 'warrior'
    : selectedName.includes('tree') ? 'tree'
      : selectedName.includes('chair') ? 'chair'
        : selectedName.includes('squat') ? 'squat'
          : selectedName.includes('lunge') ? 'lunge'
            : selectedName.includes('push') ? 'pushup'
              : '';
  const referenceImage = EXERCISE_REFERENCES[referenceKey] || '';
  return (
    <div className="neo-page exercise-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Pose Coach · Live session</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Move with clearer feedback</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Keep your full body visible. Form cues are spoken as you move; range-of-motion and mobility notes appear after you stop.
          </p>
        </div>
        <label className="block text-sm text-neutral-300">
          <span className="mb-1 block">Exercise</span>
          <select
            className="min-w-52 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white"
            value={selectedExerciseId}
            onChange={handleExerciseChange}
          >
            <option value="">Choose an exercise</option>
            {exercises.map(exercise => (
              <option key={exercise.id} value={String(exercise.id)}>{exercise.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-neutral-300">
          <span className="mb-1 block">Language</span>
          <select
            className="min-w-52 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white"
            value={language}
            onChange={event => onLanguageChange(event.target.value)}
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-neutral-300">
          <span className="mb-1 block">Voice</span>
          <select
            className="min-w-40 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white"
            value={voiceStyle}
            onChange={event => onVoiceStyleChange(event.target.value)}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          <div className="camera-stage">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="absolute inset-0 h-full w-full object-contain"
            />
            {analysis?.landmarks?.length > 0 && (
              <CanvasOverlay
                landmarks={analysis.landmarks}
                width={videoRef.current?.videoWidth || 640}
                height={videoRef.current?.videoHeight || 480}
                score={analysis.overall_score || 0}
              />
            )}
            {!running && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <button
                  onClick={startCamera}
                  className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-200"
                >
                  Start exercise
                </button>
              </div>
            )}
            {running && (
              <div className="camera-live">
                Camera active
              </div>
            )}
          </div>
          <div className="camera-controls">
            <div className="text-xs text-neutral-400">
              <div>{modelStatus}</div>
              <div className="mt-1">Face the camera for Warrior II and Tree Pose; turn sideways for squats, lunges and push-ups.</div>
            </div>
            {running ? (
              <button
                onClick={stopCamera}
                className=""
              >
                Stop and save
              </button>
            ) : (
              <button
                onClick={startCamera}
                className=""
              >
                Start camera
              </button>
            )}
          </div>
          {cameraError && <div className="px-4 pb-3 text-sm text-rose-300">{cameraError}</div>}
        </section>

        <CoachPanel
          analysis={analysis}
          exerciseName={selectedExercise?.name}
          referenceImage={referenceImage}
          running={running}
          risk={risk}
          voiceEnabled={voiceEnabled}
          speechSupported={speechSupported}
          voiceAvailable={voiceAvailable}
          voiceAvailabilityMessage={voiceAvailabilityMessage}
          speechMessage={speechMessage}
          ttsConfigured={ttsConfigured}
          language={language}
          onToggleVoice={toggleVoice}
        />
      </div>
    </div>
  );
}

function CoachPanel({
  analysis,
  exerciseName,
  referenceImage,
  running,
  risk,
  voiceEnabled,
  speechSupported,
  voiceAvailable,
  voiceAvailabilityMessage,
  speechMessage,
  ttsConfigured,
  language,
  onToggleVoice,
}) {
  const score = Number.isFinite(analysis?.overall_score)
    ? Math.round(Math.max(0, Math.min(1, analysis.overall_score)) * 100)
    : 0;
  const suggestions = (analysis?.suggestions || []).map(suggestion => translateCoachText(suggestion, language));
  const angleEntries = Object.entries(analysis?.angles || {})
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, 4);
  const riskStyle = risk.level === 'elevated'
    ? 'border-rose-500/40 bg-rose-950/35 text-rose-100'
    : risk.level === 'watch'
      ? 'border-amber-500/40 bg-amber-950/30 text-amber-100'
      : 'border-emerald-500/25 bg-emerald-950/20 text-emerald-100';

  return (
    <aside className="space-y-4">
      <section className="neo-card">
        <div className="coach-reference">
          {referenceImage ? (
            <img
              src={referenceImage}
              alt="Exercise reference pose"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-neutral-500">
              {exerciseName ? 'Your detected pose will appear here.' : 'Choose an exercise to begin.'}
            </div>
          )}
          <div className="score-card">
            <div className="text-xs font-medium text-neutral-300">Form score</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-white">{score}</span>
              <span className="text-xs text-neutral-400">/ 100</span>
            </div>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-neutral-700">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: score + '%' }} />
            </div>
          </div>
        </div>

        <div className="coach-content">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Coach feedback</h2>
              <p className="mt-1 text-xs text-neutral-500">{exerciseName || 'No exercise selected'}</p>
            </div>
            <button
              onClick={onToggleVoice}
              disabled={(!speechSupported && !ttsConfigured) || !voiceAvailable}
              aria-pressed={voiceEnabled}
              className="voice-toggle"
            >
              {voiceAvailable && (speechSupported || ttsConfigured) ? (voiceEnabled ? 'Voice on' : 'Voice off') : 'Voice unavailable'}
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-neutral-500">{voiceAvailabilityMessage}</p>
          {speechMessage && <p className="text-xs" role="status">{speechMessage}</p>}

          {suggestions.length ? (
            <ul className="space-y-2">
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <li key={index} className="flex gap-2 text-sm text-neutral-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">
              {running ? 'Waiting for a clear pose...' : 'Start a session to get spoken and on-screen cues.'}
            </p>
          )}

          {angleEntries.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
              {angleEntries.map(([name, value]) => (
                <span key={name} className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300">
                  {name.replaceAll('_', ' ')} {Math.round(value)}°
                </span>
              ))}
            </div>
          )}

          <div className={`risk-card ${risk.level} ${riskStyle}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{translateCoachText(risk.label, language)}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-75">{translateCoachText(risk.level, language)}</span>
            </div>
              <p className="mt-1 text-xs leading-relaxed opacity-80">{translateCoachText(risk.message, language)}</p>
            <p className="risk-disclaimer mt-2 text-[10px] leading-relaxed opacity-60">
              Repeated form issues may raise strain or injury risk. This camera estimate is not a medical diagnosis; stop if you feel pain.
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}

