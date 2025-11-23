"use client";

interface AgentMessageProps {
  message: string;
}

export function AgentMessage({ message }: AgentMessageProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

