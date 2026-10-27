import { useEffect, useMemo, useState } from 'react';
import { getProfile, updateProfile, fetchLogs } from '../services/api';
import { getMobilityInsight } from '../utils/sessionMetrics';

function getSessionSummary(log) {
  const value = log?.landmarks;
  return value && !Array.isArray(value) && value.schemaVersion === 1 ? value : null;
}

function formatRange(range) {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return null;
  return Math.round(range.min) + '°–' + Math.round(range.max) + '°';
}

export default function ProfilePage() {
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', height_cm: '', weight_kg: '' });
  const [history, setHistory] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    getProfile(token).then(setProfile).catch(() => {});
    fetchLogs(token).then(logs => setHistory(Array.isArray(logs) ? logs : [])).catch(() => setHistory([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = Array.isArray(history) ? history : [];
    if (!q) return rows;
    return rows.filter(log => (log.exercise || String(log.exercise_id || '')).toLowerCase().includes(q));
  }, [query, history]);

  const sessions = useMemo(
    () => filtered.filter(log => getSessionSummary(log)),
    [filtered],
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setProfile(current => ({ ...current, [name]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      await updateProfile(token, profile);
      setSaveMessage('Profile saved.');
    } catch {
      setSaveMessage('Profile could not be saved.');
    }
  }

  return (
    <div className="neo-page profile-page">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Your training</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Profile & movement history</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Review workout patterns after each session. The camera estimates movement range; it cannot diagnose flexibility or injury.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Personal data</h2>
          <p className="mt-1 text-xs text-neutral-500">Update the information associated with your account.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-300">
            <span className="mb-1 block">Name</span>
            <input name="name" value={profile.name || ''} onChange={handleChange} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-neutral-300">
            <span className="mb-1 block">Email</span>
            <input type="email" name="email" value={profile.email || ''} onChange={handleChange} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-neutral-300">
            <span className="mb-1 block">Height (cm)</span>
            <input type="number" name="height_cm" value={profile.height_cm || ''} onChange={handleChange} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-neutral-300">
            <span className="mb-1 block">Weight (kg)</span>
            <input type="number" name="weight_kg" value={profile.weight_kg || ''} onChange={handleChange} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200">Save profile</button>
          {saveMessage && <span role="status" className="text-xs text-neutral-400">{saveMessage}</span>}
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Flexibility & mobility focus</h2>
            <p className="mt-1 text-sm text-neutral-400">These notes are generated after you stop a workout.</p>
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search exercises..."
            aria-label="Search workout history"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm md:w-64"
          />
        </div>

        {sessions.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {sessions.slice(0, 8).map(log => {
              const summary = getSessionSummary(log);
              const insight = getMobilityInsight(log.exercise || summary.exerciseName, summary);
              const kneeRange = formatRange(
                summary.rangeOfMotion?.knee_average
                  || summary.rangeOfMotion?.front_knee
                  || summary.rangeOfMotion?.left_knee,
              );
              const elbowRange = formatRange(summary.rangeOfMotion?.elbow_average);
              const shoulderRange = formatRange(
                summary.rangeOfMotion?.shoulder_flexion_left
                  || summary.rangeOfMotion?.shoulder_flexion_right,
              );
              const riskLevel = summary.risk?.level || 'low';
              const riskColor = riskLevel === 'elevated'
                ? 'text-rose-300'
                : riskLevel === 'watch' ? 'text-amber-300' : 'text-emerald-300';

              return (
                <article key={log.id} className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{log.exercise || summary.exerciseName || 'Exercise'}</h3>
                      <p className="mt-1 text-xs text-neutral-500">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold text-white">{Math.round((log.score || 0) * 100)}%</div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500">average form</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                    <div className="text-sm font-medium text-emerald-200">{insight.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">{insight.detail}</p>
                    {insight.exercises.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {insight.exercises.map(exercise => (
                          <span key={exercise} className="rounded-full bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300">{exercise}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
                    {kneeRange && <span className="rounded-full bg-neutral-800 px-2.5 py-1">Knee range {kneeRange}</span>}
                    {elbowRange && <span className="rounded-full bg-neutral-800 px-2.5 py-1">Elbow range {elbowRange}</span>}
                    {shoulderRange && <span className="rounded-full bg-neutral-800 px-2.5 py-1">Shoulder reach {shoulderRange}</span>}
                    <span className={'rounded-full bg-neutral-800 px-2.5 py-1 ' + riskColor}>
                      Repeated-form signal: {summary.risk?.label || 'None'}
                    </span>
                  </div>

                  {summary.formIssues?.length > 0 && (
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Repeated cues: {summary.formIssues.slice(0, 3).map(issue => issue.label).join(', ')}.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/50 p-5 text-sm text-neutral-500">
            No completed workout summaries found. Start an exercise and choose “Stop and save” to see movement-range notes here.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Recent activity</h2>
          <p className="mt-1 text-sm text-neutral-400">Older live checkpoints remain available alongside session summaries.</p>
        </div>
        <ul className="divide-y divide-neutral-800 rounded-2xl border border-neutral-800 bg-neutral-900 px-4">
          {filtered.slice(0, 20).map(log => (
            <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="text-neutral-400">{new Date(log.timestamp).toLocaleString()}</span>
              <span className="min-w-28 flex-1 text-neutral-300">{log.exercise || log.exercise_id || 'Exercise'}</span>
              <span className="font-medium text-white">{Math.round((log.score || 0) * 100)}%</span>
            </li>
          ))}
          {!filtered.length && <li className="py-3 text-sm text-neutral-500">No results.</li>}
        </ul>
      </section>
    </div>
  );
}

