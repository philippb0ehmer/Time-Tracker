import { Tab2Page } from './tab2.page';
import { of } from 'rxjs';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let projectRepo: jasmine.SpyObj<any>;
  let timeEntryRepo: jasmine.SpyObj<any>;
  let alertController: jasmine.SpyObj<any>;

  beforeEach(() => {
    projectRepo = jasmine.createSpyObj('ProjectRepository', [
      'findActive$',
      'findArchived$',
      'createProject',
      'update',
      'archive',
      'unarchive',
      'delete',
    ]);
    projectRepo.findActive$.and.returnValue(of([]));
    projectRepo.findArchived$.and.returnValue(of([]));
    projectRepo.createProject.and.resolveTo();

    timeEntryRepo = jasmine.createSpyObj('TimeEntryRepository', ['deleteByProject']);
    timeEntryRepo.deleteByProject.and.resolveTo(0);

    alertController = jasmine.createSpyObj('AlertController', ['create']);

    component = new Tab2Page(projectRepo, timeEntryRepo, alertController);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds a project from the create-project dialog', async () => {
    let capturedOptions: any;
    const alert = {
      present: jasmine.createSpy('present').and.resolveTo(),
    };
    alertController.create.and.callFake(async (options: any) => {
      capturedOptions = options;
      return alert;
    });

    await component.createProject();

    expect(alertController.create).toHaveBeenCalled();
    expect(alert.present).toHaveBeenCalled();

    const createButton = capturedOptions.buttons.find((b: any) => b.text === 'Create');
    await createButton.handler({ name: 'Deep Work', color: '#3880ff' });

    expect(projectRepo.createProject).toHaveBeenCalledWith(
      'Deep Work',
      'demo-user-1',
      '#3880ff'
    );
  });

  it('deletes project and associated entries after confirmation', async () => {
    let capturedOptions: any;
    const alert = {
      present: jasmine.createSpy('present').and.resolveTo(),
    };
    alertController.create.and.callFake(async (options: any) => {
      capturedOptions = options;
      return alert;
    });

    await component.deleteProject({
      id: 'p1',
      name: 'Project Alpha',
      color: '#3880ff',
      isArchived: false,
      createdAt: 1,
      updatedAt: 1,
      userId: 'demo-user-1',
    });

    const deleteButton = capturedOptions.buttons.find((b: any) => b.text === 'Delete');
    await deleteButton.handler();

    expect(timeEntryRepo.deleteByProject).toHaveBeenCalledWith('p1', 'demo-user-1');
    expect(projectRepo.delete).toHaveBeenCalledWith('p1');
  });
});
