const AboutSection = () => {
  return (
    <section className="section-dark py-20 md:py-28">
      <div className="container-main">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-surface-light/10 rounded-full text-sm font-mono text-surface-light/60 mb-6">
            Why we exist
          </span>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-surface-light mb-8">
            We're Developers Who Get It
          </h2>
          
          <div className="space-y-6 text-lg text-surface-light/80 leading-relaxed">
            <p>
              Most devtool companies struggle with developer marketing. They create content that sounds like marketing, not content that helps developers solve problems.
            </p>
            <p>
              At devrel.studio, we're developers who understand developers. We create content that{" "}
              <span className="text-surface-light font-medium">earns attention</span> instead of buying it, and build relationships that last beyond the first API call.
            </p>
          </div>

          <div className="mt-12 pt-12 border-t border-surface-light/10">
            <p className="font-mono text-sm text-surface-light/50">
              // No corporate fluff. Just results.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;