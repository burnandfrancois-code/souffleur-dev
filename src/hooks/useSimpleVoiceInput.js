import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook de reconnaissance vocale continue.
 * Utilise Whisper (transcribeAudioV2) sur Android pour une meilleure compatibilité.
 * Reste ouvert jusqu'à ce que l'utilisateur dise "OK".
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

  const recordWithWhisper = useCallback(async () => {
    if (!activeRef.current || submittedRef.current) return;
    if (!micStreamRef.current) {
      console.error('[WHISPER] No media stream available');
      return;
    }

    console.log('[WHISPER] Starting recording chunk...');
    try {
      const mediaRecorder = new MediaRecorder(micStreamRef.current);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        if (!activeRef.current || submittedRef.current) return;

        const blob = new Blob(chunks, { type: 'audio/webm' });
        console.log('[WHISPER] Got audio blob, sending to Whisper...');

        try {
          const response = await base44.functions.invoke('transcribeAudioV2', { audio: blob });
          const text = response.data?.transcript || '';
          console.log('[WHISPER] Transcript:', text);

          if (!activeRef.current || submittedRef.current) return;

          accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
          const displayed = accumulatedRef.current;
          setTranscript(displayed);

          // Détecter "OK"
          const allText = displayed.toLowerCase();
          const hasOk = /\b(ok|okay|o\s*\.?\s*k)\b|^(ok|okay)$/.test(allText);
          if (hasOk && onFinalRef.current) {
            console.log('[WHISPER] OK detected! Submitting...');
            submittedRef.current = true;
            const finalText = allText.replace(/\b(ok|okay|o\s*\.?\s*k)\b|^(ok|okay)$/g, '').trim();
            const cb = onFinalRef.current;
            activeRef.current = false;
            isRecordingRef.current = false;
            setIsRecording(false);
            cb(finalText);
            return;
          }

          // Relancer la capture après 500ms de silence
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
        } catch (e) {
          console.error('[WHISPER] Error transcribing:', e);
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
        }
      };

      mediaRecorder.start();
      console.log('[WHISPER] MediaRecorder started, recording for 2 seconds');
      // Enregistrer pendant 2 secondes
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('[WHISPER] Stopping recording after 2 seconds');
          mediaRecorder.stop();
        }
      }, 2000);
    } catch (e) {
      console.error('[WHISPER] Recording error:', e);
      setError({ message: 'Erreur micro : ' + e.message });
    }
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    console.log('[WHISPER] start() called');
    // Arrêter toute synthèse vocale EN COURS avant de démarrer le micro
    window.speechSynthesis?.cancel();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    activeRef.current = false;
    submittedRef.current = false;

    accumulatedRef.current = '';
    finalCountRef.current = 0;
    onFinalRef.current = onFinalTranscript;
    setTranscript('');
    setError(null);

    // Obtenir le stream micro
    try {
      console.log('[WHISPER] Requesting getUserMedia');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      console.log('[WHISPER] Got media stream, stream active:', stream.active);
    } catch (e) {
      console.error('[WHISPER] getUserMedia error:', e);
      setError({ message: 'Permission micro refusée.' });
      activeRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      return;
    }

    activeRef.current = true;
    isRecordingRef.current = true;
    setIsRecording(true);
    console.log('[WHISPER] Starting Whisper recording loop');
    recordWithWhisper();
  }, [recordWithWhisper]);

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