import { Tab3Page } from './tab3.page';
import { BehaviorSubject } from 'rxjs';
import { Project } from '../shared/models/project.model';
import { TimeEntry } from '../shared/models/time-entry.model';

describe('Tab3Page', () => {
  const project1: Project = {
    id: 'p1',
    name: 'Project Alpha',
    color: '#3880ff',
    isArchived: false,
    createdAt: 1,
    updatedAt: 1,
    userId: 'demo-user-1',
  };
  const project2: Project = {
    id: 'p2',
    name: 'Project Beta',
    color: '#2dd36f',
    isArchived: false,
    createdAt: 1,
    updatedAt: 1,
    userId: 'demo-user-1',
  };

  let entries$: BehaviorSubject<TimeEntry[]>;
  let projects$: BehaviorSubject<Project[]>;
  let timeEntryRepo: jasmine.SpyObj<any>;
  let projectRepo: jasmine.SpyObj<any>;
  let component: Tab3Page;

  beforeEach(() => {
    localStorage.removeItem('weeklyProjectGoals');

    entries$ = new BehaviorSubject<TimeEntry[]>([]);
    projects$ = new BehaviorSubject<Project[]>([project1, project2]);

    timeEntryRepo = jasmine.createSpyObj('TimeEntryRepository', ['findByDateRange$']);
    projectRepo = jasmine.createSpyObj('ProjectRepository', ['findActive$']);

    timeEntryRepo.findByDateRange$.and.returnValue(entries$.asObservable());
    projectRepo.findActive$.and.returnValue(projects$.asObservable());

    component = new Tab3Page(timeEntryRepo, projectRepo);
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('changes weekly goal per project and persists it', () => {
    component.onProjectGoalChange('p1', 6.5);

    expect(component.projectGoalHours('p1')).toBe(6.5);
    expect(JSON.parse(localStorage.getItem('weeklyProjectGoals') || '{}')).toEqual({
      p1: 6.5,
    });
  });

  it('attributes tracked time to the correct project in weekly summaries', () => {
    entries$.next([
      {
        id: 'e1',
        projectId: 'p1',
        description: '',
        startTime: 1,
        endTime: 3600001,
        duration: 3600,
        isManual: false,
        createdAt: 1,
        updatedAt: 1,
        userId: 'demo-user-1',
      },
      {
        id: 'e2',
        projectId: 'p2',
        description: '',
        startTime: 1,
        endTime: 1800001,
        duration: 1800,
        isManual: false,
        createdAt: 1,
        updatedAt: 1,
        userId: 'demo-user-1',
      },
    ]);

    const p1 = component.projectSummaries.find((s) => s.projectId === 'p1');
    const p2 = component.projectSummaries.find((s) => s.projectId === 'p2');

    expect(p1?.totalSeconds).toBe(3600);
    expect(p2?.totalSeconds).toBe(1800);
    expect(component.totalWeekSeconds).toBe(5400);
  });
});
