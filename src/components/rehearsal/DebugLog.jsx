import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

export default function DebugLog({ show = true }) {
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = React.useState(true);
  const logsRef = useRef([]);

  useEffect(() => {
    if (!show) return;

    const originalLog = console.log;
    const originalError = console.error;

    const addLog = (message, type = 'log') => {
      logsRef.current = [
        { msg: String(message), type, time: new Date().toLocaleTimeString() },
        ...logsRef.current
      ].slice(0, 50); // Keep last 50
      setLogs([...logsRef.current]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog(args.join(' '), 'log');
    };

    console.error = (...args) => {
      originalError(...args);
      addLog(args.join(' '), 'error');
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, [show]);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed top-0 right-0 z-50 w-96 h-screen bg-black/95 border-l-2 border-yellow-500 shadow-lg rounded-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/30 bg-black/80 sticky top-0">
          <span className="text-sm text-yellow-400 font-mono font-bold">🔴 DEBUG LOG</span>
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-yellow-500/20 rounded text-yellow-400"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setLogs([])}
              className="p-1.5 hover:bg-yellow-500/20 rounded text-yellow-400 text-xs font-bold"
            >
              CLEAR
            </button>
          </div>
        </div>

        {expanded && (
          <div className="overflow-y-auto h-[calc(100vh-60px)] p-3 space-y-1 bg-black/80">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-xs italic mt-4 text-center">Waiting for logs...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`text-xs font-mono whitespace-pre-wrap break-words p-1.5 rounded border-l-2 ${
                    log.type === 'error' 
                      ? 'text-red-300 bg-red-500/10 border-l-red-500' 
                      : 'text-green-300 bg-green-500/10 border-l-green-500'
                  }`}
                >
                  <span className="text-gray-500">[{log.time}]</span> {log.msg}
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}