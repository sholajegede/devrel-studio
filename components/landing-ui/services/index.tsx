import { FileText, Users, Calendar, Compass, MessageCircle, BookOpen } from "lucide-react";

const services = [
  {
    icon: FileText,
    title: "Content Strategy",
    description: "Content that educates, not just promotes",
  },
  {
    icon: Users,
    title: "Developer Advocacy",
    description: "Authentic voices in developer communities",
  },
  {
    icon: Calendar,
    title: "Events & Workshops",
    description: "Technical sessions that developers actually attend",
  },
  {
    icon: Compass,
    title: "DevRel Consulting",
    description: "Strategic guidance for scaling your DevRel program",
  },
  {
    icon: MessageCircle,
    title: "Community Building",
    description: "Communities where developers want to participate",
  },
  {
    icon: BookOpen,
    title: "Technical Writing",
    description: "Documentation and tutorials that developers thank you for",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="section-light py-20 md:py-28">
      <div className="container-main">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 bg-foreground/5 rounded-full text-sm font-mono text-muted-foreground mb-4">
            What we do
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold">
            Developer Relations That Work
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className="card-service group"
            >
              <div className="w-12 h-12 bg-foreground/5 rounded-lg flex items-center justify-center mb-5 transition-colors group-hover:bg-foreground group-hover:text-background">
                <service.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">
                {service.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;