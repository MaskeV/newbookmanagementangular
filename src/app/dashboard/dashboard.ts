import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book } from '../models/book';
import { AuthService } from '../services/auth.service';
import { BookStore } from '../services/book.store';
import { Icon } from '../shared/icon';
import { tagStyle } from '../shared/tag-style';

interface Bar {
  label: string;
  count: number;
  width: number; // % of the biggest bar
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, NgTemplateOutlet, Icon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private auth = inject(AuthService);
  store = inject(BookStore);
  tagStyle = tagStyle;

  ready = this.store.loaded;
  canEdit = computed(() => this.auth.session()?.role === 'ADMIN');
  firstName = computed(() => (this.auth.session()?.name ?? '').trim().split(/\s+/)[0] || 'there');
  greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });

  stats = computed(() => {
    const books = this.store.allBooks();
    const available = books.filter((b) => b.available).length;
    const pct = (n: number) => (books.length ? Math.round((n / books.length) * 100) : 0);
    return {
      titles: books.length,
      copies: books.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0),
      available,
      unavailable: books.length - available,
      availablePct: pct(available),
      unavailablePct: pct(books.length - available),
      categories: new Set(books.map((b) => b.category).filter(Boolean)).size,
      languages: new Set(books.map((b) => b.language).filter(Boolean)).size,
    };
  });

  byCategory = computed(() => this.breakdown('category'));
  byLanguage = computed(() => this.breakdown('language'));
  recent = computed(() =>
    [...this.store.allBooks()].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)).slice(0, 5)
  );

  ngOnInit() {
    this.store.load();
  }

  // top 6 values of a field with their counts
  private breakdown(field: 'category' | 'language'): Bar[] {
    const counts = new Map<string, number>();
    this.store.allBooks().forEach((b: Book) => {
      const key = b[field];
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = top[0]?.[1] ?? 1;
    return top.map(([label, count]) => ({ label, count, width: Math.max(6, (count / max) * 100) }));
  }
}
