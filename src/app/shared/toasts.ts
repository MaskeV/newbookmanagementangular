import { Component, inject } from '@angular/core';
import { Icon } from './icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.error]="t.type === 'error'" role="status">
          <app-icon [name]="t.type === 'error' ? 'alert' : 'checkCircle'" [size]="18" />
          <span>{{ t.message }}</span>
          <button type="button" class="icon-btn" aria-label="Dismiss" (click)="toast.dismiss(t.id)">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 20px; bottom: 20px; z-index: 200; display: flex; flex-direction: column; gap: 10px; }
    .toast { display: flex; align-items: center; gap: 10px; min-width: 260px; max-width: 380px; padding: 12px 8px 12px 14px;
      background: #0f172a; color: #fff; border-radius: 12px; box-shadow: var(--shadow-lg); animation: slide .2s ease-out;
      border-left: 4px solid #22c55e; }
    .toast.error { border-left-color: #ef4444; }
    .toast span { flex: 1; font-weight: 500; }
    .toast .icon-btn { color: #94a3b8; width: 26px; height: 26px; }
    .toast .icon-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
    @keyframes slide { from { opacity: 0; transform: translateX(16px); } }
    @media (max-width: 480px) { .toasts { left: 12px; right: 12px; bottom: 12px; } .toast { max-width: none; } }
  `,
})
export class Toasts {
  toast = inject(ToastService);
}
