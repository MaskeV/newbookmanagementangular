import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, finalize, map, of, switchMap } from 'rxjs';
import { Book, BookFilters } from '../models/book';
import { AuthService } from '../services/auth.service';
import { BookService } from '../services/book.service';
import { BookStore } from '../services/book.store';
import { Icon, IconName } from '../shared/icon';
import { tagStyle } from '../shared/tag-style';
import { ToastService } from '../shared/toast.service';

type SortKey = 'title' | 'category' | 'language' | 'publicationYear' | 'quantity' | 'available';
type SortDir = 'asc' | 'desc';

const emptyFilters: BookFilters = { category: '', language: '', publisher: '', available: '' };

// Filters are applied in the browser (case-insensitive exact match)
const applyFilters = (list: Book[], f: BookFilters): Book[] =>
  list.filter(
    (b) =>
      (!f.category || b.category?.toLowerCase() === f.category.toLowerCase()) &&
      (!f.language || b.language?.toLowerCase() === f.language.toLowerCase()) &&
      (!f.publisher || b.publisher?.toLowerCase() === f.publisher.toLowerCase()) &&
      (!f.available || String(!!b.available) === f.available)
  );

// unique, sorted values of one field (for the dropdowns)
const uniqueValues = (list: Book[], field: 'category' | 'language' | 'publisher'): string[] =>
  [...new Set(list.map((b) => b[field]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

const compare = (a: unknown, b: unknown): number => {
  const x = a ?? '';
  const y = b ?? '';
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  if (typeof x === 'boolean' || typeof y === 'boolean') return Number(x) - Number(y);
  return String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true });
};

@Component({
  selector: 'app-book-manager',
  imports: [FormsModule, RouterLink, RouterOutlet, Icon],
  templateUrl: './book-manager.html',
  styleUrl: './book-manager.css',
})
export class BookManager implements OnInit {
  private auth = inject(AuthService);
  private bookService = inject(BookService);
  private toast = inject(ToastService);
  store = inject(BookStore);
  tagStyle = tagStyle;

  // normal users (role USER) can only view and search; ADMIN can add, edit and delete
  canEdit = computed(() => this.auth.session()?.role === 'ADMIN');

  // ---------- search (runs on the server) ----------
  search = signal('');
  searchResults = signal<Book[] | null>(null); // null = not searching, show the full library
  searching = signal(false);
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  activeIndex = signal(-1);

  // ---------- filters, sorting, paging (run in the browser) ----------
  filters = signal<BookFilters>({ ...emptyFilters });
  sort = signal<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: 'asc' });
  pageSize = signal(10);
  page = signal(1);
  readonly pageSizes = [10, 25, 50];

  // ---------- delete confirmation ----------
  deleteTarget = signal<Book | null>(null);
  deleting = signal(false);

  categories = computed(() => uniqueValues(this.store.allBooks(), 'category'));
  languages = computed(() => uniqueValues(this.store.allBooks(), 'language'));
  publishers = computed(() => uniqueValues(this.store.allBooks(), 'publisher'));
  hasFilters = computed(() => Object.values(this.filters()).some(Boolean));

  // removable "chips" for the active filters
  chips = computed(() => {
    const f = this.filters();
    const out: { key: keyof BookFilters; label: string }[] = [];
    if (f.category) out.push({ key: 'category', label: `Category: ${f.category}` });
    if (f.language) out.push({ key: 'language', label: `Language: ${f.language}` });
    if (f.publisher) out.push({ key: 'publisher', label: `Publisher: ${f.publisher}` });
    if (f.available) out.push({ key: 'available', label: f.available === 'true' ? 'Available' : 'Not available' });
    return out;
  });

  // full library (or search results) -> filters -> sort -> current page
  rows = computed(() => applyFilters(this.searchResults() ?? this.store.allBooks(), this.filters()));
  sorted = computed(() => {
    const { key, dir } = this.sort();
    const rows = this.rows();
    if (!key) return rows;
    const m = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => m * compare(a[key], b[key]));
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize())));
  currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  pageRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });
  rangeStart = computed(() => (this.sorted().length ? (this.currentPage() - 1) * this.pageSize() + 1 : 0));
  rangeEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.sorted().length));

  isLoading = computed(() => this.store.loading() && !this.store.loaded());
  skeletonRows = [1, 2, 3, 4, 5, 6];

  private searchBox = viewChild<ElementRef<HTMLElement>>('searchBox');
  private typing$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor() {
    // Search suggestions (like Amazon): wait 250ms after typing, ask the backend,
    // keep a short list of unique titles / authors. switchMap drops stale requests.
    this.typing$
      .pipe(
        debounceTime(250),
        switchMap((text) => {
          const t = text.trim();
          if (!t) return of<string[]>([]);
          return this.bookService.search(t, emptyFilters).pipe(
            map((data) => {
              const lower = t.toLowerCase();
              const unique = new Set<string>();
              data.forEach((b) =>
                [b.title, b.author].forEach((v) => {
                  if (v && v.toLowerCase().includes(lower)) unique.add(v);
                })
              );
              return [...unique].slice(0, 8);
            }),
            catchError(() => of<string[]>([]))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((list) => {
        this.suggestions.set(list);
        this.activeIndex.set(-1);
      });

    // after an add / edit / delete: without a search the table follows the shared list by itself;
    // with a search active the results come from the server, so ask again
    this.store.changes.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.searchResults() !== null) this.fetchSearch(this.search());
    });
  }

  ngOnInit() {
    this.store.load(); // one GET; skipped if the Dashboard already loaded the library
  }

  // ---------- search ----------
  onSearchInput(text: string) {
    this.search.set(text);
    this.showSuggestions.set(true);
    this.typing$.next(text);
  }

  runSearch(text: string) {
    this.search.set(text);
    this.showSuggestions.set(false);
    this.typing$.next(text);
    this.page.set(1);
    this.fetchSearch(text);
  }

  private fetchSearch(text: string) {
    const t = text.trim();
    this.searchSub?.unsubscribe(); // ignore an older, slower response
    if (!t) {
      this.searchResults.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchSub = this.bookService
      .search(t, emptyFilters)
      .pipe(finalize(() => this.searching.set(false)))
      .subscribe({
        next: (list) => this.searchResults.set(list),
        error: () => this.toast.error('Search failed. Please try again.'),
      });
  }

  clearSearch() {
    this.search.set('');
    this.suggestions.set([]);
    this.page.set(1);
    this.fetchSearch('');
  }

  onSearchKeys(e: KeyboardEvent) {
    const n = this.suggestions().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.showSuggestions.set(true);
      if (n) this.activeIndex.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.activeIndex.update((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter' && this.activeIndex() >= 0) {
      e.preventDefault();
      this.runSearch(this.suggestions()[this.activeIndex()]);
    } else if (e.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  // typed part stays normal, the rest of the suggestion is bold
  suggestionParts(text: string) {
    const q = this.search().trim();
    const start = text.toLowerCase().indexOf(q.toLowerCase());
    if (start === -1) return { before: text, match: '', after: '' };
    const end = start + q.length;
    return { before: text.slice(0, start), match: text.slice(start, end), after: text.slice(end) };
  }

  // close the suggestions when clicking outside the search box
  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(e: MouseEvent) {
    const box = this.searchBox()?.nativeElement;
    if (box && !box.contains(e.target as Node)) this.showSuggestions.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (!this.deleting()) this.deleteTarget.set(null);
  }

  // ---------- filters ----------
  changeFilter(name: keyof BookFilters, value: string) {
    this.filters.update((f) => ({ ...f, [name]: value }));
    this.page.set(1);
  }

  clearFilters() {
    this.filters.set({ ...emptyFilters });
    this.page.set(1);
  }

  // ---------- sorting + paging ----------
  // click a column: ascending -> descending -> back to the original order
  toggleSort(key: SortKey) {
    this.sort.update((s) =>
      s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }
    );
    this.page.set(1);
  }

  sortIcon(key: SortKey): IconName {
    const s = this.sort();
    return s.key !== key ? 'sort' : s.dir === 'asc' ? 'chevronUp' : 'chevronDown';
  }

  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s.key !== key ? 'none' : s.dir === 'asc' ? 'ascending' : 'descending';
  }

  changePageSize(size: string | number) {
    this.pageSize.set(Number(size));
    this.page.set(1);
  }

  goTo(page: number) {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  // ---------- delete ----------
  confirmDelete() {
    const book = this.deleteTarget();
    if (!book || book.id === undefined) return;
    this.deleting.set(true);
    this.bookService
      .delete(book.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.store.remove(book.id!);
          this.toast.success(`"${book.title}" was deleted.`);
          this.deleteTarget.set(null);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) return; // interceptor already logged the user out
          this.toast.error(err.status === 403 ? "You don't have permission to do this." : 'Could not delete the book.');
        },
      });
  }
}
