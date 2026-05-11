import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, Eye, EyeOff, Volume2, Loader2, Dumbbell, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking, unlockAudioForDesktop } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import TrainingComparison from './TrainingComparison';
import ComparisonResult from './ComparisonResult';
import { forwardRef, useImperativeHandle } from 'react';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';

const MyLineRecorder = forwardRef(function MyLineRecorder({ line, script, myCharacter, onLineAdvance }, ref) {
  // Voice Recognition Hook
  const voiceRec = useSimpleVoiceInput();

  // État principal
  const [showHint, setShowHint] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [isSpeakingMyLine, setIsSpeakingMyLine] = useState(false);
  const [phase, setPhase] = useState('line'); // 'line' | 'comparing' | 'result'
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isSpeakingPartner, setIsSpeakingPartner] = useState(false);

  // Refs
  const speakSessionRef = useRef(0);
  const compareSessionRef = useRef(0);
  const speechRateRef = useRef(1);
  const autoPlayRef = useRef(localStorage.getItem('souffleur_autoplay') !== 'false');
  const startRecordingRef = useRef(null);

  // Utils
  const stripDirections = (text) => 
    text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  const normalize = (s) => s?.trim().toLowerCase();
  const currentLineClean = line ? { ...line, text: stripDirections(line.text) } : null;

  // Arrêter tout (TTS + STT)
  const stopAll = useCallback(() => {
    voiceRec.stop();
    stopSpeaking();
    speakSessionRef.current += 1;
    compareSessionRef.current += 1;
    setIsSpeakingPartner(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(() => {
    voiceRec.start((finalText) => {
      handleSubmitRecording(finalText);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording: voiceRec.stop,
    reset: voiceRec.reset
  }), [startRecording, voiceRec.stop, voiceRec.reset]);

  // Comparaison + handling résultat
  const handleSubmitRecording = useCallback(async (spokenText) => {
    compareSessionRef.current += 1;
    const session = compareSessionRef.current;
    
    setPhase('comparing');
    const result = await compareTexts(currentLineClean.text, spokenText);
    
    if (compareSessionRef.current !== session) return;
    
    setComparisonResult(result);
    setPhase('result');
  }, [currentLineClean.text]);

  // Continuation vers prochaine réplique
  const handleContinue = useCallback(() => {
    setComparisonResult(null);
    setPhase('line');
    voiceRec.reset();
    onLineAdvance?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLineAdvance]);

  // Auto-advance après résultat
  useEffect(() => {
    if (phase !== 'result' || !comparisonResult) return;
    
    const accuracy = comparisonResult?.accuracy ?? 0;
    const hasMissingWords = (comparisonResult?.word_results || []).some(w => w.status === 'missing');
    const shouldAdvance = (comparisonResult?.perfect || accuracy >= 80) && !hasMissingWords;

    if (shouldAdvance && autoPlayRef.current) {
      const timer = setTimeout(() => {
        if (autoPlayRef.current) handleContinue();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, comparisonResult, handleContinue]);

  const handleRetry = useCallback(() => {
    setComparisonResult(null);
    setPhase('line');
  }, []);

  // TTS partenaire seul
  const handleSpeakPartnerLine = useCallback(async () => {
    stopAll();
    setIsSpeakingPartner(true);
    const controller = new AbortController();
    
    const genders = script?.character_genders || {};
    const gender = genders[line.character] || 'male';
    
    await speakText(stripDirections(line.text), 'fr-FR', gender, speechRateRef.current, controller.signal);
    setIsSpeakingPartner(false);
  }, [line, script, stopAll]);

  // Reset + auto-start when line changes
  useEffect(() => {
    voiceRec.reset();
    setPhase('line');
    setComparisonResult(null);

    if (autoPlayRef.current && !trainingMode) {
      const delay = speechRateRef.current >= 2 ? 1500 : 1200;
      const timer = setTimeout(() => {
        startRecordingRef.current?.();
      }, delay);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, trainingMode]);

  const isRecording = voiceRec.isRecording;
  const handleMicToggle = () => {
    if (isRecording) {
      voiceRec.stop();
    } else {
      startRecording();
    }
  };

  const handleReset = () => {
    voiceRec.reset();
    if (autoPlayRef.current && !trainingMode) {
      setTimeout(() => startRecording(), 300);
    }
  };

  const handleSkip = () => {
    stopAll();
    voiceRec.reset();
    onLineAdvance?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3 items-start justify-end"
    >
      <div className="flex-1 min-w-0 max-w-[90%]">

        {/* Listen to my line */}
        <div className="flex justify-center mb-3">
          <Button
            variant="outline"
            size="sm"
            disabled={isSpeakingMyLine}
            onClick={async () => {
              const wasRecording = isRecording;
              if (isRecording) {
                voiceRec.stop();
                await new Promise(r => setTimeout(r, 350));
              }
              setIsSpeakingMyLine(true);
              await speakText(line.text, 'fr-FR', 'male', speechRateRef.current);
              setIsSpeakingMyLine(false);
              if (wasRecording && autoPlayRef.current) {
                setTimeout(() => startRecording(), 200);
              }
            }}
            className="gap-2 text-muted-foreground border-border"
          >
            {isSpeakingMyLine
              ? <><Loader2 className="w-4 h-4 animate-spin" />Lecture...</>
              : <><Volume2 className="w-4 h-4 text-primary" />Écouter ma réplique</>
            }
          </Button>
        </div>

        {/* Error */}
        {voiceRec.error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm text-destructive whitespace-pre-wrap">
              {voiceRec.error.message}
            </div>
          </motion.div>
        )}

        {/* Recording banner */}
        {phase === 'line' && (
          <div className={`
            rounded-2xl border-2 p-5 mb-3 text-center transition-all duration-300
            ${isRecording
              ? 'border-destructive bg-destructive/10'
              : 'border-primary bg-primary/10'
            }
          `}>
            <div className="flex items-center justify-center gap-3 mb-3">
              {isRecording && <span className="w-3 h-3 rounded-full bg-destructive animate-ping" />}
              <p className={`font-bold text-xl ${isRecording ? 'text-destructive' : 'text-primary'}`}>
                {isRecording ? '🎙 Parlez maintenant !' : '🎤 C\'est votre tour'}
              </p>
            </div>

            <button
              onClick={handleMicToggle}
              className={`
                relative w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all
                ${isRecording
                  ? 'bg-destructive shadow-2xl shadow-destructive/50'
                  : 'bg-primary shadow-xl shadow-primary/30 hover:scale-105'
                }
              `}
            >
              {isRecording && (
                <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
              )}
              {isRecording
                ? <MicOff className="w-10 h-10 text-white relative z-10" />
                : <Mic className="w-10 h-10 text-primary-foreground relative z-10" />
              }
            </button>

            <p className="text-sm text-muted-foreground mt-2">
              {isRecording ? 'Appuyez pour arrêter' : 'Appuyez pour commencer'}
            </p>
            {isRecording && (
              <p className="text-sm text-muted-foreground mt-1 italic">
                Dites votre réplique, <span className="font-bold text-destructive text-base not-italic">attendez 2-3 secondes</span> puis <span className="font-bold text-destructive text-base not-italic">OK</span>
              </p>
            )}
          </div>
        )}

        {/* Comparing loader */}
        {phase === 'comparing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </motion.div>
        )}

        {/* Comparison result */}
        {phase === 'result' && comparisonResult && (
          <ComparisonResult
            result={comparisonResult}
            transcription={voiceRec.transcript}
            onRetry={handleRetry}
            onContinue={handleContinue}
          />
        )}

        {/* Modes */}
        {phase === 'line' && (
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setTrainingMode(!trainingMode)}
              className={`flex items-center gap-1 text-xs transition-colors ${trainingMode ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-primary'}`}
            >
              <Dumbbell className="w-3 h-3" />
              {trainingMode ? 'Mode entraînement actif' : 'Mode entraînement'}
            </button>
            {!trainingMode && (
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {showHint ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showHint ? 'Cacher le texte' : 'Voir le texte'}
              </button>
            )}
          </div>
        )}

        {/* Hint */}
        {phase === 'line' && (
          <AnimatePresence>
            {showHint && !trainingMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl"
              >
                <p className="text-sm text-muted-foreground italic">{line.text}</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Training comparison */}
        {phase === 'line' && (
          <AnimatePresence>
            {trainingMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <TrainingComparison
                  originalText={line.text}
                  transcript={voiceRec.transcript}
                  isRecording={isRecording}
                  onMicToggle={handleMicToggle}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Transcript display */}
        {phase === 'line' && !trainingMode && (
          <div className="bg-background border border-primary/30 rounded-xl px-4 py-3 mb-3 min-h-[2.5rem]">
            <p className="text-foreground leading-relaxed">
              {voiceRec.transcript || (isRecording ? 'En attente du texte...' : '')}
              {isRecording && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />}
            </p>
          </div>
        )}

        {/* Action buttons */}
        {phase === 'line' && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground gap-1">
              Passer
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              {voiceRec.transcript && voiceRec.transcript !== '🎤' && !trainingMode && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Recommencer
                </Button>
              )}
              {voiceRec.transcript && voiceRec.transcript !== '🎤' && !isRecording && !trainingMode && (
                <Button 
                  size="sm" 
                  onClick={() => handleSubmitRecording(voiceRec.transcript)}
                  className="bg-primary text-primary-foreground"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Valider
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">
            {line.character?.charAt(0)?.toUpperCase()}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

export default MyLineRecorder;