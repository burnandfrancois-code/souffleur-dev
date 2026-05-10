import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DesktopTarifs() {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Essai Gratuit',
      price: 'Gratuit',
      duration: '7 jours',
      features: [
        'Jusqu\'à 3 textes',
        'Reconnaissance vocale',
        'Feedback IA basique',
        'Export résultats'
      ]
    },
    {
      name: 'Pro',
      price: '9.99',
      duration: '/mois',
      popular: true,
      features: [
        'Textes illimités',
        'Reconnaissance vocale avancée',
        'Feedback IA détaillé',
        'Historique complet',
        'Voix premium',
        'Support prioritaire'
      ]
    },
    {
      name: 'Premium',
      price: '19.99',
      duration: '/mois',
      features: [
        'Tout Plan Pro',
        'Collaboration (bêta)',
        'Voix personnalisées',
        'Export PDF détaillé',
        'API accès',
        'Support VIP'
      ]
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
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Nos Offres</h1>
            <p className="text-lg text-muted-foreground">Choisissez le plan qui vous convient</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border-2 p-8 space-y-6 transition-all ${
                  plan.popular
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                {plan.popular && (
                  <div className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                    Le plus populaire
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    {plan.duration && <span className="text-muted-foreground">{plan.duration}</span>}
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border hover:bg-secondary'
                  }`}
                >
                  {plan.name === 'Essai Gratuit' ? 'Démarrer' : 'S\'abonner'}
                </Button>
              </div>
            ))}
          </div>

          <div className="bg-secondary/50 border border-border rounded-2xl p-8 text-center space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Besoin d\'aide ?</h3>
            <p className="text-muted-foreground">Contactez notre équipe pour des offres personnalisées ou des questions</p>
            <Button variant="outline">Nous contacter</Button>
          </div>
        </div>
      </main>
    </div>
  );
}