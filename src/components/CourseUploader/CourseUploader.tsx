'use client';

import {
  ChangeEvent,
  DragEvent,
  useId,
  useState,
} from 'react';
import { useTutor } from '@/context/TutorContext';
import { CourseIndexer } from '@/services/ai/CourseIndexer';
import {
  SUPPORTED_COURSE_EXTENSIONS,
  validateCourseFile,
} from '@/services/ai/courseFileValidation';
import type { CourseSummary } from '@/services/ai/courseUploadHandler';
import { announceToScreenReader } from '@/utils/accessibility';
import type { CourseContent, Language } from '@/types';
import styles from './CourseUploader.module.css';

const ACCEPTED_FILES = SUPPORTED_COURSE_EXTENSIONS.map((extension) => `.${extension}`).join(',');

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'success'; title: string; chunks: number }
  | { kind: 'error'; message: string };

const copy = {
  en: {
    title: 'Upload course content',
    help: 'Drag a course file here, or choose a file from your device.',
    dropActive: 'Drop the file to upload',
    choose: 'Choose file',
    formats: 'Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML (up to 10 MB)',
    uploading: (fileName: string) => `Uploading ${fileName}...`,
    success: (title: string, chunks: number) => `${title} uploaded. ${chunks} sections indexed.`,
    error: 'The course file could not be uploaded. Please try again.',
    tooLarge: 'The file is larger than 10 MB.',
    unsupported: 'That file type is not supported.',
  },
  am: {
    title: 'የትምህርት ይዘት ይጫኑ',
    help: 'የትምህርት ፋይል እዚህ ጎትተው ይጣሉ፣ ወይም ከመሣሪያዎ ፋይል ይምረጡ።',
    dropActive: 'ፋይሉን ለመጫን እዚህ ይጣሉ',
    choose: 'ፋይል ይምረጡ',
    formats: 'የሚደገፉ፦ PDF፣ DOCX፣ TXT፣ MD፣ CSV፣ JSON፣ HTML (እስከ 10MB)',
    uploading: (fileName: string) => `${fileName} በመጫን ላይ...`,
    success: (title: string, chunks: number) => `${title} ተጭኗል። ${chunks} ክፍሎች ተመዝግበዋል።`,
    error: 'ፋይሉን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    tooLarge: 'ፋይሉ ከ10MB በላይ ነው።',
    unsupported: 'ይህ የፋይል ዓይነት አይደገፍም።',
  },
} satisfies Record<Language, unknown>;

export function CourseUploader() {
  const { preferences } = useTutor();
  const labels = copy[preferences.language];
  const id = useId();
  const titleId = `${id}-title`;
  const helpId = `${id}-help`;
  const statusId = `${id}-status`;
  const inputId = `${id}-file`;

  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });
  const isUploading = status.kind === 'uploading';

  const uploadFile = async (file: File) => {
    const validation = validateCourseFile(file);

    if (!validation.ok) {
      const message = validation.code === 'FILE_TOO_LARGE' ? labels.tooLarge : labels.unsupported;
      setStatus({ kind: 'error', message });
      announceToScreenReader(message, 'assertive');
      return;
    }

    setStatus({ kind: 'uploading', fileName: file.name });
    announceToScreenReader(labels.uploading(file.name), 'polite');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ai/course', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message ?? labels.error);
      }

      const uploaded = payload.data as CourseSummary & { course?: CourseContent };
      if (uploaded.course) {
        await new CourseIndexer().addCourse(uploaded.course).catch(() => undefined);
      }

      setStatus({ kind: 'success', title: uploaded.title, chunks: uploaded.chunks });
      announceToScreenReader(labels.success(uploaded.title, uploaded.chunks), 'polite');
    } catch {
      setStatus({ kind: 'error', message: labels.error });
      announceToScreenReader(labels.error, 'assertive');
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  return (
    <section
      className={styles.container}
      aria-labelledby={titleId}
      lang={preferences.language}
      dir={preferences.language === 'am' ? 'rtl' : 'ltr'}
    >
      <h2 id={titleId}>{labels.title}</h2>
      <p id={helpId} className={styles.help}>{labels.help}</p>

      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={`${helpId} ${statusId}`}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_FILES}
          className={styles.fileInput}
          onChange={handleInputChange}
          disabled={isUploading}
          aria-describedby={`${helpId} ${statusId}`}
        />
        <label htmlFor={inputId} className={styles.chooseButton}>
          {labels.choose}
        </label>
        <p className={styles.dropHint} aria-hidden="true">
          {isDragging ? labels.dropActive : labels.help}
        </p>
      </div>

      <p className={styles.formats}>{labels.formats}</p>

      <div id={statusId} className={styles.status}>
        {status.kind === 'uploading' && labels.uploading(status.fileName)}
        {status.kind === 'success' && labels.success(status.title, status.chunks)}
        {status.kind === 'error' && (
          <span className={styles.error}>{status.message}</span>
        )}
      </div>
    </section>
  );
}
