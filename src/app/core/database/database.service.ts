import { Injectable } from '@angular/core';
import { createRxDatabase, RxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { PROJECT_SCHEMA, TIME_ENTRY_SCHEMA } from './collections';
import { environment } from '../../../environments/environment';
import { Project } from '../../shared/models/project.model';
import { TimeEntry } from '../../shared/models/time-entry.model';

export type TimeTrackerDatabase = RxDatabase<{
  projects: any;
  time_entries: any;
}>;

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private db: TimeTrackerDatabase | null = null;
  private initPromise: Promise<TimeTrackerDatabase> | null = null;

  constructor() {
    // Add RxDB plugins
    if (!environment.production) {
      addRxPlugin(RxDBDevModePlugin);
    }
    addRxPlugin(RxDBUpdatePlugin);
    addRxPlugin(RxDBQueryBuilderPlugin);
  }

  async getDatabase(): Promise<TimeTrackerDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeDatabase();
    this.db = await this.initPromise;
    return this.db;
  }

  private async initializeDatabase(): Promise<TimeTrackerDatabase> {
    const dbName = 'timetracker';

    // Use Dexie (IndexedDB) storage wrapped with AJV validator for dev mode
    const storage = wrappedValidateAjvStorage({
      storage: getRxStorageDexie()
    });

    const db = await createRxDatabase<TimeTrackerDatabase>({
      name: dbName,
      storage: storage,
      multiInstance: false,
      ignoreDuplicate: true
    });

    // Create collections
    await db.addCollections({
      projects: { schema: PROJECT_SCHEMA },
      time_entries: { schema: TIME_ENTRY_SCHEMA }
    });

    console.log('RxDB initialized with collections:', Object.keys(db.collections));
    return db;
  }

  async destroyDatabase(): Promise<void> {
    if (this.db) {
      await this.db.remove();
      this.db = null;
      this.initPromise = null;
    }
  }
}
