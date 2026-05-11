import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Theater, Mic, BookOpen, Sparkles, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !isLoadingPublicSettings && isAuthenticated) {
      navigate('/platform');
    }
  }, [isAuthenticated, isLoadingAuth, isLoadingPublicSettings]);

  const handleLogin = () => {
    base44.auth.redirectToLogin('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Theater className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold text-foreground">SOUFFLEUR</h1>
          </div>
          <Button onClick={handleLogin} className="bg-primary text-primary-foreground gap-2">
            Se connecter
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium">
            <Theater className="w-4 h-4" />
            Happy Good Lines
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Répétez votre texte
            <br />
            <span className="text-primary">sans partenaire</span>
          </h2>

          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Importez votre pièce, indiquez votre rôle — SOUFFLEUR vous donne la réplique, analyse et corrige vos erreurs en temps réel.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              onClick={handleLogin}
              className="bg-primary text-primary-foreground text-base px-8 gap-2"
            >
              <Mic className="w-5 h-5" />
              Commencer gratuitement
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.location.href = '/tarifs'}
              className="border-primary/40 text-primary hover:bg-primary/10 text-base px-8"
            >
              Voir les tarifs
            </Button>
          </motion.div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-20 max-w-4xl w-full"
        >
          {[
            { icon: BookOpen, title: 'Import intelligent', desc: 'SOUFFLEUR détecte automatiquement les personnages et les scènes de votre texte.' },
            { icon: Mic, title: 'Reconnaissance vocale', desc: 'Dites votre texte, SOUFFLEUR le transcrit et compare avec le texte original.' },
            { icon: Sparkles, title: 'Analyse IA', desc: 'Chaque erreur est détectée et corrigée mot par mot pour progresser efficacement.' },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border text-left space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">{f.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
        >
          {[
            'Essai gratuit 7 jours sans carte bancaire',
            'Résiliation en un clic',
            'Paiement sécurisé par Stripe',
          ].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              {t}
            </span>
          ))}
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50">
        © 2025 Happy Good Lines · <a href="mailto:info@happygoodlines.com" className="hover:text-primary">info@happygoodlines.com</a>
      </footer>
    </div>
  );
}