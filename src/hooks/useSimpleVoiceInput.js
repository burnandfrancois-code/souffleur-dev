import { useRef, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Detect if SpeechRecognition is available and not blocked
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSimpleVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  // --- Refs shared ---
  const sessionIdRef = useRef(0);
  const onFinalRef = useRef(null);

  // --- SpeechRecognition refs ---
  const recognitionRef = useRef(null);
  const usingSpeechRef = useRef(false);

  // --- Whisper (MediaRecorder) refs ---
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const allChunksRef = useRef([]);
  const pollTimerRef = useRef(null);
  const lastTranscriptRef = useRef('');
  const isSendingRef = useRef(false);

  // ── WHISPER helpers ──────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const sendAndTranscribe = useCallback(async (mySession) => {
    if (isSendingRef.current || allChunksRef.current.length === 0) return;
    isSendingRef.current = true;
    try {
      const blob = new Blob(allChunksRef.current, { type: 'audio/webm' });
      if (blob.size < 500) { isSendingRef.current = false; return; }
      const base64 = await blobToBase64(blob);
      if (sessionIdRef.current !== mySession) { isSendingRef.current = false; return; }
      const res = await base44.functions.invoke('transcribeAudioV2', { audio: base64 });
      const text = (res?.data?.text || '').trim();
      if (sessionIdRef.current !== mySession) { isSendingRef.current = false; return; }
      if (text && text !== lastTranscriptRef.current) {
        lastTranscriptRef.current = text;
        setTranscript(text);
        // Detect "OK" command
        const words = text.split(/\s+/);
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
      console.warn('[Whisper] error:', e);
    } finally {
      isSendingRef.current = false;
    }
  }, [stopPoll]);

  const stopWhisper = useCallback(() => {
    stopPoll();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
  }, [stopPoll]);

  const startWhisper = useCallback(async (mySession) => {
    allChunksRef.current = [];
    lastTranscriptRef.current = '';
    isSendingRef.current = false;
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError({ message: 'Microphone non accessible : ' + e.message });
      return;
    }
    if (sessionIdRef.current !== mySession) { stream.getTracks().forEach(t => t.stop()); return; }
    streamRef.current = stream;
    setIsRecording(true);
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) allChunksRef.current.push(e.data); };
    recorder.start(250);
    pollTimerRef.current = setInterval(() => {
      if (sessionIdRef.current === mySession) sendAndTranscribe(mySession);
    }, 3000);
  }, [sendAndTranscribe]);

  // ── SPEECH RECOGNITION helpers ───────────────────────────────────

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  const startSpeechRecognition = useCallback((mySession) => {
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalAccumulated = '';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      if (sessionIdRef.current !== mySession) return;
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += t + ' ';
        else interim += t;
      }
      if (newFinal) finalAccumulated += newFinal;
      const displayed = (finalAccumulated + interim).trim();
      setTranscript(displayed);

      // Detect OK command in final results
      if (newFinal) {
        const words = finalAccumulated.trim().split(/\s+/);
        const hasOk = words.some(w => /^(ok|okay)$/i.test(w));
        if (hasOk && onFinalRef.current) {
          const finalText = words.filter(w => !/^(ok|okay)$/i.test(w)).join(' ').trim();
          if (finalText) {
            stopSpeechRecognition();
            setIsRecording(false);
            const cb = onFinalRef.current;
            onFinalRef.current = null;
            cb(finalText);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('[SpeechRecognition] error:', event.error);
      // Any error means SpeechRecognition is blocked (iframe) → fallback to Whisper
      stopSpeechRecognition();
      usingSpeechRef.current = false;
      startWhisper(mySession);
    };

    recognition.onend = () => {
      // Auto-restart if still in the same session (browser stops it after silence)
      if (sessionIdRef.current === mySession && recognitionRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      recognition.start();
    } catch (e) {
      // Fallback to Whisper
      usingSpeechRef.current = false;
      startWhisper(mySession);
    }
  }, [stopSpeechRecognition, startWhisper]);

  // ── PUBLIC API ───────────────────────────────────────────────────

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    if (usingSpeechRef.current) stopSpeechRecognition();
    else stopWhisper();
    setIsRecording(false);
  }, [stopSpeechRecognition, stopWhisper]);

  const start = useCallback(async (onFinalTranscript) => {
    sessionIdRef.current += 1;
    const mySession = sessionIdRef.current;
    onFinalRef.current = onFinalTranscript;
    setTranscript('');
    setError(null);

    if (SpeechRecognition) {
      usingSpeechRef.current = true;
      startSpeechRecognition(mySession);
    } else {
      usingSpeechRef.current = false;
      await startWhisper(mySession);
    }
  }, [startSpeechRecognition, startWhisper]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setError(null);
  }, [stop]);

  useEffect(() => {
    return () => {
      stopPoll();
      stopSpeechRecognition();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [stopPoll, stopSpeechRecognition]);

  return { transcript, isRecording, error, start, stop, reset };
}