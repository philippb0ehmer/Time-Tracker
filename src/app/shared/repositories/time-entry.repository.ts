import { Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { DatabaseService } from '../../core/database/database.service';
import { BaseRepository } from './base-repository';
import { TimeEntry } from '../models/time-entry.model';

@Injectable({ providedIn: 'root' })
export class TimeEntryRepository extends BaseRepository<TimeEntry> {
  private initialized = false;

  constructor(private dbService: DatabaseService) {
    super();
    this.setInitialization(this.init());
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    const db = await this.dbService.getDatabase();
    this.collection = db.time_entries;
    this.initialized = true;
  }

  /**
   * Find entries by project ID
   */
  findByProject$(projectId: string, userId: string): Observable<TimeEntry[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId,
            projectId: projectId,
            _deleted: { $ne: true }
          } as any,
          sort: [{ startTime: 'desc' }] as any
        })
        .$ as Observable<TimeEntry[]>)
    );
  }

  /**
   * Find entries within a date range
   */
  findByDateRange$(
    userId: string,
    startDate: number,
    endDate: number
  ): Observable<TimeEntry[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId,
            startTime: {
              $gte: startDate,
              $lte: endDate
            },
            _deleted: { $ne: true }
          } as any,
          sort: [{ startTime: 'desc' }] as any
        })
        .$ as Observable<TimeEntry[]>)
    );
  }

  /**
   * Find the currently active timer (entry without endTime)
   */
  findActiveTimer$(userId: string): Observable<TimeEntry | null> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .findOne({
          selector: {
            userId: userId,
            endTime: { $exists: false },
            _deleted: { $ne: true }
          } as any
        })
        .$ as Observable<TimeEntry | null>)
    );
  }

  /**
   * Find recent entries (last N entries)
   */
  findRecent$(userId: string, limit: number = 10): Observable<TimeEntry[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId,
            _deleted: { $ne: true }
          } as any,
          sort: [{ startTime: 'desc' }] as any,
          limit: limit
        })
        .$ as Observable<TimeEntry[]>)
    );
  }

  /**
   * Create a new time entry (for timer start)
   */
  async createEntry(
    projectId: string,
    userId: string,
    description: string = '',
    isManual: boolean = false,
    startTime?: number,
    endTime?: number,
    duration?: number
  ): Promise<TimeEntry> {
    const doc = await this.create({
      projectId,
      userId,
      description,
      isManual,
      startTime: startTime || Date.now(),
      endTime,
      duration
    } as Partial<TimeEntry>);

    return doc.toJSON() as TimeEntry;
  }

  /**
   * Stop a running timer (set endTime and calculate duration)
   */
  async stopTimer(id: string, durationSeconds?: number): Promise<void> {
    const collection = await this.ensureCollection();

    const doc = await collection.findOne(id).exec();
    if (doc) {
      const entry = doc.toJSON() as TimeEntry;
      const now = Date.now();
      const duration = durationSeconds ?? Math.floor((now - entry.startTime) / 1000); // duration in seconds

      await doc.update({
        $set: {
          endTime: now,
          duration: duration,
          updatedAt: now
        }
      });
    }
  }

  /**
   * Soft-delete all entries for a project (used when deleting a project)
   */
  async deleteByProject(projectId: string, userId: string): Promise<number> {
    const collection = await this.ensureCollection();
    const docs = await collection.find({
      selector: {
        projectId: projectId,
        userId: userId,
        _deleted: { $ne: true }
      } as any
    }).exec();

    let deletedCount = 0;
    for (const doc of docs) {
      await doc.update({
        $set: {
          _deleted: true,
          updatedAt: Date.now()
        }
      });
      deletedCount += 1;
    }

    return deletedCount;
  }
}
