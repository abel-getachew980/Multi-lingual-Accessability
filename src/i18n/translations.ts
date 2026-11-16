// ============================================
// TRANSLATIONS - Amharic & English
// ============================================

export const translations = {
  am: {
    // App title and navigation
    appTitle: 'AI Tutor - የአማርኛ ቱቶር',
    newMessage: 'አዲስ መልእክት',
    sendMessage: 'መልእክት ላክ',
    skipToContent: 'ወደ ዋና ይዘት ዝለል',

    // Chat interface
    typeMessage: 'መልእክትዎን ይጻፉ...',
    voiceInput: 'የድምጽ ግብዓት',
    attachFile: 'ፋይል አያይዝ',
    send: 'ላክ',
    cancel: 'ሰርዝ',

    // AI responses
    thinking: 'አስባለው...',
    noAnswer: 'በአሁኑ ጊዜ መልስ የለኝም። እባክዎ ቆይተው ይሞክሩ።',
    offlineMode: 'ከኢንተርኔት ውጭ - የከርሰ ሥር ሁነታ',
    citation: 'ምንጭ',
    viewSource: 'ምንጩን ይመልከቱ',

    // Human help
    requestHumanHelp: 'የሰው እርዳታ ጠይቅ',
    humanHelpConnected: 'ከሰው አማካሪ ጋር ተገናኝተዋል',
    humanHelpPending: 'እባክዎ ይጠብቁ...',
    cancelHelp: 'ጥያቄውን ሰርዝ',
    screenShare: 'መስኮት ይጋሩ',
    stopScreenShare: 'መስኮት ማጋራት አቁም',

    // Settings
    settings: 'ቅንብሮች',
    closeSettings: 'ቅንብሮችን ዝጋ',
    done: 'ጨርስ',
    resetSettings: 'ወደ ነባሪ መልስ',
    settingsDescription: 'የእርስዎን ተሞክሮ ያስተካክሉ። ለውጦቹ ወዲያውኑ ይተገበራሉ።',
    language: 'ቋንቋ',
    fontSize: 'የፊደል መጠን',
    fontSizeNormal: 'መደበኛ',
    fontSizeLarge: 'ትልቅ',
    fontSizeXLarge: 'በጣም ትልቅ',
    soundEnabled: 'ድምጽ አንቃ',
    highContrast: 'ከፍተኛ ንጽጽን',
    keyboardMode: 'የቁልፍ ሰሌዳ ብቻ ሁነታ',
    screenReaderMode: 'የስክሪን አንባቢ ሁነታ',
    autoPlayVoice: 'የድምጽ ምላሾችን በራስ-ሰር አጫውት',
    reduceMotion: 'እንቅስቃሴን ቀንስ',
    settingsChanged: 'ቅንብሩ ተሻሽሏል',

    // AI Provider
    aiProvider: 'AI አቅራቢ',
    cloudAI: 'ደመና AI',
    localAI: 'አካባቢ AI',
    offlineAI: 'ከኢንተርኔት ውጭ',

    // Accessibility announcements
    messageSent: 'መልእክት ተልኳል',
    messageReceived: 'አዲስ መልእክት ተቀብለዋል',
    helpRequested: 'እርዳታ ተጠይቋል',
    helpCancelled: 'የሰው እርዳታ ተሰርዟል',
    screenShareStarted: 'የመስኮት ማጋራት ተጀምሯል',
    screenShareStopped: 'የመስኮት ማጋራት ቆሟል',

    // Errors
    errorOffline: 'ከኢንተርኔት ጋር ተገናኝቶ አያውቅም። የከርሰ ሥር ሁነታን ይጠቀሙ።',
    errorGeneric: 'ይቅርታ፣ ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።',
    errorVoice: 'የድምጽ ግብዓት አይሰራም።',

    // Time
    justNow: 'አሁን አሁን',
    minutesAgo: 'ደቂቃዎች በፊት',
    hoursAgo: 'ሰዓታት በፊት',
  },

  en: {
    // App title and navigation
    appTitle: 'AI Tutor',
    newMessage: 'New message',
    sendMessage: 'Send message',
    skipToContent: 'Skip to main content',

    // Chat interface
    typeMessage: 'Type your message...',
    voiceInput: 'Voice input',
    attachFile: 'Attach file',
    send: 'Send',
    cancel: 'Cancel',

    // AI responses
    thinking: 'Thinking...',
    noAnswer: 'No answer available. Please try again.',
    offlineMode: 'Offline - Running in offline mode',
    citation: 'Source',
    viewSource: 'View source',

    // Human help
    requestHumanHelp: 'Request human help',
    humanHelpConnected: 'Connected to human advisor',
    humanHelpPending: 'Please wait...',
    cancelHelp: 'Cancel request',
    screenShare: 'Share screen',
    stopScreenShare: 'Stop sharing',

    // Settings
    settings: 'Settings',
    closeSettings: 'Close settings',
    done: 'Done',
    resetSettings: 'Reset to defaults',
    settingsDescription: 'Adjust your experience. Changes apply right away.',
    language: 'Language',
    fontSize: 'Font size',
    fontSizeNormal: 'Normal',
    fontSizeLarge: 'Large',
    fontSizeXLarge: 'Extra large',
    soundEnabled: 'Enable sound',
    highContrast: 'High contrast',
    keyboardMode: 'Keyboard-only mode',
    screenReaderMode: 'Screen reader mode',
    autoPlayVoice: 'Auto-play voice responses',
    reduceMotion: 'Reduce motion',
    settingsChanged: 'Setting updated',

    // AI Provider
    aiProvider: 'AI Provider',
    cloudAI: 'Cloud AI',
    localAI: 'Local AI',
    offlineAI: 'Offline mode',

    // Accessibility announcements
    messageSent: 'Message sent',
    messageReceived: 'New message received',
    helpRequested: 'Help requested',
    helpCancelled: 'Human help cancelled',
    screenShareStarted: 'Screen sharing started',
    screenShareStopped: 'Screen sharing stopped',

    // Errors
    errorOffline: 'No internet connection. Using offline mode.',
    errorGeneric: 'Sorry, an error occurred. Please try again.',
    errorVoice: 'Voice input is not working.',

    // Time
    justNow: 'Just now',
    minutesAgo: 'minutes ago',
    hoursAgo: 'hours ago',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
