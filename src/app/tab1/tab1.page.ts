import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TimerService, ActiveTimer } from '../shared/services/timer.service';
import { ProjectRepository } from '../shared/repositories/project.repository';
import { Project } from '../shared/models/project.model';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Temporary hardcoded user ID (will be replaced with auth in Phase 3)
  private userId = 'demo-user-1';

  activeTimer: ActiveTimer | null = null;
  projects: Project[] = [];
  selectedProjectId: string = '';
  description: string = '';

  constructor(
    public timerService: TimerService,
    private projectRepo: ProjectRepository
  ) {}

  ngOnInit() {
    // Subscribe to active timer
    this.timerService.activeTimer$
      .pipe(takeUntil(this.destroy$))
      .subscribe(timer => {
        this.activeTimer = timer;
      });

    // Load projects
    this.projectRepo.findActive$(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(projects => {
        this.projects = projects;
        // Auto-select first project if none selected
        if (projects.length > 0 && !this.selectedProjectId) {
          this.selectedProjectId = projects[0].id;
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async startTimer() {
    if (!this.selectedProjectId) {
      alert('Please select a project first');
      return;
    }

    await this.timerService.startTimer(
      this.selectedProjectId,
      this.description,
      this.userId
    );

    // Clear description after starting
    this.description = '';
  }

  async stopTimer() {
    await this.timerService.stopTimer(this.userId);
  }

  pauseTimer() {
    this.timerService.pauseTimer();
  }

  resumeTimer() {
    this.timerService.resumeTimer();
  }

  get statusText(): string {
    if (!this.activeTimer) return 'Ready to start';
    return this.activeTimer.isPaused ? 'Paused' : 'Running...';
  }

  get formattedTime(): string {
    if (!this.activeTimer) return '00:00:00';
    return this.timerService.formatElapsedTime(this.activeTimer.elapsedSeconds);
  }

  get canStart(): boolean {
    return !this.timerService.hasActiveTimer && this.selectedProjectId !== '';
  }

  get canPause(): boolean {
    return this.timerService.isRunning;
  }

  get canResume(): boolean {
    return this.timerService.isPaused;
  }

  get canStop(): boolean {
    return this.timerService.hasActiveTimer;
  }
}
