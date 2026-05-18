import { ArrowRight, Rocket } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center section-light pattern-bg noise-overlay pt-16">
      <div className="container-main py-20 md:py-32">
        {/* Status Banner */}
        <div className="animate-fade-up flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-foreground/5 border border-border rounded-full">
            <Rocket className="w-4 h-4" />
            <span className="text-sm font-medium">Launching Soon</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm text-muted-foreground">Currently in Beta</span>
          </div>
        </div>

        {/* Main Headline */}
        <h1 className="animate-fade-up-delay-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-center leading-[1.1] tracking-tight max-w-5xl mx-auto">
          Content That Makes Developers{" "}
          <span className="relative">
            Actually
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6C50 2 150 2 198 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
            </svg>
          </span>{" "}
          Stick Around
        </h1>

        {/* Subheadline */}
        <p className="animate-fade-up-delay-2 mt-8 text-lg md:text-xl text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
          devrel.studio helps devtool companies create authentic content and build communities that developers love.
        </p>

        {/* CTA Buttons */}
        <div className="animate-fade-up-delay-3 mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#waitlist" className="btn-primary group">
            Join the Waitlist
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a href="#services" className="btn-secondary">
            See What We Do
          </a>
        </div>

        {/* Trust indicator */}
        <p className="animate-fade-up-delay-3 mt-16 text-sm text-muted-foreground text-center">
          <span className="font-mono">→</span> Built by developers who've been in your shoes
        </p>
      </div>
    </section>
  );
};

export default HeroSection;