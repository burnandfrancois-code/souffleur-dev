import { useRef, useCallback, useState, useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const sessionIdRef = useRef(0);
  const onFinalRef = useRef(null);
  const finalAccumulatedRef = useRef('');

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const start = useCallback((onFinalTranscript) => {
    sessionIdRef.current += 1;
    const mySession = sessionIdRef.current;
    onFinalRef.current = onFinalTranscript;
    finalAccumulatedRef.current = '';
    setTranscript('');
    setError(null);

    if (!SpeechRecognition) {
      setError({ message: 'Reconnaissance vocale non supportée par ce navigateur. Utilisez Chrome ou Safari.' });
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (sessionIdRef.current === mySession) setIsRecording(true);
    };

    recognition.onresult = (event) => {
      if (sessionIdRef.current !== mySession) return;

      let newFinal = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += t + ' ';
        else interim += t;
      }
      if (newFinal) finalAccumulatedRef.current += newFinal;
      const displayed = (finalAccumulatedRef.current + interim).trim();
      setTranscript(displayed);

      // Détecter la commande "OK"
      if (newFinal) {
        const words = finalAccumulatedRef.current.trim().split(/\s+/);
        const hasOk = words.some(w => /^(ok|okay)$/i.test(w));
        if (hasOk && onFinalRef.current) {
          const finalText = words.filter(w => !/^(ok|okay)$/i.test(w)).join(' ').trim();
          if (finalText) {
            stopSpeechRecognition();
            const cb = onFinalRef.current;
            onFinalRef.current = null;
            cb(finalText);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      if (sessionIdRef.current !== mySession) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
        stopSpeechRecognition();
      }
      // Pour les autres erreurs (no-speech, network...), on laisse onend relancer
    };

    recognition.onend = () => {
      if (sessionIdRef.current !== mySession) return;
      if (!recognitionRef.current) return;
      // Auto-restart pour maintenir l'écoute continue
      try { recognition.start(); } catch (e) {}
    };

    try {
      recognition.start();
    } catch (e) {
      setError({ message: 'Impossible de démarrer la reconnaissance vocale : ' + e.message });
    }
  }, [stopSpeechRecognition]);

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    stopSpeechRecognition();
  }, [stopSpeechRecognition]);

  const reset = useCallback(() => {
    stop();
    finalAccumulatedRef.current = '';
    setTranscript('');
    setError(null);
  }, [stop]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  return { transcript, isRecording, error, start, stop, reset };
}