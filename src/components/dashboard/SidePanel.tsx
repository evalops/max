"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Package,
  Wrench,
  DollarSign,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactsPanel } from "@/components/artifacts";
import { ToolRunsPanel } from "@/components/toolruns";
import { CostPanel } from "@/components/cost";

type TabId = "artifacts" | "toolruns" | "cost";

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Package;
  color: string;
}

const tabs: Tab[] = [
  { id: "artifacts", label: "Artifacts", icon: Package, color: "text-terminal-purple" },
  { id: "toolruns", label: "Tools", icon: Wrench, color: "text-terminal-amber" },
  { id: "cost", label: "Cost", icon: DollarSign, color: "text-terminal-green" },
];

interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  defaultTab?: TabId;
}

export function SidePanel({ isOpen, onToggle, defaultTab = "artifacts" }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const renderPanel = () => {
    switch (activeTab) {
      case "artifacts":
        return <ArtifactsPanel />;
      case "toolruns":
        return <ToolRunsPanel />;
      case "cost":
        return <CostPanel />;
    }
  };

  return (
    <>
      {/* Collapsed state - vertical tab strip */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="flex h-full flex-col border-l border-ink-200 bg-white"
        >
          <button
            onClick={onToggle}
            className="p-3 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-600"
            title="Open panel"
          >
            <PanelRightOpen size={18} />
          </button>
          <div className="flex flex-1 flex-col gap-1 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    onToggle();
                  }}
                  className={cn(
                    "rounded-lg p-2 transition-all",
                    activeTab === tab.id
                      ? "bg-ink-100"
                      : "text-ink-400 hover:bg-ink-50 hover:text-ink-600"
                  )}
                  title={tab.label}
                >
                  <Icon size={18} className={activeTab === tab.id ? tab.color : undefined} />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Expanded state - full panel */}
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col overflow-hidden border-l border-ink-200 bg-white"
        >
          {/* Tab header */}
          <div className="flex shrink-0 items-center justify-between border-b border-ink-200 px-2">
            <div className="flex">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex items-center gap-1.5 p-3 text-sm transition-colors",
                      isActive ? "text-ink-800" : "text-ink-400 hover:text-ink-600"
                    )}
                  >
                    <Icon size={14} className={isActive ? tab.color : undefined} />
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="sidepanel-tab-indicator"
                        className="absolute inset-x-0 bottom-0 h-0.5 bg-ink-800"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onToggle}
              className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
              title="Close panel"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {renderPanel()}
          </div>
        </motion.div>
      )}
    </>
  );
}
