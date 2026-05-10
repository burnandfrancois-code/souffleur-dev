import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AndroidTarifs() {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Essai gratuit',
      price: 'Gratuit',
      subtitle: '1 texte · 7 jours',
      features: [
        '1 texte importé',
        'Accès 7 jours',
        'Reconnaissance vocale',
        'Analyse IA'
      ]
    },
    {
      name: 'Texte unique',
      price: '2.99€',
      subtitle: 'Paiement unique',
      features: [
        '1 texte',
        'Accès illimité',
        'Reconnaissance vocale',
        'Analyse IA'
      ]
    },
    {
      name: 'Mensuel Solo',
      price: '4.99€',
      duration: '/mois',
      popular: true,
      subtitle: '1 personne',
      features: [
        'Textes illimités',
        '1 utilisateur',
        'Reconnaissance vocale',
        'Analyse IA',
        'Résiliation flexible'
      ]
    },
    {
      name: 'Annuel Solo',
      price: '39.90€',
      duration: '/an',
      subtitle: '1 personne',
      badge: '2 mois offerts',
      features: [
        'Textes illimités',
        '1 utilisateur',
        'Reconnaissance vocale',
        'Analyse IA',
        'Économisez 20%'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/30 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>

      <main className="px-3 py-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Choisissez votre <span className="text-primary">formule</span></h1>
            <p className="text-xs text-muted-foreground">Commencez gratuitement, sans carte bancaire.</p>
          </div>

          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border-2 p-4 space-y-4 transition-all relative ${
                  plan.popular
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-2 right-3 bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-sm">{plan.name}</h3>
                  {plan.subtitle && <p className="text-xs text-muted-foreground">{plan.subtitle}</p>}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                  {plan.duration && <span className="text-xs text-muted-foreground">{plan.duration}</span>}
                </div>

                <ul className="space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full text-xs ${
                    plan.popular || plan.name === 'Essai gratuit'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border'
                  }`}
                >
                  {plan.name === 'Essai gratuit' ? 'Commencer gratuitement' : 'S\'abonner'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}