import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';

type Mode = 'login' | 'signup';
interface AuthForm {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
})
export class AuthPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<Mode>('login');
  form = signal<AuthForm>({ name: '', email: '', password: '', confirm: '' });
  showPassword = signal(false);
  error = signal('');
  loading = signal(false);

  isSignup = computed(() => this.mode() === 'signup');

  switchMode(next: Mode) {
    this.mode.set(next);
    this.error.set('');
  }

  change(field: keyof AuthForm, value: string) {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  submit() {
    this.error.set('');
    const f = this.form();

    if (this.isSignup()) {
      if (f.password.length < 6) return this.error.set('Password must be at least 6 characters.');
      if (f.password !== f.confirm) return this.error.set('Passwords do not match.');
    }

    this.loading.set(true);
    const request = this.isSignup()
      ? this.auth.register({ name: f.name, email: f.email, password: f.password })
      : this.auth.login({ email: f.email, password: f.password });

    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => this.router.navigate(['/dashboard']), // session is saved by AuthService
      error: (err: Error) => this.error.set(err.message),
    });
  }
}
