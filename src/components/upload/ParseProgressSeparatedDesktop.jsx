import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import ParseErrorLog from './ParseErrorLog';

const PHASES = [
  { id: 'upload', label: 'Téléchargement', range: [0, 10] },
  { id: 'extract', label: 'Extraction du texte', range: [10, 40] },
  { id: 'parse', label: 'Analyse des répliques', range: [40, 85] },
  { id: 'verify', label: 'Vérification', range: [85, 100] }
];

export default function ParseProgressSeparatedDesktop({ fileName, progress, logs = [], error = null }) {
  const [lastProgress, setLastProgress] = useState(0);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    setLastProgress(progress);
  }, [progress]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (progress === lastProgress && progress > 0 && progress < 100 && !error) {
        setIsStuck(true);
      } else {
        setIsStuck(false);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [progress, lastProgress, error]);

  const currentPhase = useMemo(() => {
    return PHASES.find(p => progress >= p.range[0] && progress < p.range[1]) || PHASES[PHASES.length - 1];
  }, [progress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="font-semibold text-foreground">Analyse du script…</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{fileName}</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}%</p>
          </div>

          {/* Phase indicator */}
          <div className="space-y-2">
            {PHASES.map((phase) => {
              const isActive = phase.id === currentPhase.id;
              const isCompleted = progress >= phase.range[1];
              
              return (
                <div key={phase.id} className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                  )}
                  <span className={`text-xs transition-colors ${
                    isActive ? 'text-primary font-medium' : 
                    isCompleted ? 'text-muted-foreground line-through' :
                    'text-muted-foreground'
                  }`}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs font-semibold text-destructive">Erreur détectée</p>
            </div>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        )}

        {isStuck && !error && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
              <p className="text-xs font-semibold text-yellow-600">Processus bloqué</p>
            </div>
            <p className="text-xs text-yellow-600/80">L'analyse semble s'être arrêtée. Consultez le journal détaillé ci-dessous.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {progress < 100 ? 'Cela peut prendre quelques minutes pour les gros fichiers…' : 'Finalisation…'}
        </p>

        <ParseErrorLog logs={logs} />
      </div>
    </motion.div>
  );
}