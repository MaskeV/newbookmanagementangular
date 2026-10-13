import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BOOKS_URL } from '../api.config';
import { Book, BookFilters } from '../models/book';

@Injectable({ providedIn: 'root' })
export class BookService {
  private http = inject(HttpClient);

  getAll(): Observable<Book[]> {
    return this.http.get<Book[]>(BOOKS_URL);
  }

  // Sends the search text and non-empty filters as query params; no params = plain list
  search(query: string, filters: BookFilters): Observable<Book[]> {
    let params = new HttpParams();
    if (query) params = params.set('query', query);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    if (params.keys().length === 0) return this.getAll();
    return this.http.get<Book[]>(`${BOOKS_URL}/search`, { params });
  }

  // the backend returns the saved book (with its id) for both POST and PUT
  save(book: Book): Observable<Book> {
    return book.id
      ? this.http.put<Book>(`${BOOKS_URL}/${book.id}`, book)
      : this.http.post<Book>(BOOKS_URL, book);
  }

  delete(id: number | string): Observable<void> {
    return this.http.delete<void>(`${BOOKS_URL}/${id}`);
  }
}
