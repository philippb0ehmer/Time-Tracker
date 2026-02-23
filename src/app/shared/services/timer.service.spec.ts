import { TimerService } from './timer.service';

describe('TimerService', () => {
  let repo: jasmine.SpyObj<any>;
  let service: TimerService;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-01-01T00:00:00.000Z'));
    localStorage.removeItem('activeTimer');

    repo = jasmine.createSpyObj('TimeEntryRepository', ['createEntry', 'stopTimer']);
    service = new TimerService(repo);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
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

    expect(repo.stopTimer).toHaveBeenCalledWith('entry-1', jasmine.any(Number));
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

    expect(repo.stopTimer).toHaveBeenCalledWith('entry-1', jasmine.any(Number));
    expect(service.activeTimer?.projectId).toBe('project-2');
  });

  it('pauses and resumes without counting paused time', async () => {
    repo.createEntry.and.resolveTo({ id: 'entry-1' });
    repo.stopTimer.and.resolveTo();

    await service.startTimer('project-1', '', 'demo-user-1');

    jasmine.clock().tick(5000);
    service.pauseTimer();
    expect(service.isPaused).toBeTrue();
    expect(service.activeTimer?.elapsedSeconds).toBe(5);

    jasmine.clock().tick(3000);
    expect(service.activeTimer?.elapsedSeconds).toBe(5);

    service.resumeTimer();
    expect(service.isRunning).toBeTrue();

    jasmine.clock().tick(2000);
    await service.stopTimer('demo-user-1');

    expect(repo.stopTimer).toHaveBeenCalledWith('entry-1', 7);
  });
});
