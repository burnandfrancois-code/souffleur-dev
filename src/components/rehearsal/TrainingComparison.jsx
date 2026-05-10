import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

export default function TrainingComparison({ originalText, transcript, isRecording, onMicToggle }) {
  const stripDirections = (text) => text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').trim() || '';
  
  const original = stripDirections(originalText);
  const words = original.split(/\s+/).filter(w => w);
  const spoken = transcript.toLowerCase();

  return (
    <div className="bg-black border border-border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Mode entraînement</p>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Colonne gauche - Référence */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Référence :</p>
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
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-gray-700/50 text-white'
                  }`}
                >
                  {word}
                </motion.span>
              );
            })}
          </div>
        </div>

        {/* Colonne droite - Dictée */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Dictée :</p>
            <button
              onClick={onMicToggle}
              className={`p-2 rounded-full transition-all ${
                isRecording
                  ? 'bg-destructive text-white'
                  : 'bg-primary/20 text-primary hover:bg-primary/30'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-sm text-foreground italic min-h-[2rem] flex items-center">
            {transcript || <span className="text-muted-foreground">En attente...</span>}
            {isRecording && <span className="inline-block w-0.5 h-4 bg-primary ml-1 animate-pulse" />}
          </p>
        </div>
      </div>
    </div>
  );
}