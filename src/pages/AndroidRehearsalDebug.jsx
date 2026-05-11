import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Theater, Loader2, Mic, ChevronRight, ChevronLeft, List, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unlockAudioForAndroid, stopSpeaking, speakText } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import PartnerLine from '@/components/rehearsal/PartnerLine';
import MyLineRecorder from '@/components/rehearsal/MyLineRecorderAndroid';
import ComparisonResult from '@/components/rehearsal/ComparisonResultAndroid';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';
import RehearsalProgress from '@/components/rehearsal/RehearsalProgress';
import SessionSummary from '@/components/rehearsal/SessionSummary';
import VoiceAccess from '@/components/rehearsal/VoiceAccess';
import { usePartnerSpeaker } from '@/hooks/usePartnerSpeaker';
import DebugLog from '@/components/rehearsal/DebugLog';

export default function AndroidRehearsalDebug() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scriptId = urlParams.get('scriptId');

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
  const mainScrollRef = useRef(null);

  const commandVoice = useSimpleVoiceInput();
  const commandActiveRef = useRef(false);
  const handleContinueRef = useRef(null);
  const handleRetryRef = useRef(null);

  useEffect(() => {
    currentLineIndexRef.current = currentLineIndex;
    if (mainScrollRef.current) {
      setTimeout(() => {
        mainScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
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

  const stopCommandListening = useCallback(() => {
    commandActiveRef.current = false;
    commandVoice.stop();
  }, []);

  const startCommandListening = useCallback(() => {
    commandActiveRef.current = true;
    commandVoice.start((text) => {
      if (!commandActiveRef.current) return;
      const t = text.toLowerCase().trim();
      if (/passer/.test(t)) {
        commandActiveRef.current = false;
        handleContinueRef.current?.();
      } else if (/r[eé]essayer/.test(t)) {
        commandActiveRef.current = false;
        handleRetryRef.current?.();
      }
    });
  }, []);

  useEffect(() => {
    if (phase === 'result') {
      setTimeout(() => startCommandListening(), 400);
    } else {
      stopCommandListening();
    }
  }, [phase]);

  const handleRetry = () => {
    stopCommandListening();
    setComparisonResult(null);
    setPhase('line');
  };

  const handleContinue = useCallback(() => {
    stopCommandListening();
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
  }, [comparisonResult, lines, myCharacter, characterGenders, stopCommandListening]);

  useEffect(() => { handleContinueRef.current = handleContinue; }, [handleContinue]);
  useEffect(() => { handleRetryRef.current = handleRetry; }, [handleRetry]);

  const handleNextLine = () => {
    const nextIndex = currentLineIndex + 1;
    const nextLine = lines[nextIndex];
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
      <DebugLog show={true} />
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
            console.log('[DEBUG] Starting rehearsal...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            
            console.log('[DEBUG] Got mic access, unlocking audio...');
            await unlockAudioForAndroid();
            
            console.log('[DEBUG] Speaking welcome message...');
            await speakText('Bienvenue, commençons le répétition.', 'fr-FR', 'female', 1);
            
            console.log('[DEBUG] Setting started to true');
            setStarted(true);
            const firstLine = lines[0];
            if (firstLine && normalize(firstLine.character) !== normalize(myCharacter)) {
              console.log('[DEBUG] Speaking partner lines from start...');
              speakPartnerLines(0, lines, myCharacter, characterGenders, stripDirections);
            }
          } catch (e) {
            console.error('[DEBUG] Error during start:', e.message, e.stack);
            setStarted(false);
            if (e.name === 'NotAllowedError') {
              alert('Microphone refusé. Vérifiez les paramètres de votre navigateur.');
            }
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
      <DebugLog show={true} />
      {/* ... rest of the UI is identical to AndroidRehearsal ... */}
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
      </header>

      <main ref={mainScrollRef} className="flex-1 overflow-y-auto px-3 py-4 pb-80">
        <div className="w-full max-w-2xl mx-auto space-y-3">
          {currentLine?.act && (
            <div className="flex justify-center">
              <span className="text-xs font-body text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                {currentLine.act && `Acte ${currentLine.act}`}{currentLine.scene && ` · Scène ${currentLine.scene}`}
              </span>
            </div>
          )}
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
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}