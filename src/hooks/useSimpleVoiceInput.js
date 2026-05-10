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

   console.log('[useSimpleVoiceInput] START CALLED - sessionId:', mySession);
   console.log('[useSimpleVoiceInput] Browser info:', { 
     userAgent: navigator.userAgent,
     mediaDevices: !!navigator.mediaDevices,
     getUserMedia: !!navigator.mediaDevices?.getUserMedia,
   });

   if (recognitionRef.current) {
     try { recognitionRef.current.abort(); } catch (e) {}
   }

   setTranscript('');
   setError(null);
   finalWordsRef.current = [];
   interimRef.current = '';
   lastOkTimeRef.current = 0;
   okDetectedRef.current = false;
   localStorage.removeItem('souffleur_instant_mic');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[useSimpleVoiceInput] SpeechRecognition API not available');
      setError({ message: 'Reconnaissance vocale non supportée' });
      return;
    }
    console.log('[useSimpleVoiceInput] SpeechRecognition API found');
    SpeechRecognitionRef.current = SpeechRecognition;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    recognitionRef.current = rec;

    rec.onstart = () => {
      console.log('[useSimpleVoiceInput] onstart triggered - sessionId:', mySession);
      if (sessionIdRef.current === mySession) {
        console.log('[useSimpleVoiceInput] Setting isRecording to true');
        setIsRecording(true);
      }
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
       console.log('[useSimpleVoiceInput] onerror triggered:', { error: e.error, sessionId: mySession });
       if (sessionIdRef.current !== mySession) return;
       if (e.error === 'network') {
         console.log('[useSimpleVoiceInput] Network error (ignoring)');
       } else if (e.error === 'not-allowed') {
         console.error('[useSimpleVoiceInput] Permission denied by browser/OS');
       }
       // Ignorer les erreurs de permission et laisser onend redémarrer
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

    console.log('[useSimpleVoiceInput] Calling rec.start()');
    try {
      rec.start();
      console.log('[useSimpleVoiceInput] rec.start() succeeded');
    } catch (e) {
      console.error('[useSimpleVoiceInput] rec.start() threw error:', e);
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