import { PROJECT_SCHEMA, TIME_ENTRY_SCHEMA } from './collections';

describe('RxDB collection schemas', () => {
  it('enforces required constraints for indexed project fields', () => {
    const userId = PROJECT_SCHEMA.properties.userId as any;
    const updatedAt = PROJECT_SCHEMA.properties.updatedAt as any;

    expect(userId.maxLength).toBeGreaterThan(0);
    expect(updatedAt.multipleOf).toBe(1);
    expect(updatedAt.minimum).toBe(0);
    expect(updatedAt.maximum).toBeGreaterThan(updatedAt.minimum);
  });

  it('enforces required constraints for indexed time-entry fields', () => {
    const userId = TIME_ENTRY_SCHEMA.properties.userId as any;
    const projectId = TIME_ENTRY_SCHEMA.properties.projectId as any;
    const startTime = TIME_ENTRY_SCHEMA.properties.startTime as any;
    const updatedAt = TIME_ENTRY_SCHEMA.properties.updatedAt as any;

    expect(userId.maxLength).toBeGreaterThan(0);
    expect(projectId.maxLength).toBeGreaterThan(0);
    expect(startTime.multipleOf).toBe(1);
    expect(startTime.minimum).toBe(0);
    expect(updatedAt.multipleOf).toBe(1);
    expect(updatedAt.minimum).toBe(0);
  });
});
