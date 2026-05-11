import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { speakText, unlockAudioForAndroid } from '@/lib/speechServices';

export default function AndroidTTSTest() {
  const navigate = useNavigate();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('Prêt');

  const testVoice = async () => {
    try {
      setStatus('Déverrouillage audio...');
      await unlockAudioForAndroid();
      
      setStatus('Parole en cours...');
      setIsSpeaking(true);
      
      const controller = new AbortController();
      await speakText(
        'Bonjour, ceci est un test de voix synthétisée sur Android.',
        'fr-FR',
        'female',
        1,
        controller.signal
      );
      
      setIsSpeaking(false);
      setStatus('Test terminé');
    } catch (e) {
      console.error('Erreur TTS:', e);
      setStatus('Erreur: ' + e.message);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/android/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg">Test TTS</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center space-y-2">
          <p className="text-2xl">🎙️</p>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>

        <Button
          onClick={testVoice}
          disabled={isSpeaking}
          size="lg"
          className="gap-2"
        >
          <Volume2 className="w-5 h-5" />
          {isSpeaking ? 'Parole...' : 'Tester la voix'}
        </Button>
      </div>
    </div>
  );
}