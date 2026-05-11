import { useCallback, useRef } from 'react';
import { speakText, stopSpeaking } from '@/lib/speechServices';

export function usePartnerSpeaker({ speechRateRef, onLineChange, onSpeakingChange }) {
  const speakSessionRef = useRef(0);
  const abortControllerRef = useRef(null);
  const pendingTimersRef = useRef([]);

  const speakPartnerLines = useCallback(async (startIndex, lines, myCharacter, genders, stripDirections) => {
    const norm = (s) => s?.trim().toLowerCase();

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = null;
    stopSpeaking();
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
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
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      await speakText(stripDirections(line.text), 'fr-FR', gender, speechRateRef.current, controller.signal);

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
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = null;
    stopSpeaking();

    onSpeakingChange(true);
    const gender = genders[character] || 'male';
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    await speakText(stripDirections(text), 'fr-FR', gender, speechRateRef.current, controller.signal);
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