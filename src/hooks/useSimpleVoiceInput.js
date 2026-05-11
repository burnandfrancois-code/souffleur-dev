import { useRef, useCallback, useState, useEffect } from 'react';

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);
  const onFinalRef = useRef(null);
  const finalAccumulatedRef = useRef('');
  const submittedRef = useRef(false);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    onFinalRef.current = null;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const start = useCallback((onFinalTranscript) => {
    stopAll();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError({ message: 'Reconnaissance vocale non supportée. Utilisez Chrome ou Safari.' });
      return;
    }

    activeRef.current = true;
    submittedRef.current = false;
    onFinalRef.current = onFinalTranscript;
    finalAccumulatedRef.current = '';
    setTranscript('');
    setError(null);

    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (activeRef.current) setIsRecording(true);
    };

    recognition.onresult = (event) => {
      if (!activeRef.current || submittedRef.current) return;

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

      // Détecter "OK" uniquement dans les segments finaux
      if (newFinal) {
        const allWords = finalAccumulatedRef.current.trim().split(/\s+/);
        const hasOk = allWords.some(w => /^(ok|okay)$/i.test(w));
        if (hasOk && onFinalRef.current) {
          const finalText = allWords.filter(w => !/^(ok|okay)$/i.test(w)).join(' ').trim();
          if (finalText) {
            submittedRef.current = true;
            const cb = onFinalRef.current;
            stopAll();
            cb(finalText);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      if (!activeRef.current) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
        stopAll();
        return;
      }
      // Pour no-speech / network / audio-capture : ignorer, onend va relancer
    };

    recognition.onend = () => {
      if (!activeRef.current || submittedRef.current) return;
      // Chrome coupe parfois même en continuous=true — on relance silencieusement
      try {
        recognitionRef.current = recognition;
        recognition.start();
      } catch (e) {
        // Si on ne peut pas relancer le même objet, on en crée un nouveau
        setTimeout(() => {
          if (!activeRef.current || submittedRef.current) return;
          start(onFinalRef.current);
        }, 300);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setError({ message: 'Erreur démarrage micro : ' + e.message });
      stopAll();
    }
  }, [stopAll]);

  const stop = useCallback(() => {
    stopAll();
  }, [stopAll]);

  const reset = useCallback(() => {
    stopAll();
    finalAccumulatedRef.current = '';
    setTranscript('');
    setError(null);
  }, [stopAll]);

  useEffect(() => {
    return () => { stopAll(); };
  }, [stopAll]);

  return { transcript, isRecording, error, start, stop, reset };
}