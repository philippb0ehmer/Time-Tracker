import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { TimeEntryRepository } from '../repositories/time-entry.repository';
import { TimeEntry } from '../models/time-entry.model';

export interface ActiveTimer {
  entryId: string;
  projectId: string;
  startTime: number;
  description: string;
  elapsedSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class TimerService {
  private activeTimerSubject = new BehaviorSubject<ActiveTimer | null>(null);
  public activeTimer$: Observable<ActiveTimer | null> = this.activeTimerSubject.asObservable();

  constructor(private timeEntryRepo: TimeEntryRepository) {
    // Restore active timer on app start
    this.restoreActiveTimer();

    // Update elapsed time every second
    interval(1000).subscribe(() => {
      this.updateElapsedTime();
    });
  }

  /**
   * Get current active timer (sync)
   */
  get activeTimer(): ActiveTimer | null {
    return this.activeTimerSubject.value;
  }

  /**
   * Check if timer is running
   */
  get isRunning(): boolean {
    return this.activeTimerSubject.value !== null;
  }

  /**
   * Start a new timer
   */
  async startTimer(
    projectId: string,
    description: string,
    userId: string
  ): Promise<void> {
    // Stop any existing timer first
    if (this.activeTimerSubject.value) {
      await this.stopTimer(userId);
    }

    const now = Date.now();
    const entry = await this.timeEntryRepo.createEntry(
      projectId,
      userId,
      description,
      false, // isManual = false (timer-based)
      now
    );

    const timer: ActiveTimer = {
      entryId: entry.id,
      projectId,
      startTime: now,
      description,
      elapsedSeconds: 0
    };

    this.activeTimerSubject.next(timer);
    this.saveActiveTimerToStorage(timer);
  }

  /**
   * Stop the active timer
   */
  async stopTimer(userId: string): Promise<void> {
    const timer = this.activeTimerSubject.value;
    if (!timer) return;

    // Update the time entry with endTime and duration
    await this.timeEntryRepo.stopTimer(timer.entryId);

    // Clear active timer
    this.activeTimerSubject.next(null);
    this.clearActiveTimerFromStorage();
  }

  /**
   * Update elapsed time for active timer
   */
  private updateElapsedTime(): void {
    const timer = this.activeTimerSubject.value;
    if (timer) {
      const now = Date.now();
      const elapsed = Math.floor((now - timer.startTime) / 1000);
      this.activeTimerSubject.next({ ...timer, elapsedSeconds: elapsed });
    }
  }

  /**
   * Restore active timer from storage on app start
   */
  private async restoreActiveTimer(): Promise<void> {
    try {
      const stored = localStorage.getItem('activeTimer');
      if (stored) {
        const timer: ActiveTimer = JSON.parse(stored);
        // Recalculate elapsed time
        const now = Date.now();
        const elapsed = Math.floor((now - timer.startTime) / 1000);
        timer.elapsedSeconds = elapsed;
        this.activeTimerSubject.next(timer);
      }
    } catch (error) {
      console.error('Error restoring active timer:', error);
      this.clearActiveTimerFromStorage();
    }
  }

  /**
   * Save active timer to localStorage
   */
  private saveActiveTimerToStorage(timer: ActiveTimer): void {
    try {
      localStorage.setItem('activeTimer', JSON.stringify(timer));
    } catch (error) {
      console.error('Error saving active timer:', error);
    }
  }

  /**
   * Clear active timer from localStorage
   */
  private clearActiveTimerFromStorage(): void {
    try {
      localStorage.removeItem('activeTimer');
    } catch (error) {
      console.error('Error clearing active timer:', error);
    }
  }

  /**
   * Format elapsed seconds to HH:MM:SS
   */
  formatElapsedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}`;
  }

  /**
   * Pad number with leading zero
   */
  private pad(num: number): string {
    return num.toString().padStart(2, '0');
  }
}
