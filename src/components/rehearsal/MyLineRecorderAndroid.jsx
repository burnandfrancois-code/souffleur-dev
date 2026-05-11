import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImperativeHandle } from 'react';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';

const MyLineRecorderAndroid = forwardRef(function MyLineRecorderAndroid({ line, onSubmit, onSkip, autoPlay }, ref) {
  const voiceRec = useSimpleVoiceInput();
  const [sttError, setSttError] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const startRecordingRef = useRef(null);

  const startRecording = useCallback(() => {
    setSttError(null);
    voiceRec.start((finalText) => {
      onSubmit(finalText);
    });
  }, [voiceRec, onSubmit]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording: voiceRec.stop,
    reset: voiceRec.reset
  }), [startRecording, voiceRec.stop, voiceRec.reset]);

  // Reset quand la ligne change
  useEffect(() => {
    voiceRec.reset();
    setSttError(null);
    setHasStarted(false);
    // Auto-start si autoPlay est activé
    if (autoPlay) {
      setTimeout(() => {
        setHasStarted(true);
        setTimeout(() => startRecording(), 100);
      }, 300);
    }
  }, [line, autoPlay, voiceRec, startRecording]);

  // Copier les erreurs du hook
  useEffect(() => {
    if (voiceRec.error) {
      setSttError(voiceRec.error);
    }
  }, [voiceRec.error]);

  const handleMicToggle = () => {
    if (voiceRec.isRecording) {
      voiceRec.stop();
    } else {
      startRecording();
    }
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
      ) : voiceRec.isRecording ? (
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
          {voiceRec.transcript || <span className="text-muted-foreground text-xs italic">En attente...</span>}
          {voiceRec.isRecording && voiceRec.transcript && <span className="inline-block w-0.5 h-4 bg-primary ml-1 animate-pulse" />}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} className="flex-1 text-xs text-muted-foreground gap-1">
          Passer
        </Button>
        {voiceRec.transcript && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { voiceRec.reset(); setTimeout(() => startRecording(), 300); }}
              className="text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              onClick={() => { voiceRec.stop(); onSubmit(voiceRec.transcript); }}
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