import { useRef, useCallback, useState, useEffect } from 'react';
import { unlockAudioForDesktop } from '@/lib/speechServices';

/**
 * Hook pour la reconnaissance vocale (STT) avec gestion de session robuste
 * Gère : Web Speech API, session IDs, OK command detection, cleanup
 */
export function useVoiceRecognition() {
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const recognitionRef = useRef(null);
  const activeSessionIdRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pendingTimersRef = useRef([]);
  const finalWordsRef = useRef([]);
  const interimRef = useRef('');
  const lastOkTimeRef = useRef(0);
  const restartCountRef = useRef(0);

  const stopAll = useCallback(() => {
    activeSessionIdRef.current = null;
    restartCountRef.current = 0;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    setIsRecording(false);
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    stopAll();

    const newSessionId = Math.random();
    activeSessionIdRef.current = newSessionId;
    console.log('[VoiceRecognition] Nouvelle session:', newSessionId);

    lastOkTimeRef.current = 0;
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setError(null);
    restartCountRef.current = 0;

    try {
      await unlockAudioForDesktop();
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error('[VoiceRecognition] Erreur audio:', e);
    }

    if (activeSessionIdRef.current !== newSessionId) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError({ message: 'Reconnaissance vocale non supportée. Utilisez Chrome ou Edge.' });
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    recognitionRef.current = rec;

    rec.onstart = () => {
      if (activeSessionIdRef.current === newSessionId) {
        setIsRecording(true);
      }
    };

    rec.onresult = (event) => {
      if (activeSessionIdRef.current !== newSessionId) return;

      // Collecter les résultats finaux
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim();
          if (word && !finalWordsRef.current.includes(word)) {
            finalWordsRef.current.push(word);
          }
        }
      }

      // Récupérer le dernier résultat intermédiaire
      interimRef.current = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        if (!event.results[i].isFinal) {
          interimRef.current = event.results[i][0].transcript.trim();
          break;
        }
      }

      const fullText = finalWordsRef.current.join(' ') +
        (interimRef.current ? (finalWordsRef.current.length > 0 ? ' ' : '') + interimRef.current : '');
      const displayText = fullText.trim();
      setTranscript(displayText);

      // Détecte la commande "OK"
      const words = displayText.split(/\s+/);
      const hasOkCommand = words.some(w => {
        const lower = w.toLowerCase();
        return lower === 'ok' || lower === 'okay' || lower === 'o.k.' || lower === 'oke';
      });

      if (hasOkCommand && onFinalTranscript) {
        const now = Date.now();
        if (now - lastOkTimeRef.current > 1000) {
          lastOkTimeRef.current = now;
          const finalText = words
            .filter(w => {
              const lower = w.toLowerCase();
              return lower !== 'ok' && lower !== 'okay' && lower !== 'o.k.' && lower !== 'oke';
            })
            .join(' ')
            .trim();

          if (finalText) {
            const capturedSession = newSessionId;
            setTimeout(() => {
              if (activeSessionIdRef.current !== capturedSession) return;
              stop();
              onFinalTranscript(finalText);
            }, 600);
          }
        }
      }
    };

    rec.onerror = (e) => {
      console.error('[VoiceRecognition] onerror:', e.error);
      if (activeSessionIdRef.current !== newSessionId) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stop();
        setError({ message: '⚠️ Permission micro refusée' });
      }
    };

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      rec.start();
      console.log('[VoiceRecognition] rec.start() lancé');
    } catch (e) {
      console.error('[VoiceRecognition] rec.start() erreur:', e.message);
      setError({ message: `⚠️ Erreur micro: ${e.message}` });
      activeSessionIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      recognitionRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    console.log('[VoiceRecognition] stop');
    stopAll();
  }, [stopAll]);

  const reset = useCallback(() => {
    stop();
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setError(null);
  }, [stop]);

  useEffect(() => {
    return () => {
      activeSessionIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    transcript,
    error,
    isRecording,
    start,
    stop,
    reset,
    pendingTimersRef,
  };
}