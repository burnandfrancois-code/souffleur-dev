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
    console.log('[RECORDING] State changed to:', val);
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
      setError({ message: 'Pas de stream microphone.' });
      return;
    }

    console.log('[WHISPER] Starting recording chunk...');
    try {
      // Déterminer le codec supporté
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('[WHISPER] audio/webm not supported, trying audio/webm;codecs=opus');
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          console.warn('[WHISPER] audio/webm with opus not supported, trying audio/mp4');
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn('[WHISPER] audio/mp4 not supported, trying default');
            mimeType = '';
          }
        }
      }
      console.log('[WHISPER] Using mimeType:', mimeType);

      const mediaRecorder = new MediaRecorder(micStreamRef.current, mimeType ? { mimeType } : {});
      const chunks = [];
      const actualMimeType = mediaRecorder.mimeType; // Récupérer le type réel utilisé

      mediaRecorder.ondataavailable = (e) => {
        console.log('[WHISPER] ondataavailable triggered, size:', e.data.size);
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onerror = (e) => {
        console.error('[WHISPER] MediaRecorder error:', e.error);
        setError({ message: 'Erreur enregistrement : ' + e.error });
      };

      mediaRecorder.onstop = async () => {
        if (!activeRef.current || submittedRef.current) return;
        console.log('[WHISPER] onstop triggered, chunks:', chunks.length, 'actualMimeType:', actualMimeType, 'total size:', chunks.reduce((a, c) => a + c.size, 0));
        if (chunks.length === 0) {
          console.warn('[WHISPER] No audio chunks recorded');
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
          return;
        }

        const blob = new Blob(chunks, { type: actualMimeType || 'audio/webm' });
        console.log('[WHISPER] Got audio blob, size:', blob.size, 'type:', blob.type);

        if (blob.size === 0) {
          console.warn('[WHISPER] Blob size is 0, no audio data');
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
          return;
        }

        try {
          // Convertir le blob en base64
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const audioBase64 = 'data:audio/webm;base64,' + btoa(binary);
          
          console.log('[WHISPER] Sending audio to transcribeAudioV2, blob size:', blob.size, 'base64 length:', audioBase64.length);
          const response = await base44.functions.invoke('transcribeAudioV2', { audio: audioBase64 });
          const text = response.data?.transcript || response.data?.text || '';
          console.log('[WHISPER] Transcript:', text, 'full response:', response.data);

          if (!activeRef.current || submittedRef.current) return;

          if (text.trim()) {
            accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
          }
          const displayed = accumulatedRef.current;
          setTranscript(displayed);

          // Détecter "OK" (exact match ou au début/fin)
          const allText = displayed.toLowerCase();
          const hasOk = /\bok\b/.test(allText) || /^ok\s/.test(allText) || /\sok$/.test(allText);
          if (hasOk && onFinalRef.current) {
            console.log('[WHISPER] OK detected! Submitting...');
            submittedRef.current = true;
            const finalText = allText.replace(/\bok\b/g, '').trim();
            const cb = onFinalRef.current;
            activeRef.current = false;
            setRecording(false);
            cb(finalText);
            return;
          }

          // Relancer immédiatement pour rester en recording continu sans interruption
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 200);
          }
        } catch (e) {
          console.error('[WHISPER] Error transcribing:', e);
          setError({ message: 'Erreur transcription: ' + e.message });
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
        }
      };

      mediaRecorder.start();
      console.log('[WHISPER] MediaRecorder started, state:', mediaRecorder.state);
      // Enregistrer pendant 6 secondes sur Android pour bien capturer l'audio
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('[WHISPER] Force stopping recording after timeout');
          mediaRecorder.stop();
        } else {
          console.log('[WHISPER] Recording already stopped, state:', mediaRecorder.state);
        }
      }, 6000);
    } catch (e) {
      console.error('[WHISPER] Recording error:', e);
      setError({ message: 'Erreur micro : ' + e.message });
      if (activeRef.current && !submittedRef.current) {
        setTimeout(() => recordWithWhisper(), 1000);
      }
    }
  }, [setError, setRecording]);

  const start = useCallback(async (onFinalTranscript) => {
    console.log('[WHISPER] start() called');
    // Arrêter toute synthèse vocale EN COURS avant de démarrer le micro
    window.speechSynthesis?.cancel();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Arrêter tout ce qui pourrait déjà tourner
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    
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
      console.log('[WHISPER] Got media stream, active:', stream.active, 'tracks:', stream.getTracks().length);
      
      if (!stream.active || stream.getTracks().length === 0) {
        throw new Error('Stream is not active or has no tracks');
      }
    } catch (e) {
      console.error('[WHISPER] getUserMedia error:', e);
      setError({ message: 'Permission micro refusée ou impossible d\'accéder au micro.' });
      setRecording(false);
      return;
    }

    activeRef.current = true;
    setRecording(true);
    console.log('[WHISPER] Starting Whisper recording loop');
    recordWithWhisper();
  }, [recordWithWhisper, setRecording, setError]);

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