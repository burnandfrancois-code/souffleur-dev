import { useRef, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { unlockAudioForDesktop } from '@/lib/speechServices';

/**
 * Hook pour la reconnaissance vocale (STT)
 * Enregistre l'audio en WebM, envoie à backend Whisper pour transcription
 * Gère : session IDs, OK command detection, cleanup
 */
export function useVoiceRecognition() {
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const activeSessionIdRef = useRef(null);
  const pendingTimersRef = useRef([]);
  const lastOkTimeRef = useRef(0);
  const finalWordsRef = useRef([]);

  const stopAll = useCallback(() => {
    activeSessionIdRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    audioChunksRef.current = [];
    setIsRecording(false);
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    stopAll();

    const newSessionId = Math.random();
    activeSessionIdRef.current = newSessionId;
    console.log('[VoiceRecognition] Nouvelle session:', newSessionId);

    lastOkTimeRef.current = 0;
    finalWordsRef.current = [];
    setTranscript('');
    setError(null);
    audioChunksRef.current = [];

    try {
      await unlockAudioForDesktop();
    } catch (e) {
      console.error('[VoiceRecognition] Audio unlock error:', e);
    }

    if (activeSessionIdRef.current !== newSessionId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (activeSessionIdRef.current !== newSessionId) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && activeSessionIdRef.current === newSessionId) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (activeSessionIdRef.current !== newSessionId) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          setTranscript('');
          return;
        }

        try {
          // Convertir Blob en base64
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64Audio = reader.result;

              // Envoyer à backend pour transcription Whisper
              const response = await base44.functions.invoke('transcribeAudio', { audio: base64Audio });
              
              if (!response?.data?.text) {
                if (activeSessionIdRef.current === newSessionId) {
                  setTranscript('');
                }
                return;
              }

              if (activeSessionIdRef.current !== newSessionId) return;

              const text = response.data.text.trim();
              if (!text) {
                setTranscript('');
                return;
              }

              finalWordsRef.current = [text];
              setTranscript(text);

              // Détecte la commande "OK"
              const words = text.split(/\s+/);
              const hasOkCommand = words.some(w => {
                const lower = w.toLowerCase();
                return lower === 'ok' || lower === 'okay' || lower === 'o.k.' || lower === 'oke';
              });

              if (hasOkCommand && onFinalTranscript) {
                const now = Date.now();
                if (now - lastOkTimeRef.current > 1000) {
                  lastOkTimeRef.current = now;
                  const finalText = words
                    .filter(w => {
                      const lower = w.toLowerCase();
                      return lower !== 'ok' && lower !== 'okay' && lower !== 'o.k.' && lower !== 'oke';
                    })
                    .join(' ')
                    .trim();

                  if (finalText) {
                    const capturedSession = newSessionId;
                    setTimeout(() => {
                      if (activeSessionIdRef.current !== capturedSession) return;
                      stop();
                      onFinalTranscript(finalText);
                    }, 600);
                  }
                }
              }
            } catch (e) {
              console.error('[VoiceRecognition] Transcription error:', e);
              if (activeSessionIdRef.current === newSessionId) {
                setError({ message: '⚠️ Erreur transcription' });
              }
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (e) {
          console.error('[VoiceRecognition] Blob read error:', e);
          if (activeSessionIdRef.current === newSessionId) {
            setError({ message: '⚠️ Erreur lecture audio' });
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop après 30 secondes
      const timer = setTimeout(() => {
        if (activeSessionIdRef.current === newSessionId && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 30000);
      pendingTimersRef.current.push(timer);
    } catch (e) {
      console.error('[VoiceRecognition] Start error:', e);
      if (e.name === 'NotAllowedError') {
        setError({ message: '⚠️ Permission micro refusée' });
      } else {
        setError({ message: `⚠️ Erreur micro: ${e.message}` });
      }
      activeSessionIdRef.current = null;
    }
  }, [stopAll]);

  const stop = useCallback(() => {
    console.log('[VoiceRecognition] stop');
    stopAll();
  }, [stopAll]);

  const reset = useCallback(() => {
    stop();
    finalWordsRef.current = [];
    setTranscript('');
    setError(null);
  }, [stop]);

  useEffect(() => {
    return () => {
      activeSessionIdRef.current = null;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      pendingTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  return {
    transcript,
    error,
    isRecording,
    start,
    stop,
    reset,
    pendingTimersRef,
  };
}