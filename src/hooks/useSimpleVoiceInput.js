import { useRef, useCallback, useState, useEffect, useMemo } from 'react';

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
  const finalCountRef = useRef(0); // nombre de résultats finals déjà traités (toutes sessions confondues)
  const isRecordingRef = useRef(false);
  const micStreamRef = useRef(null); // garde le stream getUserMedia actif

  const setRecording = (val) => {
    // Ne pas changer l'état si on est déjà en enregistrement — rester stable
    if (isRecordingRef.current === val) return;
    isRecordingRef.current = val;
    setIsRecording(val);
  };

  const destroyRecognition = useCallback(() => {
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

  const createAndStart = useCallback(() => {
    if (!activeRef.current || submittedRef.current) return; // Pas de relance si pas actif
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
      if (activeRef.current && !submittedRef.current) {
        setRecording(true);
      }
    };

    rec.onspeechstart = () => {
      console.log('[STT] onspeechstart');
      setError(null);
    };

    rec.onresult = (event) => {
      console.log('[STT] onresult, isFinal:', event.results[event.results.length - 1]?.isFinal);
      if (!activeRef.current || submittedRef.current) return;

      let newFinals = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinals += ' ' + transcript;
          finalCountRef.current = i + 1;
        } else {
          interim += ' ' + transcript;
        }
      }

      if (newFinals) {
        accumulatedRef.current = (accumulatedRef.current + newFinals).trim();
        console.log('[STT] FINAL received:', accumulatedRef.current);
      }
      const displayed = (accumulatedRef.current + interim).trim();
      setTranscript(displayed);

      // Détecter "OK" dans les segments finaux
      if (newFinals && !submittedRef.current) {
        const allFinalText = accumulatedRef.current.toLowerCase();
        console.log('[STT] Checking for OK in:', allFinalText);
        // Accepter "ok", "okay", "o k", espacé ou pas
        const hasOk = /\b(ok|okay|o\s*k)\b/.test(allFinalText);
        if (hasOk && onFinalRef.current) {
          console.log('[STT] OK detected! Submitting...');
          submittedRef.current = true;
          // Enlever "ok"/"okay" du texte final
          const finalText = allFinalText.replace(/\b(ok|okay|o\s*k)\b/g, '').trim();
          const cb = onFinalRef.current;
          activeRef.current = false;
          destroyRecognition();
          setRecording(false);
          cb(finalText);
        }
      }
    };

    rec.onerror = (event) => {
      console.error('[STT] Error event:', event.error);
      if (!activeRef.current || submittedRef.current) return;
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
      console.log('[STT] onend - silence détecté');
      // Arrêter si la synthèse vocale est en cours
      if (window.speechSynthesis?.speaking) {
        console.log('[STT] TTS speaking, stopping voice input');
        activeRef.current = false;
        setRecording(false);
        return;
      }
      // Si actif et pas soumis, relancer automatiquement jusqu'à "OK"
      if (activeRef.current && !submittedRef.current) {
        console.log('[STT] Restarting after silence...');
        setTimeout(() => createAndStart(), 200);
      } else {
        setRecording(false);
      }
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
    finalCountRef.current = 0;
    onFinalRef.current = onFinalTranscript;
    setTranscript('');
    setError(null);
    isRecordingRef.current = false;

    // Obtenir la permission micro ET garder le stream actif
    // Chrome avorte SpeechRecognition si aucun stream audio n'est ouvert
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream; // NE PAS arrêter le stream — on le garde ouvert
    } catch (e) {
      setError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
      return;
    }

    activeRef.current = true;
    setRecording(true); // Mettre à true immédiatement — ne pas attendre onstart
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
    finalCountRef.current = 0;
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

  // Stabiliser le retour avec useMemo pour éviter les re-triggers infinis
  return useMemo(() => ({ transcript, isRecording, error, start, stop, reset }), [transcript, isRecording, error, start, stop, reset]);
}