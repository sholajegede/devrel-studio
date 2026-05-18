import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "devrel.studio helped us shift from 'marketing speak' to genuinely useful content. Our developer engagement tripled in three months.",
    author: "Sarah Chen",
    role: "Head of Developer Experience",
    company: "CloudSync API",
  },
  {
    quote: "They get developers because they are developers. The content they create actually resonates with our community.",
    author: "Marcus Rodriguez",
    role: "CTO",
    company: "DataFlow Labs",
  },
  {
    quote: "Finally, a DevRel team that measures success by developer outcomes, not vanity metrics. Game changer for our startup.",
    author: "Aisha Patel",
    role: "Founder",
    company: "BuildKit",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="section-dark py-20 md:py-28">
      <div className="container-main">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 bg-surface-light/10 rounded-full text-sm font-mono text-surface-light/60 mb-4">
            What they say
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-surface-light">
            Developers Trust Us
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative p-6 md:p-8 rounded-xl bg-surface-light/5 border border-surface-light/10 
                         transition-all duration-300 hover:bg-surface-light/10 hover:border-surface-light/20"
            >
              <Quote className="w-8 h-8 text-surface-light/20 mb-4" />
              
              <blockquote className="text-surface-light/90 leading-relaxed mb-6">
                "{testimonial.quote}"
              </blockquote>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-light/20 flex items-center justify-center">
                  <span className="text-surface-light font-display font-semibold text-sm">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-surface-light font-medium text-sm">
                    {testimonial.author}
                  </p>
                  <p className="text-surface-light/50 text-xs">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;