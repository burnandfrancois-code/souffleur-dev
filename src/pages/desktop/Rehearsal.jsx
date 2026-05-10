import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Theater, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import ComparisonResult from '@/components/rehearsal/ComparisonResult';
import SessionSummary from '@/components/rehearsal/SessionSummary';

export default function DesktopRehearsal() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scriptId = urlParams.get('scriptId');

  // Redirect Android
  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) {
      navigate(`/android/rehearsal?scriptId=${scriptId}`);
    }
  }, [scriptId, navigate]);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('line'); // 'line' | 'comparing' | 'result'
  const [result, setResult] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeakingPartner, setIsSpeakingPartner] = useState(false);
  const [completed, setCompleted] = useState(new Set());
  const [scores, setScores] = useState([]);
  const [started, setStarted] = useState(false);

  // Refs
  const recognitionRef = useRef(null);
  const sessionRef = useRef(0);

  // Fetch script
  const { data: script, isLoading } = useQuery({
    queryKey: ['script', scriptId],
    queryFn: () => base44.entities.Script.filter({ id: scriptId }),
    select: (data) => data[0],
    enabled: !!scriptId,
    staleTime: Infinity,
  });

  const lines = script?.lines || [];
  const myCharacter = script?.my_character;
  const genders = script?.character_genders || {};
  const currentLine = lines[currentIndex];
  const normalize = (s) => s?.trim().toLowerCase();
  const isMyLine = currentLine && normalize(currentLine.character) === normalize(myCharacter);
  const myLineCount = lines.filter(l => normalize(l.character) === normalize(myCharacter)).length;
  const isFinished = lines.length > 0 && currentIndex >= lines.length;

  const stripDirections = (text) => 
    text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  // Start recording
  const startRecording = useCallback(() => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    setTranscript('');
    setIsRecording(true);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Reconnaissance vocale non supportée');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    recognitionRef.current = rec;

    let finalWords = [];

    rec.onresult = (e) => {
      if (session !== sessionRef.current) return;

      // Collect final results
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const word = e.results[i][0].transcript.trim();
          if (word && !finalWords.includes(word)) finalWords.push(word);
        }
      }

      // Get interim
      let interim = '';
      for (let i = e.results.length - 1; i >= 0; i--) {
        if (!e.results[i].isFinal) {
          interim = e.results[i][0].transcript.trim();
          break;
        }
      }

      const display = (finalWords.join(' ') + (interim ? ' ' + interim : '')).trim();
      setTranscript(display);

      // Detect "OK"
      const hasOk = display.split(/\s+/).some(w => /^ok$/i.test(w) || /^okay$/i.test(w));
      if (hasOk) {
        const text = display.split(/\s+/)
          .filter(w => !/^ok$/i.test(w) && !/^okay$/i.test(w))
          .join(' ')
          .trim();
        if (text) {
          stopRecording();
          submitRecording(text, session);
        }
      }
    };

    rec.onerror = () => {};
    rec.onend = () => {
      if (session === sessionRef.current && !recognitionRef.current?.stopped) {
        try {
          rec.start();
        } catch (e) {}
      }
    };

    try {
      rec.start();
    } catch (e) {
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stopped = true;
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    setIsRecording(false);
  }, []);

  const submitRecording = useCallback(async (text, session) => {
    stopRecording();
    setPhase('comparing');
    const compResult = await compareTexts(stripDirections(currentLine.text), text);
    if (session !== sessionRef.current) return;
    setResult(compResult);
    setScores(prev => [...prev, compResult.accuracy ?? 0]);
    if (compResult.perfect) {
      setCompleted(prev => new Set([...prev, currentIndex]));
    }
    setPhase('result');
  }, [currentLine, currentIndex, stopRecording]);

  // Auto-advance
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    const hasMissing = (result.word_results || []).some(w => w.status === 'missing');
    const shouldAdvance = (result.perfect || (result.accuracy ?? 0) >= 80) && !hasMissing;
    if (shouldAdvance) {
      const timer = setTimeout(() => handleContinue(), 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, result]);

  const handleContinue = useCallback(() => {
    setResult(null);
    setPhase('line');
    setTranscript('');
    setCurrentIndex(prev => prev + 1);
  }, []);

  const handleRetry = () => {
    setResult(null);
    setPhase('line');
    setTranscript('');
  };

  const handleNext = () => {
    stopRecording();
    setResult(null);
    setPhase('line');
    setTranscript('');
    setCurrentIndex(prev => prev + 1);
  };

  const speakPartner = useCallback(async () => {
    stopRecording();
    setIsSpeakingPartner(true);
    const gender = genders[currentLine.character] || 'male';
    await speakText(stripDirections(currentLine.text), 'fr-FR', gender, 1);
    setIsSpeakingPartner(false);
  }, [currentLine, genders, stopRecording]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!script || lines.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/desktop/')}>Retour</Button>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <Theater className="w-12 h-12 text-primary" />
        <h1 className="text-2xl font-bold">{script.title}</h1>
        <p className="text-muted-foreground">Rôle: <span className="text-primary font-semibold">{myCharacter}</span></p>
        <p className="text-sm text-muted-foreground">{lines.length} répliques • {myLineCount} à jouer</p>
        <Button size="lg" onClick={() => setStarted(true)} className="gap-2">
          <Mic className="w-5 h-5" />
          Commencer
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/desktop/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">{script.title}</h1>
                <p className="text-xs text-primary">Rôle: {myCharacter}</p>
              </div>
            </div>
            <Theater className="w-6 h-6 text-primary" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Réplique {currentIndex + 1} / {lines.length}</span>
            <span>{completed.size} / {myLineCount} validées</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {isFinished ? (
              <SessionSummary
                lineScores={scores}
                myLineCount={myLineCount}
                completedMyLines={completed.size}
                scriptTitle={script.title}
                onRestart={() => {
                  setCurrentIndex(0);
                  setCompleted(new Set());
                  setScores([]);
                  setPhase('line');
                }}
              />
            ) : currentLine && (
              <motion.div key={currentIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="text-center text-sm text-muted-foreground">
                  {currentLine.act && `Acte ${currentLine.act}`}{currentLine.scene && ` • Scène ${currentLine.scene}`}
                </div>

                {isMyLine ? (
                  <>
                    {phase === 'line' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border-2 border-primary bg-primary/10 p-6 text-center">
                          <p className="text-sm text-primary mb-4">Votre réplique:</p>
                          <p className="text-lg leading-relaxed text-foreground mb-4">{currentLine.text}</p>
                          <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all ${
                              isRecording
                                ? 'bg-destructive shadow-lg shadow-destructive/50'
                                : 'bg-primary shadow-lg shadow-primary/30 hover:scale-105'
                            }`}
                          >
                            {isRecording ? (
                              <MicOff className="w-10 h-10 text-white" />
                            ) : (
                              <Mic className="w-10 h-10 text-primary-foreground" />
                            )}
                          </button>
                          <p className="text-sm text-muted-foreground mt-4">
                            {isRecording ? 'En cours...' : 'Appuyez pour enregistrer'}
                          </p>
                        </div>

                        {transcript && (
                          <div className="bg-background border border-border rounded-lg p-4">
                            <p className="text-sm text-foreground">{transcript}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button variant="outline" onClick={handleNext} className="flex-1">
                            Passer
                          </Button>
                          {transcript && !isRecording && (
                            <Button onClick={() => submitRecording(transcript, sessionRef.current)} className="flex-1">
                              Valider
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {phase === 'comparing' && (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    )}

                    {phase === 'result' && result && (
                      <ComparisonResult
                        result={result}
                        transcription={transcript}
                        onRetry={handleRetry}
                        onContinue={handleContinue}
                      />
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-secondary/50 border border-border p-4">
                      <p className="text-xs text-muted-foreground mb-2 uppercase">{currentLine.character}</p>
                      <p className="text-lg leading-relaxed text-foreground mb-4">{currentLine.text}</p>
                      <Button
                        onClick={speakPartner}
                        disabled={isSpeakingPartner}
                        variant="outline"
                        className="w-full"
                      >
                        {isSpeakingPartner ? 'Lecture...' : 'Écouter'}
                      </Button>
                    </div>
                    <Button onClick={handleNext} className="w-full">
                      Suivant
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}