import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private readonly versionStorageKey = 'tt_deployed_version';
  buildLabel = 'Build dev-local';

  constructor() {
    this.checkForNewDeployment();
  }

  private async checkForNewDeployment(): Promise<void> {
    try {
      const response = await fetch(`assets/version.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const payload = await response.json() as {
        version?: string;
        sha?: string;
        runNumber?: string;
        builtAt?: string;
      };

      const version = payload.version || `${payload.sha || 'unknown'}-${payload.runNumber || '0'}-${payload.builtAt || '0'}`;
      const shortSha = (payload.sha || '').slice(0, 7);
      this.buildLabel = payload.runNumber
        ? `Build #${payload.runNumber}${shortSha ? ` (${shortSha})` : ''}`
        : `Build ${version}`;
      const previousVersion = localStorage.getItem(this.versionStorageKey);

      if (previousVersion && previousVersion !== version) {
        localStorage.setItem(this.versionStorageKey, version);
        window.location.reload();
        return;
      }

      if (!previousVersion) {
        localStorage.setItem(this.versionStorageKey, version);
      }
    } catch {
      // Ignore version check errors to avoid blocking app startup.
    }
  }
}
