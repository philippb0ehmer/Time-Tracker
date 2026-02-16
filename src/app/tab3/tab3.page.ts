import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { Project } from '../shared/models/project.model';
import { TimeEntry } from '../shared/models/time-entry.model';
import { ProjectRepository } from '../shared/repositories/project.repository';
import { TimeEntryRepository } from '../shared/repositories/time-entry.repository';

interface WeeklyProjectSummary {
  projectId: string;
  projectName: string;
  projectColor: string;
  totalSeconds: number;
  entryCount: number;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit, OnDestroy {
  private readonly userId = 'demo-user-1';
  private readonly projectGoalStorageKey = 'weeklyProjectGoals';
  private reportsSub: Subscription | null = null;
  private projectGoals: Record<string, number> = {};

  weekOffset = 0;
  weekLabel = '';
  weekDateLabel = '';
  totalWeekSeconds = 0;
  totalGoalSeconds = 0;
  projectSummaries: WeeklyProjectSummary[] = [];

  constructor(
    private timeEntryRepo: TimeEntryRepository,
    private projectRepo: ProjectRepository
  ) {}

  ngOnInit(): void {
    this.projectGoals = this.loadProjectGoals();
    this.refreshWeekData();
  }

  ngOnDestroy(): void {
    this.reportsSub?.unsubscribe();
  }

  previousWeek(): void {
    this.weekOffset += 1;
    this.refreshWeekData();
  }

  nextWeek(): void {
    if (this.weekOffset === 0) return;
    this.weekOffset -= 1;
    this.refreshWeekData();
  }

  onProjectGoalChange(projectId: string, value: number | string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    this.projectGoals[projectId] = parsed;
    this.saveProjectGoals();
    this.recalculateTotalGoalSeconds();
  }

  get overallProgressPercent(): number {
    if (this.totalGoalSeconds <= 0) return 0;
    return Math.min((this.totalWeekSeconds / this.totalGoalSeconds) * 100, 100);
  }

  get overallProgressLabel(): string {
    if (this.totalGoalSeconds <= 0) {
      return `${this.formatDuration(this.totalWeekSeconds)} tracked, no goals set`;
    }

    return `${this.formatDuration(this.totalWeekSeconds)} / ${this.formatDuration(this.totalGoalSeconds)} goal`;
  }

  get hasProjects(): boolean {
    return this.projectSummaries.length > 0;
  }

  formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  projectGoalHours(projectId: string): number {
    return this.projectGoals[projectId] ?? 0;
  }

  projectGoalPercent(item: WeeklyProjectSummary): number {
    const goalSeconds = this.projectGoalHours(item.projectId) * 3600;
    if (goalSeconds <= 0) return 0;
    return Math.min((item.totalSeconds / goalSeconds) * 100, 100);
  }

  projectGoalLabel(item: WeeklyProjectSummary): string {
    const goalHours = this.projectGoalHours(item.projectId);
    if (goalHours <= 0) {
      return `${this.formatDuration(item.totalSeconds)} / no goal`;
    }

    return `${this.formatDuration(item.totalSeconds)} / ${goalHours}h`;
  }

  private loadProjectGoals(): Record<string, number> {
    const raw = localStorage.getItem(this.projectGoalStorageKey);
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      return Object.entries(parsed).reduce((acc, [key, value]) => {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, number>);
    } catch {
      return {};
    }
  }

  private saveProjectGoals(): void {
    localStorage.setItem(this.projectGoalStorageKey, JSON.stringify(this.projectGoals));
  }

  private refreshWeekData(): void {
    const { weekStart, weekEnd, weekLabel, weekDateLabel } = this.getWeekRange(this.weekOffset);
    this.weekLabel = weekLabel;
    this.weekDateLabel = weekDateLabel;

    this.reportsSub?.unsubscribe();
    this.reportsSub = combineLatest([
      this.timeEntryRepo.findByDateRange$(this.userId, weekStart, weekEnd),
      this.projectRepo.findActive$(this.userId),
    ]).subscribe(([entries, projects]) => {
      this.buildSummary(entries, projects);
    });
  }

  private buildSummary(entries: TimeEntry[], projects: Project[]): void {
    const projectMap = new Map(projects.map((p) => [p.id, p] as const));
    const summaryMap = new Map<string, WeeklyProjectSummary>();
    this.totalWeekSeconds = 0;

    for (const project of projects) {
      summaryMap.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
        totalSeconds: 0,
        entryCount: 0,
      });
    }

    for (const entry of entries) {
      const duration = this.resolveDurationSeconds(entry);
      if (duration <= 0) continue;

      const project = projectMap.get(entry.projectId);
      const current = summaryMap.get(entry.projectId);

      if (current) {
        current.totalSeconds += duration;
        current.entryCount += 1;
      } else {
        summaryMap.set(entry.projectId, {
          projectId: entry.projectId,
          projectName: project?.name || 'Unknown Project',
          projectColor: project?.color || '#9e9e9e',
          totalSeconds: duration,
          entryCount: 1,
        });
      }

      this.totalWeekSeconds += duration;
    }

    this.projectSummaries = Array.from(summaryMap.values()).sort(
      (a, b) => (b.totalSeconds - a.totalSeconds) || a.projectName.localeCompare(b.projectName)
    );
    this.recalculateTotalGoalSeconds();
  }

  private recalculateTotalGoalSeconds(): void {
    this.totalGoalSeconds = this.projectSummaries.reduce((sum, item) => {
      return sum + (this.projectGoalHours(item.projectId) * 3600);
    }, 0);
  }

  private resolveDurationSeconds(entry: TimeEntry): number {
    if (typeof entry.duration === 'number' && entry.duration > 0) {
      return entry.duration;
    }

    if (!entry.endTime) {
      return Math.max(0, Math.floor((Date.now() - entry.startTime) / 1000));
    }

    return Math.max(0, Math.floor((entry.endTime - entry.startTime) / 1000));
  }

  private getWeekRange(offset: number): {
    weekStart: number;
    weekEnd: number;
    weekLabel: string;
    weekDateLabel: string;
  } {
    const today = new Date();
    const start = new Date(today);
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + mondayOffset - (offset * 7));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const weekLabel = offset === 0 ? 'This Week' : `${offset} Week${offset > 1 ? 's' : ''} Ago`;
    const weekDateLabel = `${formatter.format(start)} - ${formatter.format(end)}`;

    return {
      weekStart: start.getTime(),
      weekEnd: end.getTime(),
      weekLabel,
      weekDateLabel,
    };
  }

}
