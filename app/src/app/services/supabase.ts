import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client?: SupabaseClient;

  get db(): SupabaseClient {
    if (!this.client) {
      this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    }
    return this.client;
  }
}
