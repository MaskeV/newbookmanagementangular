import { Injectable, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Book } from '../models/book';
import { AuthService } from './auth.service';
import { BookService } from './book.service';

// One shared copy of the library, used by the Dashboard, the Books page and the add/edit popup.
// It is loaded once (one GET) and then updated locally after every add / edit / delete.
@Injectable({ providedIn: 'root' })
export class BookStore {
  private api = inject(BookService);
  private auth = inject(AuthService);

  readonly allBooks = signal<Book[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  // emits after every add / edit / delete so pages showing server-side results can refresh
  readonly changes = new Subject<void>();

  constructor() {
    // logged out (manually or by a 401) -> forget the data
    effect(() => {
      if (!this.auth.session()) this.reset();
    });
  }

  load(force = false) {
    if (this.loading() || (this.loaded() && !force)) return;
    this.loading.set(true);
    this.failed.set(false);
    this.api.getAll().subscribe({
      next: (list) => {
        this.allBooks.set(list);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  upsert(book: Book, isNew: boolean) {
    if (book.id === undefined || book.id === null) {
      this.load(true); // backend did not send an id back, so fall back to a full reload
    } else {
      this.allBooks.update((list) =>
        isNew ? [...list, book] : list.map((b) => (b.id === book.id ? book : b))
      );
    }
    this.changes.next();
  }

  remove(id: number | string) {
    this.allBooks.update((list) => list.filter((b) => b.id !== id));
    this.changes.next();
  }

  private reset() {
    this.allBooks.set([]);
    this.loaded.set(false);
    this.loading.set(false);
    this.failed.set(false);
  }
}
