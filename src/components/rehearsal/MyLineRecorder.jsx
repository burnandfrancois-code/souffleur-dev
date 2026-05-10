import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, Eye, EyeOff, Volume2, Loader2, Dumbbell, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking, unlockAudioForDesktop } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import TrainingComparison from './TrainingComparison';
import ComparisonResult from './ComparisonResult';
import { forwardRef, useImperativeHandle } from 'react';

const MyLineRecorder = forwardRef(function MyLineRecorder({ line, script, myCharacter, onLineAdvance }, ref) {
  // État principal
  const [transcript, setTranscript] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [isSpeakingMyLine, setIsSpeakingMyLine] = useState(false);
  const [sttError, setSttError] = useState(null);
  const [phase, setPhase] = useState('line'); // 'line' | 'comparing' | 'result'
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isSpeakingPartner, setIsSpeakingPartner] = useState(false);

  // Refs de session — inspiré de desktop/Rehearsal
  const recognitionRef = useRef(null);
  const activeSessionIdRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pendingTimersRef = useRef([]);
  const finalWordsRef = useRef([]);
  const interimRef = useRef('');
  const lastOkTimeRef = useRef(0);
  const restartCountRef = useRef(0);
  
  const onSubmitRef = useRef(() => {});
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

  // Arrêter tout (TTS + STT + timers)
  const stopAll = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSpeaking();
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    speakSessionRef.current += 1;
    compareSessionRef.current += 1;
    setIsSpeakingPartner(false);
  }, []);

  // STT stopRecording
  const stopRecording = useCallback(() => {
    console.log('[STT] stopRecording');
    activeSessionIdRef.current = null;
    restartCountRef.current = 0;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  // STT startRecording
  const startRecording = useCallback(async () => {
    stopAll();
    
    const newSessionId = Math.random();
    activeSessionIdRef.current = newSessionId;
    console.log('[STT] Nouvelle session:', newSessionId);

    lastOkTimeRef.current = 0;
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setSttError(null);
    restartCountRef.current = 0;

    try {
      await unlockAudioForDesktop();
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error('[STT] Erreur audio:', e);
    }

    if (activeSessionIdRef.current !== newSessionId) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttError({ message: "Reconnaissance vocale non supportée. Utilisez Chrome ou Edge." });
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    recognitionRef.current = rec;

    rec.onstart = () => {
      const isValid = activeSessionIdRef.current === newSessionId;
      console.log('[STT] onstart - valide?', isValid);
      if (isValid) setTranscript('🎤');
    };

    rec.onresult = (event) => {
      if (activeSessionIdRef.current !== newSessionId) return;

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim();
          if (word && !finalWordsRef.current.includes(word)) {
            finalWordsRef.current.push(word);
          }
        }
      }

      interimRef.current = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        if (!event.results[i].isFinal) {
          interimRef.current = event.results[i][0].transcript.trim();
          break;
        }
      }

      const fullText = finalWordsRef.current.join(' ') +
        (interimRef.current ? (finalWordsRef.current.length > 0 ? ' ' : '') + interimRef.current : '');
      const displayText = fullText.trim();
      setTranscript(displayText);

      const words = displayText.split(/\s+/);
      const hasOkCommand = words.some(w => {
        const lower = w.toLowerCase();
        return lower === 'ok' || lower === 'okay' || lower === 'o.k.' || lower === 'oke';
      });

      if (hasOkCommand) {
        const now = Date.now();
        if (now - lastOkTimeRef.current > 1000) {
          lastOkTimeRef.current = now;
          const finalText = words
            .filter(w => {
              const lower = w.toLowerCase();
              return lower !== 'ok' && lower !== 'okay' && lower !== 'o.k.' && lower !== 'oke';
            })
            .join(' ')
            .trim();
          if (finalText) {
            const capturedSession = newSessionId;
            setTimeout(() => {
              if (activeSessionIdRef.current !== capturedSession) return;
              stopRecording();
              onSubmitRef.current(finalText);
            }, 600);
          }
        }
      }
    };

    rec.onerror = (e) => {
      console.error('[STT] onerror:', e.error);
      if (activeSessionIdRef.current !== newSessionId) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopRecording();
        setSttError({ message: '⚠️ Permission micro refusée' });
      }
    };

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      rec.start();
      console.log('[STT] rec.start() lancé');
    } catch (e) {
      console.error('[STT] rec.start() erreur:', e.message);
      setSttError({ message: `⚠️ Erreur micro: ${e.message}` });
      activeSessionIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      recognitionRef.current = null;
    }
  }, [stopAll]);

  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);
  useEffect(() => { onSubmitRef.current = (text) => handleSubmitRecording(text); }, []);

  useImperativeHandle(ref, () => ({
    stopRecording
  }), [stopRecording]);

  // Comparaison + handling résultat
  const handleSubmitRecording = async (spokenText) => {
    compareSessionRef.current += 1;
    const session = compareSessionRef.current;
    
    setPhase('comparing');
    const result = await compareTexts(currentLineClean.text, spokenText);
    
    if (compareSessionRef.current !== session) return;
    
    setComparisonResult(result);
    setPhase('result');
  };

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
  }, [phase, comparisonResult]);

  // Continuation vers prochaine réplique
  const handleContinue = useCallback(() => {
    setComparisonResult(null);
    setPhase('line');
    setTranscript('');
    setSttError(null);
    onLineAdvance?.();
  }, [onLineAdvance]);

  const handleRetry = useCallback(() => {
    setComparisonResult(null);
    setPhase('line');
  }, []);

  // TTS partenaire seul
  const handleSpeakPartnerLine = useCallback(async () => {
    setIsSpeakingPartner(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const genders = script?.character_genders || {};
    const gender = genders[line.character] || 'male';
    
    await speakText(stripDirections(line.text), 'fr-FR', gender, speechRateRef.current, controller.signal);
    setIsSpeakingPartner(false);
  }, [line, script]);

  // Reset + auto-start when line changes
  useEffect(() => {
    stopRecording();
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setSttError(null);
    setPhase('line');
    setComparisonResult(null);

    if (autoPlayRef.current && !trainingMode) {
      const delay = speechRateRef.current >= 2 ? 1500 : 1200;
      const timer = setTimeout(() => {
        startRecordingRef.current?.();
      }, delay);
      pendingTimersRef.current.push(timer);
      
      return () => {
        clearTimeout(timer);
        pendingTimersRef.current = pendingTimersRef.current.filter(t => t !== timer);
      };
    }
  }, [line, trainingMode, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeSessionIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const isRecording = transcript === '🎤' || (transcript && !comparisonResult && phase === 'line');
  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleReset = () => {
    stopRecording();
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    if (autoPlayRef.current && !trainingMode) {
      const timer = setTimeout(() => startRecording(), 300);
      pendingTimersRef.current.push(timer);
    }
  };

  const handleSkip = () => {
    stopAll();
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
                stopRecording();
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
        {sttError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm text-destructive whitespace-pre-wrap">
              {sttError.message}
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
            transcription={transcript}
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
                  transcript={transcript}
                  isRecording={isRecording}
                  onMicToggle={handleMicToggle}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Transcript display */}
        {phase === 'line' && !trainingMode && (
          <div className="bg-background border border-border rounded-xl px-4 py-3 mb-3 min-h-[2.5rem]">
            <p className="text-foreground leading-relaxed">
              {transcript && transcript !== '🎤' ? transcript : <span className="text-muted-foreground text-sm italic">En attente...</span>}
              {isRecording && transcript && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />}
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
              {transcript && transcript !== '🎤' && !trainingMode && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Recommencer
                </Button>
              )}
              {transcript && transcript !== '🎤' && !isRecording && !trainingMode && (
                <Button 
                  size="sm" 
                  onClick={() => handleSubmitRecording(transcript)}
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