import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

export default function DebugLog({ show = true }) {
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = React.useState(false);
  const logsRef = useRef([]);

  useEffect(() => {
    if (!show) return;

    const originalLog = console.log;
    const originalError = console.error;

    const addLog = (message, type = 'log') => {
      logsRef.current = [
        { msg: String(message), type, time: new Date().toLocaleTimeString() },
        ...logsRef.current
      ].slice(0, 20); // Keep last 20
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
        className={`fixed top-20 right-2 z-50 rounded-lg border border-yellow-500/50 bg-black/90 backdrop-blur-sm transition-all ${
          expanded ? 'w-80 h-48' : 'w-64 h-12'
        }`}
      >
        <div className="flex items-center justify-between px-2 py-1 border-b border-yellow-500/30">
          <span className="text-xs text-yellow-400 font-mono">DEBUG</span>
          <div className="flex gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-yellow-500/20 rounded text-yellow-400"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setLogs([])}
              className="p-1 hover:bg-yellow-500/20 rounded text-yellow-400 text-xs"
            >
              CLEAR
            </button>
          </div>
        </div>

        {expanded && (
          <div className="overflow-y-auto h-44 p-1.5 space-y-0.5 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`${
                    log.type === 'error' ? 'text-red-400' : 'text-green-400'
                  } text-xs whitespace-nowrap overflow-hidden text-ellipsis`}
                >
                  <span className="text-gray-600">[{log.time}]</span> {log.msg}
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}