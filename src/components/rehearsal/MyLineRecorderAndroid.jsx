import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText } from '@/lib/speechServices';

export default function MyLineRecorderAndroid({ line, onSubmit, onSkip, autoPlay }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState(null);
  const [isSpeakingLine, setIsSpeakingLine] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const recognitionRef = useRef(null);
  const userStoppedRef = useRef(false);
  const sessionIdRef = useRef(0);
  const finalWordsRef = useRef([]);
  const interimRef = useRef('');
  const lastOkTimeRef = useRef(0);
  const startRecordingRef = useRef(null);
  const autoStartedRef = useRef(false);

  const stopRecording = useCallback(() => {
    userStoppedRef.current = true;
    autoStartedRef.current = false;
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
      addLog('🎤 onstart - recording started');
      if (sessionIdRef.current === mySession && !userStoppedRef.current) setIsRecording(true);
    };

    rec.onresult = (event) => {
      addLog(`🎤 onresult - ${event.results.length} résultats`);
      if (sessionIdRef.current !== mySession || userStoppedRef.current) return;

      // Collecter tous les résultats finaux
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim();
          addLog(`✓ Final: ${word}`);
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
          break;
        }
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
      if (sessionIdRef.current !== mySession) return;
      if (userStoppedRef.current) return;
      // Attendre 2s avant de relancer (évite boucles rapides)
      setTimeout(() => {
        if (sessionIdRef.current !== mySession || userStoppedRef.current) return;
        startRecordingRef.current();
      }, 2000);
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
    if (autoPlay && !isRecording && !transcript && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const timer = setTimeout(startRecording, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, startRecording]);

  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="space-y-3">
      {/* Debug Logs */}
      {debugLogs.length > 0 && (
        <div className="bg-black border border-yellow-500/30 rounded-lg p-2 max-h-24 overflow-y-auto text-xs text-yellow-400 font-mono space-y-0.5">
          {debugLogs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}

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
      <div className={`rounded-xl border-2 p-4 text-center transition-all ${
        isRecording ? 'border-destructive bg-destructive/10' : 'border-primary bg-primary/10'
      }`}>
        <button
          onClick={handleMicToggle}
          disabled={false}
          className={`relative w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all mb-3 ${
            isRecording ? 'bg-destructive shadow-lg shadow-destructive/50' : 'bg-primary shadow-lg shadow-primary/30'
          }`}
        >
          {isRecording && <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />}
          {isRecording
            ? <MicOff className="w-8 h-8 text-white relative z-10" />
            : <Mic className="w-8 h-8 text-primary-foreground relative z-10" />
          }
        </button>
        <p className={`text-sm font-semibold ${isRecording ? 'text-destructive' : 'text-primary'}`}>
          {isRecording ? '🎙 Parlez !' : '🎤 C\'est votre tour'}
        </p>
      </div>

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
}