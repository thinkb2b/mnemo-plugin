export interface Snippet {
  id: string;
  title: string;
  subject: string;
  body: string;
  groupId: string;
  variables: string[];
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface SenderAccount {
  id: string;
  email: string;
  name: string;
  signature: string;
}

export type ViewState = 'LIST' | 'CREATE' | 'EDIT' | 'FILL_VARS' | 'INFO' | 'SETTINGS';

export interface SnippetFormData {
  title: string;
  subject: string;
  body: string;
  groupId: string;
}

export interface AiGeneratedSnippet {
  title?: string;
  subject?: string;
  body?: string;
}