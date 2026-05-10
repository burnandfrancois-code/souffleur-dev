import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DesktopTarifs() {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Essai gratuit',
      price: 'Gratuit',
      subtitle: '1 texte · 7 jours',
      features: [
        '1 texte importé',
        'Accès pendant 7 jours',
        'Reconnaissance vocale',
        'Analyse IA des erreurs'
      ],
      cta: 'Commencer gratuitement'
    },
    {
      name: 'Texte unique',
      price: '2.99',
      currency: '€',
      subtitle: 'Paiement unique',
      features: [
        '1 texte importé',
        'Accès illimité dans le temps',
        'Reconnaissance vocale',
        'Analyse IA des erreurs'
      ],
      cta: 'Choisir ce forfait'
    },
    {
      name: 'Mensuel Solo',
      price: '4.99',
      currency: '€',
      duration: '/mois',
      popular: true,
      subtitle: '1 personne',
      badge: 'Populaire',
      features: [
        'Textes illimités',
        '1 utilisateur',
        'Reconnaissance vocale',
        'Analyse IA des erreurs',
        'Résiliation à tout moment'
      ],
      cta: 'S\'abonner'
    },
    {
      name: 'Mensuel Troupe',
      price: '19.90',
      currency: '€',
      duration: '/mois',
      subtitle: 'Jusqu\'à 10 personnes',
      features: [
        'Textes illimités',
        'Jusqu\'à 10 utilisateurs',
        'Reconnaissance vocale',
        'Analyse IA des erreurs',
        'Résiliation à tout moment'
      ],
      cta: 'S\'abonner'
    },
    {
      name: 'Annuel Solo',
      price: '39.90',
      currency: '€',
      duration: '/an',
      subtitle: '1 personne',
      badge: '2 mois offerts',
      features: [
        'Textes illimités',
        '1 utilisateur',
        'Reconnaissance vocale',
        'Analyse IA des erreurs',
        'Économisez 20% vs mensuel'
      ],
      cta: 'S\'abonner'
    },
    {
      name: 'Annuel Troupe',
      price: '149.00',
      currency: '€',
      duration: '/an',
      subtitle: 'Jusqu\'à 10 personnes',
      badge: '2 mois offerts',
      features: [
        'Textes illimités',
        'Jusqu\'à 10 utilisateurs',
        'Reconnaissance vocale',
        'Analyse IA des erreurs',
        'Économisez 20% vs mensuel'
      ],
      cta: 'S\'abonner'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h1 className="text-5xl font-bold text-foreground">Choisissez votre <span className="text-primary">formule</span></h1>
            <p className="text-lg text-muted-foreground">Répétez votre texte sans partenaire, à votre rythme. Commencez gratuitement, sans carte bancaire.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border-2 p-6 space-y-5 transition-all relative ${
                  plan.popular
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 bg-card/50 hover:border-border'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  {plan.subtitle && <p className="text-xs text-muted-foreground">{plan.subtitle}</p>}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  {plan.currency && <span className="text-sm text-muted-foreground">{plan.currency}</span>}
                  {plan.duration && <span className="text-sm text-muted-foreground">{plan.duration}</span>}
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.popular || plan.name === 'Essai gratuit'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border text-foreground hover:bg-secondary'
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground border-t border-border pt-6">
            <p>Paiement sécurisé par Stripe · Sans engagement pour les essais · Résiliation en un clic pour les abonnements</p>
          </div>
        </div>
      </main>
    </div>
  );
}