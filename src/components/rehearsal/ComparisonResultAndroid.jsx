import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, RotateCcw, ChevronRight } from 'lucide-react';

export default function ComparisonResultAndroid({ result, onRetry, onContinue }) {
  if (!result) return null;

  const accuracy = result.accuracy ?? 0;
  const isGood = accuracy >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Score */}
      <div className={`rounded-xl p-4 text-center space-y-2 ${
        isGood ? 'bg-green-500/10 border border-green-500/30' : 'bg-orange-500/10 border border-orange-500/30'
      }`}>
        <div className="flex items-center justify-center gap-2">
          {isGood ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-orange-500" />
          )}
          <p className={`text-3xl font-bold ${isGood ? 'text-green-500' : 'text-orange-500'}`}>
            {accuracy}%
          </p>
        </div>
        <p className={`text-xs font-semibold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
          {result.perfect ? '✨ Parfait !' : isGood ? 'Très bon !' : 'À améliorer'}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onRetry}
          size="sm"
          className="flex-1 gap-1 text-xs"
        >
          <RotateCcw className="w-3 h-3" />
          Réessayer
        </Button>
        <Button
          onClick={onContinue}
          size="sm"
          className="flex-1 bg-primary text-primary-foreground gap-1 text-xs"
        >
          Continuer
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}