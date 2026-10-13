import { HttpErrorResponse } from '@angular/common/http';
import {
  Component, DestroyRef, ElementRef, HostListener, afterNextRender, computed, effect, inject,
  input, signal, untracked, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Book } from '../models/book';
import { BookService } from '../services/book.service';
import { BookStore } from '../services/book.store';
import { Icon } from '../shared/icon';
import { ToastService } from '../shared/toast.service';

interface FormField {
  name: 'title' | 'author' | 'category' | 'publisher' | 'publicationYear' | 'language' | 'quantity' | 'description';
  label: string;
  type?: 'number' | 'textarea';
  wide?: boolean;
  required?: boolean;
}

const emptyForm = (): Book => ({ available: true });

// Opens as a popup on /books/new (add) and /books/:id/edit (edit)
@Component({
  selector: 'app-book-dialog',
  imports: [FormsModule, Icon],
  templateUrl: './book-dialog.html',
  styleUrl: './book-dialog.css',
})
export class BookDialog {
  private router = inject(Router);
  private store = inject(BookStore);
  private bookService = inject(BookService);
  private toast = inject(ToastService);

  // :id from the URL (only present when editing) - filled by withComponentInputBinding()
  id = input<string>();

  readonly fields: FormField[] = [
    { name: 'title', label: 'Title', required: true, wide: true },
    { name: 'author', label: 'Author', required: true },
    { name: 'category', label: 'Category', required: true },
    { name: 'publisher', label: 'Publisher' },
    { name: 'language', label: 'Language', required: true },
    { name: 'publicationYear', label: 'Publication year', type: 'number' },
    { name: 'quantity', label: 'Quantity', type: 'number' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ];

  form = signal<Book>(emptyForm());
  saving = signal(false);
  isEdit = computed(() => !!this.id());

  private readonly defaultLanguages = ['English', 'Hindi', 'Marathi', 'Spanish', 'French', 'German'];

  // defaults + languages already used by books + the one being edited, so nothing disappears
  languageChoices = computed(() => {
    const used = this.store.allBooks().map((b) => b.language).filter((l): l is string => !!l);
    const current = this.form().language;
    return [...new Set([...this.defaultLanguages, ...used, ...(current ? [current] : [])])].sort((a, b) =>
      a.localeCompare(b)
    );
  });

  private dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private filledFor?: string;

  constructor() {
    this.store.load(); // no-op if the library is already loaded

    // edit mode: fill the form with the book once the library is available
    effect(() => {
      const id = this.id();
      if (!id || !this.store.loaded()) return;
      untracked(() => {
        if (this.filledFor === id) return;
        const book = this.store.allBooks().find((b) => String(b.id) === id);
        if (!book) {
          this.toast.error('That book no longer exists.');
          this.close();
          return;
        }
        this.filledFor = id;
        this.form.set({ ...book });
      });
    });

    // lock page scroll behind the popup, and focus the first field
    document.body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => (document.body.style.overflow = ''));
    afterNextRender(() => this.dialog()?.nativeElement.querySelector<HTMLElement>('input, select')?.focus());
  }

  close() {
    this.router.navigate(['/books']);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (!this.saving()) this.close();
  }

  onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget && !this.saving()) this.close();
  }

  handleChange(field: FormField, value: string | number | null) {
    const v = field.type === 'number' && value !== '' && value !== null ? Number(value) : (value ?? '');
    this.form.update((f) => ({ ...f, [field.name]: v }));
  }

  setAvailable(checked: boolean) {
    this.form.update((f) => ({ ...f, available: checked }));
  }

  save() {
    // the browser checks required fields; this also rejects values that are only spaces
    const book = this.form();
    const missing = this.fields.filter((f) => f.required && !String(book[f.name] ?? '').trim());
    if (missing.length) {
      this.toast.error(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    const isNew = !book.id;
    this.saving.set(true);
    this.bookService
      .save(book)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.store.upsert(saved ?? book, isNew);
          this.toast.success(isNew ? 'Book added to the library.' : 'Book updated.');
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) return; // interceptor already logged the user out
          this.toast.error(err.status === 403 ? "You don't have permission to do this." : 'Could not save the book.');
        },
      });
  }
}
