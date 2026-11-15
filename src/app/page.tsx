import { TutorProvider } from '@/context/TutorContext';
import { ChatContainer } from '@/components/Chat';

export default function Home() {
  return (
    <TutorProvider>
      <ChatContainer />
    </TutorProvider>
  );
}
