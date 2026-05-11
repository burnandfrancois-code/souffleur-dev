import { useRef, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionIdRef = useRef(0);
  const onFinalRef = useRef(null);
  const pollTimerRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');
  const isSendingRef = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const sendChunk = useCallback(async (mySession) => {
    if (isSendingRef.current) return;
    if (chunksRef.current.length === 0) return;

    const chunksCopy = [...chunksRef.current];
    chunksRef.current = [];
    isSendingRef.current = true;

    try {
      const blob = new Blob(chunksCopy, { type: 'audio/webm' });
      if (blob.size < 1000) { isSendingRef.current = false; return; }

      const base64 = await blobToBase64(blob);

      if (sessionIdRef.current !== mySession) { isSendingRef.current = false; return; }

      const res = await base44.functions.invoke('transcribeAudio', { audio: base64 });
      const text = (res?.data?.text || '').trim();

      if (sessionIdRef.current !== mySession) { isSendingRef.current = false; return; }

      if (text) {
        accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + text).trim();
        setTranscript(accumulatedTranscriptRef.current);

        // Detect "OK" command
        const words = accumulatedTranscriptRef.current.split(/\s+/);
        const hasOk = words.some(w => /^(ok|okay|o\.k\.)$/i.test(w));
        if (hasOk && onFinalRef.current) {
          const finalText = words.filter(w => !/^(ok|okay|o\.k\.)$/i.test(w)).join(' ').trim();
          if (finalText) {
            stopPoll();
            const cb = onFinalRef.current;
            onFinalRef.current = null;
            cb(finalText);
          }
        }
      }
    } catch (e) {
      console.warn('[useSimpleVoiceInput] sendChunk error:', e);
    } finally {
      isSendingRef.current = false;
    }
  }, [stopPoll]);

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    stopPoll();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, [stopPoll]);

  const start = useCallback(async (onFinalTranscript) => {
    sessionIdRef.current += 1;
    const mySession = sessionIdRef.current;

    onFinalRef.current = onFinalTranscript;
    accumulatedTranscriptRef.current = '';
    chunksRef.current = [];
    isSendingRef.current = false;
    setTranscript('');
    setError(null);
    stopPoll();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError({ message: 'Microphone non accessible : ' + e.message });
      return;
    }

    if (sessionIdRef.current !== mySession) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    streamRef.current = stream;
    setIsRecording(true);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onerror = (e) => console.error('[useSimpleVoiceInput] recorder error:', e);

    // Collect chunks every 500ms
    recorder.start(500);

    // Send to Whisper every 4 seconds
    pollTimerRef.current = setInterval(() => {
      if (sessionIdRef.current === mySession) sendChunk(mySession);
    }, 4000);

  }, [stopPoll, sendChunk]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setError(null);
    accumulatedTranscriptRef.current = '';
  }, [stop]);

  useEffect(() => {
    return () => {
      stopPoll();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [stopPoll]);

  return { transcript, isRecording, error, start, stop, reset };
}