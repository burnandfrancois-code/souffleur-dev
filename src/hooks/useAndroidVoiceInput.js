import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Hook optimisé pour Android/Chrome — détecte auto la fin de parole sans "OK"
 * Utilise la Web Speech API avec gestion intelligente du silence.
 */
export function useAndroidVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const activeRef = useRef(false);
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const micStreamRef = useRef(null);
  const accumulatedRef = useRef('');
  const silenceTimeoutRef = useRef(null);
  const lastSpeechTimeRef = useRef(0);
  const hasSpeechRef = useRef(false);

  const SILENCE_THRESHOLD = 1500; // 1.5s de silence = fin de parole

  const destroyRecognition = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.onstart = null; r.onresult = null; r.onerror = null; r.onend = null; r.abort(); } catch (e) {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const finishRecording = useCallback((text) => {
    if (!activeRef.current || !text.trim()) return;
    
    console.log('[ANDROID-STT] Fin auto-détectée:', text);
    activeRef.current = false;
    destroyRecognition();
    setIsRecording(false);
    
    if (onFinalRef.current) {
      onFinalRef.current(text.trim());
    }
  }, [destroyRecognition]);

  const createAndStart = useCallback(() => {
    destroyRecognition();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError({ message: 'Speech Recognition non supportée' });
      return;
    }

    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      console.log('[ANDROID-STT] Démarré');
      if (activeRef.current) {
        setIsRecording(true);
      }
    };

    rec.onspeechstart = () => {
      console.log('[ANDROID-STT] Parole détectée');
      hasSpeechRef.current = true;
      lastSpeechTimeRef.current = Date.now();
    };

    rec.onresult = (event) => {
      if (!activeRef.current) return;

      let interim = '';
      let newFinals = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinals += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (newFinals) {
        accumulatedRef.current += ' ' + newFinals;
        lastSpeechTimeRef.current = Date.now();
      }

      const displayed = (accumulatedRef.current + ' ' + interim).trim();
      setTranscript(displayed);

      // Redémarrer le timer de silence
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      if (hasSpeechRef.current && activeRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (activeRef.current && accumulatedRef.current.trim()) {
            finishRecording(accumulatedRef.current);
          }
        }, SILENCE_THRESHOLD);
      }
    };

    rec.onerror = (event) => {
      console.log('[ANDROID-STT] Erreur:', event.error);
      if (!activeRef.current) return;
      
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        activeRef.current = false;
        destroyRecognition();
        setIsRecording(false);
        setError({ message: 'Microphone refusé. Vérifiez les permissions du navigateur.' });
      } else if (event.error === 'no-speech') {
        // Pas de parole — relancer silencieusement
        console.log('[ANDROID-STT] Pas de parole, relance...');
        setTimeout(() => {
          if (activeRef.current) createAndStart();
        }, 200);
      }
    };

    rec.onend = () => {
      console.log('[ANDROID-STT] Arrêté');
      if (activeRef.current && !hasSpeechRef.current) {
        // Pas encore eu de parole — relancer
        setTimeout(() => {
          if (activeRef.current) createAndStart();
        }, 200);
      }
    };

    try {
      rec.start();
    } catch (e) {
      setError({ message: 'Erreur démarrage: ' + e.message });
      activeRef.current = false;
      setIsRecording(false);
    }
  }, [createAndStart, finishRecording]);

  const start = useCallback(async (onFinal) => {
    activeRef.current = false;
    destroyRecognition();

    accumulatedRef.current = '';
    hasSpeechRef.current = false;
    onFinalRef.current = onFinal;
    setTranscript('');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (e) {
      setError({ message: 'Microphone refusé. Vérifiez les permissions.' });
      return;
    }

    activeRef.current = true;
    createAndStart();
  }, [destroyRecognition, createAndStart]);

  const stop = useCallback(() => {
    activeRef.current = false;
    destroyRecognition();
    setIsRecording(false);
  }, [destroyRecognition]);

  const reset = useCallback(() => {
    activeRef.current = false;
    destroyRecognition();
    accumulatedRef.current = '';
    hasSpeechRef.current = false;
    onFinalRef.current = null;
    setTranscript('');
    setError(null);
    setIsRecording(false);
  }, [destroyRecognition]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      destroyRecognition();
    };
  }, [destroyRecognition]);

  return { transcript, isRecording, error, start, stop, reset };
}