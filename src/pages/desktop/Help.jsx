import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, BookOpen, Sparkles, Volume2, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DesktopHelp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/desktop/')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Mode d'emploi</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Importer un texte */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">1. Importer un texte</h2>
            </div>
            <p className="text-base text-muted-foreground ml-16">
              Cliquez sur le bouton <span className="font-semibold">"Importer"</span> et sélectionnez votre script (PDF, Word, ou texte brut). SOUFFLEUR détecte automatiquement les personnages et répliques.
            </p>
          </div>

          {/* Choisir votre rôle */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">2. Choisir votre rôle</h2>
            </div>
            <p className="text-base text-muted-foreground ml-16">
              Sélectionnez le personnage que vous jouez. Indiquez le genre (Homme/Femme) pour chaque personnage afin d'adapter les voix de synthèse.
            </p>
          </div>

          {/* Répéter */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">3. Répéter</h2>
            </div>
            <p className="text-base text-muted-foreground ml-16">
              L'application vous donne les répliques de vos partenaires. Quand c'est votre tour, cliquez sur le bouton microphone et dites votre texte. SOUFFLEUR analyse votre prononciation en temps réel.
            </p>
          </div>

          {/* Feedback */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Volume2 className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">4. Feedback et correction</h2>
            </div>
            <p className="text-base text-muted-foreground ml-16">
              Recevez un score de précision et un feedback détaillé sur vos erreurs. Vous pouvez réessayer autant de fois que vous le souhaitez pour améliorer votre performance.
            </p>
          </div>

          {/* Tips */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-primary" />
              Conseils pour de meilleurs résultats
            </h3>
            <ul className="space-y-3 text-base text-muted-foreground ml-8 list-disc">
              <li>Parlez clairement et à volume normal</li>
              <li>Autorisez l'accès au microphone dans les paramètres de votre navigateur</li>
              <li>Utilisez un environnement calme pour de meilleurs résultats de reconnaissance</li>
              <li>Vous pouvez régler la vitesse de parole de vos partenaires dans les paramètres</li>
              <li>Mode "Lire sans interruption" : écoutez simplement les répliques sans enregistrer</li>
            </ul>
          </div>

          {/* Permissions */}
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 space-y-3">
            <h3 className="font-bold text-destructive text-lg flex items-center gap-3">
              <Settings className="w-5 h-5" />
              Permissions et confidentialité
            </h3>
            <p className="text-base text-muted-foreground">
              SOUFFLEUR a besoin d'accéder au microphone pour enregistrer et analyser votre voix. Sachez que vos enregistrements ne sont pas stockés : ils sont uniquement traités pour générer le feedback, puis supprimés. Vos données restent privées et ne sont jamais partagées.
            </p>
          </div>

          {/* Test des voix */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-foreground text-lg">Tester les voix avant de commencer</h3>
            <p className="text-base text-muted-foreground">
              Vous pouvez écouter les différentes voix disponibles avant de lancer une répétition. Cliquez sur le lien <span className="font-semibold">"Test des voix"</span> en haut de la page d'accueil.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}