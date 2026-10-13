import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// the app needs a login
export const authGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);

// /login is skipped if you are already logged in
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;

// add / edit popups are for admins only
export const adminGuard: CanActivateFn = () =>
  inject(AuthService).session()?.role === 'ADMIN' ? true : inject(Router).createUrlTree(['/books']);
