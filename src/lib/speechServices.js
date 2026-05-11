let audioContextDesktop = null;
let audioContextAndroid = null;
let currentUtterance = null;
let mediaStream = null;
let androidInitialized = false;

export async function unlockAudioForDesktop() {
  try {
    if (!audioContextDesktop) {
      audioContextDesktop = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextDesktop.state === 'suspended') {
      await audioContextDesktop.resume();
    }
    return audioContextDesktop;
  } catch (e) {
    console.error('Failed to unlock audio:', e);
    return null;
  }
}

export async function unlockAudioContextDesktop() {
  return unlockAudioForDesktop();
}

export async function unlockAudioForAndroid() {
  try {
    // Initialiser une seule fois
    if (!androidInitialized) {
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[TTS] Android media stream unlocked');
      }
      androidInitialized = true;
    }
    
    if (!audioContextAndroid) {
      audioContextAndroid = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextAndroid.state === 'suspended') {
      await audioContextAndroid.resume();
    }
    return audioContextAndroid;
  } catch (e) {
    console.error('Failed to unlock audio for Android:', e);
    return null;
  }
}

function getVoices() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve([]); return; }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    // Sur Android, les voix se chargent de manière asynchrone
    const handler = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    // Fallback si l'événement ne se déclenche pas
    setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 1000);
  });
}

export async function speakText(text, lang = 'fr-FR', gender = 'male', rate = 1.3, signal) {
  if (signal?.aborted) return;

  // Déverrouiller l'audio sur desktop ET Android
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    const ctx = await unlockAudioForAndroid();
    console.log('[TTS] Android audio context:', ctx);
  } else {
    await unlockAudioForDesktop();
  }

  // Charger les voix disponibles
  const voices = await getVoices();
  console.log('[TTS] Available voices:', voices.length, 'lang:', lang);

  return new Promise((resolve) => {
    try {
      if (signal?.aborted) { resolve(); return; }

      // Map vitesses pour accélération
      const rateMap = {
        1: 2.5,
        1.5: 3.0,
        2: 3.5,
        3: 4.5
      };
      const actualRate = Math.min(rateMap[rate] || rate, 4.5);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = actualRate;
      utterance.pitch = gender === 'female' ? 1.3 : 0.8;
      utterance.volume = 1;

      // Sélectionner une voix française si disponible
      const frVoice = voices.find(v => v.lang.startsWith('fr') && (gender === 'female' ? v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('fem') || v.name.includes('Amélie') || v.name.includes('Marie') || v.name.includes('Audrey') : true))
        || voices.find(v => v.lang.startsWith('fr'))
        || voices.find(v => v.lang.startsWith('fr-'));
      if (frVoice) utterance.voice = frVoice;

      currentUtterance = utterance;

      // Keepalive pour Chrome Android (bug: s'arrête après ~15s)
      const keepaliveInterval = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);

      const cleanup = () => {
        clearInterval(keepaliveInterval);
        currentUtterance = null;
      };

      utterance.onend = () => { cleanup(); resolve(); };
      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        cleanup();
        resolve();
      };

      signal?.addEventListener('abort', () => {
        window.speechSynthesis.cancel();
        cleanup();
        resolve();
      });

      // Sur Android, cancel() avant speak() évite les conflits
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      setTimeout(() => {
        if (signal?.aborted) { resolve(); return; }
        console.log('[TTS] Speaking:', text.substring(0, 50), 'volume:', utterance.volume);
        window.speechSynthesis.speak(utterance);
      }, 300);

    } catch (e) {
      console.error('Error in speakText:', e);
      resolve();
    }
  });
}

export function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  } catch (e) {
    console.error('Error stopping speech:', e);
  }
}