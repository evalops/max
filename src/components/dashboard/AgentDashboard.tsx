"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ActivityPanel } from "@/components/activity";
import { ComputerPanel } from "@/components/panels";
import { MessageInput } from "@/components/input";
import { SettingsPanel } from "@/components/settings";
import { SidePanel } from "./SidePanel";
import { useAppStore } from "@/store";
import { useAgent } from "@/hooks";

export function AgentDashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  const {
    settings,
    agent,
    activities,
    statusTexts,
    tasks,
    document,
    setAgent,
  } = useAppStore();

  const { runAgent, stopAgent, isRunning } = useAgent();

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!settings.apiKey) {
        setIsSettingsOpen(true);
        return;
      }
      await runAgent(message);
    },
    [settings.apiKey, runAgent]
  );

  const handleStop = useCallback(() => {
    stopAgent();
    setAgent({ isThinking: false });
  }, [stopAgent, setAgent]);

  return (
    <div className="flex h-screen w-full bg-paper-200">
      {/* Left Panel - Activity Feed */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex min-w-[400px] flex-1 flex-col border-r border-paper-400/50"
      >
        <ActivityPanel
          activities={activities}
          statusTexts={statusTexts}
          agentName={agent.name}
          className="flex-1 overflow-hidden"
          onSettingsClick={() => setIsSettingsOpen(true)}
        />
        <MessageInput
          agentName={agent.name}
          onSend={handleSendMessage}
          onStop={handleStop}
          isProcessing={isRunning || agent.isThinking}
          hasApiKey={!!settings.apiKey}
        />
      </motion.div>

      {/* Center Panel - Computer View */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={cn(
          "flex w-[400px] shrink-0 flex-col",
          "shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.1)]"
        )}
      >
        <ComputerPanel agent={agent} document={document} tasks={tasks} />
      </motion.div>

      {/* Right Panel - Artifacts/ToolRuns/Cost */}
      <AnimatePresence mode="wait">
        <SidePanel
          isOpen={isSidePanelOpen}
          onToggle={() => setIsSidePanelOpen(!isSidePanelOpen)}
        />
      </AnimatePresence>

      {/* Settings Panel */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
