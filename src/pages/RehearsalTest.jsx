import React, { useState, useRef } from 'react';
import { useSimpleVoiceInput } from '@/hooks/useSimpleVoiceInput';

export default function RehearsalTest() {
  const voiceRec = useSimpleVoiceInput();
  const [logs, setLogs] = useState([]);
  const [finalResult, setFinalResult] = useState('');

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
    console.log(msg);
  };

  const handleStart = () => {
    addLog('▶ start() appelé');
    setFinalResult('');
    voiceRec.start((text) => {
      addLog(`✅ CALLBACK final reçu: "${text}"`);
      setFinalResult(text);
    });
  };

  const handleStop = () => {
    addLog('⏹ stop() appelé');
    voiceRec.stop();
  };

  const handleReset = () => {
    addLog('🔄 reset() appelé');
    voiceRec.reset();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-mono">
      <h1 className="text-2xl font-bold mb-6 text-yellow-400">🎤 Rehearsal Test — Voice Debug</h1>

      {/* Status */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-lg border-2 ${voiceRec.isRecording ? 'border-green-500 bg-green-900/30' : 'border-gray-600 bg-gray-800'}`}>
          <p className="text-xs text-gray-400 mb-1">isRecording</p>
          <p className={`text-xl font-bold ${voiceRec.isRecording ? 'text-green-400' : 'text-gray-500'}`}>
            {voiceRec.isRecording ? '🟢 TRUE' : '⚫ false'}
          </p>
        </div>
        <div className={`p-4 rounded-lg border-2 ${voiceRec.error ? 'border-red-500 bg-red-900/30' : 'border-gray-600 bg-gray-800'}`}>
          <p className="text-xs text-gray-400 mb-1">error</p>
          <p className="text-sm text-red-400">{voiceRec.error?.message || '—'}</p>
        </div>
        <div className={`p-4 rounded-lg border-2 ${finalResult ? 'border-yellow-500 bg-yellow-900/30' : 'border-gray-600 bg-gray-800'}`}>
          <p className="text-xs text-gray-400 mb-1">Résultat final</p>
          <p className="text-sm text-yellow-400 break-all">{finalResult || '—'}</p>
        </div>
      </div>

      {/* Transcript live */}
      <div className="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-600 min-h-[4rem]">
        <p className="text-xs text-gray-400 mb-1">transcript (live)</p>
        <p className="text-lg text-cyan-300">
          {voiceRec.transcript || <span className="text-gray-600 italic">En attente...</span>}
          {voiceRec.isRecording && voiceRec.transcript && (
            <span className="inline-block w-0.5 h-5 bg-cyan-400 ml-1 animate-pulse" />
          )}
        </p>
      </div>

      {/* Instructions */}
      <div className="mb-6 p-4 rounded-lg bg-blue-900/30 border border-blue-600 text-sm text-blue-300">
        <strong>Comment tester :</strong>
        <ol className="list-decimal ml-4 mt-2 space-y-1">
          <li>Cliquez <strong>START</strong></li>
          <li>Parlez : <em>"Bonjour je m'appelle Jean"</em></li>
          <li>Attendez 2-3 secondes puis dites <strong>"OK"</strong></li>
          <li>Le résultat final doit apparaître en jaune ci-dessus</li>
        </ol>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleStart}
          disabled={voiceRec.isRecording}
          className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-white transition-colors"
        >
          ▶ START
        </button>
        <button
          onClick={handleStop}
          disabled={!voiceRec.isRecording}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-white transition-colors"
        >
          ⏹ STOP
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold text-white transition-colors"
        >
          🔄 RESET
        </button>
        <button
          onClick={() => setLogs([])}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Vider logs
        </button>
      </div>

      {/* Logs */}
      <div className="bg-black border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
        <p className="text-xs text-gray-500 mb-2">Logs applicatifs :</p>
        {logs.length === 0 ? (
          <p className="text-gray-600 text-sm italic">Aucun log — cliquez START pour commencer</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="text-xs text-green-400 leading-5">{log}</div>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-gray-600">
        Ouvrez aussi la console Chrome (F12) pour voir les logs de la reconnaissance vocale en temps réel.
      </p>
    </div>
  );
}