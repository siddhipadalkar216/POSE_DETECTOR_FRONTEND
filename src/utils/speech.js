import { synthesizeSpeech } from '../services/api';
import { findSpeechVoice, getLanguageOption, getTtsVoiceId } from './language';

let activeAudio = null;
let activeAudioUrl = '';
let requestVersion = 0;
let requestPending = false;
let audioContext = null;
const audioNodes = new WeakMap();

export function unlockCoachAudio() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => { /* Browser speech remains available as a fallback. */ });
  } catch { /* A browser without Web Audio can still use its speech engine. */ }
}

export function getInstalledSpeechVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

export function isCoachSpeechActive() {
  return requestPending
    || Boolean(activeAudio && !activeAudio.paused && !activeAudio.ended)
    || Boolean(typeof window !== 'undefined' && window.speechSynthesis?.speaking);
}

function releaseAudio() {
  if (activeAudio) {
    audioNodes.get(activeAudio)?.disconnect();
    audioNodes.delete(activeAudio);
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = '';
  }
}

export function cancelCoachSpeech() {
  requestVersion += 1;
  requestPending = false;
  releaseAudio();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function speakWithBrowserVoice(text, language, voiceStyle, voices, warning = '') {
  const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const Utterance = typeof window !== 'undefined'
    ? window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance
    : null;
  const voice = findSpeechVoice(voices, language, voiceStyle);
  const defaultEnglishVoiceAllowed = language === 'en'
    && voices.length === 0
    && typeof navigator !== 'undefined'
    && navigator.language?.toLowerCase().startsWith('en');

  if (!synthesis || typeof Utterance !== 'function' || (!voice && !defaultEnglishVoiceAllowed)) {
    return { ok: false, message: warning || `${getLanguageOption(language).label.split(' (')[0]} voice is unavailable on this device.` };
  }

  const utterance = new Utterance(text);
  utterance.lang = voice?.lang || getLanguageOption(language).locale;
  if (voice) utterance.voice = voice;
  utterance.rate = 0.94;
  utterance.pitch = 1;
  synthesis.speak(utterance);
  return { ok: true, engine: 'browser', message: warning };
}

export async function speakCoachText(text, {
  language = 'en',
  voiceStyle = 'female',
  ttsConfigured = false,
  voices = getInstalledSpeechVoices(),
} = {}) {
  unlockCoachAudio();
  const version = ++requestVersion;
  requestPending = true;
  let warning = '';

  if (ttsConfigured) {
    try {
      const blob = await synthesizeSpeech({ text, voice: getTtsVoiceId(language, voiceStyle) });
      if (version !== requestVersion) return { ok: false, cancelled: true };
      if (!blob.size) throw new Error('The speech service returned empty audio.');
      activeAudioUrl = URL.createObjectURL(blob);
      activeAudio = new Audio(activeAudioUrl);
      activeAudio.preload = 'auto';
      if (audioContext) {
        const node = audioContext.createMediaElementSource(activeAudio);
        node.connect(audioContext.destination);
        audioNodes.set(activeAudio, node);
      }
      requestPending = false;
      activeAudio.addEventListener('ended', releaseAudio, { once: true });
      activeAudio.addEventListener('error', releaseAudio, { once: true });
      await activeAudio.play();
      return { ok: true, engine: 'server' };
    } catch (error) {
      if (version !== requestVersion) return { ok: false, cancelled: true };
      requestPending = false;
      releaseAudio();
      warning = `Natural voice service failed; trying this device's voice. ${error?.message || ''}`.trim();
    }
  }

  if (version !== requestVersion) return { ok: false, cancelled: true };
  requestPending = false;
  return speakWithBrowserVoice(text, language, voiceStyle, voices, warning);
}
