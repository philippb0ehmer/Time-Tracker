import { RxJsonSchema } from 'rxdb';
import { Project } from '../../shared/models/project.model';
import { TimeEntry } from '../../shared/models/time-entry.model';

export const PROJECT_SCHEMA: RxJsonSchema<Project> = {
  title: 'project schema',
  version: 0,
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: { type: 'string', maxLength: 36 },
    name: { type: 'string', maxLength: 200 },
    color: { type: 'string', maxLength: 32 },
    icon: { type: 'string', maxLength: 64 },
    isArchived: { type: 'boolean' },
    createdAt: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    updatedAt: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    userId: { type: 'string', maxLength: 128 },
    _deleted: { type: 'boolean' }
  },
  required: ['id', 'name', 'userId', 'createdAt', 'updatedAt', 'isArchived', 'color'],
  indexes: ['userId', 'updatedAt']
};

export const TIME_ENTRY_SCHEMA: RxJsonSchema<TimeEntry> = {
  title: 'time entry schema',
  version: 0,
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: { type: 'string', maxLength: 36 },
    projectId: { type: 'string', maxLength: 36 },
    description: { type: 'string', maxLength: 2000 },
    startTime: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    endTime: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    duration: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    isManual: { type: 'boolean' },
    createdAt: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    updatedAt: { type: 'number', multipleOf: 1, minimum: 0, maximum: 9007199254740991 },
    userId: { type: 'string', maxLength: 128 },
    _deleted: { type: 'boolean' }
  },
  required: ['id', 'projectId', 'description', 'startTime', 'userId', 'createdAt', 'updatedAt', 'isManual'],
  indexes: ['userId', 'projectId', 'startTime', 'updatedAt']
};
