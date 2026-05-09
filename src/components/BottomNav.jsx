import React from 'react';
import { Link } from 'react-router-dom';
import { Home, BookOpen, Settings, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function BottomNav() {
  const { user } = useAuth();
  const isDesktop = user?.preferred_platform === 'desktop';
  const basePath = isDesktop ? '/desktop' : '/android';

  const navItems = [
    { icon: Home, label: 'Accueil', path: basePath },
    { icon: BookOpen, label: 'Textes', path: `${basePath}/my-scripts` },
    { icon: CreditCard, label: 'Tarifs', path: '/tarifs' },
    { icon: Settings, label: 'Paramètres', path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/30 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-around">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}