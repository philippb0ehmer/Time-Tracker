import { from, Observable, switchMap } from 'rxjs';
import { RxCollection, RxDocument } from 'rxdb';

export abstract class BaseRepository<T> {
  protected initPromise: Promise<void> = Promise.resolve();

  constructor(protected collection: RxCollection<T> | null = null) {}

  protected setInitialization(initPromise: Promise<void>): void {
    this.initPromise = initPromise;
  }

  protected async ensureCollection(): Promise<RxCollection<T>> {
    await this.initPromise;
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }
    return this.collection;
  }

  /**
   * Find all documents for a user (returns observable for reactive updates)
   */
  findAll$(userId: string): Observable<T[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId,
            _deleted: { $ne: true }
          } as any,
          sort: [{ updatedAt: 'desc' }] as any
        })
        .$ as Observable<T[]>)
    );
  }

  /**
   * Find all documents for a user including soft-deleted rows.
   */
  findAllIncludingDeleted$(userId: string): Observable<T[]> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .find({
          selector: {
            userId: userId
          } as any,
          sort: [{ updatedAt: 'desc' }] as any
        })
        .$ as Observable<T[]>)
    );
  }

  /**
   * Find a single document by ID (returns observable)
   */
  findById$(id: string): Observable<T | null> {
    return from(this.ensureCollection()).pipe(
      switchMap((collection) => collection
        .findOne({
          selector: {
            id: id,
            _deleted: { $ne: true }
          } as any
        })
        .$ as Observable<T | null>)
    );
  }

  /**
   * Create a new document
   */
  async create(data: Partial<T>): Promise<RxDocument<T>> {
    const collection = await this.ensureCollection();

    const now = Date.now();
    const doc = await collection.insert({
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      _deleted: false
    } as any);

    return doc;
  }

  /**
   * Update an existing document
   */
  async update(id: string, data: Partial<T>): Promise<void> {
    const collection = await this.ensureCollection();

    const doc = await collection.findOne(id).exec();
    if (doc) {
      await doc.update({
        $set: {
          ...data,
          updatedAt: Date.now()
        }
      });
    }
  }

  /**
   * Soft delete a document (sets _deleted flag for sync)
   */
  async delete(id: string): Promise<void> {
    const collection = await this.ensureCollection();

    const doc = await collection.findOne(id).exec();
    if (doc) {
      await doc.update({
        $set: {
          _deleted: true,
          updatedAt: Date.now()
        }
      });
    }
  }

  /**
   * Hard delete a document (permanent removal)
   */
  async hardDelete(id: string): Promise<void> {
    const collection = await this.ensureCollection();

    const doc = await collection.findOne(id).exec();
    if (doc) {
      await doc.remove();
    }
  }

  /**
   * Upsert a document from cloud sync using source timestamps.
   */
  async upsertFromSync(data: T & { id: string }): Promise<void> {
    const collection = await this.ensureCollection();
    const doc = await collection.findOne(data.id).exec();

    if (doc) {
      const { id: _id, ...rest } = data as any;
      await doc.update({
        $set: rest
      });
      return;
    }

    await collection.insert(data as any);
  }

  /**
   * Generate UUID v4
   */
  protected generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
