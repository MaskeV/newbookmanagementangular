import { Routes } from '@angular/router';
import { AuthPage } from './auth-page/auth-page';
import { BookDialog } from './book-dialog/book-dialog';
import { BookManager } from './book-manager/book-manager';
import { Dashboard } from './dashboard/dashboard';
import { adminGuard, authGuard, guestGuard } from './guards/auth.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', component: AuthPage, canActivate: [guestGuard] },
  {
    // everything inside the navbar layout needs a login
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      {
        path: 'books',
        component: BookManager,
        children: [
          // these open the add / edit popup on top of the books table
          { path: 'new', component: BookDialog, canActivate: [adminGuard] },
          { path: ':id/edit', component: BookDialog, canActivate: [adminGuard] },
        ],
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
