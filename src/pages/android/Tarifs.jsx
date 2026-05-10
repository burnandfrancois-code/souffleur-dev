import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AndroidTarifs() {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Essai',
      price: 'Gratuit',
      duration: '7 jours',
      features: ['3 textes', 'Feedback basique', 'Export']
    },
    {
      name: 'Pro',
      price: '9.99',
      duration: '/mois',
      popular: true,
      features: ['Illimité', 'Feedback avancé', 'Historique', 'Voix premium']
    },
    {
      name: 'Premium',
      price: '19.99',
      duration: '/mois',
      features: ['Tout Pro', 'Collaboration', 'Export PDF', 'Support VIP']
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
        <div className="max-w-md mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Nos Offres</h1>
            <p className="text-sm text-muted-foreground">Choisissez votre plan</p>
          </div>

          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border-2 p-5 space-y-4 transition-all ${
                  plan.popular
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                {plan.popular && (
                  <div className="inline-block bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-semibold">
                    Populaire
                  </div>
                )}

                <div className="space-y-1">
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    {plan.duration && <span className="text-xs text-muted-foreground">{plan.duration}</span>}
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full text-sm ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border'
                  }`}
                >
                  {plan.name === 'Essai' ? 'Démarrer' : 'S\'abonner'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}