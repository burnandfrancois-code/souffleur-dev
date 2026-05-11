import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, BookOpen, Sparkles, Volume2, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DesktopHelp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/desktop/')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Mode d'emploi</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-20">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Importer un texte */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">1. Importer un texte</h2>
            </div>
            <p className="text-sm text-muted-foreground ml-13">
              Cliquez sur <span className="font-semibold">"Importer"</span> et sélectionnez votre script (PDF, Word, ou texte). SOUFFLEUR détecte automatiquement les personnages et répliques.
            </p>
          </div>

          {/* Choisir votre rôle */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">2. Choisir votre rôle</h2>
            </div>
            <p className="text-sm text-muted-foreground ml-13">
              Sélectionnez le personnage que vous jouez. Indiquez le genre (Homme/Femme) pour chaque personnage pour adapter les voix.
            </p>
          </div>

          {/* Répéter */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">3. Répéter</h2>
            </div>
            <p className="text-sm text-muted-foreground ml-13">
              L'app vous donne les répliques de vos partenaires. Quand c'est votre tour, cliquez sur le micro et dites votre texte. SOUFFLEUR analyse votre prononciation en temps réel.
            </p>
          </div>

          {/* Feedback */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">4. Feedback</h2>
            </div>
            <p className="text-sm text-muted-foreground ml-13">
              Recevez un score de précision et un feedback détaillé sur vos erreurs. Réessayez autant de fois que vous le souhaitez.
            </p>
          </div>

          {/* Tips */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Conseils
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Parlez clairement et à volume normal</li>
              <li>✓ Autorisez l'accès au microphone dans les paramètres de votre navigateur</li>
              <li>✓ Utilisez un environnement calme pour de meilleurs résultats</li>
              <li>✓ Vous pouvez régler la vitesse de parole de vos partenaires</li>
              <li>✓ Lire sans interruption : écoutez simplement les répliques sans enregistrer</li>
            </ul>
          </div>

          {/* Permissions */}
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-destructive flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Permissions
            </h3>
            <p className="text-xs text-muted-foreground">
              SOUFFLEUR a besoin de l'accès au microphone pour enregistrer et analyser votre voix. Vos enregistrements ne sont pas stockés et restent privés.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}