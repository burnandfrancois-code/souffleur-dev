import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImperativeHandle } from 'react';

const MyLineRecorderAndroid = forwardRef(function MyLineRecorderAndroid({ line, onSubmit, onSkip, autoPlay }, ref) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);       // session active ?
  const submittedRef = useRef(false);    // OK déjà déclenché ?
  const accumulatedRef = useRef('');     // texte final accumulé
  const finalCountRef = useRef(0);       // nb résultats finals déjà traités (toutes sessions)
  const startRecordingRef = useRef(null);
  const micStreamRef = useRef(null);

  const destroyRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.onstart = null; r.onresult = null; r.onerror = null; r.onend = null; r.abort(); } catch (e) {}
    }
  }, []);

  const createAndStart = useCallback(() => {
    destroyRecognition();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      if (activeRef.current) setIsRecording(true);
    };

    rec.onresult = (event) => {
      if (!activeRef.current || submittedRef.current) return;

      let newFinals = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          if (i < finalCountRef.current) continue; // déjà traité
          finalCountRef.current = i + 1;
          newFinals += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (newFinals) accumulatedRef.current += ' ' + newFinals;
      const displayed = (accumulatedRef.current + ' ' + interim).trim();
      setTranscript(displayed);

      // Détecter "OK"
      if (newFinals) {
        const allWords = accumulatedRef.current.trim().split(/\s+/);
        const hasOk = allWords.some(w => /^(ok|okay|o\.k\.|oke)$/i.test(w));
        if (hasOk && !submittedRef.current) {
          const finalText = allWords.filter(w => !/^(ok|okay|o\.k\.|oke)$/i.test(w)).join(' ').trim();
          if (finalText) {
            submittedRef.current = true;
            activeRef.current = false;
            destroyRecognition();
            setIsRecording(false);
            onSubmit(finalText);
          }
        }
      }
    };

    rec.onerror = (event) => {
      if (!activeRef.current) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        activeRef.current = false;
        destroyRecognition();
        setIsRecording(false);
        setSttError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
      } else if (event.error === 'aborted') {
        activeRef.current = false;
        destroyRecognition();
        setIsRecording(false);
      }
    };

    rec.onend = () => {
      if (!activeRef.current || submittedRef.current) return;
      // Chrome a coupé — relancer sans toucher à isRecording ni à l'accumulation
      setTimeout(() => {
        if (!activeRef.current || submittedRef.current) return;
        createAndStart();
      }, 150);
    };

    try {
      rec.start();
    } catch (e) {
      setSttError({ message: 'Erreur démarrage micro : ' + e.message });
      activeRef.current = false;
      setIsRecording(false);
    }
  }, [destroyRecognition, onSubmit]);

  const startRecording = useCallback(async () => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    accumulatedRef.current = '';
    finalCountRef.current = 0;
    setTranscript('');
    setSttError(null);
    setIsRecording(false);

    if (!micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      } catch (e) {
        setSttError({ message: 'Permission micro refusée. Autorisez le microphone dans votre navigateur.' });
        return;
      }
    }

    activeRef.current = true;
    createAndStart();
  }, [destroyRecognition, createAndStart]);

  const stopRecording = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    setIsRecording(false);
  }, [destroyRecognition]);

  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);

  useImperativeHandle(ref, () => ({ startRecording, stopRecording }), [startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      destroyRecognition();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
    };
  }, [destroyRecognition]);

  // Reset quand la ligne change
  useEffect(() => {
    stopRecording();
    accumulatedRef.current = '';
    finalCountRef.current = 0;
    setTranscript('');
  }, [line]);

  const handleMicToggle = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <div className="space-y-3">
      {/* Error */}
      {sttError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-lg bg-destructive/10 border border-destructive flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{sttError.message}</p>
        </motion.div>
      )}

      {/* Mic button */}
      {!hasStarted ? (
        <div className="rounded-xl border-2 border-primary bg-primary/10 p-6 text-center">
          <p className="text-sm text-primary mb-3">Prêt à commencer ?</p>
          <button
            onClick={() => { setHasStarted(true); setTimeout(() => startRecording(), 100); }}
            className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all bg-primary shadow-lg shadow-primary/30 hover:scale-105"
          >
            <Mic className="w-8 h-8 text-primary-foreground relative z-10" />
          </button>
          <p className="text-xs text-muted-foreground mt-3">Cliquez pour activer le micro</p>
        </div>
      ) : isRecording ? (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-center">
          <button
            onClick={handleMicToggle}
            className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all mb-3 bg-destructive shadow-lg shadow-destructive/50"
          >
            <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
            <MicOff className="w-8 h-8 text-white relative z-10" />
          </button>
          <p className="text-sm font-semibold text-destructive">🎙 Parlez !</p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-primary bg-primary/10 p-4 text-center">
          <button
            onClick={handleMicToggle}
            className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all mb-3 bg-primary shadow-lg shadow-primary/30 hover:scale-105"
          >
            <Mic className="w-8 h-8 text-primary-foreground relative z-10" />
          </button>
          <p className="text-sm font-semibold text-primary">🎤 C'est votre tour</p>
        </div>
      )}

      {/* Transcript */}
      <div className="bg-background border border-border rounded-lg px-3 py-2 min-h-[2rem] flex items-center">
        <p className="text-sm text-foreground">
          {transcript || <span className="text-muted-foreground text-xs italic">En attente...</span>}
          {isRecording && transcript && <span className="inline-block w-0.5 h-4 bg-primary ml-1 animate-pulse" />}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} className="flex-1 text-xs text-muted-foreground gap-1">
          Passer
        </Button>
        {transcript && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { stopRecording(); accumulatedRef.current = ''; finalCountRef.current = 0; setTranscript(''); setTimeout(() => startRecording(), 300); }}
              className="text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              onClick={() => { stopRecording(); onSubmit(transcript); }}
              className="flex-1 bg-primary text-primary-foreground text-xs gap-1"
            >
              <Send className="w-3 h-3" />
              Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

export default MyLineRecorderAndroid;