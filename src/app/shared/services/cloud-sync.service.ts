import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, firstValueFrom } from 'rxjs';
import { Project } from '../models/project.model';
import { TimeEntry } from '../models/time-entry.model';
import { ProjectRepository } from '../repositories/project.repository';
import { TimeEntryRepository } from '../repositories/time-entry.repository';
import { SupabaseService } from './supabase.service';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface RemoteProjectRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_archived: boolean;
  created_at: number | string;
  updated_at: number | string;
  deleted: boolean;
}

interface RemoteTimeEntryRow {
  id: string;
  project_id: string;
  user_id: string;
  description: string;
  start_time: number | string;
  end_time: number | string | null;
  duration: number | string | null;
  is_manual: boolean;
  created_at: number | string;
  updated_at: number | string;
  deleted: boolean;
}

export interface CloudSyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type SyncMode = 'merge' | 'up' | 'down';

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private readonly cloudUserStorageKey = 'tt_cloud_user_id';
  private started = false;
  private authSubscription: Subscription | null = null;
  private syncTimerId: ReturnType<typeof setInterval> | null = null;
  private syncInProgress = false;

  private stateSubject = new BehaviorSubject<CloudSyncState>({
    status: 'idle',
    lastSyncedAt: null,
    lastError: null
  });
  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private projectRepo: ProjectRepository,
    private timeEntryRepo: TimeEntryRepository
  ) {}

  get state(): CloudSyncState {
    return this.stateSubject.value;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    this.supabaseService.start();
    this.authSubscription = this.supabaseService.user$.subscribe((user) => {
      this.stopPeriodicSync();
      if (!user) {
        this.stateSubject.next({
          ...this.stateSubject.value,
          status: 'idle'
        });
        return;
      }

      void this.syncNow();
      this.syncTimerId = setInterval(() => {
        void this.syncNow();
      }, this.supabaseService.syncIntervalMs);
    });
  }

  async syncNow(): Promise<void> {
    await this.syncInternal('merge');
  }

  async syncUpOverwriteCloud(): Promise<void> {
    await this.syncInternal('up');
  }

  async syncDownOverwriteDevice(): Promise<void> {
    await this.syncInternal('down');
  }

  private async syncInternal(mode: SyncMode): Promise<void> {
    if (this.syncInProgress || !this.supabaseService.isConfigured) return;
    const remoteUser = this.supabaseService.currentUser;
    if (!remoteUser) return;

    this.syncInProgress = true;
    this.stateSubject.next({
      ...this.stateSubject.value,
      status: 'syncing',
      lastError: null
    });

    try {
      const localUserId = this.supabaseService.localUserId;
      this.ensureCloudUserBinding(remoteUser.id);

      if (mode === 'up') {
        const [localProjectsAll, localEntriesAll] = await Promise.all([
          firstValueFrom(this.projectRepo.findAllIncludingDeleted$(localUserId)),
          firstValueFrom(this.timeEntryRepo.findAllIncludingDeleted$(localUserId))
        ]);

        const localProjects = localProjectsAll.filter((item) => item._deleted !== true);
        const localEntries = localEntriesAll.filter((item) => item._deleted !== true);

        await this.clearRemoteData(remoteUser.id);

        if (localProjects.length > 0) {
          await this.pushProjects(localProjects, remoteUser.id);
        }
        if (localEntries.length > 0) {
          await this.pushTimeEntries(localEntries, remoteUser.id);
        }

        this.stateSubject.next({
          status: 'idle',
          lastSyncedAt: Date.now(),
          lastError: null
        });
        return;
      }

      if (mode === 'down') {
        const [remoteProjectsAll, remoteEntriesAll] = await Promise.all([
          this.fetchRemoteProjects(remoteUser.id),
          this.fetchRemoteTimeEntries(remoteUser.id)
        ]);

        const remoteProjects = remoteProjectsAll.filter((item) => item._deleted !== true);
        const remoteProjectIds = new Set(remoteProjects.map((item) => item.id));
        const remoteEntries = remoteEntriesAll.filter(
          (item) => item._deleted !== true && remoteProjectIds.has(item.projectId)
        );

        await this.clearLocalData(localUserId);

        for (const project of remoteProjects) {
          await this.projectRepo.upsertFromSync(project);
        }
        for (const entry of remoteEntries) {
          await this.timeEntryRepo.upsertFromSync(entry);
        }

        this.stateSubject.next({
          status: 'idle',
          lastSyncedAt: Date.now(),
          lastError: null
        });
        return;
      }

      const [localProjects, localEntries, remoteProjects, remoteEntries] = await Promise.all([
        firstValueFrom(this.projectRepo.findAllIncludingDeleted$(localUserId)),
        firstValueFrom(this.timeEntryRepo.findAllIncludingDeleted$(localUserId)),
        this.fetchRemoteProjects(remoteUser.id),
        this.fetchRemoteTimeEntries(remoteUser.id)
      ]);

      const localProjectMap = new Map(localProjects.map((item) => [item.id, item]));
      const remoteProjectMap = new Map(remoteProjects.map((item) => [item.id, item]));

      const projectsToPush = localProjects.filter((local) => {
        const remote = remoteProjectMap.get(local.id);
        return !remote || local.updatedAt > remote.updatedAt;
      });
      const projectsToPull = remoteProjects.filter((remote) => {
        const local = localProjectMap.get(remote.id);
        return !local || remote.updatedAt > local.updatedAt;
      });

      if (projectsToPush.length > 0) {
        await this.pushProjects(projectsToPush, remoteUser.id);
      }
      for (const project of projectsToPull) {
        await this.projectRepo.upsertFromSync(project);
      }

      const localEntryMap = new Map(localEntries.map((item) => [item.id, item]));
      const remoteEntryMap = new Map(remoteEntries.map((item) => [item.id, item]));

      const entriesToPush = localEntries.filter((local) => {
        const remote = remoteEntryMap.get(local.id);
        return !remote || local.updatedAt > remote.updatedAt;
      });
      const entriesToPull = remoteEntries.filter((remote) => {
        const local = localEntryMap.get(remote.id);
        return !local || remote.updatedAt > local.updatedAt;
      });

      if (entriesToPush.length > 0) {
        await this.pushTimeEntries(entriesToPush, remoteUser.id);
      }
      for (const entry of entriesToPull) {
        await this.timeEntryRepo.upsertFromSync(entry);
      }

      this.stateSubject.next({
        status: 'idle',
        lastSyncedAt: Date.now(),
        lastError: null
      });
    } catch (error) {
      this.stateSubject.next({
        ...this.stateSubject.value,
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Sync failed'
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  private stopPeriodicSync(): void {
    if (this.syncTimerId) {
      clearInterval(this.syncTimerId);
      this.syncTimerId = null;
    }
  }

  private ensureCloudUserBinding(remoteUserId: string): void {
    const currentBinding = localStorage.getItem(this.cloudUserStorageKey);
    if (!currentBinding) {
      localStorage.setItem(this.cloudUserStorageKey, remoteUserId);
      return;
    }

    if (currentBinding !== remoteUserId) {
      throw new Error(
        'This device already has synced data for a different cloud account. ' +
        'Use one account per device/profile or clear local data before switching.'
      );
    }
  }

  private async clearLocalData(localUserId: string): Promise<void> {
    const [localEntries, localProjects] = await Promise.all([
      firstValueFrom(this.timeEntryRepo.findAllIncludingDeleted$(localUserId)),
      firstValueFrom(this.projectRepo.findAllIncludingDeleted$(localUserId))
    ]);

    for (const entry of localEntries) {
      await this.timeEntryRepo.hardDelete(entry.id);
    }

    for (const project of localProjects) {
      await this.projectRepo.hardDelete(project.id);
    }
  }

  private async clearRemoteData(remoteUserId: string): Promise<void> {
    const deleteEntries = await this.supabaseService.supabase
      .from('time_entries')
      .delete()
      .eq('user_id', remoteUserId);
    if (deleteEntries.error) {
      throw new Error(`Failed to clear remote entries: ${deleteEntries.error.message}`);
    }

    const deleteProjects = await this.supabaseService.supabase
      .from('projects')
      .delete()
      .eq('user_id', remoteUserId);
    if (deleteProjects.error) {
      throw new Error(`Failed to clear remote projects: ${deleteProjects.error.message}`);
    }
  }

  private async fetchRemoteProjects(remoteUserId: string): Promise<Project[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('projects')
      .select('*')
      .eq('user_id', remoteUserId);

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return (data || []).map((row) => this.fromRemoteProject(row as RemoteProjectRow));
  }

  private async fetchRemoteTimeEntries(remoteUserId: string): Promise<TimeEntry[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', remoteUserId);

    if (error) {
      throw new Error(`Failed to fetch time entries: ${error.message}`);
    }

    return (data || []).map((row) => this.fromRemoteTimeEntry(row as RemoteTimeEntryRow));
  }

  private async pushProjects(projects: Project[], remoteUserId: string): Promise<void> {
    const payload = projects.map((project) => this.toRemoteProject(project, remoteUserId));
    const { error } = await this.supabaseService.supabase
      .from('projects')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to upload projects: ${error.message}`);
    }
  }

  private async pushTimeEntries(entries: TimeEntry[], remoteUserId: string): Promise<void> {
    const payload = entries.map((entry) => this.toRemoteTimeEntry(entry, remoteUserId));
    const { error } = await this.supabaseService.supabase
      .from('time_entries')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to upload time entries: ${error.message}`);
    }
  }

  private fromRemoteProject(row: RemoteProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon || undefined,
      isArchived: Boolean(row.is_archived),
      createdAt: this.toNumber(row.created_at),
      updatedAt: this.toNumber(row.updated_at),
      userId: this.supabaseService.localUserId,
      _deleted: Boolean(row.deleted)
    };
  }

  private toRemoteProject(project: Project, remoteUserId: string): RemoteProjectRow {
    return {
      id: project.id,
      user_id: remoteUserId,
      name: project.name,
      color: project.color,
      icon: project.icon || null,
      is_archived: project.isArchived,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
      deleted: project._deleted === true
    };
  }

  private fromRemoteTimeEntry(row: RemoteTimeEntryRow): TimeEntry {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: this.supabaseService.localUserId,
      description: row.description || '',
      startTime: this.toNumber(row.start_time),
      endTime: row.end_time == null ? undefined : this.toNumber(row.end_time),
      duration: row.duration == null ? undefined : this.toNumber(row.duration),
      isManual: Boolean(row.is_manual),
      createdAt: this.toNumber(row.created_at),
      updatedAt: this.toNumber(row.updated_at),
      _deleted: Boolean(row.deleted)
    };
  }

  private toRemoteTimeEntry(entry: TimeEntry, remoteUserId: string): RemoteTimeEntryRow {
    return {
      id: entry.id,
      project_id: entry.projectId,
      user_id: remoteUserId,
      description: entry.description,
      start_time: entry.startTime,
      end_time: entry.endTime ?? null,
      duration: entry.duration ?? null,
      is_manual: entry.isManual,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      deleted: entry._deleted === true
    };
  }

  private toNumber(value: number | string): number {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
