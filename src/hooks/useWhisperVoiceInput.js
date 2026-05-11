import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useWhisperVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const onCompleteRef = useRef(null);

  const start = useCallback((onComplete) => {
    console.log('[WHISPER] Starting recording...');
    onCompleteRef.current = onComplete;
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          console.log('[WHISPER] Recording stopped, sending to Whisper...');
          stream.getTracks().forEach(track => track.stop());

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('language', 'fr');

            const response = await base44.functions.invoke('transcribeAudioV2', {
              audio_blob: audioBlob,
              language: 'fr'
            });

            const transcribedText = response.data?.text || '';
            console.log('[WHISPER] Transcribed:', transcribedText);
            setTranscript(transcribedText);
            setIsRecording(false);

            if (onCompleteRef.current) {
              onCompleteRef.current(transcribedText);
            }
          } catch (err) {
            console.error('[WHISPER] Error:', err);
            setError({
              message: 'Erreur de transcription. Vérifiez votre connexion.',
              code: err.code
            });
            setIsRecording(false);
          }
        };

        setIsRecording(true);
        mediaRecorder.start();
      })
      .catch(err => {
        console.error('[WHISPER] Mic error:', err);
        setError({
          message: 'Microphone refusé. Vérifiez les permissions.',
          code: err.name
        });
      });
  }, []);

  const stop = useCallback(() => {
    console.log('[WHISPER] Stopping...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const reset = useCallback(() => {
    console.log('[WHISPER] Resetting...');
    setTranscript('');
    setError(null);
    audioChunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  return {
    transcript,
    isRecording,
    error,
    start,
    stop,
    reset
  };
}