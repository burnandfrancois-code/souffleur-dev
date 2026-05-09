import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Theater, Monitor, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function PlatformSelect() {
  const navigate = useNavigate();
  const { isLoadingPublicSettings, authError } = useAuth();
  const [detected, setDetected] = useState(null);
  const [autoRedirecting, setAutoRedirecting] = useState(true);

  useEffect(() => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const platform = isAndroid ? 'android' : 'desktop';
    setDetected(platform);

    const timer = setTimeout(() => {
      navigate(`/${platform}/`);
    }, 2000);

    const handleInteraction = () => {
      clearTimeout(timer);
      setAutoRedirecting(false);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [navigate]);

  const handleSelect = (platform) => {
    navigate(`/${platform}/`);
  };

  if (isLoadingPublicSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-lg font-bold text-foreground">
            Erreur de chargement
          </p>
          <p className="text-muted-foreground text-sm">
            {authError.message || 'Une erreur est survenue. Veuillez rafraîchir la page.'}
          </p>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground gap-2"
          >
            Actualiser
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 max-w-xl"
      >
        <div className="space-y-3">
          <Theater className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">
            SOUFFLEUR
          </h1>
          <p className="text-muted-foreground text-sm">
            by Happy Good Lines
          </p>
        </div>

        <p className="text-foreground text-lg">
          Choisissez votre plateforme
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            onClick={() => handleSelect('desktop')}
            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group ${
              detected === 'desktop'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Monitor className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-foreground mb-1">Desktop</p>
            <p className="text-xs text-muted-foreground mb-2">
              Version complète avec choix des voix
            </p>
            {detected === 'desktop' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs text-primary font-semibold mt-2 flex items-center justify-center gap-1"
              >
                ✓ Détecté
              </motion.div>
            )}
          </motion.button>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => handleSelect('android')}
            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group ${
              detected === 'android'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Smartphone className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-foreground mb-1">Android</p>
            <p className="text-xs text-muted-foreground mb-2">
              Version mobile optimisée
            </p>
            {detected === 'android' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs text-primary font-semibold mt-2 flex items-center justify-center gap-1"
              >
                ✓ Détecté
              </motion.div>
            )}
          </motion.button>
        </div>

        {detected && autoRedirecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2 text-center"
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-xs text-primary font-medium">
                Redirection automatique en cours…
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Cliquez pour annuler
            </p>
          </motion.div>
        )}

        {detected && !autoRedirecting && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground"
          >
            Vous pouvez changer de plateforme à tout moment
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}