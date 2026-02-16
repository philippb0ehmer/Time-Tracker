import { TimerService } from './timer.service';

describe('TimerService', () => {
  let repo: jasmine.SpyObj<any>;
  let service: TimerService;

  beforeEach(() => {
    localStorage.removeItem('activeTimer');

    repo = jasmine.createSpyObj('TimeEntryRepository', ['createEntry', 'stopTimer']);
    service = new TimerService(repo);
  });

  it('tracks time by creating an entry when a timer starts', async () => {
    repo.createEntry.and.resolveTo({ id: 'entry-1' });

    await service.startTimer('project-1', 'Focus block', 'demo-user-1');

    expect(repo.createEntry).toHaveBeenCalledWith(
      'project-1',
      'demo-user-1',
      'Focus block',
      false,
      jasmine.any(Number)
    );
    expect(service.isRunning).toBeTrue();
    expect(service.activeTimer?.projectId).toBe('project-1');
  });

  it('stops and persists tracked timer state', async () => {
    repo.createEntry.and.resolveTo({ id: 'entry-1' });
    repo.stopTimer.and.resolveTo();

    await service.startTimer('project-1', '', 'demo-user-1');
    expect(localStorage.getItem('activeTimer')).toContain('entry-1');

    await service.stopTimer('demo-user-1');

    expect(repo.stopTimer).toHaveBeenCalledWith('entry-1');
    expect(service.isRunning).toBeFalse();
    expect(localStorage.getItem('activeTimer')).toBeNull();
  });

  it('stops the existing timer before starting a new one', async () => {
    let callCount = 0;
    repo.createEntry.and.callFake(async () => {
      callCount += 1;
      return { id: callCount === 1 ? 'entry-1' : 'entry-2' };
    });
    repo.stopTimer.and.resolveTo();

    await service.startTimer('project-1', '', 'demo-user-1');
    await service.startTimer('project-2', '', 'demo-user-1');

    expect(repo.stopTimer).toHaveBeenCalledWith('entry-1');
    expect(service.activeTimer?.projectId).toBe('project-2');
  });
});
