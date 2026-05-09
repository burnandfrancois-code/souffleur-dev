import React from 'react';
import { motion } from 'framer-motion';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VoiceAccess({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Accès au microphone</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Permission requise</p>
              <p className="text-xs text-muted-foreground">
                SOUFFLEUR a besoin d'accéder à votre microphone pour analyser votre prononciation.
              </p>
            </div>
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Comment activer :</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Recherchez le verrou 🔒 dans la barre d'adresse</li>
              <li>Cliquez sur "Paramètres du site"</li>
              <li>Autorisez le microphone</li>
              <li>Rechargez la page</li>
            </ol>
          </div>

          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-700">Vos données vocales ne sont jamais enregistrées</p>
          </div>
        </div>

        <Button
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground"
        >
          Compris
        </Button>
      </motion.div>
    </motion.div>
  );
}