import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Theater, ChevronRight, ChevronLeft, Trophy, Loader2, Mic, FastForward, Rewind, Zap, Hand, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking, unlockAudioForDesktop } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import PartnerLine from '@/components/rehearsal/PartnerLine';
import MyLineRecorder from '@/components/rehearsal/MyLineRecorder';
import ComparisonResult from '@/components/rehearsal/ComparisonResult';
import RehearsalProgress from '@/components/rehearsal/RehearsalProgress';
import MyLinesPanel from '@/components/rehearsal/MyLinesPanel';
import SessionSummary from '@/components/rehearsal/SessionSummary';

export default function Rehearsal() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scriptId = urlParams.get('scriptId');

  // Rediriger Android vers /android/rehearsal
  const isAndroidDevice = /Android/i.test(navigator.userAgent);
  
  useEffect(() => {
    if (isAndroidDevice) {
      navigate(`/android/rehearsal?scriptId=${scriptId}`);
    }
  }, [isAndroidDevice, scriptId, navigate]);

  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [phase, setPhase] = useState('line');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [completedMyLines, setCompletedMyLines] = useState(new Set());
  const [lineScores, setLineScores] = useState([]);
  const [started, setStarted] = useState(false);
  const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem('souffleur_autoplay') !== 'false');
  const [showMyLines, setShowMyLines] = useState(false);
  const [speechRate, setSpeechRate] = useState(() => parseFloat(localStorage.getItem('souffleur_rate') || '1'));

  const scrollRef = useRef(null);
  const myLineRecorderRef = useRef(null);
  const autoPlayRef = useRef(autoPlay);
  const speechRateRef = useRef(speechRate);
  const currentLineIndexRef = useRef(currentLineIndex);
  const speakSessionRef = useRef(0);
  const pendingTimersRef = useRef([]);
  const abortControllerRef = useRef(null);
  const compareSessionRef = useRef(0);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
    localStorage.setItem('souffleur_autoplay', autoPlay ? 'true' : 'false');
  }, [autoPlay]);

  useEffect(() => {
    speechRateRef.current = speechRate;
    localStorage.setItem('souffleur_rate', String(speechRate));
  }, [speechRate]);

  const { data: script, isLoading } = useQuery({
    queryKey: ['script', scriptId],
    queryFn: () => base44.entities.Script.filter({ id: scriptId }),
    select: (data) => data[0],
    enabled: !!scriptId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const stripDirections = (text) => text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  const lines = script?.lines || [];
  const myCharacter = script?.my_character;
  const characterGenders = script?.character_genders || {};
  const currentLine = lines[currentLineIndex];
  const currentLineClean = currentLine ? { ...currentLine, text: stripDirections(currentLine.text) } : null;
  const normalize = (s) => s?.trim().toLowerCase();
  const isMyLine = normalize(currentLine?.character) === normalize(myCharacter);
  const myLineCount = lines.filter(l => normalize(l.character) === normalize(myCharacter)).length;
  const isFinished = lines.length > 0 && currentLineIndex >= lines.length;

  useEffect(() => {
    currentLineIndexRef.current = currentLineIndex;
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentLineIndex, phase]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      pendingTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const stopAll = useCallback(() => {
    if (myLineRecorderRef.current) {
      myLineRecorderRef.current.stop();
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
  }, []);

  const speakAndAdvance = useCallback(async (startIndex, linesArr, myChar, genders, session, signal) => {
    const norm = (s) => s?.trim().toLowerCase();
    let index = startIndex;

    while (session === speakSessionRef.current && !signal?.aborted && index < linesArr.length) {
      const line = linesArr[index];
      if (!line) break;

      if (norm(line.character) === norm(myChar)) {
        setCurrentLineIndex(index);
        setIsSpeaking(false);
        return;
      }

      setCurrentLineIndex(index);
      setIsSpeaking(true);
      const gender = genders[line.character] || 'male';
      await speakText(stripDirections(line.text), 'fr-FR', gender, speechRateRef.current, signal);

      if (session !== speakSessionRef.current || signal?.aborted || !autoPlayRef.current) {
        setIsSpeaking(false);
        return;
      }

      index++;
    }

    setIsSpeaking(false);
  }, []);

  const launchSpeakChain = useCallback((index, linesArr, myChar, genders) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = null;
    stopSpeaking();
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    speakSessionRef.current += 1;
    const session = speakSessionRef.current;

    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      speakAndAdvance(index, linesArr, myChar, genders, session, controller.signal);
    }, 50);
    pendingTimersRef.current.push(timer);
  }, [speakAndAdvance]);

  const handleSpeakPartnerLine = async (text, character) => {
    stopAll();
    setIsSpeaking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    await speakText(text, 'fr-FR', characterGenders[character] || 'male', speechRate, controller.signal);
    setIsSpeaking(false);
  };

  const handleSubmitRecording = async (spokenText) => {
    const idx = currentLineIndexRef.current;
    const lineText = currentLineClean.text;
    compareSessionRef.current += 1;
    const session = compareSessionRef.current;
    setPhase('comparing');
    const result = await compareTexts(lineText, spokenText);
    if (compareSessionRef.current !== session) return;
    if (currentLineIndexRef.current !== idx) return;
    setComparisonResult(result);
    setLineScores(prev => [...prev, result.accuracy ?? 0]);
    if (result.perfect) {
      setCompletedMyLines(prev => new Set([...prev, idx]));
    }
    setPhase('result');
  };

  useEffect(() => {
     const accuracy = comparisonResult?.accuracy ?? 0;
     const hasMissingWords = (comparisonResult?.word_results || []).some(w => w.status === 'missing');
     const shouldAdvance = (comparisonResult?.perfect || accuracy >= 100) && !hasMissingWords;
     if (phase === 'result' && shouldAdvance && autoPlayRef.current) {
       const timer = setTimeout(() => {
         if (autoPlayRef.current) handleContinue();
       }, 1200);
       return () => clearTimeout(timer);
     }
   }, [phase, comparisonResult, handleContinue]);

  const handleRetry = () => {
    setComparisonResult(null);
    setPhase('line');
  };

  const handleContinue = () => {
    const idx = currentLineIndexRef.current;
    if (comparisonResult?.perfect) {
      setCompletedMyLines(prev => new Set([...prev, idx]));
    }

    const nextIndex = idx + 1;
    const nextLine = lines[nextIndex];

    setComparisonResult(null);
    setPhase('line');
    setCurrentLineIndex(nextIndex);

    if (!nextLine) return;

    const nextIsPartner = normalize(nextLine.character) !== normalize(myCharacter);
    if (nextIsPartner && autoPlayRef.current) {
      launchSpeakChain(nextIndex, lines, myCharacter, characterGenders);
    }
  };

  const handleJumpTo = (idx) => {
    stopAll();
    setPhase('line');
    setComparisonResult(null);
    setTimeout(() => {
      setCurrentLineIndex(idx);
      const targetLine = lines[idx];
      if (targetLine && normalize(targetLine.character) !== normalize(myCharacter) && autoPlayRef.current) {
        launchSpeakChain(idx, lines, myCharacter, characterGenders);
      }
    }, 100);
  };

  const goToPrevLine = () => {
    if (currentLineIndex > 0) {
      stopAll();
      setPhase('line');
      setComparisonResult(null);
      setTimeout(() => {
        setCurrentLineIndex(prev => prev - 1);
      }, 100);
    }
  };

  const handleNextPartnerLine = () => {
    const nextIndex = currentLineIndex + 1;
    const nextLine = lines[nextIndex];
    stopAll();
    setCurrentLineIndex(nextIndex);

    if (!nextLine) return;

    if (normalize(nextLine.character) !== normalize(myCharacter)) {
      if (autoPlay) {
        launchSpeakChain(nextIndex, lines, myCharacter, characterGenders);
      } else {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsSpeaking(true);
        speakText(stripDirections(nextLine.text), 'fr-FR', characterGenders[nextLine.character] || 'male', speechRate, controller.signal)
          .then(() => setIsSpeaking(false));
      }
    }
  };

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
        <div className="text-center space-y-4 px-4">
          <p className="text-foreground text-xl font-bold">
            {!script ? 'Texte introuvable' : "Ce texte n'a pas pu être analysé"}
          </p>
          <p className="text-muted-foreground text-sm">
            Veuillez ré-importer votre fichier depuis la page d'accueil.
          </p>
          <Link to="/desktop/"><Button className="bg-primary text-primary-foreground">Ré-importer le texte</Button></Link>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-8 px-4">
        <div className="text-center space-y-3">
          <Theater className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">{script.title}</h1>
          <p className="text-muted-foreground">
            Rôle : <span className="text-primary font-semibold">{myCharacter}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {lines.length} répliques · {myLineCount} à jouer
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-3">
          <button
            onClick={() => setAutoPlay(false)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${!autoPlay ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Hand className="w-4 h-4" />
            Manuel
          </button>
          <button
            onClick={() => setAutoPlay(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${autoPlay ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Zap className="w-4 h-4" />
            Auto
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs -mt-4">
          {autoPlay
            ? "Les répliques des autres se lisent automatiquement jusqu'à la vôtre."
            : 'Appuyez sur "Suivant" pour avancer réplique par réplique.'}
        </p>

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">Vitesse de lecture</p>
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2">
            {[1, 1.5, 2, 3].map(r => (
              <button
                key={r}
                onClick={() => {
                  setSpeechRate(r);
                  speechRateRef.current = r;
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${speechRate === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r === 1 ? '1×' : `${r}×`}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="bg-primary text-primary-foreground text-lg px-10 py-6 gap-3"
          onClick={async (e) => {
            e.preventDefault();
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(track => track.stop());
              autoPlayRef.current = autoPlay;
              speechRateRef.current = speechRate;
              const firstLine = lines[0];
              setStarted(true);
              if (firstLine && normalize(firstLine.character) !== normalize(myCharacter) && autoPlay) {
                launchSpeakChain(0, lines, myCharacter, characterGenders);
              }
            } catch (e) {
              if (e.name === 'NotAllowedError') {
                alert('Microphone refusé. Vérifiez les paramètres de votre navigateur.');
              }
            }
          }}
        >
          <Mic className="w-6 h-6" />
          Commencer la répétition
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/desktop/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">
                  {script.title}
                </h1>
                <p className="text-xs text-primary font-medium">
                  Rôle : {myCharacter}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <button
                  onClick={() => { stopSpeaking(); setAutoPlay(false); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${!autoPlay ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Hand className="w-3 h-3" />
                  Manuel
                </button>
                <button
                  onClick={() => setAutoPlay(true)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${autoPlay ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Zap className="w-3 h-3" />
                  Auto
                </button>
              </div>
              <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-1">
                {[1, 1.5, 2, 3].map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      setSpeechRate(r);
                      speechRateRef.current = r;
                    }}
                    className={`px-1.5 py-1 rounded-md text-xs transition-all ${speechRate === r ? 'bg-background text-primary shadow-sm font-semibold' : 'text-muted-foreground'}`}
                  >
                    {r === 1 ? '1×' : `${r}×`}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMyLines(true)}
                className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 text-xs px-3"
              >
                Mes répliques
              </Button>
              <Theater className="w-6 h-6 text-primary" />
            </div>
          </div>
          <RehearsalProgress
            currentIndex={currentLineIndex}
            totalLines={lines.length}
            myLineCount={myLineCount}
            completedMyLines={completedMyLines.size}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="w-full max-w-4xl mx-auto space-y-4">
          {currentLine?.act && (
            <div className="flex justify-center">
              <span className="text-xs text-muted-foreground bg-secondary/50 border border-border px-3 py-1 rounded-full">
                {currentLine.act && `Acte ${currentLine.act}`}{currentLine.scene && ` · Scène ${currentLine.scene}`}
              </span>
            </div>
          )}

          {lines.slice(Math.max(0, currentLineIndex - 3), currentLineIndex).map((line, i) => {
            const actualIndex = Math.max(0, currentLineIndex - 3) + i;
            const isMyPastLine = normalize(line.character) === normalize(myCharacter);
            return (
              <div key={actualIndex} className={`opacity-35 ${isMyPastLine ? 'flex justify-end' : ''}`}>
                <div className={`flex gap-2 items-start ${isMyPastLine ? 'flex-row-reverse' : ''} max-w-[85%]`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${isMyPastLine ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {line.character?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${isMyPastLine ? 'bg-primary/5 border border-primary/20 rounded-tr-sm' : 'bg-secondary/50 border border-border rounded-tl-sm'}`}>
                    {line.text}
                  </div>
                </div>
              </div>
            );
          })}

          <AnimatePresence mode="wait">
            {isFinished ? (
              <SessionSummary
                lineScores={lineScores}
                myLineCount={myLineCount}
                completedMyLines={completedMyLines.size}
                scriptTitle={script.title}
                onRestart={() => {
                  setCurrentLineIndex(0);
                  setCompletedMyLines(new Set());
                  setLineScores([]);
                  setPhase('line');
                }}
              />
            ) : currentLine && (
              <div key={currentLineIndex}>
                {isMyLine ? (
                  <div className="space-y-4">
                    {phase === 'line' && (
                      <MyLineRecorder
                        ref={myLineRecorderRef}
                        line={currentLineClean}
                        script={script}
                        myCharacter={myCharacter}
                        onLineAdvance={handleContinue}
                      />
                    )}
                    {phase === 'comparing' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-center gap-3 py-8"
                      >
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-muted-foreground">Analyse en cours...</span>
                      </motion.div>
                    )}
                    {phase === 'result' && (
                      <ComparisonResult
                        result={comparisonResult}
                        onRetry={handleRetry}
                        onContinue={handleContinue}
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <PartnerLine
                      line={currentLineClean}
                      isSpeaking={isSpeaking}
                      onSpeak={() => handleSpeakPartnerLine(currentLineClean.text, currentLine.character)}
                    />

                    {(() => {
                      const nextLine = lines[currentLineIndex + 1];
                      const nextIsMe = nextLine && normalize(nextLine.character) === normalize(myCharacter);
                      return nextIsMe && !isSpeaking ? (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm"
                        >
                          <Mic className="w-4 h-4" />
                          Votre réplique arrive…
                        </motion.div>
                      ) : null;
                    })()}

                    <div className="flex justify-between items-center">
                      {autoPlay ? (
                        <p className="text-xs text-muted-foreground italic">
                          {isSpeaking ? 'Lecture en cours…' : 'Passage automatique…'}
                        </p>
                      ) : (
                        <span />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleNextPartnerLine}
                        disabled={isSpeaking && autoPlay}
                        className="text-muted-foreground hover:text-foreground gap-1"
                      >
                        Suivant
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>

          <div ref={scrollRef} />
        </div>
      </main>

      <AnimatePresence>
        {showMyLines && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black"
              onClick={() => setShowMyLines(false)}
            />
            <MyLinesPanel
              lines={lines}
              myCharacter={myCharacter}
              currentLineIndex={currentLineIndex}
              onJumpTo={handleJumpTo}
              onClose={() => setShowMyLines(false)}
            />
          </>
        )}
      </AnimatePresence>

      <footer className="sticky bottom-0 bg-background/80 backdrop-blur-lg border-t border-border/50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevLine}
              disabled={currentLineIndex === 0}
              className="gap-1 text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>
            {lines.findLastIndex((l, i) => i < currentLineIndex && normalize(l.character) === normalize(myCharacter)) !== -1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const idx = lines.findLastIndex((l, i) => i < currentLineIndex && normalize(l.character) === normalize(myCharacter));
                  if (idx !== -1) {
                    stopAll();
                    setPhase('line');
                    setComparisonResult(null);
                    setTimeout(() => {
                      setCurrentLineIndex(idx);
                    }, 100);
                  }
                }}
                className="gap-1 text-primary"
              >
                <Rewind className="w-4 h-4" />
                Ma précédente réplique
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {currentLine?.character}
          </span>
          <div className="flex items-center gap-1">
            {!isMyLine && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPartnerLine}
                disabled={isFinished}
                className="gap-1 text-muted-foreground"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {!isFinished && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const idx = lines.findIndex((l, i) => i > currentLineIndex && normalize(l.character) === normalize(myCharacter));
                  if (idx === -1) return;
                  stopAll();
                  setPhase('line');
                  setComparisonResult(null);
                  setTimeout(() => setCurrentLineIndex(idx), 100);
                }}
                className="gap-1 text-primary"
              >
                <FastForward className="w-4 h-4" />
                Ma prochaine réplique
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}