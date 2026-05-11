import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Hook de reconnaissance vocale continue.
 * Reste ouvert jusqu'à ce que l'utilisateur dise "OK".
 * Chrome coupe parfois la reconnaissance même en continuous=true — on relance sans changer isRecording.
 */
export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const activeRef = useRef(false);
  const submittedRef = useRef(false);
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const accumulatedRef = useRef('');
  // Ref miroir de isRecording pour éviter les flash false→true dans onstart
  const isRecordingRef = useRef(false);

  const setRecording = (val) => {
    isRecordingRef.current = val;
    setIsRecording(val);
  };

  const destroyRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.onstart = null; r.onresult = null; r.onerror = null; r.onend = null; r.abort(); } catch (e) {}
    }
  }, []);

  const createAndStart = useCallback(() => {
    destroyRecognition();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      console.log('[STT] onstart');
      if (activeRef.current) {
        isRecordingRef.current = true;
        setIsRecording(true);
      }
    };

    rec.onsoundstart = () => console.log('[STT] onsoundstart — son détecté');
    rec.onspeechstart = () => console.log('[STT] onspeechstart — parole détectée');
    rec.onspeechend = () => console.log('[STT] onspeechend');
    rec.onsoundend = () => console.log('[STT] onsoundend');
    rec.onnomatch = () => console.log('[STT] onnomatch');

    rec.onresult = (event) => {
      console.log('[STT] onresult — results:', event.results.length);
      if (!activeRef.current || submittedRef.current) return;

      let newFinals = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinals += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (newFinals) accumulatedRef.current += ' ' + newFinals;
      const displayed = (accumulatedRef.current + ' ' + interim).trim();
      setTranscript(displayed);

      // Détecter "OK" dans les segments finaux
      if (newFinals) {
        const allFinalWords = accumulatedRef.current.trim().split(/\s+/);
        const hasOk = allFinalWords.some(w => /^(ok|okay)$/i.test(w));
        if (hasOk && onFinalRef.current && !submittedRef.current) {
          const finalText = allFinalWords.filter(w => !/^(ok|okay)$/i.test(w)).join(' ').trim();
          if (finalText) {
            submittedRef.current = true;
            const cb = onFinalRef.current;
            activeRef.current = false;
            destroyRecognition();
            setRecording(false);
            cb(finalText);
          }
        }
      }
    };

    rec.onerror = (event) => {
      console.log('[STT] onerror:', event.error, event.message);
      if (!activeRef.current) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        activeRef.current = false;
        destroyRecognition();
        setRecording(false);
        setError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
      } else if (event.error === 'aborted') {
        // Chrome bloque les relances automatiques — on arrête la boucle
        activeRef.current = false;
        destroyRecognition();
        setRecording(false);
      }
      // no-speech / network : onend va relancer silencieusement
    };

    rec.onend = () => {
      console.log('[STT] onend — active:', activeRef.current, 'submitted:', submittedRef.current);
      if (!activeRef.current || submittedRef.current) return;
      // Chrome a coupé malgré continuous=true — relancer SANS toucher à isRecording
      setTimeout(() => {
        if (!activeRef.current || submittedRef.current) return;
        createAndStart();
      }, 150);
    };

    try {
      rec.start();
    } catch (e) {
      setError({ message: 'Erreur démarrage micro : ' + e.message });
      activeRef.current = false;
      setRecording(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();

    accumulatedRef.current = '';
    onFinalRef.current = onFinalTranscript;
    setTranscript('');
    setError(null);
    isRecordingRef.current = false;

    // Demander explicitement la permission micro avant de lancer STT
    // Chrome exige getUserMedia avant SpeechRecognition sur HTTPS
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // libérer le stream, STT prend le relais
    } catch (e) {
      setError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
      return;
    }

    activeRef.current = true;
    createAndStart();
  }, [destroyRecognition, createAndStart]);

  const stop = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    setRecording(false);
  }, [destroyRecognition, setRecording]);

  const reset = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    accumulatedRef.current = '';
    onFinalRef.current = null;
    setTranscript('');
    setError(null);
    setRecording(false);
  }, [destroyRecognition, setRecording]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      destroyRecognition();
    };
  }, [destroyRecognition]);

  return { transcript, isRecording, error, start, stop, reset };
}