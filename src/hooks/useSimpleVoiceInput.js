import { useRef, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const allChunksRef = useRef([]); // ALL chunks since start (needed for valid WebM header)
  const sessionIdRef = useRef(0);
  const onFinalRef = useRef(null);
  const pollTimerRef = useRef(null);
  const lastTranscriptRef = useRef('');
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

  const sendAndTranscribe = useCallback(async (mySession) => {
    if (isSendingRef.current) return;
    if (allChunksRef.current.length === 0) return;

    isSendingRef.current = true;

    try {
      // Send ALL chunks from the start so the WebM header is included
      const blob = new Blob(allChunksRef.current, { type: 'audio/webm' });
      if (blob.size < 500) { isSendingRef.current = false; return; }

      const base64 = await blobToBase64(blob);

      if (sessionIdRef.current !== mySession) { isSendingRef.current = false; return; }

      const res = await base44.functions.invoke('transcribeAudio', { audio: base64 });
      const text = (res?.data?.text || '').trim();

      if (sessionIdRef.current !== mySession) { isSendingRef.current = false; return; }

      if (text && text !== lastTranscriptRef.current) {
        lastTranscriptRef.current = text;
        setTranscript(text);

        // Detect "OK" command
        const words = text.split(/\s+/);
        const okIndex = words.findIndex(w => /^(ok|okay|o\.k\.)$/i.test(w));
        if (okIndex !== -1 && onFinalRef.current) {
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
      console.warn('[useSimpleVoiceInput] transcribe error:', e);
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
    allChunksRef.current = [];
    lastTranscriptRef.current = '';
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
      if (e.data && e.data.size > 0) allChunksRef.current.push(e.data);
    };

    recorder.onerror = (e) => console.error('[useSimpleVoiceInput] recorder error:', e);

    // Collect a chunk every 250ms
    recorder.start(250);

    // Transcribe every 3 seconds
    pollTimerRef.current = setInterval(() => {
      if (sessionIdRef.current === mySession) sendAndTranscribe(mySession);
    }, 3000);

  }, [stopPoll, sendAndTranscribe]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setError(null);
    lastTranscriptRef.current = '';
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