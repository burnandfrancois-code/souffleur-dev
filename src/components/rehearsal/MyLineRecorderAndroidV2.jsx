import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWhisperRecorder } from '@/hooks/useWhisperRecorder';
import { compareTexts } from '@/lib/scriptParser';

export default function MyLineRecorderAndroidV2({ line, script, myCharacter, onLineAdvance, autoPlay }) {
  const voiceRec = useWhisperRecorder();
  const [sttError, setSttError] = useState(null);
  const [phase, setPhase] = useState('waiting'); // waiting, recording, comparing, result
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stripDirections = (text) =>
    text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  // Auto-start recording quand le composant monte et que autoPlay est true
  useEffect(() => {
    if (autoPlay && phase === 'waiting') {
      startRecording();
    }
  }, []);

  const startRecording = useCallback(() => {
    setSttError(null);
    setPhase('recording');
    voiceRec.start((finalText) => {
      handleSubmit(finalText);
    });
  }, [voiceRec]);

  const handleSubmit = useCallback(async (spokenText) => {
    if (!line?.text || !spokenText.trim()) return;

    setIsSubmitting(true);
    setPhase('comparing');

    try {
      const result = await compareTexts(stripDirections(line.text), spokenText);
      setComparisonResult(result);
      setPhase('result');
      
      // Auto-avancer si résultat parfait
      if (result?.perfect) {
        setTimeout(() => onLineAdvance(100), 1200);
      }
    } catch (e) {
      setSttError({ message: 'Erreur comparaison: ' + e.message });
      setPhase('recording');
    } finally {
      setIsSubmitting(false);
    }
  }, [line, onLineAdvance]);

  const handleRetry = () => {
    voiceRec.reset();
    setSttError(null);
    setComparisonResult(null);
    setPhase('waiting');
    setTimeout(() => startRecording(), 300);
  };

  const handleSkip = () => {
    voiceRec.stop();
    voiceRec.reset();
    setSttError(null);
    setPhase('waiting');
    onLineAdvance(0);
  };

  const handleContinue = () => {
    const score = comparisonResult?.accuracy ?? 0;
    voiceRec.reset();
    setSttError(null);
    setComparisonResult(null);
    setPhase('waiting');
    onLineAdvance(score);
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

      {/* Recording state */}
      {phase === 'recording' && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-center">
          <button
            onClick={() => voiceRec.stop()}
            className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all mb-3 bg-destructive shadow-lg shadow-destructive/50"
          >
            <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
            <MicOff className="w-8 h-8 text-white relative z-10" />
          </button>
          <p className="text-sm font-semibold text-destructive">🎙 Parlez !</p>
          <p className="text-xs text-muted-foreground mt-2">Dites "OK" pour arrêter</p>
        </div>
      )}

      {/* Waiting state */}
      {phase === 'waiting' && (
        <div className="rounded-xl border-2 border-primary bg-primary/10 p-4 text-center">
          <button
            onClick={startRecording}
            className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all mb-3 bg-primary shadow-lg shadow-primary/30 hover:scale-105"
          >
            <Mic className="w-8 h-8 text-primary-foreground relative z-10" />
          </button>
          <p className="text-sm font-semibold text-primary">En attente du texte</p>
        </div>
      )}

      {/* Comparing state */}
      {phase === 'comparing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </motion.div>
      )}

      {/* Result state */}
      {phase === 'result' && comparisonResult && (
        <div className="space-y-3">
          <div className="rounded-lg bg-card border border-border p-4 text-center">
            <p className="text-3xl font-bold text-primary mb-2">{Math.round(comparisonResult.accuracy)}%</p>
            <p className="text-xs text-muted-foreground">Exactitude</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRetry}
              className="flex-1 text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Recommencer
            </Button>
            <Button
              onClick={handleContinue}
              className="flex-1 bg-primary text-primary-foreground text-xs"
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Transcript display */}
      {(phase === 'recording' || phase === 'comparing') && (
        <div className="bg-background border border-border rounded-lg px-3 py-2 min-h-[2rem] flex items-center">
          <p className="text-sm text-foreground">
            {voiceRec.transcript || <span className="text-muted-foreground text-xs italic">En écoute...</span>}
          </p>
        </div>
      )}

      {/* Skip button */}
      {phase === 'recording' && (
        <Button variant="ghost" size="sm" onClick={handleSkip} className="w-full text-xs text-muted-foreground">
          Passer
        </Button>
      )}
    </div>
  );
}