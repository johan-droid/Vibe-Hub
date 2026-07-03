import React, { useEffect, useState } from 'react';
import {
  Bell,
  Cpu,
  Database,
  Languages,
  Lock,
  Palette,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  Terminal,
  User,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { VibeLogoCompact } from '../../../components/VibeLogo';
import { SELINA_BRAND } from '../../../brand/selina';

const fieldShell = 'rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3';
const inputShell = 'rounded-md border border-white/10 bg-[#080A0F]/80 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-[#43F3C5]/45';

function Toggle({ enabled, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <span className="block text-sm font-bold text-white/85">{label}</span>
        {description && <span className="mt-1 block text-xs leading-relaxed text-white/40">{description}</span>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none ${
          enabled ? 'bg-[#43F3C5]' : 'bg-white/15'
        }`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full transition ${
            enabled ? 'translate-x-6 bg-[#07110F]' : 'translate-x-1 bg-white/80'
          }`}
        />
      </button>
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange, label, unit = '' }) {
  return (
    <div className="py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-white/85">{label}</span>
        <span className="rounded-md border border-[#43F3C5]/20 bg-[#43F3C5]/10 px-2 py-1 font-mono text-xs text-[#43F3C5]">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#43F3C5]"
      />
    </div>
  );
}

function Select({ value, options, onChange, label, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <span className="text-sm font-bold text-white/85">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${inputShell} min-w-44 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Section({ eyebrow, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{eyebrow}</h3>
      <div className="divide-y divide-white/[0.07] rounded-lg border border-white/10 bg-white/[0.035] px-5">
        {children}
      </div>
    </section>
  );
}

function LanguageLock() {
  return (
    <div className="py-4">
      <div className="mb-3 flex items-center gap-2">
        <Languages size={15} className="text-[#F7C35F]" />
        <span className="text-sm font-bold text-white/85">Language lock</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {['en', 'hi', 'or'].map((language) => (
          <span
            key={language}
            className="rounded-md border border-[#F7C35F]/20 bg-[#F7C35F]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#F7C35F]"
          >
            {language}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, setSettings, user, setExperienceMode, setAutonomyLevel } = useStore();
  const [activeTab, setActiveTab] = useState('agent');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    if (isOpen) setLocalSettings(settings);
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const updateLocal = (group, key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    const normalizedAutonomy = Math.min(3, Math.max(1, Number(localSettings.workflow.autonomyLevel) || 2));
    const normalizedMode = localSettings.workflow.experienceMode === 'learner' ? 'learner' : 'professional';
    const nextSettings = {
      ...localSettings,
      agent: {
        ...localSettings.agent,
        sandboxType: 'Local Docker container',
      },
      workflow: {
        ...localSettings.workflow,
        experienceMode: normalizedMode,
        autonomyLevel: normalizedAutonomy,
      },
    };

    setExperienceMode(normalizedMode);
    setAutonomyLevel(normalizedAutonomy);
    setSettings(nextSettings);
    onClose();
  };

  const tabs = [
    { id: 'agent', icon: Cpu, label: 'Selina Core', color: 'text-[#43F3C5]' },
    { id: 'terminal', icon: Terminal, label: 'Terminal', color: 'text-[#8DA2FF]' },
    { id: 'appearance', icon: Palette, label: 'Appearance', color: 'text-[#F7C35F]' },
    { id: 'workflow', icon: Bell, label: 'Workflow', color: 'text-[#43F3C5]' },
    { id: 'profile', icon: User, label: 'Profile', color: 'text-[#8DA2FF]' },
  ];

  if (showAdvanced) {
    tabs.splice(4, 0, { id: 'advanced', icon: ShieldAlert, label: 'Advanced', color: 'text-[#FF8F8F]' });
  }

  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label;
  const displayName = user?.name || user?.email || 'Selina Developer';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 16 }}
        className="relative flex h-[min(760px,92vh)] w-full max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-[#0D1117] shadow-2xl"
      >
        <aside className="hidden w-72 shrink-0 flex-col border-r border-white/10 bg-[#0B0E14] p-5 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <VibeLogoCompact size={44} />
            <div>
              <h2 className="text-base font-black text-white">Settings</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Workspace Control</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition ${
                  activeTab === tab.id
                    ? 'bg-white/[0.07] text-white'
                    : 'text-white/45 hover:bg-white/[0.045] hover:text-white/80'
                }`}
              >
                <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-white/35'} />
                <span className="text-sm font-bold">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.span layoutId="settings-active-tab" className="absolute left-0 top-2 h-8 w-1 rounded-r bg-[#43F3C5]" />
                )}
              </button>
            ))}
          </nav>

          <div className="space-y-4 border-t border-white/10 pt-5">
            <Toggle
              enabled={showAdvanced}
              onChange={setShowAdvanced}
              label="Advanced Mode"
              description="Expose power-user controls"
            />
            <div className="rounded-lg border border-white/10 bg-[#080A0F]/70 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
              {SELINA_BRAND.versionLabel}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-white/10 bg-[#0D1117]/95 px-5 py-4 backdrop-blur">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SettingsIcon size={17} className="text-[#43F3C5] md:hidden" />
                <h2 className="truncate text-lg font-black tracking-tight text-white">{activeLabel}</h2>
              </div>
              <p className="mt-1 text-xs font-medium text-white/40">{SELINA_BRAND.productName} workspace configuration</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-white/50 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="mx-auto max-w-3xl space-y-7"
              >
                {activeTab === 'agent' && (
                  <>
                    <Section eyebrow="Core Processing">
                      <Slider
                        label="Max automatic retries"
                        value={localSettings.agent.maxRetries}
                        min={1}
                        max={10}
                        onChange={(value) => updateLocal('agent', 'maxRetries', value)}
                      />
                      <div className="flex items-center justify-between gap-4 py-4">
                        <span className="text-sm font-bold text-white/85">Timeout per command</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={localSettings.agent.timeout}
                            onChange={(event) => updateLocal('agent', 'timeout', Number.parseInt(event.target.value, 10) || 30)}
                            className={`${inputShell} w-24 text-center`}
                          />
                          <span className="text-xs font-medium text-white/35">seconds</span>
                        </div>
                      </div>
                      <Select
                        label="Model / Provider"
                        value={localSettings.agent.model}
                        options={['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro', 'DeepSeek Coder']}
                        onChange={(value) => updateLocal('agent', 'model', value)}
                      />
                    </Section>

                    <Section eyebrow="Architecture Locks">
                      <Toggle
                        label="Auto-accept changes"
                        enabled={localSettings.agent.autoAccept}
                        onChange={(value) => updateLocal('agent', 'autoAccept', value)}
                        description="Apply changes after passing validation"
                      />
                      <Select
                        label="Sandbox type"
                        value="Local Docker container"
                        options={['Local Docker container']}
                        onChange={() => updateLocal('agent', 'sandboxType', 'Local Docker container')}
                        disabled
                      />
                      <div className="flex items-start gap-3 py-4">
                        <Lock size={16} className="mt-0.5 shrink-0 text-[#43F3C5]" />
                        <p className="text-sm leading-relaxed text-white/45">
                          Deployment and execution stay inside the local Docker sandbox.
                        </p>
                      </div>
                      <LanguageLock />
                    </Section>
                  </>
                )}

                {activeTab === 'terminal' && (
                  <>
                    <Section eyebrow="Visibility">
                      <Select
                        label="Terminal visibility"
                        value={localSettings.terminal.visibility}
                        options={['Never show', 'On Error', 'Always show']}
                        onChange={(value) => updateLocal('terminal', 'visibility', value)}
                      />
                      <Toggle
                        label="Peek auto-dismiss"
                        enabled={localSettings.terminal.peekAutoDismiss}
                        onChange={(value) => updateLocal('terminal', 'peekAutoDismiss', value)}
                        description="Collapse terminal preview after focus leaves"
                      />
                    </Section>

                    <Section eyebrow="Log Management">
                      <Select
                        label="Log retention"
                        value={localSettings.terminal.logRetention}
                        options={['Until session ends', '1 hour', '24 hours', 'Forever']}
                        onChange={(value) => updateLocal('terminal', 'logRetention', value)}
                      />
                      <div className="flex items-center justify-between gap-4 py-4">
                        <span className="text-sm font-bold text-white/85">Max log lines</span>
                        <input
                          type="number"
                          value={localSettings.terminal.maxLogLines}
                          onChange={(event) => updateLocal('terminal', 'maxLogLines', Number.parseInt(event.target.value, 10) || 10000)}
                          className={`${inputShell} w-28 text-center`}
                        />
                      </div>
                      <Toggle label="Capture ANSI colors" enabled={localSettings.terminal.captureAnsi} onChange={(value) => updateLocal('terminal', 'captureAnsi', value)} />
                      <Toggle label="Record execution timeline" enabled={localSettings.terminal.recordDiary} onChange={(value) => updateLocal('terminal', 'recordDiary', value)} />
                    </Section>
                  </>
                )}

                {activeTab === 'appearance' && (
                  <>
                    <Section eyebrow="Interface">
                      <Select
                        label="Theme"
                        value={localSettings.appearance.theme}
                        options={['Dark', 'Light', 'System']}
                        onChange={(value) => updateLocal('appearance', 'theme', value)}
                      />
                      <Slider label="Font size" value={localSettings.appearance.fontSize} min={12} max={20} unit="px" onChange={(value) => updateLocal('appearance', 'fontSize', value)} />
                      <Select
                        label="Code font"
                        value={localSettings.appearance.codeFont}
                        options={['JetBrains Mono', 'Fira Code', 'Roboto Mono', 'Cascadia Code']}
                        onChange={(value) => updateLocal('appearance', 'codeFont', value)}
                      />
                    </Section>

                    <Section eyebrow="Motion">
                      <Select
                        label="Animation intensity"
                        value={localSettings.appearance.animationIntensity}
                        options={['Full', 'Reduced', 'Off']}
                        onChange={(value) => updateLocal('appearance', 'animationIntensity', value)}
                      />
                      <Select
                        label="Sound effects"
                        value={localSettings.appearance.soundEffects}
                        options={['On', 'Errors only', 'Off']}
                        onChange={(value) => updateLocal('appearance', 'soundEffects', value)}
                      />
                      <Toggle label="Minimap in diff" enabled={localSettings.appearance.minimap} onChange={(value) => updateLocal('appearance', 'minimap', value)} />
                    </Section>
                  </>
                )}

                {activeTab === 'workflow' && (
                  <>
                    <Section eyebrow="Orchestrator Experience">
                      <Select
                        label="Experience mode"
                        value={localSettings.workflow.experienceMode || 'professional'}
                        options={[
                          { value: 'learner', label: 'Learner' },
                          { value: 'professional', label: 'Professional' },
                        ]}
                        onChange={(value) => updateLocal('workflow', 'experienceMode', value)}
                      />
                      <Slider
                        label="Autonomy level"
                        value={localSettings.workflow.autonomyLevel || 2}
                        min={1}
                        max={3}
                        onChange={(value) => updateLocal('workflow', 'autonomyLevel', value)}
                      />
                      <div className="flex items-start gap-3 py-4">
                        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[#F7C35F]" />
                        <p className="text-sm leading-relaxed text-white/45">
                          Level 1 asks before tool use, level 2 auto-runs safe reads and gates risky actions, and level 3 keeps approvals for writes, execution, browser, GitHub, and MCP mutations.
                        </p>
                      </div>
                    </Section>

                    <Section eyebrow="Review Flow">
                      <Toggle label="Show desktop notifications" enabled={localSettings.workflow.showNotifications} onChange={(value) => updateLocal('workflow', 'showNotifications', value)} />
                      <Toggle label="Alert on manual review needed" enabled={localSettings.workflow.alertManualReview} onChange={(value) => updateLocal('workflow', 'alertManualReview', value)} />
                      <Toggle label="Auto-open diff on change" enabled={localSettings.workflow.autoOpenDiff} onChange={(value) => updateLocal('workflow', 'autoOpenDiff', value)} />
                      <Toggle label="Confirm before accepting all" enabled={localSettings.workflow.confirmAcceptAll} onChange={(value) => updateLocal('workflow', 'confirmAcceptAll', value)} />
                    </Section>
                  </>
                )}

                {activeTab === 'advanced' && (
                  <>
                    <Section eyebrow="Security">
                      <div className="py-4">
                        <span className="mb-2 block text-sm font-bold text-white/85">Allowed directories</span>
                        <input
                          type="text"
                          placeholder="/src, /tests"
                          value={localSettings.advanced.allowedDirectories}
                          onChange={(event) => updateLocal('advanced', 'allowedDirectories', event.target.value)}
                          className={`${inputShell} w-full`}
                        />
                      </div>
                      <Toggle
                        label="Debug mode"
                        enabled={localSettings.advanced.debugMode}
                        onChange={(value) => updateLocal('advanced', 'debugMode', value)}
                        description="Stream diagnostic detail to the console"
                      />
                    </Section>

                    <Section eyebrow="Data Management">
                      <Select
                        label="Session auto-save"
                        value={localSettings.advanced.sessionAutoSave}
                        options={['None', 'Gist', 'Local']}
                        onChange={(value) => updateLocal('advanced', 'sessionAutoSave', value)}
                      />
                      <div className="flex items-center justify-between gap-4 py-4">
                        <span className="text-sm font-bold text-white/85">Configuration</span>
                        <div className="flex gap-2">
                          <button className="h-9 rounded-md border border-white/10 px-3 text-xs font-black text-white/60 transition hover:bg-white/[0.06] hover:text-white">Export</button>
                          <button className="h-9 rounded-md border border-white/10 px-3 text-xs font-black text-white/60 transition hover:bg-white/[0.06] hover:text-white">Import</button>
                        </div>
                      </div>
                    </Section>
                  </>
                )}

                {activeTab === 'profile' && (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6">
                      <div className="flex items-center gap-5">
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-[#43F3C5]/25 bg-[#43F3C5]/10 text-2xl font-black text-[#43F3C5]">
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-2xl font-black tracking-tight text-white">{displayName}</h3>
                          <p className="mt-1 text-sm font-medium text-white/40">
                            {(localSettings.workflow.experienceMode || 'professional') === 'learner' ? 'Learner workspace' : 'Professional workspace'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-md border border-[#43F3C5]/20 bg-[#43F3C5]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#43F3C5]">Verified</span>
                            <span className="rounded-md border border-[#8DA2FF]/20 bg-[#8DA2FF]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#B8C5FF]">Early Access</span>
                            <span className="rounded-md border border-[#F7C35F]/20 bg-[#F7C35F]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#F7C35F]">
                              Autonomy L{localSettings.workflow.autonomyLevel || 2}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={fieldShell}>
                        <div className="mb-2 flex items-center gap-2 text-white/55">
                          <Database size={16} />
                          <span className="text-[10px] font-black uppercase tracking-[0.14em]">Memory</span>
                        </div>
                        <p className="text-xl font-black text-white">1.2 GB <span className="text-xs font-medium text-white/35">/ 10 GB</span></p>
                      </div>
                      <div className={fieldShell}>
                        <div className="mb-2 flex items-center gap-2 text-white/55">
                          <Zap size={16} />
                          <span className="text-[10px] font-black uppercase tracking-[0.14em]">Compute</span>
                        </div>
                        <p className="text-xl font-black text-white">Local <span className="text-xs font-medium text-white/35">Docker only</span></p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#FF6B6B]/15 bg-[#FF6B6B]/[0.035] p-5">
                      <div>
                        <h4 className="text-sm font-black text-white">Critical Zone</h4>
                        <p className="mt-1 text-xs font-medium text-white/40">Permanently clear cached workspace memory</p>
                      </div>
                      <button className="h-10 rounded-md border border-[#FF6B6B]/25 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#FF8F8F] transition hover:bg-[#FF6B6B]/10">
                        Purge
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="flex h-20 shrink-0 items-center justify-between border-t border-white/10 bg-[#0B0E14] px-5">
            <div className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35 sm:flex">
              <Lock size={14} className="text-[#43F3C5]" />
              Encrypted local storage
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={onClose}
                className="h-10 rounded-md px-4 text-xs font-black uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.05] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex h-11 items-center gap-2 rounded-md bg-[#43F3C5] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#07110F] transition hover:bg-[#6FF8D4]"
              >
                <Save size={15} />
                Save Preferences
              </button>
            </div>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}
