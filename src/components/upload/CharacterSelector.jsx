import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function CharacterSelector({ characters, selected, onSelect, genders, onGenderChange }) {
  return (
    <div className="space-y-3">
      {characters.map((char, i) => (
        <motion.button
          key={char}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect(char)}
          className={`w-full p-4 rounded-xl border-2 transition-all text-left group ${
            selected === char
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-primary/5'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">{char}</p>
              <p className="text-xs text-muted-foreground">
                {genders[char] === 'female' ? '👩 Femme' : '👨 Homme'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenderChange(char, genders[char] === 'female' ? 'male' : 'female');
                }}
                className="px-2 py-1 text-xs rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {genders[char] === 'female' ? '👩' : '👨'}
              </button>
              {selected === char && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold"
                >
                  ✓
                </motion.div>
              )}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}