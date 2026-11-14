import { useState, useEffect, useCallback } from 'react';
import { announceToScreenReader } from '../utils/accessibility';

interface UseAccessibilityOptions {
  announceNewMessages?: boolean;
  soundEnabled?: boolean;
}

/**
 * Hook for managing accessibility features
 */
export function useAccessibility(options: UseAccessibilityOptions = {}) {
  const { announceNewMessages = true, soundEnabled = true } = options;
  
  const [preferences, setPreferences] = useState({
    soundEnabled,
    highContrast: false,
    fontSize: 'normal' as 'normal' | 'large' | 'xlarge',
    keyboardOnlyMode: false,
    screenReaderOptimized: false,
  });
  
  // Check system preferences on mount
  useEffect(() => {
    const prefersHC = window.matchMedia('(prefers-contrast: high)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersHC) {
      setPreferences(prev => ({ ...prev, highContrast: true }));
    }
    
    // Apply reduced motion if preferred
    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--transition-duration', '0ms');
    }
  }, []);
  
  const toggleSound = useCallback(() => {
    setPreferences(prev => {
      const newValue = !prev.soundEnabled;
      if (newValue) {
        announceToScreenReader('Sound enabled', 'polite');
      } else {
        announceToScreenReader('Sound disabled', 'polite');
      }
      return { ...prev, soundEnabled: newValue };
    });
  }, []);
  
  const toggleHighContrast = useCallback(() => {
    setPreferences(prev => {
      const newValue = !prev.highContrast;
      document.documentElement.classList.toggle('high-contrast', newValue);
      announceToScreenReader(
        newValue ? 'High contrast enabled' : 'High contrast disabled',
        'polite'
      );
      return { ...prev, highContrast: newValue };
    });
  }, []);
  
  const setFontSize = useCallback((size: 'normal' | 'large' | 'xlarge') => {
    setPreferences(prev => {
      document.documentElement.setAttribute('data-font-size', size);
      announceToScreenReader(`Font size set to ${size}`, 'polite');
      return { ...prev, fontSize: size };
    });
  }, []);
  
  const toggleKeyboardOnlyMode = useCallback(() => {
    setPreferences(prev => {
      const newValue = !prev.keyboardOnlyMode;
      announceToScreenReader(
        newValue ? 'Keyboard-only mode enabled' : 'Keyboard-only mode disabled',
        'polite'
      );
      return { ...prev, keyboardOnlyMode: newValue };
    });
  }, []);
  
  return {
    preferences,
    toggleSound,
    toggleHighContrast,
    setFontSize,
    toggleKeyboardOnlyMode,
  };
}

/**
 * Hook for announcing new messages to screen readers
 */
export function useMessageAnnouncer() {
  const [lastAnnouncedId, setLastAnnouncedId] = useState<string | null>(null);
  
  const announceMessage = useCallback((message: string, messageId: string) => {
    if (messageId !== lastAnnouncedId) {
      announceToScreenReader(message, 'polite');
      setLastAnnouncedId(messageId);
    }
  }, [lastAnnouncedId]);
  
  return { announceMessage };
}

/**
 * Hook for managing focus trap in modals
 */
export function useFocusTrap(isActive: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
    
    container.addEventListener('keydown', handleKeyDown);
    firstFocusable?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, containerRef]);
}
