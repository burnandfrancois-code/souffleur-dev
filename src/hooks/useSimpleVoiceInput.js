import { useRef, useCallback, useState, useEffect } from 'react';

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const sessionIdRef = useRef(0);
  const finalWordsRef = useRef([]);
  const interimRef = useRef('');
  const lastOkTimeRef = useRef(0);
  const userStoppedRef = useRef(false);
  const pendingTimersRef = useRef([]);
  const okDetectedRef = useRef(false);
  const intentionallyStopping = useRef(false);
  const SpeechRecognitionRef = useRef(null);

  const stop = useCallback(() => {
    intentionallyStopping.current = true;
    userStoppedRef.current = true;
    sessionIdRef.current += 1;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    setIsRecording(false);
  }, []);

  const start = useCallback((onFinalTranscript) => {
    sessionIdRef.current += 1;
    const mySession = sessionIdRef.current;
    userStoppedRef.current = false;
    intentionallyStopping.current = false;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    setTranscript('');
    setError(null);
    finalWordsRef.current = [];
    interimRef.current = '';
    lastOkTimeRef.current = 0;
    okDetectedRef.current = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError({ message: 'Reconnaissance vocale non supportée' });
      return;
    }
    SpeechRecognitionRef.current = SpeechRecognition;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    recognitionRef.current = rec;

    rec.onstart = () => {
      if (sessionIdRef.current === mySession) setIsRecording(true);
    };

    rec.onresult = (event) => {
      if (sessionIdRef.current !== mySession) return;

      // Reconstruire la phrase complète à partir de ALL event.results
      let fullText = '';
      for (let i = 0; i < event.results.length; i++) {
        fullText += event.results[i][0].transcript;
      }
      const displayText = fullText.trim();
      setTranscript(displayText);

      // Détecte "OK"
      const words = displayText.split(/\s+/);
      const hasOk = words.some(w => /^ok$/i.test(w.toLowerCase()) || /^okay$/i.test(w.toLowerCase()) || /^o\.k\.$/i.test(w.toLowerCase()));

      if (hasOk && !okDetectedRef.current) {
        okDetectedRef.current = true;
        const now = Date.now();
        if (now - lastOkTimeRef.current > 1000) {
          lastOkTimeRef.current = now;
          const finalText = words
            .filter(w => !/^ok$/i.test(w.toLowerCase()) && !/^okay$/i.test(w.toLowerCase()) && !/^o\.k\.$/i.test(w.toLowerCase()))
            .join(' ')
            .trim();

          if (finalText && onFinalTranscript) {
            const capturedSession = mySession;
            setTimeout(() => {
              if (sessionIdRef.current !== capturedSession) return;
              stop();
              onFinalTranscript(finalText);
            }, 200);
          }
        }
      }
    };

    rec.onerror = (e) => {
      if (sessionIdRef.current !== mySession) return;
      if (e.error === 'not-allowed') {
        setError({ message: 'Permission micro refusée' });
        stop();
      }
    };

    rec.onend = () => {
      if (sessionIdRef.current !== mySession || intentionallyStopping.current || okDetectedRef.current) return;
      
      // Redémarrer immédiatement sans délai
      if (SpeechRecognitionRef.current) {
        try {
          const newRec = new SpeechRecognitionRef.current();
          newRec.continuous = true;
          newRec.interimResults = true;
          newRec.lang = 'fr-FR';
          recognitionRef.current = newRec;
          
          newRec.onstart = () => {
            if (sessionIdRef.current === mySession) setIsRecording(true);
          };
          
          newRec.onresult = rec.onresult;
          newRec.onerror = rec.onerror;
          newRec.onend = rec.onend;
          
          newRec.start();
        } catch (e) {}
      }
    };

    try {
      rec.start();
    } catch (e) {
      setError({ message: `Erreur: ${e.message}` });
    }
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setError(null);
    finalWordsRef.current = [];
    interimRef.current = '';
  }, [stop]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  return {
    transcript,
    isRecording,
    error,
    start,
    stop,
    reset,
  };
}