import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText } from '@/lib/speechServices';
import { useImperativeHandle } from 'react';

const MyLineRecorderAndroid = forwardRef(function MyLineRecorderAndroid({ line, onSubmit, onSkip, autoPlay }, ref) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState(null);
  const [isSpeakingLine, setIsSpeakingLine] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [hasStarted, setHasStarted] = useState(false);
  const autoStartedRef = useRef(false);

  const recognitionRef = useRef(null);
  const userStoppedRef = useRef(false);
  const sessionIdRef = useRef(0);
  const finalWordsRef = useRef([]);
  const interimRef = useRef('');
  const lastOkTimeRef = useRef(0);
  const startRecordingRef = useRef(null);
  const restartCountRef = useRef(0);

  const stopRecording = useCallback(() => {
    userStoppedRef.current = true;
    restartCountRef.current = 0;
    sessionIdRef.current += 1;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const addLog = (msg) => {
    setDebugLogs(prev => [...prev.slice(-9), msg]);
    console.log(msg);
  };

  const startRecording = useCallback(() => {
    sessionIdRef.current += 1;
    const mySession = sessionIdRef.current;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    userStoppedRef.current = false;
    lastOkTimeRef.current = 0;
    finalWordsRef.current = [];
    interimRef.current = '';
    setTranscript('');
    setSttError(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttError({ message: 'Reconnaissance vocale non supportée' });
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    recognitionRef.current = rec;

    rec.onstart = () => {
      addLog(`🎤 onstart - lang: ${rec.lang}, continuous: ${rec.continuous}, interim: ${rec.interimResults}`);
      if (sessionIdRef.current === mySession && !userStoppedRef.current) setIsRecording(true);
    };

    rec.onresult = (event) => {
      addLog(`🎤 onresult - resultIndex: ${event.resultIndex}, total: ${event.results.length}`);
      if (sessionIdRef.current !== mySession || userStoppedRef.current) return;

      // Collecter UNIQUEMENT les nouveaux résultats finaux (depuis resultIndex)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim();
          addLog(`✓ Final: ${word}`);
          if (word) finalWordsRef.current.push(word);
        }
      }

      // Récupérer le dernier résultat intermédiaire uniquement
      interimRef.current = '';
      const last = event.results[event.results.length - 1];
      if (last && !last.isFinal) {
        interimRef.current = last[0].transcript.trim();
      }

      // Afficher final + interim en temps réel
      const fullText = finalWordsRef.current.join(' ') +
        (interimRef.current ? (finalWordsRef.current.length > 0 ? ' ' : '') + interimRef.current : '');
      const displayText = fullText.trim();
      setTranscript(displayText);

      // Détecter commande "OK"
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
            const capturedSession = mySession;
            setTimeout(() => {
              if (sessionIdRef.current !== capturedSession) return;
              stopRecording();
              onSubmit(finalText);
            }, 200);
          }
        }
      }
    };

    rec.onerror = (e) => {
      addLog(`❌ onerror - ${e.error}`);
      if (sessionIdRef.current !== mySession) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopRecording();
        setSttError({ message: 'Permission micro refusée' });
      }
    };

    rec.onend = () => {
      addLog(`🎤 onend - restart ${restartCountRef.current}`);
      if (sessionIdRef.current !== mySession) return;
      if (userStoppedRef.current) return;
      
      restartCountRef.current += 1;
      if (restartCountRef.current > 5) {
        addLog('❌ trop de relances, arrêt');
        setSttError({ message: 'Micro ne détecte rien — vérifiez la permission' });
        return;
      }
      
      addLog(`↻ relance ${restartCountRef.current}...`);
      // Réinitialiser l'accumulation pour éviter la répétition des segments
      finalWordsRef.current = [];
      interimRef.current = '';
      const delay = setTimeout(() => startRecordingRef.current(), 500);
    };

    try {
      addLog('🎤 rec.start() appelé');
      rec.start();
    } catch (e) {
      addLog(`❌ rec.start() erreur: ${e.message}`);
      setSttError({ message: `Erreur: ${e.message}` });
      recognitionRef.current = null;
    }
  }, [stopRecording, onSubmit]);

  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording
  }), [startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (autoPlay && hasStarted && !isRecording && !transcript) {
      const timer = setTimeout(startRecording, 200);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, hasStarted, isRecording, transcript, startRecording]);

  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
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

      {/* Mic button or start prompt */}
      {!hasStarted ? (
        <div className="rounded-xl border-2 border-primary bg-primary/10 p-6 text-center">
          <p className="text-sm text-primary mb-3">Prêt à commencer ?</p>
          <button
            onClick={() => {
              setHasStarted(true);
              setTimeout(() => startRecording(), 100);
            }}
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

      {/* Debug Logs */}
      {debugLogs.length > 0 && (
        <div className="bg-black border border-yellow-500/30 rounded-lg p-2 max-h-24 overflow-y-auto text-xs text-yellow-400 font-mono space-y-0.5">
          {debugLogs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="flex-1 text-xs text-muted-foreground gap-1"
        >
          Passer
        </Button>
        {transcript && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopRecording();
                finalWordsRef.current = [];
                interimRef.current = '';
                setTranscript('');
                setTimeout(() => startRecording(), 300);
              }}
              className="text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                stopRecording();
                onSubmit(transcript);
              }}
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