import { TutorProvider } from './context/TutorContext';
import './App.css';

function App() {
  return (
    <TutorProvider>
      <div className="app">
        {/* Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        
        {/* Screen reader announcer */}
        <div
          id="sr-announcer"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
        
        <main id="main-content" role="main">
          <h1>AI Tutor - የአማርኛ ቱቶር</h1>
          <p>Accessible AI Tutor with Amharic and English support</p>
          <p>Project initialized successfully. Ready for implementation.</p>
        </main>
      </div>
    </TutorProvider>
  );
}

export default App;
