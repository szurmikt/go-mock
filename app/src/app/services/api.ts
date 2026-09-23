import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiEnvironmentService } from './api-environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private get base(): string {
    return this.env.apiUrl();
  }

  constructor(private http: HttpClient, private env: ApiEnvironmentService) {}

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get<T>(`${this.base}/${path}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${path}`, body);
  }

  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.http.delete<T>(`${this.base}/${path}`, { body });
  }
}
