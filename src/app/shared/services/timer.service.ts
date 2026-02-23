import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { TimeEntryRepository } from '../repositories/time-entry.repository';

export interface ActiveTimer {
  entryId: string;
  projectId: string;
  startTime: number;
  lastResumedAt: number;
  description: string;
  accumulatedSeconds: number;
  elapsedSeconds: number;
  isPaused: boolean;
  pausedAt?: number;
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
   * Check if any timer exists (running or paused)
   */
  get hasActiveTimer(): boolean {
    return this.activeTimerSubject.value !== null;
  }

  /**
   * Check if timer is actively running
   */
  get isRunning(): boolean {
    const timer = this.activeTimerSubject.value;
    return timer !== null && !timer.isPaused;
  }

  /**
   * Check if timer is paused
   */
  get isPaused(): boolean {
    const timer = this.activeTimerSubject.value;
    return timer !== null && timer.isPaused;
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
      lastResumedAt: now,
      description,
      accumulatedSeconds: 0,
      elapsedSeconds: 0,
      isPaused: false
    };

    this.activeTimerSubject.next(timer);
    this.saveActiveTimerToStorage(timer);
  }

  /**
   * Stop the active timer
   */
  async stopTimer(_userId: string): Promise<void> {
    const timer = this.activeTimerSubject.value;
    if (!timer) return;

    const now = Date.now();
    const elapsedWhileRunning = timer.isPaused
      ? 0
      : Math.floor((now - timer.lastResumedAt) / 1000);
    const totalDuration = timer.accumulatedSeconds + elapsedWhileRunning;

    // Update the time entry with endTime and duration
    await this.timeEntryRepo.stopTimer(timer.entryId, totalDuration);

    // Clear active timer
    this.activeTimerSubject.next(null);
    this.clearActiveTimerFromStorage();
  }

  /**
   * Pause the active timer
   */
  pauseTimer(): void {
    const timer = this.activeTimerSubject.value;
    if (!timer || timer.isPaused) return;

    const now = Date.now();
    const elapsedWhileRunning = Math.floor((now - timer.lastResumedAt) / 1000);
    const pausedTimer: ActiveTimer = {
      ...timer,
      accumulatedSeconds: timer.accumulatedSeconds + elapsedWhileRunning,
      elapsedSeconds: timer.accumulatedSeconds + elapsedWhileRunning,
      isPaused: true,
      pausedAt: now
    };

    this.activeTimerSubject.next(pausedTimer);
    this.saveActiveTimerToStorage(pausedTimer);
  }

  /**
   * Resume a paused timer
   */
  resumeTimer(): void {
    const timer = this.activeTimerSubject.value;
    if (!timer || !timer.isPaused) return;

    const resumedTimer: ActiveTimer = {
      ...timer,
      lastResumedAt: Date.now(),
      isPaused: false,
      pausedAt: undefined
    };

    this.activeTimerSubject.next(resumedTimer);
    this.saveActiveTimerToStorage(resumedTimer);
  }

  /**
   * Update elapsed time for active timer
   */
  private updateElapsedTime(): void {
    const timer = this.activeTimerSubject.value;
    if (timer && !timer.isPaused) {
      const now = Date.now();
      const elapsed = timer.accumulatedSeconds + Math.floor((now - timer.lastResumedAt) / 1000);
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
        const parsed = JSON.parse(stored) as Partial<ActiveTimer>;

        const timer: ActiveTimer = {
          entryId: parsed.entryId || '',
          projectId: parsed.projectId || '',
          startTime: parsed.startTime || Date.now(),
          lastResumedAt: parsed.lastResumedAt || parsed.startTime || Date.now(),
          description: parsed.description || '',
          accumulatedSeconds: parsed.accumulatedSeconds ?? (parsed.isPaused ? parsed.elapsedSeconds ?? 0 : 0),
          elapsedSeconds: parsed.elapsedSeconds ?? 0,
          isPaused: parsed.isPaused ?? false,
          pausedAt: parsed.pausedAt
        };

        const now = Date.now();
        timer.elapsedSeconds = timer.isPaused
          ? timer.accumulatedSeconds
          : timer.accumulatedSeconds + Math.floor((now - timer.lastResumedAt) / 1000);

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
