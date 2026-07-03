import React from 'react';
import { motion } from 'framer-motion';
import { VibeLogoCompact } from './VibeLogo';

/**
 * Application Header with Selina Branding
 */
export function ApplicationHeader({ 
  showLogo = true, 
  title = "Selina",
  className = "",
  showBreadcrumb = false,
  breadcrumbItems = []
}) {
  return (
    <motion.header
      className={`flex items-center justify-between gap-4 px-6 py-4 bg-black/80 backdrop-blur-md border-b border-white/5 ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo and title */}
      <div className="flex items-center gap-3">
        {showLogo && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="cursor-pointer"
          >
            <VibeLogoCompact size={40} />
          </motion.div>
        )}
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight text-white">
            {title}
          </h1>
          {showBreadcrumb && breadcrumbItems.length > 0 && (
            <nav className="text-[10px] text-slate-500 flex gap-2 uppercase tracking-widest">
              {breadcrumbItems.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="opacity-30">/</span>}
                  <span>{item}</span>
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Right side content slot */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Navigation or User Profile would go here */}
      </div>
    </motion.header>
  );
}

export function ApplicationFooter() {
  return (
    <motion.footer
      className="flex items-center justify-center gap-2 px-6 py-6 bg-black border-t border-white/5 mt-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
    >
      <VibeLogoCompact size={20} />
      <span className="text-xs font-medium text-slate-600 tracking-wide">
        Powered by Selina
      </span>
    </motion.footer>
  );
}
