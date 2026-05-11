import { useRef, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useWhisperRecorder() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const onCompleteRef = useRef(null);
  const intervalRef = useRef(null);
  const isProcessingRef = useRef(false);

  const sendChunk = useCallback(async () => {
    if (isProcessingRef.current || chunksRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const chunks = chunksRef.current;
    chunksRef.current = [];

    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });

      const response = await base44.functions.invoke('transcribeAudioV5', { audio: base64 });
      const text = response.data?.text || '';

      if (text.trim()) {
        const newTranscript = (transcript + ' ' + text).trim();
        setTranscript(newTranscript);

        // Détecte "OK"
        if (/\bok\b/i.test(text)) {
          const final = newTranscript.replace(/\bok\b/i, '').trim();
          if (onCompleteRef.current) {
            onCompleteRef.current(final);
          }
          isProcessingRef.current = false;
          return;
        }
      }
    } catch (e) {
      console.error('[WHISPER] Erreur:', e);
      setError({ message: 'Erreur transcription' });
    }

    isProcessingRef.current = false;
  }, [transcript]);

  const start = useCallback(async (onComplete) => {
    window.speechSynthesis?.cancel();
    await new Promise(resolve => setTimeout(resolve, 300));

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      onCompleteRef.current = onComplete;
      setTranscript('');
      setError(null);
      chunksRef.current = [];

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Envoyer les chunks toutes les 6 secondes
      intervalRef.current = setInterval(sendChunk, 6000);
    } catch (e) {
      setError({ message: 'Erreur micro: ' + e.message });
    }
  }, [sendChunk]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setError(null);
    chunksRef.current = [];
  }, [stop]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stop();
    };
  }, [stop]);

  return { transcript, isRecording, error, start, stop, reset };
}