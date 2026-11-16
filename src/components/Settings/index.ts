// ============================================
// SETTINGS COMPONENTS - Teammate 8
// ============================================
//
// - `SettingsDialog` is the connected entry point used by the chat header.
// - `SettingsPanel` is presentational, so it can be tested and reused.
// - The remaining components are the individual controls.
//
// Settings are stored through `PreferencesStore` (localStorage) by
// `TutorContext`; `applyPreferences` mirrors them onto <html> so the global
// tokens (font size, contrast, motion) follow immediately.

export { AccessibilityToggles } from './AccessibilityToggles';
export { AIProviderSelector } from './AIProviderSelector';
export { applyPreferences } from './applyPreferences';
export { FontSizeAdjuster } from './FontSizeAdjuster';
export { LanguageSelector } from './LanguageSelector';
export { SettingsButton } from './SettingsButton';
export { SettingsDialog } from './SettingsDialog';
export { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';
