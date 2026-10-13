import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { API_BASE } from '../api.config';
import { Session } from '../models/book';

const KEY = 'bookmgmt_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly session = signal<Session | null>(this.readSession());
  readonly isLoggedIn = computed(() => !!this.session()?.token);

  login(body: { email: string; password: string }): Observable<Session> {
    return this.authRequest('login', body);
  }

  register(body: { name: string; email: string; password: string }): Observable<Session> {
    return this.authRequest('register', body);
  }

  logout(): void {
    localStorage.removeItem(KEY);
    this.session.set(null);
    this.router.navigate(['/login']);
  }

  // POST to /api/auth/<path>. Errors are turned into Error(message) like the React version.
  private authRequest(path: string, body: object): Observable<Session> {
    return this.http.post<Session>(`${API_BASE}/auth/${path}`, body).pipe(
      tap((session) => {
        localStorage.setItem(KEY, JSON.stringify(session));
        this.session.set(session);
      }),
      catchError((err: HttpErrorResponse) => throwError(() => new Error(this.messageFrom(err))))
    );
  }

  private messageFrom(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Cannot reach the server. Is the backend running?';
    const body = err.error;
    const message = typeof body === 'string' ? body : body?.message;
    return message || 'Something went wrong. Please try again.';
  }

  private readSession(): Session | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      return null;
    }
  }
}
