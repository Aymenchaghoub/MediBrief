"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingMarkdownProps {
  /** The full text to render (typewriter effect applies on first appearance). */
  content: string;
  /** Speed in ms per character. Default 8. */
  speed?: number;
  /** Skip the typewriter animation and show content immediately. */
  immediate?: boolean;
  /** Called when the typewriter animation finishes. */
  onComplete?: () => void;
}

/**
 * Renders Markdown content with a ChatGPT-style typewriter animation.
 * Text streams in character-by-character, parsed as Markdown in real time.
 */
export function StreamingMarkdown({
  content,
  speed = 8,
  immediate = false,
  onComplete,
}: StreamingMarkdownProps) {
  const [displayed, setDisplayed] = useState(immediate ? content : "");
  const [isStreaming, setIsStreaming] = useState(!immediate && content.length > 0);
  const indexRef = useRef(immediate ? content.length : 0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset when content changes
  useEffect(() => {
    if (immediate) {
      setDisplayed(content);
      setIsStreaming(false);
      return;
    }

    indexRef.current = 0;
    setDisplayed("");
    setIsStreaming(content.length > 0);
    lastTimeRef.current = 0;
  }, [content, immediate]);

  // Typewriter animation loop using requestAnimationFrame
  useEffect(() => {
    if (!isStreaming || immediate) return;

    function step(timestamp: number) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= speed) {
        // Stream multiple chars per frame proportional to elapsed time
        const charsToAdd = Math.max(1, Math.floor(elapsed / speed));
        const nextIndex = Math.min(indexRef.current + charsToAdd, content.length);
        indexRef.current = nextIndex;
        setDisplayed(content.slice(0, nextIndex));
        lastTimeRef.current = timestamp;

        if (nextIndex >= content.length) {
          setIsStreaming(false);
          onComplete?.();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isStreaming, content, speed, immediate, onComplete]);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayed]);

  return (
    <div ref={containerRef} className="streaming-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
      {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
    </div>
  );
}
