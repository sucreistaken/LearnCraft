// src/components/ui/TagInput.tsx
import React, { useState, useRef, useEffect } from "react";

interface TagInputProps {
    tags: string[];
    allTags: string[];
    onAdd: (tag: string) => void;
    onRemove: (tag: string) => void;
    placeholder?: string;
}

export default function TagInput({ tags, allTags, onAdd, onRemove, placeholder }: TagInputProps) {
    const [input, setInput] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const suggestions = input.trim()
        ? allTags.filter(
              (t) => t.includes(input.toLowerCase()) && !tags.includes(t)
          ).slice(0, 5)
        : [];

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const handleSubmit = (value?: string) => {
        const tag = (value || input).trim().toLowerCase();
        if (tag && !tags.includes(tag)) {
            onAdd(tag);
        }
        setInput("");
        setShowSuggestions(false);
    };

    return (
        <div ref={containerRef} style={{ position: "relative" }}>
            <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                alignItems: "center",
                padding: "4px 8px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--input-bg)",
                minHeight: 32,
            }}>
                {tags.map((tag) => (
                    <span
                        key={tag}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "var(--accent-2)",
                            color: "white",
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    >
                        {tag}
                        <button
                            onClick={() => onRemove(tag)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "white",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: 12,
                                lineHeight: 1,
                                opacity: 0.7,
                            }}
                        >
                            x
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit();
                        }
                        if (e.key === "Backspace" && !input && tags.length > 0) {
                            onRemove(tags[tags.length - 1]);
                        }
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={tags.length === 0 ? (placeholder || "Add tag...") : ""}
                    style={{
                        flex: 1,
                        minWidth: 60,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: "var(--text)",
                        fontSize: 12,
                        padding: "2px 0",
                    }}
                />
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 2,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    boxShadow: "var(--shadow-2)",
                    zIndex: 50,
                    overflow: "hidden",
                }}>
                    {suggestions.map((tag) => (
                        <div
                            key={tag}
                            onClick={() => handleSubmit(tag)}
                            style={{
                                padding: "6px 12px",
                                fontSize: 12,
                                cursor: "pointer",
                                color: "var(--text)",
                                transition: "background 0.1s",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg)")}
                            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                            {tag}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
