import { useRef, useCallback, useState, useEffect } from 'react';

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const activeRef = useRef(false); // true = on veut rester en écoute
  const onFinalRef = useRef(null);
  const finalAccumulatedRef = useRef('');

  const stopAll = useCallback(() => {
    activeRef.current = false;
    onFinalRef.current = null;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
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
    onFinalRef.current = onFinalTranscript;
    finalAccumulatedRef.current = '';
    setTranscript('');
    setError(null);

    const launchRecognition = () => {
      if (!activeRef.current) return;

      const recognition = new SR();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        if (activeRef.current) setIsRecording(true);
      };

      recognition.onresult = (event) => {
        if (!activeRef.current) return;

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

        // Détecter la commande "OK" dans le texte final
        if (newFinal) {
          const words = finalAccumulatedRef.current.trim().split(/\s+/);
          const hasOk = words.some(w => /^(ok|okay)$/i.test(w));
          if (hasOk && onFinalRef.current) {
            const finalText = words.filter(w => !/^(ok|okay)$/i.test(w)).join(' ').trim();
            if (finalText) {
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
        }
        // autres erreurs : onend va relancer
      };

      recognition.onend = () => {
        if (!activeRef.current) return;
        // relancer automatiquement pour écoute continue
        setTimeout(launchRecognition, 150);
      };

      try {
        recognition.start();
      } catch (e) {
        setError({ message: 'Erreur démarrage micro : ' + e.message });
        stopAll();
      }
    };

    launchRecognition();
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
  }, []);

  return { transcript, isRecording, error, start, stop, reset };
}