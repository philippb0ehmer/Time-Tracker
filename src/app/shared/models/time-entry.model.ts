export interface TimeEntry {
  id: string;                    // UUID
  projectId: string;             // Foreign key
  description: string;
  startTime: number;             // Timestamp
  endTime?: number;              // Timestamp (null for active timer)
  duration?: number;             // Calculated in seconds
  isManual: boolean;             // Manual vs timer entry
  createdAt: number;
  updatedAt: number;
  userId: string;

  // Sync metadata
  _deleted?: boolean;
}
