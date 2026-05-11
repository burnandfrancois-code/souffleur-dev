import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { speakText, unlockAudioForAndroid } from '@/lib/speechServices';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TestRomeoTTS() {
  const navigate = useNavigate();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('');

  const testPhrase = 'Roméo, Roméo, pourquoi es-tu Roméo?';

  const handleSpeak = async () => {
    setIsSpeaking(true);
    setStatus('Déverrouillage audio...');
    
    try {
      await unlockAudioForAndroid();
      setStatus('Synthèse en cours...');
      
      await speakText(testPhrase, 'fr-FR', 'female', 1.3);
      setStatus('✓ Phrase lue');
    } catch (e) {
      setStatus(`Erreur: ${e.message}`);
      console.error(e);
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <Button variant="ghost" onClick={() => navigate('/android/')} className="w-fit mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Test TTS - Romeo et Juliet</h1>
          <p className="text-lg text-muted-foreground italic">"{testPhrase}"</p>
        </div>

        <Button
          size="lg"
          onClick={handleSpeak}
          disabled={isSpeaking}
          className="gap-2"
        >
          {isSpeaking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              En cours...
            </>
          ) : (
            '🎙️ Lire la phrase'
          )}
        </Button>

        {status && (
          <p className={`text-sm ${status.includes('✓') ? 'text-green-500' : status.includes('Erreur') ? 'text-red-500' : 'text-muted-foreground'}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}