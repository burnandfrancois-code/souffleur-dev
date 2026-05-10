import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Theater, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText, stopSpeaking } from '@/lib/speechServices';
import { compareTexts } from '@/lib/scriptParser';
import ComparisonResult from '@/components/rehearsal/ComparisonResult';
import SessionSummary from '@/components/rehearsal/SessionSummary';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';

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
  const [phase, setPhase] = useState('line');
  const [result, setResult] = useState(null);
  const [completed, setCompleted] = useState(new Set());
  const [scores, setScores] = useState([]);
  const [started, setStarted] = useState(false);
  const [micPermissionChecked, setMicPermissionChecked] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);

  const voiceRec = useSimpleVoiceInput();

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicAllowed(true);
      setMicPermissionChecked(true);
    } catch (e) {
      setMicAllowed(false);
      setMicPermissionChecked(true);
    }
  };

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

  const submitRecording = useCallback(async (text) => {
    voiceRec.stop();
    setPhase('comparing');
    const compResult = await compareTexts(stripDirections(currentLine.text), text);
    setResult(compResult);
    setScores(prev => [...prev, compResult.accuracy ?? 0]);
    if (compResult.perfect) {
      setCompleted(prev => new Set([...prev, currentIndex]));
    }
    setPhase('result');
  }, [currentLine, currentIndex, voiceRec]);

  // Auto-start recording when arriving at my line
  useEffect(() => {
    if (phase === 'line' && isMyLine && started && !voiceRec.isRecording) {
      const timer = setTimeout(() => {
        voiceRec.start((finalText) => {
          submitRecording(finalText);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, isMyLine, started, voiceRec, submitRecording]);

  // Auto-advance on perfect
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
    voiceRec.reset();
    setCurrentIndex(prev => prev + 1);
  }, [voiceRec]);

  const handleRetry = () => {
    setResult(null);
    setPhase('line');
    voiceRec.reset();
  };

  const handleNext = () => {
    voiceRec.stop();
    setResult(null);
    setPhase('line');
    voiceRec.reset();
    setCurrentIndex(prev => prev + 1);
  };

  const speakPartner = useCallback(async () => {
    voiceRec.stop();
    const gender = genders[currentLine.character] || 'male';
    await speakText(stripDirections(currentLine.text), 'fr-FR', gender, 1);
    // Auto-restart recording if it was my turn
    if (isMyLine) {
      setTimeout(() => {
        voiceRec.start((finalText) => {
          submitRecording(finalText);
        });
      }, 300);
    }
  }, [currentLine, genders, isMyLine, voiceRec, submitRecording]);

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
        <AnimatePresence>
          {!micPermissionChecked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            >
              <div className="bg-card rounded-2xl border border-border p-8 max-w-sm space-y-6 shadow-lg">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-primary/20 p-4 rounded-full">
                    <Mic className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Accès au microphone</h2>
                </div>
                <p className="text-center text-muted-foreground">
                  La répétition nécessite l'accès à votre microphone pour enregistrer vos répliques.
                </p>
                <Button size="lg" onClick={requestMicPermission} className="w-full">
                  Autoriser le microphone
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Theater className="w-12 h-12 text-primary" />
        <h1 className="text-2xl font-bold">{script.title}</h1>
        <p className="text-muted-foreground">Rôle: <span className="text-primary font-semibold">{myCharacter}</span></p>
        <p className="text-sm text-muted-foreground">{lines.length} répliques • {myLineCount} à jouer</p>
        
        {micPermissionChecked && !micAllowed && (
          <div className="text-center space-y-3">
            <p className="text-destructive font-semibold">Microphone non autorisé</p>
            <p className="text-sm text-muted-foreground">Veuillez autoriser l'accès au microphone pour continuer</p>
            <Button size="lg" onClick={requestMicPermission}>Réessayer</Button>
          </div>
        )}
        
        {micPermissionChecked && micAllowed && (
          <Button size="lg" onClick={() => setStarted(true)}>Commencer la répétition</Button>
        )}
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
                  voiceRec.reset();
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
                        <div className="rounded-2xl border-2 border-primary bg-primary/10 p-8 text-center">
                          <p className="text-sm text-muted-foreground mb-3">Votre réplique:</p>
                          <p className="text-lg leading-relaxed text-foreground mb-6">{currentLine.text}</p>
                          <div className={`rounded-full w-20 h-20 mx-auto flex items-center justify-center transition-all ${
                            voiceRec.isRecording ? 'bg-destructive animate-pulse' : 'bg-primary'
                          }`}>
                            <div className="text-white text-2xl">🎤</div>
                          </div>
                          <p className="text-sm text-primary font-semibold mt-4">
                            {voiceRec.isRecording ? '🔴 ENREGISTREMENT' : 'Microphone prêt'}
                          </p>
                        </div>

                        {voiceRec.transcript && (
                          <div className="bg-background border border-border rounded-lg p-4">
                            <p className="text-sm text-foreground">{voiceRec.transcript}</p>
                          </div>
                        )}

                        <Button onClick={handleNext} variant="outline" className="w-full">
                          Passer cette réplique
                        </Button>
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
                        transcription={voiceRec.transcript}
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
                      <Button onClick={speakPartner} variant="outline" className="w-full">
                        Écouter
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