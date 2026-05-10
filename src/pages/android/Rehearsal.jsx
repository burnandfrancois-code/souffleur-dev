import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Theater, Loader2, Mic, ChevronRight, ChevronLeft, List, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unlockAudioForAndroid, stopSpeaking } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import PartnerLine from '@/components/rehearsal/PartnerLine';
import MyLineRecorder from '@/components/rehearsal/MyLineRecorderAndroid';
import ComparisonResult from '@/components/rehearsal/ComparisonResultAndroid';
import RehearsalProgress from '@/components/rehearsal/RehearsalProgress';
import SessionSummary from '@/components/rehearsal/SessionSummary';
import VoiceAccess from '@/components/rehearsal/VoiceAccess';
import { usePartnerSpeaker } from '@/hooks/usePartnerSpeaker';

export default function AndroidRehearsal() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scriptId = urlParams.get('scriptId');

  // Rediriger desktop vers /desktop/rehearsal
  const isAndroidDevice = /Android/i.test(navigator.userAgent);
  
  useEffect(() => {
    if (!isAndroidDevice) {
      navigate(`/desktop/rehearsal?scriptId=${scriptId}`);
    }
  }, [isAndroidDevice, scriptId, navigate]);

  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [phase, setPhase] = useState('line');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [completedMyLines, setCompletedMyLines] = useState(new Set());
  const [lineScores, setLineScores] = useState([]);
  const [started, setStarted] = useState(false);
  const [showLinesList, setShowLinesList] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const autoAdvanceThreshold = 80;
  const speechRateRef = useRef(1);
  const currentLineIndexRef = useRef(currentLineIndex);
  const myLineRecorderRef = useRef(null);
  const compareSessionRef = useRef(0);

  useEffect(() => {
    currentLineIndexRef.current = currentLineIndex;
  }, [currentLineIndex]);

  const { speakPartnerLines, speakSingleLine, cancelAll } = usePartnerSpeaker({
    speechRateRef,
    onLineChange: (idx) => setCurrentLineIndex(idx),
    onSpeakingChange: (s) => setIsSpeaking(s),
  });

  const { data: script, isLoading } = useQuery({
    queryKey: ['script', scriptId],
    queryFn: () => base44.entities.Script.filter({ id: scriptId }),
    select: (data) => data[0],
    enabled: !!scriptId,
  });

  const stripDirections = (text) => text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';
  const normalize = (s) => s?.trim().toLowerCase();

  const lines = script?.lines || [];
  const myCharacter = script?.my_character;
  const characterGenders = script?.character_genders || {};
  const currentLine = lines[currentLineIndex];
  const currentLineClean = currentLine ? { ...currentLine, text: stripDirections(currentLine.text) } : null;
  const isMyLine = normalize(currentLine?.character) === normalize(myCharacter);
  const myLineCount = lines.filter(l => normalize(l.character) === normalize(myCharacter)).length;
  const isFinished = lines.length > 0 && currentLineIndex >= lines.length;

  useEffect(() => () => cancelAll(), [cancelAll]);

  const launchSpeakChain = useCallback((index) => {
    speakPartnerLines(index, lines, myCharacter, characterGenders, stripDirections);
  }, [speakPartnerLines, lines, myCharacter, characterGenders]);

  const handleSubmitRecording = async (spokenText) => {
    const idx = currentLineIndexRef.current;
    const lineText = currentLineClean.text;
    compareSessionRef.current += 1;
    const session = compareSessionRef.current;
    setPhase('comparing');
    const result = await compareTexts(lineText, spokenText || '');
    if (compareSessionRef.current !== session) return;
    if (currentLineIndexRef.current !== idx) return;
    setComparisonResult(result);
    setLineScores(prev => [...prev, result.accuracy ?? 0]);
    if (result.perfect) setCompletedMyLines(prev => new Set([...prev, idx]));
    setPhase('result');
  };

  useEffect(() => {
    if (phase !== 'result' || !comparisonResult) return;
    const accuracy = comparisonResult?.accuracy ?? 0;
    const hasMissingWords = (comparisonResult?.word_results || []).some(w => w.status === 'missing');
    const shouldAdvance = (comparisonResult?.perfect || accuracy >= autoAdvanceThreshold) && !hasMissingWords;
    if (shouldAdvance) {
      const timer = setTimeout(() => handleContinue(), 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, comparisonResult]);

  const handleRetry = () => {
    setComparisonResult(null);
    setPhase('line');
  };

  const handleContinue = () => {
    const idx = currentLineIndexRef.current;
    if (comparisonResult?.perfect) setCompletedMyLines(prev => new Set([...prev, idx]));
    const nextIndex = idx + 1;
    const nextLine = lines[nextIndex];
    setComparisonResult(null);
    setPhase('line');
    setCurrentLineIndex(nextIndex);
    if (!nextLine) return;
    if (normalize(nextLine.character) !== normalize(myCharacter)) {
      speakPartnerLines(nextIndex, lines, myCharacter, characterGenders, stripDirections);
    }
  };

  const handleNextLine = () => {
    const nextIndex = currentLineIndex + 1;
    const nextLine = lines[nextIndex];
    cancelAll();
    setCurrentLineIndex(nextIndex);
    if (!nextLine) return;
    if (normalize(nextLine.character) !== normalize(myCharacter)) {
      speakPartnerLines(nextIndex, lines, myCharacter, characterGenders, stripDirections);
    }
  };

  const getMyLineIndices = () => lines
    .map((line, i) => normalize(line.character) === normalize(myCharacter) ? i : null)
    .filter(i => i !== null);

  const goToMyLine = (targetIndex) => {
    cancelAll();
    setCurrentLineIndex(targetIndex);
    setPhase('line');
    setComparisonResult(null);
  };

  const goToPrevMyLine = () => {
    const indices = getMyLineIndices();
    const cur = indices.indexOf(currentLineIndexRef.current);
    if (cur > 0) goToMyLine(indices[cur - 1]);
  };

  const goToNextMyLine = () => {
    const indices = getMyLineIndices();
    const cur = indices.indexOf(currentLineIndexRef.current);
    if (cur < indices.length - 1) goToMyLine(indices[cur + 1]);
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  if (!script || lines.length === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 px-4">
        <p className="text-foreground font-display text-lg font-bold">Texte introuvable</p>
        <Button onClick={() => navigate('/android/')} className="bg-primary text-primary-foreground">Retour</Button>
      </div>
    </div>
  );

  if (!started) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4 py-8">
      <div className="text-center space-y-2">
        <Theater className="w-10 h-10 text-primary mx-auto" />
        <h1 className="font-display text-xl font-bold text-foreground">{script.title}</h1>
        <p className="font-body text-sm text-primary font-semibold">{myCharacter}</p>
        <p className="font-body text-xs text-muted-foreground">{myLineCount} répliques à jouer</p>
      </div>

      <Button
        size="lg"
        className="w-full max-w-xs bg-primary text-primary-foreground font-body text-base gap-2 mt-4"
        onClick={async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setStarted(true);
            await unlockAudioForAndroid();
            const firstLine = lines[0];
            if (firstLine && normalize(firstLine.character) !== normalize(myCharacter)) {
              speakPartnerLines(0, lines, myCharacter, characterGenders, stripDirections);
            }
          } catch (e) {
            alert('Microphone refusé. Vérifiez les paramètres de votre navigateur.');
          }
        }}
      >
        <Mic className="w-5 h-5" />
        Commencer
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/android/')} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-sm font-bold text-foreground truncate">{script.title}</h1>
              <p className="text-xs text-primary font-body">{myCharacter}</p>
            </div>
          </div>
          <Theater className="w-5 h-5 text-primary shrink-0" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <RehearsalProgress
            currentIndex={currentLineIndex}
            totalLines={lines.length}
            myLineCount={myLineCount}
            completedMyLines={completedMyLines.size}
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowVoiceModal(true)} className="shrink-0 h-8 w-8" title="Voix">
              <span className="text-xs">🎙️</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowLinesList(!showLinesList)} className="shrink-0 h-8 w-8">
              {showLinesList ? <X className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-4 pb-80">
        <div className="w-full max-w-2xl mx-auto space-y-3">
          {currentLine?.act && (
            <div className="flex justify-center">
              <span className="text-xs font-body text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                {currentLine.act && `Acte ${currentLine.act}`}{currentLine.scene && ` · Scène ${currentLine.scene}`}
              </span>
            </div>
          )}

          {lines.slice(Math.max(0, currentLineIndex - 2), currentLineIndex).map((line, i) => {
            const actualIndex = Math.max(0, currentLineIndex - 2) + i;
            const isMyPastLine = normalize(line.character) === normalize(myCharacter);
            return (
              <div key={actualIndex} className={`opacity-40 flex ${isMyPastLine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 items-start max-w-[80%] ${isMyPastLine ? 'flex-row-reverse' : ''}`}>
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${isMyPastLine ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {line.character?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className={`rounded-lg px-2.5 py-1.5 text-xs font-body ${isMyPastLine ? 'bg-primary/5 border border-primary/20 rounded-tr-sm' : 'bg-secondary/50 border border-border rounded-tl-sm'}`}>
                    {stripDirections(line.text)}
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
              <div key={currentLineIndex} className="space-y-3">
                {isMyLine ? (
                  <>
                    {phase === 'line' && <MyLineRecorder ref={myLineRecorderRef} line={currentLineClean} onSubmit={handleSubmitRecording} onSkip={handleNextLine} autoPlay={true} />}
                    {phase === 'comparing' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </motion.div>
                    )}
                    {phase === 'result' && <ComparisonResult result={comparisonResult} onRetry={handleRetry} onContinue={handleContinue} />}
                  </>
                ) : (
                  <div className="space-y-3">
                    <PartnerLine
                      line={currentLineClean}
                      isSpeaking={isSpeaking}
                      onSpeak={() => speakSingleLine(currentLine.text, currentLine.character, characterGenders, stripDirections)}
                    />
                    {!isSpeaking && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
                        <Button onClick={handleNextLine} className="bg-primary text-primary-foreground font-body text-sm gap-2 w-full max-w-xs">
                          Suivant <ChevronRight className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    )}
                    {isSpeaking && (
                      <p className="text-xs text-muted-foreground text-center font-body italic">Lecture en cours…</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/30 px-2 py-1 space-y-1">
        <div className="flex items-center justify-between gap-1 px-0 py-1">
          <div className="flex items-center gap-0">
            <button onClick={goToPrevMyLine} className="p-1 rounded hover:bg-primary/30 hover:text-primary transition-all">
              <ChevronLeft className="w-4 h-4 text-primary" />
            </button>
            <span className="text-xs font-body font-bold text-primary -ml-0.5">Ma</span>
          </div>

          <button
            onClick={() => { cancelAll(); setIsSpeaking(false); }}
            disabled={!isSpeaking}
            className={`px-2 py-1 rounded transition-all ${isSpeaking ? 'bg-destructive hover:bg-destructive/90' : 'bg-destructive/40 cursor-not-allowed'}`}
          >
            <Square className={`w-4 h-4 ${isSpeaking ? 'text-destructive-foreground' : 'text-muted-foreground'}`} />
          </button>

          <div className="flex items-center gap-0">
            <span className="text-xs font-body font-bold text-primary -mr-0.5">Ma</span>
            <button onClick={goToNextMyLine} className="p-1 rounded hover:bg-primary/30 hover:text-primary transition-all">
              <ChevronRight className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => { cancelAll(); if (currentLineIndex > 0) setCurrentLineIndex(currentLineIndex - 1); setPhase('line'); setComparisonResult(null); }}
            disabled={currentLineIndex === 0}
            className="p-1 rounded text-muted-foreground hover:bg-secondary disabled:opacity-50 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => { cancelAll(); if (currentLineIndex < lines.length - 1) setCurrentLineIndex(currentLineIndex + 1); setPhase('line'); setComparisonResult(null); }}
            disabled={currentLineIndex >= lines.length - 1}
            className="p-1 rounded text-muted-foreground hover:bg-secondary disabled:opacity-50 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {showLinesList && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowLinesList(false)} className="fixed inset-0 bg-black/40 z-40" />
      )}
      <AnimatePresence>
        {showLinesList && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed top-20 left-4 right-4 z-50 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 max-h-96 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-body font-semibold text-muted-foreground uppercase">Mes répliques</p>
              <div className="flex gap-2">
                <button onClick={goToPrevMyLine} className="p-2 rounded hover:bg-secondary text-foreground hover:text-primary transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={goToNextMyLine} className="p-2 rounded hover:bg-secondary text-foreground hover:text-primary transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {lines.map((line, i) => {
                if (normalize(line.character) !== normalize(myCharacter)) return null;
                const isCompleted = completedMyLines.has(i);
                const isCurrent = i === currentLineIndex;
                return (
                  <button key={i} onClick={() => { cancelAll(); setCurrentLineIndex(i); setShowLinesList(false); setPhase('line'); setComparisonResult(null); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-body transition-all ${isCurrent ? 'bg-primary/20 border border-primary text-foreground' : isCompleted ? 'bg-green-500/10 text-green-400' : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'}`}>
                    <div className="truncate">{isCompleted && '✓ '}{stripDirections(line.text)}</div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVoiceModal && <VoiceAccess onClose={() => setShowVoiceModal(false)} />}
      </AnimatePresence>
    </div>
  );
}