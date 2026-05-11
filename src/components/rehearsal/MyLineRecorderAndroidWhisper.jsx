import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MicOff, Loader2 } from 'lucide-react';
import { useWhisperRecorder } from '@/hooks/useWhisperRecorder';
import { compareTexts } from '@/lib/scriptParser';

export default function MyLineRecorderAndroidWhisper({ line, onLineAdvance }) {
  const voiceRec = useWhisperRecorder();
  const [phase, setPhase] = useState('recording'); // recording, comparing, result
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const stripDirections = (text) =>
    text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  // Démarrer l'enregistrement au montage
  useEffect(() => {
    voiceRec.start(async (finalText) => {
      setPhase('comparing');
      try {
        const compareResult = await compareTexts(stripDirections(line.text), finalText);
        setResult(compareResult);
        setPhase('result');
      } catch (e) {
        setError('Erreur comparaison');
        setPhase('recording');
      }
    });
    return () => voiceRec.stop();
  }, [line, voiceRec]);

  const handleRetry = () => {
    voiceRec.reset();
    setResult(null);
    setError(null);
    setPhase('recording');
    voiceRec.start(async (finalText) => {
      setPhase('comparing');
      try {
        const compareResult = await compareTexts(stripDirections(line.text), finalText);
        setResult(compareResult);
        setPhase('result');
      } catch (e) {
        setError('Erreur comparaison');
        setPhase('recording');
      }
    });
  };

  const handleContinue = () => {
    onLineAdvance(result?.accuracy ?? 0);
  };

  return (
    <div className="space-y-3">
      {/* Recording state */}
      {phase === 'recording' && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-8 text-center">
          <div className="relative w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-4 bg-destructive shadow-lg shadow-destructive/50">
            <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
            <MicOff className="w-10 h-10 text-white relative z-10" />
          </div>
          <p className="text-lg font-bold text-destructive">🎙 Parlez!</p>
          <p className="text-xs text-muted-foreground mt-3">Dites "OK" pour arrêter</p>
          <div className="bg-background border border-border rounded-lg px-4 py-3 mt-4 min-h-[2.5rem] flex items-center">
            <p className="text-sm text-foreground">
              {voiceRec.transcript || <span className="text-muted-foreground text-xs italic">En écoute...</span>}
            </p>
          </div>
        </div>
      )}

      {/* Comparing */}
      {phase === 'comparing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </motion.div>
      )}

      {/* Result */}
      {phase === 'result' && result && (
        <div className="rounded-xl border-2 border-primary bg-primary/10 p-6 text-center space-y-4">
          <div>
            <p className="text-4xl font-bold text-primary">{Math.round(result.accuracy)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Exactitude</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition"
            >
              Recommencer
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}