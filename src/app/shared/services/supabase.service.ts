import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseClient, User, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private initialized = false;
  private userSubject = new BehaviorSubject<User | null>(null);

  readonly user$ = this.userSubject.asObservable();

  get isConfigured(): boolean {
    const cfg = environment.supabase;
    return Boolean(
      cfg?.url &&
      cfg?.anonKey &&
      !cfg.url.includes('YOUR_SUPABASE_URL') &&
      !cfg.anonKey.includes('YOUR_SUPABASE_ANON_KEY')
    );
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  get localUserId(): string {
    return environment.supabase?.localUserId || 'demo-user-1';
  }

  get syncIntervalMs(): number {
    return environment.supabase?.syncIntervalMs || 30000;
  }

  get supabase(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not configured.');
    }
    return this.client;
  }

  constructor() {
    this.start();
  }

  start(): void {
    if (this.initialized || !this.isConfigured) return;

    const cfg = environment.supabase!;
    this.client = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    this.initialized = true;

    void this.client.auth.getSession().then(({ data }) => {
      this.userSubject.next(data.session?.user ?? null);
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.userSubject.next(session?.user ?? null);
    });
  }

  async signInWithMagicLink(email: string): Promise<string | null> {
    if (!this.isConfigured) {
      return 'Supabase is not configured. Add URL and anon key in environment files.';
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return 'Please enter an email address.';
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await this.supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    return error?.message || null;
  }

  async signInWithPassword(email: string, password: string): Promise<string | null> {
    if (!this.isConfigured) {
      return 'Supabase is not configured. Add URL and anon key in environment files.';
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return 'Please enter email and password.';
    }

    const { error } = await this.supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    return error?.message || null;
  }

  async signUpWithPassword(email: string, password: string): Promise<string | null> {
    if (!this.isConfigured) {
      return 'Supabase is not configured. Add URL and anon key in environment files.';
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return 'Please enter email and password.';
    }

    const { error } = await this.supabase.auth.signUp({
      email: normalizedEmail,
      password
    });

    return error?.message || null;
  }

  async signOut(): Promise<string | null> {
    if (!this.client) return null;
    const { error } = await this.client.auth.signOut();
    return error?.message || null;
  }
}
