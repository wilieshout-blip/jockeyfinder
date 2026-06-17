"use client";

import { Fragment, useEffect, useRef, useState } from "react";

const messages = [
  {
    side: "left",
    name: "Trainer",
    body: "Confirmed for Race 6. She works best ridden quiet early.",
    time: "10:42",
  },
  {
    side: "right",
    name: "Jockey",
    body: "Got it. I will be on course by 11. See you at the birdcage.",
    time: "10:43",
  },
  {
    side: "left",
    name: "Trainer",
    body: "Perfect. The owner is joining this chat so everyone has the plan.",
    time: "10:43",
  },
] as const;

export function MessageFlowDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || hasPlayed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHasPlayed(true);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPlayed]);

  return (
    <div
      id="booking-messages"
      ref={rootRef}
      className="premium-card-hover scroll-mt-24 border border-line bg-white p-6 shadow-card"
    >
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-turf-50 text-turf-700">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-display font-semibold text-ink">
              Sunline - Te Rapa R6
            </p>
            <span className="h-2 w-2 shrink-0 rounded-full bg-turf-500" />
          </div>
          <p className="text-xs text-zinc-500">
            Booking chat opened automatically
          </p>
        </div>
      </div>

      <div
        className={`message-flow min-h-[254px] space-y-3 pt-4 text-sm ${
          hasPlayed ? "message-flow-played" : ""
        }`}
        aria-label="Example booking conversation"
      >
        {messages.map((message, index) => (
          <Fragment key={message.body}>
            {index === 2 ? (
              <div className="message-flow-typing flex w-fit items-center gap-1 rounded-xl rounded-tl-sm bg-mist px-3.5 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <span className="ml-1 text-[10px] font-medium text-zinc-500">
                  typing
                </span>
              </div>
            ) : null}
            <div
              className={`message-flow-item message-flow-item-${index} ${
                message.side === "right" ? "ml-auto" : ""
              } max-w-[88%]`}
            >
              <div
                className={
                  message.side === "right"
                    ? "rounded-xl rounded-tr-sm bg-turf-600 px-3.5 py-2.5 text-white"
                    : "rounded-xl rounded-tl-sm bg-mist px-3.5 py-2.5 text-zinc-700"
                }
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-65">
                  {message.name}
                </p>
                <p className="leading-relaxed">{message.body}</p>
              </div>
              <p
                className={`mt-1 text-[10px] text-zinc-400 ${
                  message.side === "right" ? "text-right" : ""
                }`}
              >
                {message.time}
                {message.side === "right" ? " - Delivered" : ""}
              </p>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
