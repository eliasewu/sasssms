"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface StepInfo {
  number: number;
  title: string;
}

interface ProgressBarProps {
  steps: StepInfo[];
}

export default function ProgressBar({ steps }: ProgressBarProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompact, setIsCompact] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const scrollToStep = useCallback((stepNum: number) => {
    const el = document.getElementById(`step-${stepNum}`);
    if (el && barRef.current) {
      const rect = el.getBoundingClientRect();
      const barHeight = barRef.current.offsetHeight;
      window.scrollTo({
        top: window.scrollY + rect.top - barHeight - 24,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    // Detect when progress bar becomes compact (scroll past header)
    const handleScroll = () => {
      setIsCompact(window.scrollY > 250);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // IntersectionObserver for step detection
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to the top of the viewport
          const sorted = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          const el = sorted[0].target;
          const match = el.id.match(/^step-(\d+)$/);
          if (match) {
            setCurrentStep(parseInt(match[1]));
          }
        }
      },
      {
        rootMargin: "-10% 0px -70% 0px",
        threshold: [0, 0.25, 0.5],
      }
    );

    // Observe all step elements
    steps.forEach((s) => {
      const el = document.getElementById(`step-${s.number}`);
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [steps]);

  const pct = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div
      ref={barRef}
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 transition-all ${
        isCompact ? "py-2 shadow-md" : "py-3"
      }`}
    >
      {/* Progress track */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Thin progress line */}
        <div className="relative h-1.5 bg-slate-200 rounded-full mb-3">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center overflow-x-auto gap-0.5 pb-1">
          {steps.map((step, idx) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;

            return (
              <div key={step.number} className="flex items-center min-w-0">
                {/* Connector line between dots */}
                {idx > 0 && (
                  <div
                    className={`h-0.5 w-3 shrink-0 transition-colors duration-500 ${
                      step.number <= currentStep
                        ? "bg-blue-400"
                        : "bg-slate-200"
                    }`}
                  />
                )}

                {/* Step button */}
                <button
                  onClick={() => scrollToStep(step.number)}
                  className={`relative flex items-center gap-1.5 px-2 py-1 rounded-full transition-all shrink-0 group ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md scale-110"
                      : isCompleted
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                  }`}
                  title={step.title}
                >
                  {/* Step number circle */}
                  <span
                    className={`flex items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      isActive
                        ? "bg-white text-blue-600 w-5 h-5"
                        : isCompleted
                        ? "bg-blue-600 text-white w-4 h-4"
                        : "bg-slate-300 text-slate-500 w-4 h-4 group-hover:bg-slate-400 group-hover:text-white"
                    }`}
                  >
                    {isCompleted ? "✓" : step.number}
                  </span>

                  {/* Step title (visible on active + hover) */}
                  <span
                    className={`text-[11px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? "max-w-[120px] opacity-100"
                        : "max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 overflow-hidden"
                    }`}
                  >
                    {step.title}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
