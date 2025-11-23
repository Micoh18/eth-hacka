"use client";

interface AgentMessageProps {
  message: string;
}

export function AgentMessage({ message }: AgentMessageProps) {
  return (
    <div className="w-full">
      <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-system mt-1.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-zinc-500 font-mono mb-1 uppercase tracking-wider">
              Agent
            </div>
            <p className="text-zinc-300 text-sm font-mono leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

