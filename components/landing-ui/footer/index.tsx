import { Linkedin, Twitter, Youtube } from "lucide-react";
import Image from "next/image";

const Footer = () => {
  return (
    <footer className="section-dark py-16">
      <div className="container-main">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2">
              <Image src="/assets/logo-light.png" width={100} height={100} alt="Logo" className="w-10 h-10 rounded-md" />
              <span className="font-display font-semibold text-lg text-surface-light">
                devrel<span className="text-surface-light/50">.studio</span>
              </span>
            </div>
            <p className="text-surface-light/60 text-sm">
              Built by developers, for developers
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <a
              href="mailto:support@devrel.studio"
              className="text-surface-light/80 hover:text-surface-light transition-colors font-mono text-sm"
            >
              support@devrel.studio
            </a>
            
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://www.linkedin.com/company/devrelstudio"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-surface-light/10 flex items-center justify-center text-surface-light/60 hover:text-surface-light hover:bg-surface-light/20 transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://x.com/devrelstudio"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-surface-light/10 flex items-center justify-center text-surface-light/60 hover:text-surface-light hover:bg-surface-light/20 transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com/@devrelstudio"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-surface-light/10 flex items-center justify-center text-surface-light/60 hover:text-surface-light hover:bg-surface-light/20 transition-all"
                aria-label="GitHub"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-surface-light/10 text-center">
          <p className="text-surface-light/40 text-sm">
            © 2025 devrel.studio. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;