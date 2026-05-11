import { useCallback, useRef, useEffect } from 'react';
import { speakText, stopSpeaking, unlockAudioForAndroid } from '@/lib/speechServices';

export function usePartnerSpeaker({ speechRateRef, onLineChange, onSpeakingChange }) {
  const speakSessionRef = useRef(0);
  const abortControllerRef = useRef(null);
  const pendingTimersRef = useRef([]);
  const audioUnlockedRef = useRef(false);

  const speakPartnerLines = useCallback(async (startIndex, lines, myCharacter, genders, stripDirections) => {
    const norm = (s) => s?.trim().toLowerCase();

    // Unlock audio une seule fois avant tout (exactement comme TestRomeoTTS)
    if (!audioUnlockedRef.current) {
      try {
        await unlockAudioForAndroid();
        audioUnlockedRef.current = true;
        console.log('[TTS] Audio unlocked for Android');
      } catch (e) {
        console.error('[TTS] Failed to unlock audio:', e);
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSpeaking();
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    speakSessionRef.current += 1;
    const session = speakSessionRef.current;

    let index = startIndex;
    console.log('[PARTNER] Starting speakPartnerLines at index:', startIndex, 'total lines:', lines.length);
    
    while (session === speakSessionRef.current && index < lines.length) {
      const line = lines[index];
      if (!line) break;

      if (norm(line.character) === norm(myCharacter)) {
        console.log('[PARTNER] Reached my line at index:', index);
        onLineChange(index);
        onSpeakingChange(false);
        return;
      }

      onLineChange(index);
      onSpeakingChange(true);
      const gender = genders[line.character] || 'male';
      const textToSpeak = stripDirections(line.text);
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        console.log('[PARTNER] Speaking line', index, ':', textToSpeak.substring(0, 50));
        await speakText(textToSpeak, 'fr-FR', gender, speechRateRef.current, controller.signal);
      } catch (e) {
        console.error('[TTS] Error speaking:', e);
      }

      if (session !== speakSessionRef.current) {
        onSpeakingChange(false);
        return;
      }

      // Small delay before next line
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