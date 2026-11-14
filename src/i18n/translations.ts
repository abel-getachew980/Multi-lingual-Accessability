// Translations for Amharic and English

export const translations = {
  am: {
    // App title and navigation
    appTitle: 'AI Tutor - የአማርኛ ቱቶር',
    newMessage: 'አዲስ መልእክት',
    sendMessage: 'መልእክት ላክ',
    
    // Chat interface
    typeMessage: 'መልእክትዎን ይጻፉ...',
    voiceInput: 'የድምጽ ግብዓት',
    attachFile: 'ፋይል አያይዝ',
    
    // AI responses
    thinking: 'አስባለው...',
    noAnswer: 'በአሁኑ ጊዜ መልስ የለኝም። እባክዎ ቆይተው ይሞክሩ።',
    offlineMode: 'ከኢንተርኔት ውጭ - የከርሰ ሥር ሁነታ',
    citation: 'ምንጭ',
    
    // Human help
    requestHumanHelp: 'የሰው እርዳታ ጠይቅ',
    humanHelpConnected: 'ከሰው አማካሪ ጋር ተገናኝተዋል',
    screenShare: 'መስኮት ይጋሩ',
    stopScreenShare: 'መስኮት ማጋራት አቁም',
    
    // Settings
    settings: 'ቅንብሮች',
    language: 'ቋንቋ',
    fontSize: 'የቃል መጠን',
    soundEnabled: 'ድምጽ አንቃ',
    highContrast: 'ከፍተኛ ንጽጽን',
    keyboardMode: 'የቁልፍ ሰሌዳ ብቻ ሁነታ',
    screenReaderMode: 'የስክሪን አንባቢ ሁነታ',
    
    // AI Provider
    aiProvider: 'AI አቅራቢ',
    cloudAI: 'ደመና AI',
    localAI: 'አካባቢ AI',
    offlineAI: 'ከኢንተርኔት ውጭ',
    
    // Accessibility announcements
    messageSent: 'መልእክት ተልኳል',
    messageReceived: 'አዲስ መልእክት ተቀብለዋል',
    helpRequested: 'እርዳታ ተጠይቋል',
    
    // Errors
    errorOffline: 'ከኢንተርኔት ጋር ተገናኝቶ አያውቅም። የከርሰ ሥር ሁነታን ይጠቀሙ።',
    errorGeneric: 'ይቅርታ፣ ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።'
  },
  
  en: {
    // App title and navigation
    appTitle: 'AI Tutor',
    newMessage: 'New message',
    sendMessage: 'Send message',
    
    // Chat interface
    typeMessage: 'Type your message...',
    voiceInput: 'Voice input',
    attachFile: 'Attach file',
    
    // AI responses
    thinking: 'Thinking...',
    noAnswer: 'No answer available at the moment. Please try again later.',
    offlineMode: 'Offline - Running in offline mode',
    citation: 'Source',
    
    // Human help
    requestHumanHelp: 'Request human help',
    humanHelpConnected: 'Connected to human advisor',
    screenShare: 'Share screen',
    stopScreenShare: 'Stop screen share',
    
    // Settings
    settings: 'Settings',
    language: 'Language',
    fontSize: 'Font size',
    soundEnabled: 'Enable sound',
    highContrast: 'High contrast',
    keyboardMode: 'Keyboard-only mode',
    screenReaderMode: 'Screen reader mode',
    
    // AI Provider
    aiProvider: 'AI Provider',
    cloudAI: 'Cloud AI',
    localAI: 'Local AI',
    offlineAI: 'Offline mode',
    
    // Accessibility announcements
    messageSent: 'Message sent',
    messageReceived: 'New message received',
    helpRequested: 'Help requested',
    
    // Errors
    errorOffline: 'Not connected to internet. Using offline mode.',
    errorGeneric: 'Sorry, an error occurred. Please try again.'
  }
} as const;

export type TranslationKey = keyof typeof translations.en;
