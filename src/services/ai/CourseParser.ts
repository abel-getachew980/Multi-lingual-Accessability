import type { ContentChunk, CourseMetadata, Language } from '@/types';
import type {
  CourseParseOptions,
  ParsedCourse,
  ParsedFileInput,
} from './types';

const DEFAULT_MAX_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;

const TEXT_EXTENSIONS = new Set([
  'txt',
  'text',
  'md',
  'markdown',
  'csv',
  'json',
  'html',
  'htm',
]);

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
]);

const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class CourseParser {
  isSupported(name: string, type?: string): boolean {
    return this.resolveFormat(name, type) !== null;
  }

  async parseFile(input: ParsedFileInput, options: CourseParseOptions = {}): Promise<ParsedCourse> {
    const format = this.resolveFormat(input.name, input.type);
    if (!format) {
      throw new Error(`Unsupported file type: ${input.type ?? input.name}`);
    }

    let content: string;
    let totalPages = 1;
    let parsedTitle: string | undefined;

    if (format === 'pdf') {
      const parsed = await this.parsePDFFile(input.data);
      content = parsed.text;
      totalPages = parsed.totalPages;
    } else if (format === 'docx') {
      content = await this.parseDocxFile(input.data);
    } else {
      const text = this.toText(input.data);
      if (format === 'json') {
        const parsed = this.parseJSONCourse(text);
        content = parsed.content;
        parsedTitle = parsed.title;
      } else if (format === 'html') {
        content = this.htmlToText(text);
      } else {
        content = text;
      }
    }

    const cleanContent = content.replace(/\r\n/g, '\n').trim();
    if (!cleanContent) {
      throw new Error('Course file did not contain any readable text');
    }

    const title = options.title
      ?? parsedTitle
      ?? this.extractTitle(cleanContent, input.name);
    const language = options.language ?? this.detectLanguage(cleanContent);
    const id = this.createCourseId(input.name, cleanContent);
    const chunks = this.createChunks(cleanContent, id, {
      maxChunkSize: options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE,
      chunkOverlap: options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
    });

    const metadata: CourseMetadata = {
      fileName: input.name,
      uploadedAt: new Date(),
      fileSize: this.getByteLength(input.data),
      fileType: input.type ?? format,
      totalPages,
    };

    return {
      id,
      title,
      content: cleanContent,
      language,
      metadata,
      chunks,
      totalPages,
    };
  }

  splitIntoChunks(
    content: string,
    maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
  ): string[] {
    const paragraphs = content
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let current = '';

    const flush = () => {
      if (current.trim()) chunks.push(current.trim());
      current = '';
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChunkSize) {
        if (current && current.length + 2 + paragraph.length > maxChunkSize) {
          flush();
        }
        current = current ? `${current}\n\n${paragraph}` : paragraph;
        continue;
      }

      flush();

      const words = paragraph.split(/\s+/).filter(Boolean);
      let part = '';

      for (const word of words) {
        const candidate = part ? `${part} ${word}` : word;

        if (candidate.length > maxChunkSize) {
          if (part) {
            chunks.push(part);
            const overlapText = this.tail(part, chunkOverlap);
            part = overlapText ? `${overlapText} ${word}` : word;
          } else {
            chunks.push(word.slice(0, maxChunkSize));
            part = '';
          }
        } else {
          part = candidate;
        }
      }

      if (part) {
        chunks.push(part);
        current = '';
      }
    }

    flush();
    return chunks;
  }

  private createChunks(
    content: string,
    courseId: string,
    options: { maxChunkSize: number; chunkOverlap: number },
  ): ContentChunk[] {
    const pages = content.split('\f');
    const chunks: ContentChunk[] = [];

    pages.forEach((page, pageIndex) => {
      for (const section of this.splitPageIntoSections(page)) {
        const sectionChunks = this.splitIntoChunks(
          section.text,
          options.maxChunkSize,
          options.chunkOverlap,
        );

        sectionChunks.forEach((chunkContent) => {
          chunks.push({
            id: `${courseId}-chunk-${chunks.length + 1}`,
            courseId,
            content: chunkContent,
            pageNumber: pageIndex + 1,
            ...(section.section ? { section: section.section } : {}),
          });
        });
      }
    });

    return chunks;
  }

  private splitPageIntoSections(page: string): Array<{ text: string; section?: string }> {
    const sections: Array<{ text: string; section?: string }> = [];
    let currentSection: string | undefined;
    let buffer: string[] = [];

    const flush = () => {
      const text = buffer.join('\n').trim();
      if (text) sections.push({ text, ...(currentSection ? { section: currentSection } : {}) });
      buffer = [];
    };

    for (const line of page.split('\n')) {
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (heading) {
        flush();
        currentSection = heading[1].trim();
        buffer.push(line);
      } else {
        buffer.push(line);
      }
    }

    flush();
    return sections.length > 0 ? sections : [{ text: page }];
  }

  private resolveFormat(name: string, type?: string): 'text' | 'json' | 'html' | 'pdf' | 'docx' | null {
    const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
    const mimeType = type?.toLowerCase();

    if (extension === 'pdf' || mimeType === PDF_MIME_TYPE) return 'pdf';
    if (extension === 'docx' || mimeType === DOCX_MIME_TYPE) return 'docx';
    if (extension === 'json' || mimeType === 'application/json') return 'json';
    if (extension === 'html' || extension === 'htm' || mimeType === 'text/html') return 'html';
    if (extension === 'doc') return null;
    if (TEXT_EXTENSIONS.has(extension) || (mimeType && TEXT_MIME_TYPES.has(mimeType))) {
      return 'text';
    }

    return null;
  }

  private async parsePDFFile(data: ParsedFileInput['data']): Promise<{
    text: string;
    totalPages: number;
  }> {
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule.default ?? pdfModule) as unknown as (
      buffer: Buffer,
    ) => Promise<{ text: string; numpages?: number }>;
    const result = await pdfParse(this.toBuffer(data));

    return {
      text: result.text,
      totalPages: result.numpages ?? result.text.split('\f').length,
    };
  }

  private async parseDocxFile(data: ParsedFileInput['data']): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: this.toBuffer(data) });
    return result.value;
  }

  private parseJSONCourse(text: string): { title?: string; content: string } {
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      return { content: text };
    }

    if (Array.isArray(parsed)) {
      return {
        content: parsed
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const record = item as Record<string, unknown>;
              return [record.title, record.content, record.text]
                .filter((value): value is string => typeof value === 'string')
                .join('\n\n');
            }
            return '';
          })
          .filter(Boolean)
          .join('\n\n'),
      };
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title : undefined;
      const content = [record.content, record.text, record.body]
        .find((value): value is string => typeof value === 'string');

      if (content) return { title, content };
    }

    return { content: text };
  }

  private toText(data: ParsedFileInput['data']): string {
    if (typeof data === 'string') return data;

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }

    return Buffer.from(bytes).toString('utf-8');
  }

  private toBuffer(data: ParsedFileInput['data']): Buffer {
    if (typeof data === 'string') return Buffer.from(data, 'utf-8');
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof Uint8Array) return Buffer.from(data);
    return Buffer.from(new Uint8Array(data));
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTitle(content: string, fileName: string): string {
    const markdownHeading = content.match(/^#{1,6}\s+(.+)$/m);
    if (markdownHeading) return markdownHeading[1].trim();

    const firstLine = content.split('\n').find((line) => line.trim());
    if (firstLine && firstLine.length <= 100) return firstLine.trim();

    return fileName.replace(/\.[^.]+$/, '');
  }

  private detectLanguage(content: string): Language {
    return /[\u1200-\u137F]/.test(content) ? 'am' : 'en';
  }

  private createCourseId(name: string, content: string): string {
    const slug = name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'course';

    let hash = 0;
    for (let index = 0; index < content.length; index += 1) {
      hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
    }

    return `${slug}-${hash.toString(36)}`;
  }

  private getByteLength(data: ParsedFileInput['data']): number {
    if (typeof data === 'string') {
      if (typeof Buffer !== 'undefined') return Buffer.byteLength(data, 'utf-8');
      return new TextEncoder().encode(data).length;
    }

    return data.byteLength;
  }

  private tail(text: string, maxChars: number): string {
    if (maxChars <= 0) return '';

    const words = text.split(/\s+/);
    let tail = '';

    for (let index = words.length - 1; index >= 0; index -= 1) {
      const candidate = tail ? `${words[index]} ${tail}` : words[index];
      if (candidate.length > maxChars) break;
      tail = candidate;
    }

    return tail;
  }
}

export const courseParser = new CourseParser();
