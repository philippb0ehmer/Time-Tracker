import { Tab1Page } from './tab1.page';
import { of } from 'rxjs';

describe('Tab1Page', () => {
  let timerService: any;
  let projectRepo: jasmine.SpyObj<any>;
  let component: Tab1Page;

  beforeEach(() => {
    timerService = {
      activeTimer$: of(null),
      isRunning: false,
      startTimer: jasmine.createSpy('startTimer').and.resolveTo(),
      stopTimer: jasmine.createSpy('stopTimer').and.resolveTo(),
      formatElapsedTime: jasmine.createSpy('formatElapsedTime').and.returnValue('00:00:00'),
    };

    projectRepo = jasmine.createSpyObj('ProjectRepository', ['findActive$']);
    projectRepo.findActive$.and.returnValue(of([]));

    component = new Tab1Page(timerService, projectRepo);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
