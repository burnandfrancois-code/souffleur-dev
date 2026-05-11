import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { MicOff, Loader2 } from 'lucide-react';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';
import { compareTexts } from '@/lib/scriptParser';

const MyLineRecorderAndroidWhisper = forwardRef(function MyLineRecorderAndroidWhisper({ line, onSubmit, onSkip, autoPlay }, ref) {
  const voiceRec = useSimpleVoiceInput();
  const [phase, setPhase] = useState('recording'); // recording, comparing, result
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const stripDirections = (text) =>
    text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  useImperativeHandle(ref, () => ({
    startRecording: () => voiceRec.start(handleFinalText)
  }), [voiceRec]);

  const handleFinalText = async (finalText) => {
    setPhase('comparing');
    try {
      const compareResult = await compareTexts(stripDirections(line.text), finalText);
      setResult(compareResult);
      setPhase('result');
    } catch (e) {
      setError('Erreur comparaison');
      setPhase('recording');
      setResult(null);
    }
  };

  useEffect(() => {
    if (autoPlay) {
      voiceRec.start(handleFinalText);
    }
    return () => voiceRec.stop();
  }, [autoPlay, line]);

  const handleRetry = () => {
    voiceRec.reset();
    setResult(null);
    setError(null);
    setPhase('recording');
    voiceRec.start(handleFinalText);
  };

  const handleContinue = () => {
    onSubmit(result);
  };

  const handleSkipClick = () => {
    voiceRec.stop();
    voiceRec.reset();
    onSkip();
  };

  return (
    <div className="space-y-3">
      {/* Recording state */}
      {phase === 'recording' && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-8 text-center space-y-4">
          <div className="relative w-24 h-24 rounded-full mx-auto flex items-center justify-center bg-destructive shadow-lg shadow-destructive/50">
            <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
            <MicOff className="w-10 h-10 text-white relative z-10" />
          </div>
          <div>
            <p className="text-lg font-bold text-destructive">🎙 Parlez!</p>
            <p className="text-xs text-muted-foreground mt-1">Dites "OK" pour arrêter</p>
          </div>
          <div className="bg-background border-2 border-destructive/40 rounded-lg px-4 py-4 min-h-[3rem] flex items-center justify-center">
            <p className="text-base text-foreground leading-relaxed">
              {voiceRec.transcript ? (
                <>
                  {voiceRec.transcript}
                  <span className="inline-block w-0.5 h-5 bg-destructive ml-1 animate-pulse" />
                </>
              ) : (
                <span className="text-muted-foreground text-sm italic">En écoute...</span>
              )}
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

      {/* Skip button */}
      {phase === 'recording' && (
        <button
          onClick={handleSkipClick}
          className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition"
        >
          Passer
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
});

export default MyLineRecorderAndroidWhisper;