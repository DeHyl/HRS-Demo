import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      {Array.from({ length: 80 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${Math.random() * 2 + 1}px`,
            height: `${Math.random() * 2 + 1}px`,
            backgroundColor: Math.random() > 0.6 ? "#4A6CF7" : "#ffffff",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.4 + 0.1,
            animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <AnimatedBackground />

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 px-6 sm:px-10 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#EF4444" }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#EAB308" }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#3B82F6" }} />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">GameTime.ai</span>
        </div>
        <button
          onClick={() => setLocation("/login")}
          className="text-sm text-white/70 hover:text-white transition-colors border border-white/20 hover:border-white/50 rounded-full px-4 py-1.5"
        >
          Sign in
        </button>
      </div>

      {/* Badge */}
      <div
        className={`absolute top-20 left-0 right-0 flex justify-center z-10 transition-all duration-500 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
          <div className="flex gap-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#EF4444" }} />
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#EAB308" }} />
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#3B82F6" }} />
          </div>
          <span className="text-white/60 text-xs">A product by GroundGame</span>
        </div>
      </div>

      {/* Hero */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center z-10 px-4 transition-all duration-700 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="text-center max-w-3xl mx-auto">
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black text-white mb-6 tracking-tighter leading-none"
            data-testid="text-headline"
          >
            The AI Layer That Makes<br />
            Sales Teams{" "}
            <span style={{ color: "#4A6CF7" }}>Unstoppable</span>
          </h1>
          <p
            className="text-base sm:text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 font-sans leading-relaxed"
            data-testid="text-subheadline"
          >
            From pre-call research to post-call coaching — Lead Intel gives every rep an AI
            copilot that knows your playbook, preps your calls, and coaches in real-time.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => setLocation("/login")}
              className="group flex items-center gap-2 px-8 py-3.5 bg-white text-black font-semibold text-sm rounded-full hover:bg-white/90 transition-all duration-200 hover:scale-105 active:scale-[0.98]"
              data-testid="button-enter"
            >
              Get Started
              <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center gap-2 px-8 py-3.5 text-white/70 font-semibold text-sm rounded-full border border-white/20 hover:border-white/50 hover:text-white transition-all duration-200"
            >
              Sign in →
            </button>
          </div>
        </div>

        {/* Module tabs */}
        <div className="absolute bottom-16 flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1.5">
          <span className="text-xs text-white/40 px-3 py-1">Lead Intel</span>
          <span className="text-xs text-white rounded-full px-3 py-1 font-medium" style={{ backgroundColor: "#4A6CF7" }}>Call Center</span>
          <span className="text-xs text-white/40 px-3 py-1">Analytics</span>
        </div>
      </div>
    </div>
  );
}
