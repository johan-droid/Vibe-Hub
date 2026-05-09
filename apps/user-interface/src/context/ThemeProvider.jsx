import React, { useEffect } from 'react';
import { ThemeContext } from './ThemeContext.js';

export const ThemeProvider = ({ children }) => {
  // Always use dark theme as specified
  const theme = 'dark';

  useEffect(() => {
    // Apply dark theme to document
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = {
    theme,
    isDark: true,
    toggleTheme: () => {
      // No-op - always dark
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
