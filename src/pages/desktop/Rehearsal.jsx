import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Theater, Loader2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking } from '@/lib/speechServices';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';
import RehearsalProgress from '@/components/rehearsal/RehearsalProgress';
import PartnerLine from '@/components/rehearsal/PartnerLine';
import MyLineRecorder from '@/components/rehearsal/MyLineRecorderV2';
import SessionSummary from '@/components/rehearsal/SessionSummary';
import MyLinesPanel from '@/components/rehearsal/MyLinesPanel';


export default function DesktopRehearsal() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scriptId = urlParams.get('scriptId');

  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) {
      navigate(`/android/rehearsal?scriptId=${scriptId}`);
    }
  }, [scriptId, navigate]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedMyLines, setCompletedMyLines] = useState(0);
  const [lineScores, setLineScores] = useState([]);
  const [showMyLines, setShowMyLines] = useState(false);
  const [started, setStarted] = useState(false);
  const [isSpeakingPartner, setIsSpeakingPartner] = useState(false);

  const myLineRecorderRef = useRef(null);
  const speakAbortRef = useRef(null);
  const commandVoice = useSimpleVoiceInput();
  const commandActiveRef = useRef(false);

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

  // Auto-play partner lines — avance automatiquement après la lecture
  const speakPartnerLine = useCallback(async (line) => {
    if (speakAbortRef.current) speakAbortRef.current.abort();
    const controller = new AbortController();
    speakAbortRef.current = controller;
    const gender = genders[line.character] || 'male';
    setIsSpeakingPartner(true);
    await speakText(stripDirections(line.text), 'fr-FR', gender, 1, controller.signal);
    if (!controller.signal.aborted) {
      setIsSpeakingPartner(false);
      // Avancer automatiquement après la réplique partenaire
      setCurrentIndex(prev => prev + 1);
    }
  }, [genders]);

  // When line changes, auto-play partner or auto-record my line
  useEffect(() => {
    if (!started || !currentLine) return;
    if (!isMyLine) {
      speakPartnerLine(currentLine);
    }
  }, [currentIndex, started]);

  const handleLineAdvance = useCallback((score) => {
    if (score !== undefined) {
      setLineScores(prev => [...prev, score]);
      if (score >= 80) setCompletedMyLines(prev => prev + 1);
    }
    if (speakAbortRef.current) speakAbortRef.current.abort();
    setIsSpeakingPartner(false);
    setCurrentIndex(prev => prev + 1);
  }, []);

  const handleJumpTo = useCallback((index) => {
    if (speakAbortRef.current) speakAbortRef.current.abort();
    setIsSpeakingPartner(false);
    myLineRecorderRef.current?.reset();
    setCurrentIndex(index);
  }, []);

  const handleRestart = () => {
    if (speakAbortRef.current) speakAbortRef.current.abort();
    setCurrentIndex(0);
    setCompletedMyLines(0);
    setLineScores([]);
    setStarted(false);
  };

  // Commandes vocales
  const stopCommandListening = useCallback(() => {
    commandActiveRef.current = false;
    commandVoice.stop();
    commandVoice.reset();
  }, [commandVoice]);

  const startCommandListening = useCallback(() => {
    if (commandActiveRef.current) return;
    commandActiveRef.current = true;
    commandVoice.start((text) => {
      if (!commandActiveRef.current) return;
      const t = text.toLowerCase().trim();
      if (/passer|suivant|next/.test(t)) {
        commandActiveRef.current = false;
        myLineRecorderRef.current?.handleContinue?.();
      } else if (/r[eé]essayer|retry|again/.test(t)) {
        commandActiveRef.current = false;
        myLineRecorderRef.current?.handleRetry?.();
      }
    });
  }, [commandVoice]);

  useEffect(() => {
    return () => {
      stopCommandListening();
    };
  }, [stopCommandListening]);

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
        <Button size="lg" onClick={() => setStarted(true)}>Commencer la répétition</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/desktop/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold leading-tight">{script.title}</h1>
                <p className="text-xs text-primary">Rôle: {myCharacter}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowMyLines(true)}>
              <List className="w-5 h-5" />
            </Button>
          </div>
          {!isFinished && (
            <RehearsalProgress
              currentIndex={currentIndex}
              totalLines={lines.length}
              myLineCount={myLineCount}
              completedMyLines={completedMyLines}
            />
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence mode="wait">
            {isFinished ? (
              <SessionSummary
                key="summary"
                lineScores={lineScores}
                myLineCount={myLineCount}
                completedMyLines={completedMyLines}
                scriptTitle={script.title}
                onRestart={handleRestart}
              />
            ) : currentLine && (
              <motion.div key={currentIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Act/Scene label */}
                {(currentLine.act || currentLine.scene) && (
                  <p className="text-xs text-center text-muted-foreground mb-3">
                    {currentLine.act && `Acte ${currentLine.act}`}
                    {currentLine.scene && ` • Scène ${currentLine.scene}`}
                  </p>
                )}

                {isMyLine ? (
                  <MyLineRecorder
                    ref={myLineRecorderRef}
                    line={currentLine}
                    script={script}
                    myCharacter={myCharacter}
                    onLineAdvance={handleLineAdvance}
                  />
                ) : (
                  <PartnerLine
                    line={currentLine}
                    isSpeaking={isSpeakingPartner}
                    onSpeak={() => speakPartnerLine(currentLine)}
                  />
                )}

                {/* Next button for partner lines — visible seulement si pas en train de parler */}
                {!isMyLine && !isSpeakingPartner && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => handleLineAdvance()} className="bg-primary text-primary-foreground">
                      Suivant →
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* My Lines Panel */}
      <AnimatePresence>
        {showMyLines && (
          <MyLinesPanel
            lines={lines}
            myCharacter={myCharacter}
            currentLineIndex={currentIndex}
            onJumpTo={handleJumpTo}
            onClose={() => setShowMyLines(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}