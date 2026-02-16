import { Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { DatabaseService } from '../../core/database/database.service';
import { BaseRepository } from './base-repository';
import { Project } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectRepository extends BaseRepository<Project> {
  private initialized = false;

  constructor(private dbService: DatabaseService) {
    super();
    this.setInitialization(this.init());
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    const db = await this.dbService.getDatabase();
    this.collection = db.projects;
    this.initialized = true;
  }

  /**
   * Find only active (non-archived) projects for a user
   */
  findActive$(userId: string): Observable<Project[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId,
            isArchived: false,
            _deleted: { $ne: true }
          } as any,
          sort: [{ name: 'asc' }] as any
        })
        .$ as Observable<Project[]>)
    );
  }

  /**
   * Find archived projects for a user
   */
  findArchived$(userId: string): Observable<Project[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId,
            isArchived: true,
            _deleted: { $ne: true }
          } as any,
          sort: [{ name: 'asc' }] as any
        })
        .$ as Observable<Project[]>)
    );
  }

  /**
   * Archive a project (soft archive, not delete)
   */
  async archive(id: string): Promise<void> {
    await this.update(id, { isArchived: true } as Partial<Project>);
  }

  /**
   * Unarchive a project
   */
  async unarchive(id: string): Promise<void> {
    await this.update(id, { isArchived: false } as Partial<Project>);
  }

  /**
   * Create a new project with default values
   */
  async createProject(
    name: string,
    userId: string,
    color: string = '#3880ff',
    icon?: string
  ): Promise<void> {
    await this.create({
      name,
      userId,
      color,
      icon,
      isArchived: false
    } as Partial<Project>);
  }
}
