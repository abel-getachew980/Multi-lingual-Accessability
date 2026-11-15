'use client';

import {
  ChangeEvent,
  DragEvent,
  useId,
  useState,
} from 'react';
import { useTutor } from '@/context/TutorContext';
import { validateCourseFile } from '@/services/ai/courseFileValidation';
import { announceToScreenReader } from '@/utils/accessibility';
import type { Language } from '@/types';
import styles from './CourseUploader.module.css';

const ACCEPTED_FILES = '.pdf,.docx,.txt,.text,.md,.markdown,.csv,.json,.html,.htm';

interface UploadedCourse {
  id: string;
  title: string;
  language: Language;
  chunks: number;
  totalPages: number;
}

interface CourseUploaderProps {
  onUploaded?: (course: UploadedCourse) => void;
}

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

export function CourseUploader({ onUploaded }: CourseUploaderProps) {
  const { preferences } = useTutor();
  const text = copy[preferences.language];
  const id = useId();
  const titleId = `${id}-title`;
  const helpId = `${id}-help`;
  const statusId = `${id}-status`;
  const inputId = `${id}-file`;

  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });
  const isUploading = status.kind === 'uploading';

  const uploadFile = async (file: File) => {
    const validation = validateCourseFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!validation.ok) {
      const message = validation.code === 'FILE_TOO_LARGE' ? text.tooLarge : text.unsupported;
      setStatus({ kind: 'error', message });
      announceToScreenReader(message, 'assertive');
      return;
    }

    setStatus({ kind: 'uploading', fileName: file.name });
    announceToScreenReader(text.uploading(file.name), 'polite');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ai/course', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message ?? text.error);
      }

      const uploaded = payload.data as UploadedCourse;
      setStatus({ kind: 'success', title: uploaded.title, chunks: uploaded.chunks });
      announceToScreenReader(text.success(uploaded.title, uploaded.chunks), 'polite');
      onUploaded?.(uploaded);
    } catch {
      setStatus({ kind: 'error', message: text.error });
      announceToScreenReader(text.error, 'assertive');
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
    <section className={styles.container} aria-labelledby={titleId}>
      <h2 id={titleId}>{text.title}</h2>
      <p id={helpId} className={styles.help}>{text.help}</p>

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
          {text.choose}
        </label>
        <p className={styles.dropHint} aria-hidden="true">
          {isDragging ? text.dropActive : text.help}
        </p>
      </div>

      <p className={styles.formats}>{text.formats}</p>

      <div id={statusId} role="status" aria-live="polite" className={styles.status}>
        {status.kind === 'uploading' && text.uploading(status.fileName)}
        {status.kind === 'success' && text.success(status.title, status.chunks)}
        {status.kind === 'error' && (
          <span className={styles.error}>{status.message}</span>
        )}
      </div>
    </section>
  );
}
