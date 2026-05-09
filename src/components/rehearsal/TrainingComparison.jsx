import React from 'react';
import { motion } from 'framer-motion';

export default function TrainingComparison({ originalText, transcript, isRecording }) {
  const stripDirections = (text) => text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').trim() || '';
  
  const original = stripDirections(originalText);
  const words = original.split(/\s+/).filter(w => w);
  const spoken = transcript.toLowerCase();

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Mode entraînement</p>
      
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Texte original :</p>
        <div className="flex flex-wrap gap-1">
          {words.map((word, i) => {
            const lowerWord = word.toLowerCase();
            const isFound = spoken.includes(lowerWord);
            
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  isFound 
                    ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-600'
                }`}
              >
                {word}
              </motion.span>
            );
          })}
        </div>
      </div>

      {transcript && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Votre transcription :</p>
          <p className="text-sm text-foreground italic">
            {transcript}
            {isRecording && <span className="inline-block w-0.5 h-4 bg-primary ml-1 animate-pulse" />}
          </p>
        </div>
      )}
    </div>
  );
}