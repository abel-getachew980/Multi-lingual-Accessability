/**
 * CourseCache - Cache course content for offline access
 *
 * Manages cached course content in IndexedDB.
 * Tracks cache size and last accessed time.
 */

import { IndexedDBStore } from './IndexedDBStore';
import { CachedCourse, StorageUsage } from './types';
import { CourseContent } from '@/types';

export class CourseCache {
  private store: IndexedDBStore;

  constructor(store: IndexedDBStore) {
    this.store = store;
  }

  /**
   * Cache a course for offline access
   */
  async cacheCourse(course: CourseContent): Promise<void> {
    const cachedCourse: CachedCourse = {
      id: course.id,
      data: course,
      cachedAt: new Date(),
      lastAccessed: new Date(),
      size: this.calculateSize(course),
    };

    await this.store.set('courses', cachedCourse);
  }

  /**
   * Get a cached course by ID
   */
  async getCourse(id: string): Promise<CourseContent | null> {
    const cached = await this.store.get<CachedCourse>('courses', id);

    if (cached) {
      // Update last accessed time
      cached.lastAccessed = new Date();
      await this.store.set('courses', cached);
      return cached.data;
    }

    return null;
  }

  /**
   * Get all cached courses
   */
  async getAllCourses(): Promise<CachedCourse[]> {
    return await this.store.getAll<CachedCourse>('courses');
  }

  /**
   * Check if a course is cached
   */
  async isCached(id: string): Promise<boolean> {
    const course = await this.store.get<CachedCourse>('courses', id);
    return course !== null;
  }

  /**
   * Remove a cached course
   */
  async removeCourse(id: string): Promise<void> {
    await this.store.delete('courses', id);
  }

  /**
   * Get total cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    const courses = await this.getAllCourses();
    return courses.reduce((total, course) => total + course.size, 0);
  }

  /**
   * Get storage usage statistics
   */
  async getUsage(): Promise<StorageUsage> {
    const courses = await this.getAllCourses();
    const totalSize = courses.reduce((total, course) => total + course.size, 0);

    // Estimate available storage (rough approximation)
    const usedMB = totalSize / (1024 * 1024);

    return {
      courses: totalSize,
      messages: 0,
      queue: 0,
      total: totalSize,
      usedMB,
    };
  }

  /**
   * Clear courses not accessed in X days
   */
  async clearOldCourses(daysOld: number): Promise<number> {
    const courses = await this.getAllCourses();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    let removed = 0;
    for (const course of courses) {
      if (new Date(course.lastAccessed) < cutoff) {
        await this.removeCourse(course.id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear courses exceeding size limit (FIFO)
   */
  async clearToSize(maxSizeBytes: number): Promise<number> {
    const courses = await this.getAllCourses();
    const totalSize = courses.reduce((total, course) => total + course.size, 0);

    if (totalSize <= maxSizeBytes) {
      return 0;
    }

    // Sort by last accessed (oldest first)
    courses.sort((a, b) =>
      new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    );

    let removed = 0;
    let currentSize = totalSize;

    for (const course of courses) {
      if (currentSize <= maxSizeBytes) {
        break;
      }

      await this.removeCourse(course.id);
      currentSize -= course.size;
      removed++;
    }

    return removed;
  }

  /**
   * Clear all cached courses
   */
  async clearAll(): Promise<void> {
    await this.store.clear('courses');
  }

  /**
   * Get number of cached courses
   */
  async count(): Promise<number> {
    return await this.store.count('courses');
  }

  /**
   * Calculate size of course in bytes
   */
  private calculateSize(course: CourseContent): number {
    return new Blob([JSON.stringify(course)]).size;
  }
}
