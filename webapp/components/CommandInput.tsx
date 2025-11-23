"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";

interface CommandInputProps {
  onExecute: (command: string) => void;
  disabled?: boolean;
}

export function CommandInput({ onExecute, disabled }: CommandInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const exampleCommands = [
    "Unlock smart lock in office",
    "Print document on Lab 3 printer",
    "Charge vehicle at station 1",
  ];

  useEffect(() => {
    if (input.length > 2) {
      const filtered = exampleCommands.filter((cmd) =>
        cmd.toLowerCase().includes(input.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 3));
    } else {
      setSuggestions([]);
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim() && !disabled) {
      onExecute(input.trim());
      setInput("");
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-30">
      <div className="relative group">
        {/* Efecto de brillo trasero */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 transition duration-500 blur-xl" />
        
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Describe tu misión..."
          className="relative w-full bg-black/60 backdrop-blur-xl border border-white/10 text-white placeholder-zinc-500 rounded-xl py-4 px-6 text-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {/* Badge de atajo de teclado */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <span className="text-xs text-zinc-500 font-mono border border-white/10 rounded px-1.5 py-0.5 bg-white/5">
            ⏎ ENTER
          </span>
        </div>

        {/* Sugerencias mejoradas */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full mb-2 w-full bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

