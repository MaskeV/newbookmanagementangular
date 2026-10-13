import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE } from '../api.config';
import { AuthService } from '../services/auth.service';

// Adds the JWT to protected requests and logs out on 401 (missing/expired token).
// Login/register calls are skipped so a wrong password doesn't trigger a logout.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(`${API_BASE}/auth/`)) return next(req);

  const auth = inject(AuthService);
  const token = auth.session()?.token;
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) auth.logout();
      return throwError(() => err);
    })
  );
};
