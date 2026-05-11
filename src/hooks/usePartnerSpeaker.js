import { useCallback, useRef, useEffect } from 'react';
import { speakText, stopSpeaking, unlockAudioForAndroid } from '@/lib/speechServices';

export function usePartnerSpeaker({ speechRateRef, onLineChange, onSpeakingChange }) {
  const speakSessionRef = useRef(0);
  const abortControllerRef = useRef(null);
  const pendingTimersRef = useRef([]);
  const audioUnlockedRef = useRef(false);

  const speakPartnerLines = useCallback(async (startIndex, lines, myCharacter, genders, stripDirections) => {
    const norm = (s) => s?.trim().toLowerCase();

    // Unlock audio une seule fois avant tout
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
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    speakSessionRef.current += 1;
    const session = speakSessionRef.current;
    
    // Attendre un peu avant de commencer — donne au cancel() le temps de se propager
    await new Promise(resolve => setTimeout(resolve, 300));

    let index = startIndex;
    console.log('[PARTNER] Starting speakPartnerLines at index:', startIndex, 'total lines:', lines.length);
    while (session === speakSessionRef.current && index < lines.length) {
      const line = lines[index];
      console.log('[PARTNER] Line', index, ':', line?.character, '(my char:', myCharacter, ')');
      if (!line) break;

      if (norm(line.character) === norm(myCharacter)) {
        console.log('[PARTNER] Reached my line, stopping');
        onLineChange(index);
        onSpeakingChange(false);
        return;
      }

      console.log('[PARTNER] Speaking partner line at index:', index);
      onLineChange(index);
      onSpeakingChange(true);
      const gender = genders[line.character] || 'male';
      const textToSpeak = stripDirections(line.text);
      
      console.log('[PARTNER] Text to speak:', textToSpeak.substring(0, 60), 'gender:', gender, 'rate:', speechRateRef.current);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        console.log('[TTS] Speaking:', textToSpeak.substring(0, 50));
        await speakText(textToSpeak, 'fr-FR', gender, speechRateRef.current, controller.signal);
        console.log('[TTS] Finished speaking line');
      } catch (e) {
        console.error('[TTS] Error speaking:', e);
      }

      if (session !== speakSessionRef.current) {
        onSpeakingChange(false);
        return;
      }

      // Small delay to allow UI to update before advancing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Auto-advance to next line
      index++;
    }

    // If we've reached the end of lines
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