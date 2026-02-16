import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { ProjectRepository } from '../shared/repositories/project.repository';
import { TimeEntryRepository } from '../shared/repositories/time-entry.repository';
import { Project } from '../shared/models/project.model';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private userId = 'demo-user-1'; // Temporary

  projects: Project[] = [];
  archivedProjects: Project[] = [];
  showArchived = false;

  // Predefined colors for projects
  colors = [
    { name: 'Blue', value: '#3880ff' },
    { name: 'Green', value: '#2dd36f' },
    { name: 'Red', value: '#eb445a' },
    { name: 'Orange', value: '#ffc409' },
    { name: 'Purple', value: '#9d4edd' },
    { name: 'Pink', value: '#f72585' },
    { name: 'Teal', value: '#06d6a0' },
    { name: 'Indigo', value: '#4361ee' }
  ];

  private normalizeHexColor(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    const trimmed = value.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : fallback;
  }

  private pickHexColor(initial: string): Promise<string> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = this.normalizeHexColor(initial, '#3880ff');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);

      let finished = false;
      const complete = (value: string) => {
        if (finished) return;
        finished = true;
        resolve(this.normalizeHexColor(value, initial));
        input.remove();
      };

      input.addEventListener('input', () => complete(input.value), { once: true });
      input.addEventListener('change', () => complete(input.value), { once: true });
      input.addEventListener('blur', () => complete(initial), { once: true });
      input.click();
    });
  }

  constructor(
    private projectRepo: ProjectRepository,
    private timeEntryRepo: TimeEntryRepository,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadProjects();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProjects() {
    // Load active projects
    this.projectRepo.findActive$(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(projects => {
        this.projects = projects;
      });

    // Load archived projects
    this.projectRepo.findArchived$(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(archived => {
        this.archivedProjects = archived;
      });
  }

  async createProject() {
    const pickedColor = await this.pickHexColor(this.colors[0].value);
    const alert = await this.alertController.create({
      header: 'New Project',
      message: 'Color picked. You can adjust the hex code below.',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Project name'
        },
        {
          name: 'colorHex',
          type: 'text',
          value: pickedColor,
          placeholder: '#3880ff'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Create',
          handler: async (data) => {
            if (data.name && data.name.trim()) {
              await this.projectRepo.createProject(
                data.name.trim(),
                this.userId,
                this.normalizeHexColor(data.colorHex, pickedColor)
              );
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async editProject(project: Project) {
    const pickedColor = await this.pickHexColor(project.color);
    const alert = await this.alertController.create({
      header: 'Edit Project',
      message: 'Color picked. You can adjust the hex code below.',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: project.name,
          placeholder: 'Project name'
        },
        {
          name: 'colorHex',
          type: 'text',
          value: pickedColor,
          placeholder: '#3880ff'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: async (data) => {
            if (data.name && data.name.trim()) {
              await this.projectRepo.update(project.id, {
                name: data.name.trim(),
                color: this.normalizeHexColor(data.colorHex, pickedColor)
              } as Partial<Project>);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async archiveProject(project: Project) {
    const alert = await this.alertController.create({
      header: 'Archive Project',
      message: `Are you sure you want to archive "${project.name}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Archive',
          handler: async () => {
            await this.projectRepo.archive(project.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async unarchiveProject(project: Project) {
    await this.projectRepo.unarchive(project.id);
  }

  async deleteProject(project: Project) {
    const alert = await this.alertController.create({
      header: 'Delete Project',
      message: `Delete "${project.name}" and all of its time entries? This cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.timeEntryRepo.deleteByProject(project.id, this.userId);
            await this.projectRepo.delete(project.id);
          }
        }
      ]
    });

    await alert.present();
  }

  toggleArchived() {
    this.showArchived = !this.showArchived;
  }
}
