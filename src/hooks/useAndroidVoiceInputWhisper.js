import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook de reconnaissance vocale Whisper (ANDROID - Transcription OpenAI)
 * Inspire de la logique Desktop (Web Speech API) mais avec Whisper cloud.
 * 
 * Architecture :
 * - Capture chunks audio de 1.5s (optimisé pour Whisper)
 * - Accumule les résultats finals (pas de doublons)
 * - Simule les résultats "interim" (texte partiel) en temps réel
 * - Détecte "OK" et soumet le texte nettoyé
 * - Respecte rate limit OpenAI (3 req/min = 20s minimum entre appels)
 */
export function useAndroidVoiceInputWhisper() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const activeRef = useRef(false);
  const submittedRef = useRef(false);
  const onFinalRef = useRef(null);
  const accumulatedRef = useRef(''); // Texte final validé
  const interimRef = useRef(''); // Texte partial en cours (simulé)
  const micStreamRef = useRef(null);
  const lastTranscriptRef = useRef(''); // Éviter les doublons

  const destroyRecognition = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const recordWithWhisper = useCallback(async () => {
    if (!activeRef.current || submittedRef.current) return;
    if (!micStreamRef.current) {
      setError({ message: 'Pas de stream microphone.' });
      return;
    }

    try {
      // Sélectionner le meilleur mimeType disponible
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const mediaRecorder = new MediaRecorder(micStreamRef.current, mimeType ? { mimeType } : {});
      const chunks = [];
      const actualMimeType = mediaRecorder.mimeType;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onerror = (e) => {
        setError({ message: 'Erreur enregistrement : ' + e.error });
      };

      mediaRecorder.onstop = async () => {
        if (!activeRef.current || submittedRef.current) return;
        
        if (chunks.length === 0) {
          // Pas de données, relancer
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
          return;
        }

        const blob = new Blob(chunks, { type: actualMimeType || 'audio/webm' });
        if (blob.size === 0) {
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 500);
          }
          return;
        }

        try {
          // Convertir en base64 pour transmission
          const audioBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (e) => reject(new Error('FileReader error: ' + e.message));
            reader.readAsDataURL(blob);
          });

          // Appel Whisper
          const response = await base44.functions.invoke('transcribeAudioV5', { audio: audioBase64 });

          if (response.status !== 200) {
            throw new Error('Backend status ' + response.status);
          }

          const text = response.data?.text || response.data?.transcript || '';

          if (!activeRef.current || submittedRef.current) return;

          // ===== LOGIQUE DESKTOP ADAPTÉE =====
          // Traiter comme un "résultat final" (isFinal = true en Web Speech API)
          if (text.trim()) {
            // Ne pas ajouter si c'est un doublon
            if (text !== lastTranscriptRef.current) {
              accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
              lastTranscriptRef.current = text;
            }
          }

          // Afficher : accumulated + interim (simulé vide car Whisper pas de stream)
          const displayed = accumulatedRef.current;
          setTranscript(displayed);
          interimRef.current = '';

          // ===== DÉTECTION "OK" (identique à Desktop) =====
          const allText = displayed.toLowerCase();
          const hasOk = /\bok\b/.test(allText) || /^ok\s/.test(allText) || /\sok$/.test(allText);
          
          if (hasOk && onFinalRef.current) {
            // Soumettre le texte nettoyé (sans "ok")
            submittedRef.current = true;
            const finalText = allText.replace(/\bok\b/g, '').trim();
            const cb = onFinalRef.current;
            activeRef.current = false;
            setIsRecording(false);
            cb(finalText);
            return;
          }

          // Relancer avec délai (rate limit : 3 req/min = 20s minimum)
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 20000);
          }
        } catch (e) {
          console.error('[WHISPER] Error transcribing:', e);
          setError({ message: 'Erreur transcription: ' + e.message });
          if (activeRef.current && !submittedRef.current) {
            setTimeout(() => recordWithWhisper(), 1500);
          }
        }
      };

      mediaRecorder.start();
      
      // Capture chunks de 1.5s pour maximiser la qualité Whisper
      // (plus court = plus souvent, mais risque de texte incomplet)
      // (plus long = moins souvent, mais Whisper capture mieux les phrases)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 1500);

    } catch (e) {
      setError({ message: 'Erreur micro : ' + e.message });
      if (activeRef.current && !submittedRef.current) {
        setTimeout(() => recordWithWhisper(), 1500);
      }
    }
  }, []);

  const start = useCallback(async (onFinalTranscript) => {
    // Arrêter la synthèse vocale en cours
    window.speechSynthesis?.cancel();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Nettoyer l'ancienne session
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    activeRef.current = false;
    submittedRef.current = false;
    accumulatedRef.current = '';
    interimRef.current = '';
    lastTranscriptRef.current = '';
    onFinalRef.current = onFinalTranscript;
    setTranscript('');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      if (!stream.active || stream.getTracks().length === 0) {
        throw new Error('Stream is not active or has no tracks');
      }
    } catch (e) {
      setError({ message: 'Permission micro refusée ou impossible d\'accéder au micro.' });
      setIsRecording(false);
      return;
    }

    activeRef.current = true;
    setIsRecording(true);
    recordWithWhisper();
  }, [recordWithWhisper]);

  const stop = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    setIsRecording(false);
  }, [destroyRecognition]);

  const reset = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    destroyRecognition();
    accumulatedRef.current = '';
    interimRef.current = '';
    lastTranscriptRef.current = '';
    onFinalRef.current = null;
    setTranscript('');
    setError(null);
    setIsRecording(false);
  }, [destroyRecognition]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      destroyRecognition();
    };
  }, [destroyRecognition]);

  return useMemo(() => ({ transcript, isRecording, error, start, stop, reset }), [transcript, isRecording, error, start, stop, reset]);
}