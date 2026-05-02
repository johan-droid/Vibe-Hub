import React, { useState } from 'react';
import { Surface } from '../../shared/components/Surface';
import { ShieldAlert, ShieldCheck, AlertTriangle, Fingerprint, Activity, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SecurityAudit() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);

  const runAudit = () => {
    setScanning(true);
    setResults(null);
    // Mock network request / scan delay
    setTimeout(() => {
      setScanning(false);
      setResults({
        score: 92,
        issues: [
          { type: 'high', title: 'Dependency Vulnerability', desc: 'lodash < 4.17.21 is vulnerable to ReDoS.' },
          { type: 'medium', title: 'Hardcoded Secret Risk', desc: 'Potential API key found in config.js.' },
          { type: 'low', title: 'Missing Content Security Policy', desc: 'index.html lacks robust CSP headers.' }
        ]
      });
    }, 2500);
  };

  return (
    <div className="h-full flex flex-col bg-surface p-6 overflow-y-auto">
      <div className="flex items-center gap-3 mb-8 border-b border-outline-variant/10 pb-6">
        <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h2 className="title-medium font-bold text-on-surface uppercase tracking-widest text-sm">Security Audit</h2>
          <p className="label-small text-on-surface-variant opacity-60">Neural vulnerability analysis & threat detection</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <Surface elevation={1} className="p-6 flex flex-col items-center justify-center text-center gap-4 border border-outline-variant/10 bg-surface-container-lowest">
          <Activity size={32} className={scanning ? 'text-primary animate-pulse' : 'text-on-surface-variant opacity-50'} />

          <div>
            <h3 className="title-medium font-bold mb-1">{scanning ? 'Analyzing Codebase...' : 'System Ready for Audit'}</h3>
            <p className="text-sm text-on-surface-variant opacity-70">
              {scanning
                ? 'Performing deep neural inspection of dependencies, auth flows, and code structure.'
                : 'Run a comprehensive security sweep to identify potential vulnerabilities before deployment.'}
            </p>
          </div>

          <button
            onClick={runAudit}
            disabled={scanning}
            className={`mt-4 px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all
              ${scanning
                ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}
          >
            {scanning ? 'Scanning...' : 'Initiate Audit'}
          </button>
        </Surface>

        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Score Card */}
            <Surface elevation={2} className="p-6 flex items-center justify-between border border-outline-variant/10 bg-surface-container">
              <div>
                <div className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-1">Security Score</div>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black text-primary">{results.score}</span>
                  <span className="text-on-surface-variant opacity-50 mb-1">/ 100</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <ShieldCheck size={32} className="text-primary" />
              </div>
            </Surface>

            {/* Issues List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 mb-2">Detected Anomalies</h4>
              {results.issues.map((issue, i) => (
                <Surface key={i} elevation={1} className="p-4 flex gap-4 border border-outline-variant/10">
                  <div className="mt-0.5">
                    {issue.type === 'high' && <AlertTriangle size={18} className="text-error" />}
                    {issue.type === 'medium' && <Fingerprint size={18} className="text-tertiary" />}
                    {issue.type === 'low' && <CheckCircle2 size={18} className="text-secondary" />}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-on-surface mb-1">{issue.title}</h5>
                    <p className="text-xs text-on-surface-variant opacity-80 leading-relaxed">{issue.desc}</p>
                  </div>
                </Surface>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
