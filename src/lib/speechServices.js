let audioContextDesktop = null;
let audioContextAndroid = null;
let currentUtterance = null;
let mediaStream = null;
let androidInitialized = false;
let pendingIntervals = [];

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
    let resolved = false;
    const handler = () => {
      if (!resolved) {
        resolved = true;
        resolve(window.speechSynthesis.getVoices());
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    // Fallback si l'événement ne se déclenche pas après 300ms
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(window.speechSynthesis.getVoices() || []);
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
      }
    }, 300);
  });
}

export async function speakText(text, lang = 'fr-FR', gender = 'male', rate = 1.3, signal) {
  if (signal?.aborted) return;
  
  console.log('[TTS] speakText called - rate:', rate, 'gender:', gender, 'text length:', text.length);

  // Déverrouiller l'audio sur desktop ET Android
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    const ctx = await unlockAudioForAndroid();
    console.log('[TTS] Android audio context:', ctx?.state);
  } else {
    await unlockAudioForDesktop();
  }

  // Charger les voix disponibles
  const voices = await getVoices();
  console.log('[TTS] Available voices:', voices.length, 'lang:', lang);

  return new Promise((resolve) => {
    try {
      if (signal?.aborted) { resolve(); return; }
      if (!window.speechSynthesis) { resolve(); return; }

      // Map vitesses pour accélération
      const rateMap = {
        1: 1.5,
        1.5: 1.8,
        2: 2.0,
        3: 2.5
      };
      const actualRate = Math.min(rateMap[rate] || rate, 2.5);
      console.log('[TTS] Computed rate:', rate, '→', actualRate);

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
      let keepaliveInterval = null;
      keepaliveInterval = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          console.log('[TTS] Keepalive: resuming playback');
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 8000);
      pendingIntervals.push(keepaliveInterval);

      const cleanup = () => {
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          pendingIntervals = pendingIntervals.filter(id => id !== keepaliveInterval);
        }
        currentUtterance = null;
        console.log('[TTS] Cleanup complete');
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

      // Arrêter tout ce qui parle actuellement
      window.speechSynthesis.cancel();
      
      // Délai plus long sur Android pour laisser le cancel se propager
      const delay = /Android/i.test(navigator.userAgent) ? 200 : 50;
      const speakTimeout = setTimeout(() => {
        if (signal?.aborted) { resolve(); return; }
        console.log('[TTS] Speaking:', text.substring(0, 50), 'rate:', actualRate, 'volume:', utterance.volume);
        try {
          window.speechSynthesis.speak(utterance);
          console.log('[TTS] Utterance queued, speaking:', window.speechSynthesis.speaking);
        } catch (e) {
          console.error('[TTS] Error calling speak():', e);
          resolve();
        }
      }, delay);
      
      signal?.addEventListener('abort', () => {
        clearTimeout(speakTimeout);
      });

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
    // Clean up any pending intervals
    pendingIntervals.forEach(id => clearInterval(id));
    pendingIntervals = [];
    console.log('[TTS] Stopped speaking and cleaned intervals');
  } catch (e) {
    console.error('Error stopping speech:', e);
  }
}