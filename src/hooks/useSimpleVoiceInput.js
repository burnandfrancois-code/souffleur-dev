import { useRef, useCallback, useState, useEffect, useMemo } from 'react';

/**
 * Hook de reconnaissance vocale Web Speech API (DESKTOP NATIF - ULTRA RAPIDE)
 * Détecte "OK" pour arrêter et soumettre le texte.
 */
export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const activeRef = useRef(false);
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const accumulatedRef = useRef('');

  const startWebSpeechRecognition = useCallback(async () => {
    if (!activeRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError({ message: 'Web Speech API non disponible' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      if (!activeRef.current) return;

      let interimTranscript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
          if (transcript.trim()) {
            accumulatedRef.current = (accumulatedRef.current + ' ' + transcript).trim();
          }
        } else {
          interimTranscript += transcript;
        }
      }

      const displayed = accumulatedRef.current + ' ' + interimTranscript;
      setTranscript(displayed);

      // Détecter "OK" pour arrêter
      if (isFinal) {
        const allText = (accumulatedRef.current + ' ' + interimTranscript).toLowerCase();
        const hasOk = /\bok\b/.test(allText);
        if (hasOk && onFinalRef.current) {
          const finalText = allText.replace(/\bok\b/g, '').trim();
          activeRef.current = false;
          recognition.stop();
          setIsRecording(false);
          const cb = onFinalRef.current;
          cb(finalText);
        }
      }
    };

    recognition.onerror = (event) => {
      setError({ message: `Erreur: ${event.error}` });
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Erreur démarrage recognition:', e);
    }
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    window.speechSynthesis?.cancel();
    await new Promise(resolve => setTimeout(resolve, 300));

    activeRef.current = true;
    onFinalRef.current = onFinalTranscript;
    accumulatedRef.current = '';
    setTranscript('');
    setError(null);

    startWebSpeechRecognition();
  }, [startWebSpeechRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    accumulatedRef.current = '';
    setTranscript('');
    setError(null);
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return useMemo(() => ({ transcript, isRecording, error, start, stop, reset }), [transcript, isRecording, error, start, stop, reset]);
}