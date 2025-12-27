"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  X,
  Eye,
  EyeOff,
  Zap,
  Palette,
  Sliders,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, type ThemeMode } from "@/store";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "general" | "agent" | "appearance";

const models = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Fast, balanced" },
  { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5", description: "Most capable" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Quick tasks" },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [showApiKey, setShowApiKey] = useState(false);
  const { settings, updateSettings } = useAppStore();

  const tabs = [
    { id: "general" as const, label: "General", icon: Sliders },
    { id: "agent" as const, label: "Agent", icon: Zap },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/20 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-50 flex size-full max-w-md flex-col bg-white shadow-elevated"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-ink-600" />
                <h2 className="font-display text-lg font-semibold text-ink-900">Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-ink-100 px-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "border-terminal-blue text-terminal-blue"
                      : "border-transparent text-ink-500 hover:text-ink-700"
                  )}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "general" && (
                <div className="space-y-6">
                  {/* API Key */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink-700">
                      Anthropic API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={settings.apiKey}
                        onChange={(e) => updateSettings({ apiKey: e.target.value })}
                        placeholder="sk-ant-..."
                        className="w-full rounded-lg border border-ink-200 px-4 py-2.5 pr-10 font-mono text-sm text-ink-800 placeholder:text-ink-400 focus:border-terminal-blue focus:outline-none focus:ring-2 focus:ring-terminal-blue/20"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-ink-400">
                      Your API key is stored locally and never sent to our servers.
                    </p>
                  </div>

                  {/* Working Directory */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink-700">Working Directory</label>
                    <input
                      type="text"
                      value={settings.workingDirectory}
                      onChange={(e) => updateSettings({ workingDirectory: e.target.value })}
                      placeholder="/path/to/project"
                      className="w-full rounded-lg border border-ink-200 px-4 py-2.5 font-mono text-sm text-ink-800 placeholder:text-ink-400 focus:border-terminal-blue focus:outline-none focus:ring-2 focus:ring-terminal-blue/20"
                    />
                  </div>
                </div>
              )}

              {activeTab === "agent" && (
                <div className="space-y-6">
                  {/* Model Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-ink-700">Model</label>
                    <div className="space-y-2">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => updateSettings({ model: model.id })}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-all",
                            settings.model === model.id
                              ? "border-terminal-blue bg-terminal-blue/5"
                              : "border-ink-200 hover:border-ink-300"
                          )}
                        >
                          <div className="text-left">
                            <p
                              className={cn(
                                "font-medium",
                                settings.model === model.id
                                  ? "text-terminal-blue"
                                  : "text-ink-700"
                              )}
                            >
                              {model.name}
                            </p>
                            <p className="text-xs text-ink-400">{model.description}</p>
                          </div>
                          {settings.model === model.id && (
                            <Check size={18} className="text-terminal-blue" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Max Turns */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-ink-700">Max Turns</label>
                      <span className="font-mono text-sm text-ink-500">{settings.maxTurns}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={settings.maxTurns}
                      onChange={(e) => updateSettings({ maxTurns: parseInt(e.target.value) })}
                      className="w-full accent-terminal-blue"
                    />
                    <p className="text-xs text-ink-400">
                      Maximum number of agent iterations per task
                    </p>
                  </div>

                  {/* Max Budget */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-ink-700">Max Budget</label>
                      <span className="font-mono text-sm text-ink-500">
                        ${settings.maxBudgetUsd.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="50"
                      step="0.5"
                      value={settings.maxBudgetUsd}
                      onChange={(e) =>
                        updateSettings({ maxBudgetUsd: parseFloat(e.target.value) })
                      }
                      className="w-full accent-terminal-blue"
                    />
                    <p className="text-xs text-ink-400">Maximum spend per task in USD</p>
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-6">
                  {/* Theme */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-ink-700">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["light", "dark", "system"] as ThemeMode[]).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => updateSettings({ theme })}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-all",
                            settings.theme === theme
                              ? "border-terminal-blue bg-terminal-blue/5 text-terminal-blue"
                              : "border-ink-200 text-ink-600 hover:border-ink-300"
                          )}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Options */}
                  <div className="space-y-3">
                    <ToggleOption
                      label="Auto-scroll"
                      description="Automatically scroll to new activities"
                      checked={settings.autoScroll}
                      onChange={(checked) => updateSettings({ autoScroll: checked })}
                    />
                    <ToggleOption
                      label="Show timestamps"
                      description="Display time for each activity"
                      checked={settings.showTimestamps}
                      onChange={(checked) => updateSettings({ showTimestamps: checked })}
                    />
                    <ToggleOption
                      label="Compact mode"
                      description="Reduce spacing in activity feed"
                      checked={settings.compactMode}
                      onChange={(checked) => updateSettings({ compactMode: checked })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-ink-100 p-4">
              <p className="text-center text-xs text-ink-400">
                Max Agent Dashboard v0.1.0
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-4 py-3 transition-colors hover:border-ink-300"
    >
      <div className="text-left">
        <p className="font-medium text-ink-700">{label}</p>
        <p className="text-xs text-ink-400">{description}</p>
      </div>
      <div
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-terminal-blue" : "bg-ink-300"
        )}
      >
        <div
          className={cn(
            "absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </div>
    </button>
  );
}
