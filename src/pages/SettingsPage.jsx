import { useEffect, useState } from 'react';
import { getTtsStatus } from '../services/api';
import { findSpeechVoice, LANGUAGE_OPTIONS, translateCoachText } from '../utils/language';
import { cancelCoachSpeech, getInstalledSpeechVoices, speakCoachText, unlockCoachAudio } from '../utils/speech';

export default function SettingsPage({ language, onLanguageChange, voiceStyle, onVoiceStyleChange }) {
  const [tts, setTts] = useState({ configured: false, loading: true });
  const [voices, setVoices] = useState(getInstalledSpeechVoices);
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const localSpeechSupported = typeof window !== 'undefined'
    && Boolean(window.speechSynthesis)
    && typeof (window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance) === 'function';
  const localVoiceAvailable = localSpeechSupported && (Boolean(findSpeechVoice(voices, language))
    || (language === 'en' && voices.length === 0 && navigator.language?.toLowerCase().startsWith('en')));

  useEffect(() => {
    let active = true;
    getTtsStatus()
      .then(status => {
        if (!active) return;
        const speechConfigured = Boolean(status?.configured && (status?.provider === 'Sarvam Bulbul v3' || status?.reachable));
        setTts({ ...status, configured: speechConfigured, serverConfigured: Boolean(status?.configured), loading: false });
      })
      .catch(() => { if (active) setTts({ configured: false, loading: false }); });
    const refresh = () => setVoices(getInstalledSpeechVoices());
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh);
    const timer = window.setTimeout(refresh, 600);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh);
      cancelCoachSpeech();
    };
  }, []);

  async function previewVoice() {
    cancelCoachSpeech();
    unlockCoachAudio();
    setPreviewMessage('Preparing a short voice sample…');
    setPreviewing(true);
    const message = translateCoachText('Voice coaching is on. Keep your full body in view.', language);
    const result = await speakCoachText(message, { language, voiceStyle, ttsConfigured: tts.configured, voices });
    setPreviewing(false);
    setPreviewMessage(result.ok
      ? result.message || (result.engine === 'server' ? 'Natural voice preview is playing.' : 'Device voice preview is playing.')
      : result.message || 'The selected voice could not be played.');
  }

  return (
    <div className="neo-page settings-page">
      <header className="page-heading">
        <p className="eyebrow">MAKE IT YOURS · 01</p>
        <h1>Settings</h1>
        <p>Choose the voice you want to hear during a workout. These preferences are saved on this device.</p>
      </header>

      <section className="neo-card settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon">♫</span>
          <div><p className="eyebrow">VOICE COACH</p><h2>Spoken feedback</h2></div>
          <span className={`service-pill ${tts.configured ? 'is-ready' : ''}`}>
            <span className="neo-dot" />
            {tts.loading ? 'CHECKING' : tts.configured ? 'NATURAL VOICE READY' : tts.serverConfigured ? 'VOICE SERVICE OFFLINE' : 'DEVICE VOICE'}
          </span>
        </div>

        <div className="settings-controls">
          <label className="neo-field">
            <span>Spoken language</span>
            <select value={language} onChange={event => onLanguageChange(event.target.value)}>
              {LANGUAGE_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
            <small>Feedback is spoken in the selected language.</small>
          </label>
          <label className="neo-field">
            <span>Voice style</span>
            <select value={voiceStyle} onChange={event => onVoiceStyleChange(event.target.value)}>
              <option value="female">Female voice</option>
              <option value="male">Male voice</option>
            </select>
            <small>Choose a voice profile for the selected language.</small>
          </label>
        </div>

        <div className="voice-status-box">
          <div className="voice-status-icon">{tts.configured ? '✓' : 'i'}</div>
          <div>
            <strong>{tts.configured ? `${tts.provider || 'Server voice'} is configured` : tts.serverConfigured ? 'Speech service is not reachable' : 'Local speech is active'}</strong>
            <p>{tts.configured
              ? tts.fallback_languages?.includes(language)
                ? 'The AI voice service is ready. Bhojpuri is not a native Bulbul language, so it uses the Hindi model as a best-effort fallback.'
                : 'The AI voice service can generate the selected language even when your device has no installed voice. Use Preview to confirm the server key and voice.'
              : tts.serverConfigured
                ? 'The server has a speech provider configured, but its health check failed. Check the provider settings and deployment logs.'
                : localVoiceAvailable
                ? 'This browser has a voice for your selection. A server voice provider can make supported languages available consistently across devices.'
                : 'This device has no matching voice installed. Connect a server voice provider for reliable multilingual coaching.'}</p>
          </div>
        </div>

        <div className="settings-action-row">
          <button className="neo-button neo-button-lime" onClick={previewVoice} disabled={previewing || (!tts.configured && !localVoiceAvailable)}>
            {previewing ? 'Preparing sample…' : '▶  Preview selected voice'}
          </button>
          <span className="preview-message" role="status">{previewMessage}</span>
        </div>
      </section>

      <aside className="neo-note">
        <strong>Voice setup for deployment</strong>
        <span>For natural multilingual speech, add <code>SARVAM_API_KEY</code> to the Render server environment. The key stays on the server. Only the short coaching cue is sent for speech generation; camera frames are used by the pose analyzer.</span>
      </aside>
    </div>
  );
}
