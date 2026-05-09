import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ParseProgress({ fileName, progress }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="font-semibold text-foreground">Analyse en cours…</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground truncate">{fileName}</p>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}%</p>
        </div>
      </div>
    </motion.div>
  );
}