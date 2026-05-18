import AnimatedCounter from "./animatedCounter";

const stats = [
  { value: 300, suffix: "K+", label: "Developers Reached" },
  { value: 25, suffix: "+", label: "Articles Published" },
  { value: 2, suffix: "+", label: "Companies Served" },
];

const StatsSection = () => {
  return (
    <section className="section-dark py-20 md:py-24">
      <div className="container-main">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card text-center">
              <span className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-surface-light">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={2000 + index * 200} />
              </span>
              <span className="mt-3 text-surface-light/70 text-sm md:text-base font-medium tracking-wide uppercase">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;