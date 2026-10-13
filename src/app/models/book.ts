export interface Book {
  id?: number | string;
  title?: string;
  author?: string;
  category?: string;
  publisher?: string;
  publicationYear?: number | '';
  language?: string;
  quantity?: number | '';
  description?: string;
  available?: boolean;
}

export interface BookFilters {
  category: string;
  language: string;
  publisher: string;
  available: string; // "", "true" or "false"
}

export interface Session {
  token: string;
  name: string;
  email?: string;
  role?: string; // "ADMIN" can add/edit/delete, others can only view/search
}
