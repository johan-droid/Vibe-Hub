import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

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
