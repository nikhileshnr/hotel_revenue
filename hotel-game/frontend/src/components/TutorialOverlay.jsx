import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * TutorialOverlay — step-by-step spotlight tutorial.
 * 
 * Usage:
 *   <TutorialOverlay
 *     storageKey="classic-tutorial-v1"
 *     steps={[
 *       { target: '[data-tutorial="guest-card"]', title: 'Guest Card', text: '...' },
 *       ...
 *     ]}
 *   />
 * 
 * The overlay only shows once per storageKey (persisted in localStorage).
 */
export default function TutorialOverlay({ steps, storageKey, onComplete }) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState(null);
  const tooltipRef = useRef(null);

  // Check if already completed
  useEffect(() => {
    const done = localStorage.getItem(storageKey);
    if (!done) {
      // Small delay to let the page render first
      const t = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  // Find target element and compute rect
  const updateRect = useCallback(() => {
    if (!active || !steps[currentStep]) return;
    const el = document.querySelector(steps[currentStep].target);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      // Scroll into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setRect(null);
    }
  }, [active, currentStep, steps]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [updateRect]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    localStorage.setItem(storageKey, 'true');
    setActive(false);
    onComplete?.();
  };

  if (!active || !steps.length) return null;

  const step = steps[currentStep];
  const padding = 12;
  const spotlightStyle = rect ? {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  } : null;

  // Tooltip positioning
  let tooltipPos = {};
  if (rect) {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const below = rect.top + rect.height + padding + 20;
    const above = rect.top - padding - 220;

    if (below + 200 < viewH) {
      // Place below
      tooltipPos = { top: below, left: Math.max(16, Math.min(rect.left, viewW - 380)) };
    } else if (above > 0) {
      // Place above
      tooltipPos = { top: above, left: Math.max(16, Math.min(rect.left, viewW - 380)) };
    } else {
      // Center
      tooltipPos = { top: viewH / 2 - 100, left: viewW / 2 - 180 };
    }
  } else {
    // No target found — center
    tooltipPos = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: 'auto' }}>
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightStyle && (
              <rect
                x={spotlightStyle.left}
                y={spotlightStyle.top}
                width={spotlightStyle.width}
                height={spotlightStyle.height}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(30, 20, 10, 0.65)"
          mask="url(#tutorial-mask)"
        />
      </svg>

      {/* Spotlight border ring */}
      {spotlightStyle && (
        <div
          className="absolute border-3 border-tertiary rounded-2xl animate-pulse pointer-events-none"
          style={{
            top: spotlightStyle.top - 2,
            left: spotlightStyle.left - 2,
            width: spotlightStyle.width + 4,
            height: spotlightStyle.height + 4,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="absolute w-[360px] bg-secondary-container rounded-[2rem] shadow-[8px_8px_0_0_#6e6444] p-6 flex flex-col gap-4"
        style={tooltipPos}
      >
        {/* Step badge */}
        <div className="flex items-center justify-between">
          <span className="bg-tertiary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_3px_0_0_#1a5a4c]">
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            className="text-[10px] font-bold text-outline hover:text-error transition-colors uppercase tracking-widest"
            onClick={handleSkip}
          >
            Skip
          </button>
        </div>

        {/* Step icon + title */}
        <div className="flex items-start gap-3">
          {step.icon && (
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
            </div>
          )}
          <div>
            <h3 className="font-headline font-black text-on-secondary-container text-lg uppercase tracking-tight">{step.title}</h3>
            <p className="text-sm text-on-secondary-container/80 font-medium mt-1 leading-relaxed">{step.text}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-1">
          {currentStep > 0 && (
            <button
              className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center shadow-[0_3px_0_0_#dbdad7] hover:translate-y-0.5 hover:shadow-none transition-all"
              onClick={handlePrev}
            >
              <span className="material-symbols-outlined text-on-surface-variant text-sm">arrow_back</span>
            </button>
          )}
          <button
            className="flex-1 h-10 bg-tertiary text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-[0_4px_0_0_#1a5a4c] hover:translate-y-0.5 hover:shadow-[0_1px_0_0_#1a5a4c] transition-all flex items-center justify-center gap-2"
            onClick={handleNext}
          >
            {currentStep === steps.length - 1 ? 'Got it!' : 'Next'}
            <span className="material-symbols-outlined text-sm">
              {currentStep === steps.length - 1 ? 'check' : 'arrow_forward'}
            </span>
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'w-6 bg-tertiary' : i < currentStep ? 'w-1.5 bg-tertiary/50' : 'w-1.5 bg-outline/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Pre-defined step sets ---

export const CLASSIC_TUTORIAL_STEPS = [
  {
    target: '[data-tutorial="guest-card"]',
    icon: 'person',
    title: 'Guest Card',
    text: 'Each guest arrives with their profile — market segment, length of stay, and room preference. Read these carefully before deciding.',
  },
  {
    target: '[data-tutorial="risk-badge"]',
    icon: 'shield',
    title: 'Risk Assessment',
    text: 'The risk badge shows cancellation and no-show probability. High-risk guests may book but never check in — costing you the room.',
  },
  {
    target: '[data-tutorial="revenue-info"]',
    icon: 'payments',
    title: 'Revenue vs Expected Value',
    text: 'Revenue Offered is what they\'ll pay. Expected Value = Revenue × (1 - Cancel Risk). A $200 guest with 50% cancel risk has an EV of only $100.',
  },
  {
    target: '[data-tutorial="availability"]',
    icon: 'calendar_month',
    title: 'Room Availability',
    text: 'This grid shows how many rooms are left each day. Green means plenty, yellow means filling up, red means nearly full.',
  },
  {
    target: '[data-tutorial="action-buttons"]',
    icon: 'gamepad',
    title: 'Accept or Reject',
    text: 'Accept to book the guest and earn revenue. Reject to save the room for a potentially better guest later. Choose wisely!',
  },
  {
    target: '[data-tutorial="timer"]',
    icon: 'timer',
    title: 'Decision Timer',
    text: 'You have 30 seconds per guest. If time runs out, the guest leaves — it counts as a missed opportunity.',
  },
  {
    target: '[data-tutorial="decision-log"]',
    icon: 'list_alt',
    title: 'Decision Log',
    text: 'Track your decisions for the current week. After all guests, the week resolves — cancellations and no-shows are applied to your revenue.',
  },
];

export const PRICING_TUTORIAL_STEPS = [
  {
    target: '[data-tutorial="demand-indicator"]',
    icon: 'trending_up',
    title: 'Demand Level',
    text: 'This shows whether demand is Low, Medium, or High this week. High demand = you can charge more. Low demand = lower prices fill more rooms.',
  },
  {
    target: '[data-tutorial="price-inputs"]',
    icon: 'sell',
    title: 'Set Your Prices',
    text: 'Set a price for each room tier. The suggested range shows what guests are typically willing to pay (WTP).',
  },
  {
    target: '[data-tutorial="pricing-submit"]',
    icon: 'play_arrow',
    title: 'Submit & Simulate',
    text: 'After setting prices, the system simulates the week — guests who can afford your price will book, others won\'t.',
  },
  {
    target: '[data-tutorial="week-results"]',
    icon: 'analytics',
    title: 'Week Results',
    text: 'See your revenue, occupancy, and booking outcomes. Cancellations and no-shows reduce your realized revenue.',
  },
  {
    target: '[data-tutorial="cumulative"]',
    icon: 'account_balance',
    title: 'Season Revenue',
    text: 'Your cumulative revenue across the entire season. The goal is to maximize total revenue over all weeks.',
  },
];

export const RESULTS_TUTORIAL_STEPS = [
  {
    target: '[data-tutorial="kpi-revpar"]',
    icon: 'payments',
    title: 'RevPAR — The #1 Hotel Metric',
    text: 'Revenue Per Available Room = Total Revenue ÷ Available Room-Nights. This is THE metric that real hotel revenue managers optimize.',
  },
  {
    target: '[data-tutorial="ai-benchmark"]',
    icon: 'smart_toy',
    title: 'AI Benchmark',
    text: 'The AI played the exact same scenario with an optimal strategy. Your efficiency score shows how close you came. Aim for 80%+!',
  },
  {
    target: '[data-tutorial="strategy-profile"]',
    icon: 'psychology',
    title: 'Your Strategy Profile',
    text: 'Based on your decisions, we classified your approach. Real revenue managers constantly adjust between volume and yield strategies.',
  },
];
