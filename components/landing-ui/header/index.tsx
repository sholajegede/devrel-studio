import Image from "next/image";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container-main flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-2 group">
          <Image src="/assets/logo-dark.png" width={100} height={100} alt="Logo" className="w-10 h-10 rounded-md" />
          <span className="font-display font-semibold text-lg tracking-tight">
            devrel<span className="text-muted-foreground">.studio</span>
          </span>
        </a>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-foreground/5 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-muted-foreground">Beta</span>
          </span>
          <a href="#waitlist" className="btn-primary text-sm py-2.5 px-5">
            Join Waitlist
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;