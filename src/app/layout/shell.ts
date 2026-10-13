import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private auth = inject(AuthService);

  user = this.auth.session;
  isAdmin = computed(() => this.user()?.role === 'ADMIN');
  displayName = computed(() => this.user()?.name || this.user()?.email || 'User');
  initials = computed(() => {
    const parts = this.displayName().trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  });

  menuOpen = signal(false);
  private menu = viewChild<ElementRef<HTMLElement>>('menu');

  // close the user menu on outside click / Escape
  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(e: MouseEvent) {
    const el = this.menu()?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.menuOpen.set(false);
  }

  logout() {
    this.menuOpen.set(false);
    this.auth.logout();
  }
}
