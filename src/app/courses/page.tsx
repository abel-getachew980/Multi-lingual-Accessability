import { TutorProvider } from '@/context/TutorContext';
import { CourseUploader } from '@/components/CourseUploader';

export default function CoursesPage() {
  return (
    <TutorProvider>
      <main id="main-content">
        <CourseUploader />
      </main>
    </TutorProvider>
  );
}
