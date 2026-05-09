import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SessionSummary({ lineScores, myLineCount, completedMyLines, scriptTitle, onRestart }) {
  React.useEffect(() => {
    if (completedMyLines === myLineCount && completedMyLines > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [completedMyLines, myLineCount]);

  const avgScore = lineScores.length > 0 
    ? Math.round(lineScores.reduce((a, b) => a + b, 0) / lineScores.length)
    : 0;

  const perfectLines = lineScores.filter(s => s >= 100).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 text-center"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-yellow-500" />
          <h2 className="text-3xl font-bold text-foreground">Bravo !</h2>
        </div>
        <p className="text-lg text-primary font-semibold">{scriptTitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Score moyen</p>
          <p className="text-3xl font-bold text-primary">{avgScore}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Répliques validées</p>
          <p className="text-3xl font-bold text-green-500">{completedMyLines}/{myLineCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Parfaites</p>
          <p className="text-3xl font-bold text-primary">{perfectLines}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Tentatives</p>
          <p className="text-3xl font-bold">{lineScores.length}</p>
        </div>
      </div>

      <Button
        onClick={onRestart}
        className="w-full bg-primary text-primary-foreground gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Recommencer
      </Button>
    </motion.div>
  );
}