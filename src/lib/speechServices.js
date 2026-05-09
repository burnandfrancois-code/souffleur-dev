let audioContextDesktop = null;
let audioContextAndroid = null;
let currentUtterance = null;
let mediaStream = null;

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
    if (!mediaStream) {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

export async function speakText(text, lang = 'fr-FR', gender = 'male', rate = 1, signal) {
  return new Promise((resolve) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = gender === 'female' ? 1.3 : 0.8;
      utterance.volume = 1;

      currentUtterance = utterance;

      utterance.onend = () => {
        currentUtterance = null;
        resolve();
      };

      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        currentUtterance = null;
        resolve();
      };

      if (signal?.aborted) {
        resolve();
        return;
      }

      signal?.addEventListener('abort', () => {
        window.speechSynthesis.cancel();
        currentUtterance = null;
        resolve();
      });

      window.speechSynthesis.speak(utterance);
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