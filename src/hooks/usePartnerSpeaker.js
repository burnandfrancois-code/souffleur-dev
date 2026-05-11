import { useCallback, useRef, useEffect } from 'react';
import { speakText, stopSpeaking, unlockAudioForAndroid } from '@/lib/speechServices';

export function usePartnerSpeaker({ speechRateRef, onLineChange, onSpeakingChange }) {
  const speakSessionRef = useRef(0);
  const abortControllerRef = useRef(null);
  const pendingTimersRef = useRef([]);
  const audioUnlockedRef = useRef(false);

  const speakPartnerLines = useCallback(async (startIndex, lines, myCharacter, genders, stripDirections) => {
    const norm = (s) => s?.trim().toLowerCase();

    // Unlock audio une seule fois (exactement comme TestRomeoTTS)
    if (!audioUnlockedRef.current) {
      try {
        await unlockAudioForAndroid();
        audioUnlockedRef.current = true;
        console.log('[TTS] Audio unlocked for Android');
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        console.error('[TTS] Failed to unlock audio:', e);
        return;
      }
    }

    // Arrêter tout ce qui parle actuellement pour éviter les interférences
    stopSpeaking();
    await new Promise(resolve => setTimeout(resolve, 100));

    speakSessionRef.current += 1;
    const session = speakSessionRef.current;
    let index = startIndex;

    while (session === speakSessionRef.current && index < lines.length) {
      const line = lines[index];
      if (!line) break;

      if (norm(line.character) === norm(myCharacter)) {
        onLineChange(index);
        onSpeakingChange(false);
        return;
      }

      onLineChange(index);
      onSpeakingChange(true);
      const gender = genders[line.character] || 'male';
      const textToSpeak = stripDirections(line.text);

      try {
        // Utiliser speakText exactement comme TestRomeoTTS — pas d'AbortController
        await speakText(textToSpeak, 'fr-FR', gender, speechRateRef.current);
      } catch (e) {
        console.error('[TTS] Error speaking:', e);
      }

      if (session !== speakSessionRef.current) {
        onSpeakingChange(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      index++;
    }

    onSpeakingChange(false);
  }, [onLineChange, onSpeakingChange, speechRateRef]);

  const speakSingleLine = useCallback(async (text, character, genders, stripDirections) => {
    // Unlock audio une seule fois
    if (!audioUnlockedRef.current) {
      try {
        await unlockAudioForAndroid();
        audioUnlockedRef.current = true;
        console.log('[TTS] Audio unlocked for Android');
      } catch (e) {
        console.error('[TTS] Failed to unlock audio:', e);
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    onSpeakingChange(true);
    const gender = genders[character] || 'male';
    const textToSpeak = stripDirections(text);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      console.log('[TTS] Speaking single line:', textToSpeak.substring(0, 50));
      await speakText(textToSpeak, 'fr-FR', gender, speechRateRef.current, controller.signal);
      console.log('[TTS] Finished speaking single line');
    } catch (e) {
      console.error('[TTS] Error speaking single line:', e);
    }

    onSpeakingChange(false);
  }, [onSpeakingChange]);

  const cancelAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSpeaking();
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    speakSessionRef.current += 1;
    onSpeakingChange(false);
  }, [onSpeakingChange]);

  return { speakPartnerLines, speakSingleLine, cancelAll };
}