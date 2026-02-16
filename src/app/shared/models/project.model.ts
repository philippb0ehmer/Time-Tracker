export interface Project {
  id: string;                    // UUID
  name: string;
  color: string;                 // Hex color for UI
  icon?: string;                 // Optional icon name
  isArchived: boolean;
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  userId: string;                // Owner reference

  // Sync metadata
  _deleted?: boolean;            // Soft delete for sync
}
