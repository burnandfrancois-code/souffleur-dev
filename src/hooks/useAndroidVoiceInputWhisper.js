import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook de reconnaissance vocale Whisper (ANDROID UNIQUEMENT - Transcription OpenAI)
 * Détecte "OK" pour arrêter et soumettre le texte.
 */
export function useAndroidVoiceInputWhisper() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const activeRef = useRef(false);
  const submittedRef = useRef(false);
  const onFinalRef = useRef(null);
  const accumulatedRef = useRef('');
  const micStreamRef = useRef(null);

  const destroyRecognition = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const recordWithWhisper = useCallback(async () => {
    if (!activeRef.current || submittedRef.current) return;
    if (!micStreamRef.current) {
      setError({ message: 'Pas de stream microphone.' });
      return;
    }

    try {
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const mediaRecorder = new MediaRecorder(micStreamRef.current, mimeType ? { mimeType } : {});
      const chunks = [];
      const actualMimeType = mediaRecorder.mimeType;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onerror = (e) => {
        setError({ message: 'Erreur enregistrement : ' + e.error });
      };

      mediaRecorder.onstop = async () => {
        if (!activeRef.current || submittedRef.current) return;
        if (chunks.length === 0) {
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
          return;
        }

        const blob = new Blob(chunks, { type: actualMimeType || 'audio/webm' });
        if (blob.size === 0) {
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
          return;
        }

        try {
          const audioBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (e) => reject(new Error('FileReader error: ' + e.message));
            reader.readAsDataURL(blob);
          });

          const response = await base44.functions.invoke('transcribeAudioV5', { audio: audioBase64 });

          if (response.status !== 200) {
            throw new Error('Backend status ' + response.status);
          }

          const text = response.data?.text || response.data?.transcript || '';

          if (!activeRef.current || submittedRef.current) return;

          if (text.trim()) {
            if (!accumulatedRef.current.includes(text)) {
              accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
            }
          }
          const displayed = accumulatedRef.current;
          setTranscript(displayed);

          // Détecter "OK" pour arrêter
          const allText = displayed.toLowerCase();
          const hasOk = /\bok\b/.test(allText) || /^ok\s/.test(allText) || /\sok$/.test(allText);
          if (hasOk && onFinalRef.current) {
            submittedRef.current = true;
            const finalText = allText.replace(/\bok\b/g, '').trim();
            const cb = onFinalRef.current;
            activeRef.current = false;
            setIsRecording(false);
            cb(finalText);
            return;
          }

          // Relancer avec délai respectant le rate limit
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 20000);
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
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 2500);
    } catch (e) {
      setError({ message: 'Erreur micro : ' + e.message });
      if (activeRef.current && !submittedRef.current) {
        setTimeout(() => recordWithWhisper(), 1500);
      }
    }
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    window.speechSynthesis?.cancel();
    await new Promise(resolve => setTimeout(resolve, 300));

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    activeRef.current = false;
    submittedRef.current = false;
    accumulatedRef.current = '';
    onFinalRef.current = onFinalTranscript;
    setTranscript('');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      if (!stream.active || stream.getTracks().length === 0) {
        throw new Error('Stream is not active or has no tracks');
      }
    } catch (e) {
      setError({ message: 'Permission micro refusée ou impossible d\'accéder au micro.' });
      setIsRecording(false);
      return;
    }

    activeRef.current = true;
    setIsRecording(true);
    recordWithWhisper();
  }, [recordWithWhisper]);

  const stop = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    setIsRecording(false);
  }, [destroyRecognition]);

  const reset = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    accumulatedRef.current = '';
    onFinalRef.current = null;
    setTranscript('');
    setError(null);
    setIsRecording(false);
  }, [destroyRecognition]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      destroyRecognition();
    };
  }, [destroyRecognition]);

  return useMemo(() => ({ transcript, isRecording, error, start, stop, reset }), [transcript, isRecording, error, start, stop, reset]);
}