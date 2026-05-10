import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, Eye, EyeOff, Volume2, Loader2, Dumbbell, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking, unlockAudioForDesktop } from '@/lib/speechServices';
import TrainingComparison from './TrainingComparison';
import { forwardRef, useImperativeHandle } from 'react';

const MyLineRecorder = forwardRef(function MyLineRecorder({ line, onSubmit, onSkip, isComparing, autoPlay, speechRate = 1, listenForCommands, onVoiceCommand, phase, onContinue, onRetry }, ref) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [isSpeakingMyLine, setIsSpeakingMyLine] = useState(false);
  const [sttError, setSttError] = useState(null);

  // Session management — Inspired by desktop/Rehearsal pattern
  const recognitionRef = useRef(null);
  const activeSessionIdRef = useRef(null); // Identifiant unique session actuelle
  const abortControllerRef = useRef(null); // Pour abort propre du STT
  const pendingTimersRef = useRef([]); // Track tous les timers actifs
  
  // Buffers pour accumulation de paroles
  const finalWordsRef = useRef([]);
  const interimRef = useRef('');
  const lastOkTimeRef = useRef(0);
  const restartCountRef = useRef(0);

  const onSubmitRef = useRef(onSubmit);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  const startRecordingRef = useRef(null);

  // Arrêter la session actuellement active
  const stopRecording = useCallback(() => {
    console.log('[STT] stopRecording — session:', activeSessionIdRef.current);
    activeSessionIdRef.current = null; // Invalide toute session active
    restartCountRef.current = 0;

    // Abort et ferme contrôleur
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Nettoie tous les timers en attente
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];

    // Arrête la reconnaissance vocale
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    // 1️⃣ Nettoyer tout ce qui tourne
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

    // 2️⃣ Créer nouvelle session unique
    const newSessionId = Math.random();
    activeSessionIdRef.current = newSessionId;
    console.log('[STT] ▶ Nouvelle session:', newSessionId);

    // 3️⃣ Réinitialiser buffers
    lastOkTimeRef.current = 0;
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setSttError(null);
    restartCountRef.current = 0;

    // 4️⃣ Initialiser audio context
    try {
      await unlockAudioForDesktop();
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error('[STT] ❌ Erreur audio:', e);
    }

    // 5️⃣ Vérifier si session est toujours active
    if (activeSessionIdRef.current !== newSessionId) {
      console.log('[STT] ⚠ Session invalide après audio init');
      return;
    }

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
      console.log('[STT] ✓ onstart - session valide?', isValid, '→', isValid ? '🎤 MICRO ACTIF' : '⚠ Ignorer');
      if (isValid) setIsRecording(true);
    };

    rec.onresult = (event) => {
      if (activeSessionIdRef.current !== newSessionId) {
        console.log('[STT] ⚠ Ignorer onresult: session invalide');
        return;
      }

      // Collecter les résultats finaux
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim();
          console.log('[STT] ✓ Final word:', word);
          if (word && !finalWordsRef.current.includes(word)) {
            finalWordsRef.current.push(word);
          }
        }
      }

      // Récupérer le dernier résultat intermédiaire
      interimRef.current = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        if (!event.results[i].isFinal) {
          interimRef.current = event.results[i][0].transcript.trim();
          if (interimRef.current) console.log('[STT] ⟳ Interim:', interimRef.current);
          break;
        }
      }

      const fullText = finalWordsRef.current.join(' ') +
        (interimRef.current ? (finalWordsRef.current.length > 0 ? ' ' : '') + interimRef.current : '');
      const displayText = fullText.trim();
      if (displayText) console.log('[STT] 📝 Display:', displayText);
      setTranscript(displayText);

      const words = displayText.split(/\s+/);

      // Détecter commandes vocales de navigation
      if (listenForCommands && onVoiceCommand) {
        const lower = displayText.toLowerCase();
        if (lower.includes('passer') || lower.includes('suivant') || lower.includes('continuer')) {
          stopRecording();
          onVoiceCommand('continue');
          return;
        }
        if (lower.includes('réessayer') || lower.includes('recommencer')) {
          stopRecording();
          onVoiceCommand('retry');
          return;
        }
      }

      // Détecteur de commande "OK"
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
      console.error('[STT] ❌ onerror:', e.error);
      if (activeSessionIdRef.current !== newSessionId) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopRecording();
        setSttError({ message: '⚠️ Permission micro refusée\n\nClique sur l\'icône 🔒 et autorise le micro.' });
      }
    };

    rec.onend = () => {
      // Avec continuous: true, ne devrait pas se déclencher
    };

    try {
      // Créer contrôleur d'abort pour cette session
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      rec.start();
      console.log('[STT] ✓ rec.start() lancé');
    } catch (e) {
      console.error('[STT] ❌ rec.start() erreur:', e.message);
      setSttError({ message: `⚠️ Erreur micro: ${e.message}` });
      activeSessionIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      recognitionRef.current = null;
    }
  }, [stopRecording, listenForCommands, onVoiceCommand]);

  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);

  useImperativeHandle(ref, () => ({
    stopRecording
  }), [stopRecording]);

  // Voice commands during result phase
  useEffect(() => {
    if (phase !== 'result' || isRecording) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let active = true;
    let rec = null;

    const start = () => {
      if (!active) return;
      rec = new SpeechRecognition();
      rec.lang = 'fr-FR';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = (event) => {
        if (!active) return;
        const text = event.results[0]?.[0]?.transcript?.toLowerCase().trim() || '';
        if (text.includes('passer') || text.includes('suivant') || text.includes('continuer')) {
          onContinue?.();
        } else if (text.includes('réessayer') || text.includes('recommencer')) {
          onRetry?.();
        }
      };

      rec.onend = () => { if (active) setTimeout(start, 100); };
      rec.onerror = (e) => { if (e.error !== 'aborted' && active) setTimeout(start, 300); };

      try { rec.start(); } catch (e) {}
    };

    const timer = setTimeout(start, 200);

    return () => {
      active = false;
      clearTimeout(timer);
      if (rec) { try { rec.abort(); } catch (e) {} }
    };
  }, [phase, isRecording, onContinue, onRetry]);

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

  // Reset + auto-start when line changes
  useEffect(() => {
    console.log('[STT] useEffect: line changed');
    stopRecording();
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setSttError(null);

    if (autoPlay && !trainingMode) {
      const delay = speechRate >= 2 ? 1500 : 1200;
      const timer = setTimeout(() => {
        console.log('[STT] auto-start après délai');
        startRecordingRef.current();
      }, delay);
      pendingTimersRef.current.push(timer);
      
      return () => {
        clearTimeout(timer);
        pendingTimersRef.current = pendingTimersRef.current.filter(t => t !== timer);
      };
    }
  }, [line, autoPlay, trainingMode, speechRate, stopRecording]);

  const handleSubmit = () => {
    const final = transcript.trim();
    if (final) onSubmit(final);
  };

  const handleReset = () => {
    stopRecording();
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    if (autoPlay && !trainingMode) {
      const timer = setTimeout(() => startRecording(), 300);
      pendingTimersRef.current.push(timer);
    }
  };

  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
              await speakText(line.text, 'fr-FR', 'male', speechRate);
              setIsSpeakingMyLine(false);
              if (wasRecording && autoPlay) {
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

          {/* Mic button */}
          <button
            onClick={handleMicToggle}
            disabled={isComparing}
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
          {isRecording && autoPlay && (
            <p className="text-sm text-muted-foreground mt-1 italic">
              Dites votre réplique, <span className="font-bold text-destructive text-base not-italic">attendez 2 ou 3 secondes</span> puis dites <span className="font-bold text-destructive text-base not-italic">OK</span>
            </p>
          )}
        </div>

        {/* Modes */}
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

        {/* Hint */}
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

        {/* Training comparison */}
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

        {/* Transcript display - only in normal mode */}
        {!trainingMode && (
          <div className="bg-background border border-border rounded-xl px-4 py-3 mb-3 min-h-[2.5rem]">
            <p className="text-foreground leading-relaxed">
              {transcript || <span className="text-muted-foreground text-sm italic">En attente...</span>}
              {isRecording && transcript && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground gap-1">
            Passer
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            {transcript && !trainingMode && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <RotateCcw className="w-4 h-4 mr-1" />
                Recommencer
              </Button>
            )}
            {transcript && !isRecording && !trainingMode && (
              <Button size="sm" onClick={handleSubmit} disabled={isComparing} className="bg-primary text-primary-foreground">
                <Send className="w-4 h-4 mr-1" />
                Valider
              </Button>
            )}
          </div>
        </div>
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