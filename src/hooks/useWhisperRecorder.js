import { useRef, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook stable pour enregistrement et transcription Whisper.
 * Enregistre en continu, envoie à Whisper chaque 6 secondes.
 * Arrête quand l'utilisateur dit "OK".
 */
export function useWhisperRecorder() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const onCompleteRef = useRef(null);
  const timerRef = useRef(null);

  const recordChunk = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.stop();
    
    // Attendre que ondataavailable soit appelé
    await new Promise(resolve => {
      const checkRecorder = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
          resolve();
        } else {
          setTimeout(checkRecorder, 50);
        }
      };
      checkRecorder();
    });

    if (chunksRef.current.length === 0) {
      // Redémarrer immédiatement si pas de données
      if (mediaRecorderRef.current && micStreamRef.current) {
        mediaRecorderRef.current = new MediaRecorder(micStreamRef.current);
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorderRef.current.start();
      }
      timerRef.current = setTimeout(recordChunk, 6000);
      return;
    }

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const audioBase64 = reader.result;
        const response = await base44.functions.invoke('transcribeAudioV5', { audio: audioBase64 });
        const text = response.data?.text || '';
        
        if (text.trim()) {
          setTranscript(prev => (prev + ' ' + text).trim());
          
          // Détecte "OK"
          if (/\bok\b/i.test(text)) {
            const final = (transcript + ' ' + text).trim().replace(/\bok\b/i, '').trim();
            if (onCompleteRef.current) {
              onCompleteRef.current(final);
            }
            return;
          }
        }

        // Redémarrer la recording
        if (mediaRecorderRef.current && micStreamRef.current) {
          mediaRecorderRef.current = new MediaRecorder(micStreamRef.current);
          mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          mediaRecorderRef.current.start();
          timerRef.current = setTimeout(recordChunk, 6000);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setError({ message: 'Erreur: ' + e.message });
      timerRef.current = setTimeout(recordChunk, 6000);
    }
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

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);

      timerRef.current = setTimeout(recordChunk, 6000);
    } catch (e) {
      setError({ message: 'Erreur micro: ' + e.message });
    }
  }, [recordChunk]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
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
      if (timerRef.current) clearTimeout(timerRef.current);
      stop();
    };
  }, [stop]);

  return { transcript, isRecording, error, start, stop, reset };
}