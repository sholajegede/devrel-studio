const DevToLogo = () => (
  <svg viewBox="0 0 50 40" className="h-8 w-auto" aria-label="Dev.to">
    <rect width="50" height="40" rx="5" fill="currentColor" className="text-charcoal" />
    <path
      d="M8.5 12.5h4.1c2.4 0 4.3 1.9 4.3 4.3v6.4c0 2.4-1.9 4.3-4.3 4.3H8.5V12.5zm4.1 12c1.1 0 2-0.9 2-2v-6.4c0-1.1-0.9-2-2-2h-1.8v10.4h1.8z M19 12.5h7.8v3h-5.5v3.4h5.1v3h-5.1v4.6h5.5v3H19V12.5z M29 12.5h2.8l2.9 9.8 2.9-9.8h2.8l-4.3 15h-2.8L29 12.5z"
      fill="#f5f4f5"
    />
  </svg>
);

// Kinde official wordmark
const KindeLogo = () => (
  <svg viewBox="0 0 80 24" className="h-6 w-auto" aria-label="Kinde">
    <text
      x="0"
      y="19"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontSize="22"
      fontWeight="700"
      fill="currentColor"
      className="text-charcoal"
    >
      Kinde
    </text>
  </svg>
);

// Agent.ai logo with three dots pattern
const AgentAiLogo = () => (
  <svg viewBox="0 0 120 24" className="h-6 w-auto" aria-label="Agent.ai">
    {/* Three dots pattern */}
    <circle cx="4" cy="8" r="3" fill="#F59E0B" />
    <circle cx="12" cy="8" r="3" fill="#3B82F6" />
    <circle cx="4" cy="16" r="3" fill="#3B82F6" />
    <text
      x="22"
      y="18"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontSize="18"
      fontWeight="600"
      fill="currentColor"
      className="text-charcoal"
    >
      agent.ai
    </text>
  </svg>
);

const SocialProofSection = () => {
  return (
    <section className="section-light py-16 border-y border-border">
      <div className="container-main">
        <p className="text-center text-sm text-muted-foreground mb-8 font-medium uppercase tracking-wider">
          Trusted by forward-thinking devtool companies
        </p>
        
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 lg:gap-16">
          {/* FreeCodeCamp */}
          <div className="h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
            <img src="/assets/logos/freecodecamp.svg" alt="freeCodeCamp" className="h-8 w-auto" />
          </div>
          
          {/* Dev.to */}
          <div className="h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity">
            <DevToLogo />
          </div>
          
          {/* Convex */}
          <div className="h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
            <img src="/assets/logos/convex.svg" alt="Convex" className="h-7 w-auto" />
          </div>
          
          {/* Kinde */}
          <div className="h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity">
            <KindeLogo />
          </div>
          
          {/* Ollama */}
          <div className="h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
            <img src="/assets/logos/ollama.svg" alt="Ollama" className="h-8 w-auto" />
          </div>
          
          {/* Agent.ai */}
          <div className="h-8 flex items-center opacity-60 hover:opacity-100 transition-opacity">
            <AgentAiLogo />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;