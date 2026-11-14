import { TutorProvider } from '@/context/TutorContext';

export default function Home() {
  return (
    <TutorProvider>
      <main id="main-content" role="main" aria-label="AI Tutor Chat Interface">
        <h1>AI Tutor - የአማርኛ ቱቶር</h1>
        <p>Accessible AI Tutor with Amharic and English support</p>
        <p>
          <strong>Status:</strong> Project initialized with Next.js.
        </p>
        <p>
          Teammates can now work on their assigned modules in parallel using feature branches.
        </p>
      </main>
    </TutorProvider>
  );
}
