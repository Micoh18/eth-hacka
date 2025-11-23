"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";

interface CommandInputProps {
  onExecute: (command: string) => void;
  disabled?: boolean;
}

export function CommandInput({ onExecute, disabled = false }: CommandInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const exampleCommands = [
    "Unlock smart lock in office",
    "Print document on Lab 3 printer",
    "Charge vehicle at station 1",
    "Dispense product from vending machine",
    "Restock vending machine slot 5",
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
    <div className="w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={Boolean(disabled)}
          placeholder="> Enter command..."
          className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 rounded px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {/* Badge de atajo de teclado */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <span className="text-xs text-zinc-600 font-mono border border-zinc-800 rounded px-1.5 py-0.5 bg-zinc-950">
            ENTER
          </span>
        </div>

        {/* Sugerencias mejoradas */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full mb-2 w-full bg-zinc-900 border border-zinc-800 rounded overflow-hidden shadow-lg">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-3 py-2 text-left text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800 last:border-0"
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

