import React, { useMemo } from 'react';
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

export default function ParseProgress({ fileName, progress, logs = [] }) {
  const currentPhase = useMemo(() => {
    return PHASES.find(p => progress >= p.range[0] && progress < p.range[1]) || PHASES[PHASES.length - 1];
  }, [progress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-5">
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

        <p className="text-xs text-muted-foreground text-center">
          {progress < 100 ? 'Cela peut prendre quelques minutes pour les gros fichiers…' : 'Finalisation…'}
        </p>

        <ParseErrorLog logs={logs} />
      </div>
    </motion.div>
  );
}