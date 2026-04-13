// Core entity types

import type { NoteTemplateData, ConditionalFormat } from './spreadsheet-types';

// Spreadsheet types for Supabase
export interface Spreadsheet {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetSheet {
  id: string;
  spreadsheetId: string;
  name: string;
  orderIndex: number;
  createdAt: string;
}

export interface SpreadsheetColumn {
  id: string;
  spreadsheetId: string;
  sheetId?: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'formula';
  width: number;
  orderIndex: number;
  formula?: string;
  format?: ConditionalFormat[];
  createdAt: string;
}

export interface SpreadsheetRow {
  id: string;
  spreadsheetId: string;
  sheetId?: string;
  orderIndex: number;
  isHeader?: boolean;
  createdAt: string;
}

export interface SpreadsheetMerge {
  id: string;
  spreadsheetId: string;
  sheetId?: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SpreadsheetCell {
  id: string;
  rowId: string;
  columnId: string;
  value: string | null;
  computedValue?: string;
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  inviteStatus?: 'none' | 'pending' | 'accepted';
  authUserId?: string;
  type: 'internal' | 'partner';
  color: string;
  active: boolean;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  coverColor?: string | null;
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  color?: string;
  projectId: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface Cell {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Device {
  id: string;
  name: string;
  active: boolean;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  phaseId?: string;
  cellId?: string;
  deviceId?: string;
  responsibleIds?: string[]; // Array de IDs dos responsáveis
  quantity?: number;
  collected?: number;
  startDate?: string;
  endDate?: string;
  sprintDate?: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  observation?: string;
  updatedAt: string;
  customValues?: Record<string, string | number>;
}

export interface CustomColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'list' | 'percentage' | 'user';
  projectId: string;
  order: number;
  options?: string[];
  isMilestone?: boolean;
  active: boolean;
  hidden?: boolean;
  wrapText?: boolean; // Permitir quebra de linhas em colunas de texto
  // Standard field mapping - if set, this column displays a core task field
  standardField?: 'name' | 'description' | 'responsible' | 'status' | 'priority' | 'startDate' | 'endDate' | 'progress';
}

export interface Milestone {
  id: string;
  name: string;
  projectId: string;
  phaseId?: string; // Fase vinculada (opcional)
  description?: string;
  color?: string;
  date: string; // Data única do marco (diamante)
  completed?: boolean;
}

// Note categories
export type NoteCategory = 'meeting' | 'decision' | 'idea' | 'reminder' | 'general';

export const noteCategoryLabels: Record<NoteCategory, string> = {
  meeting: 'Reunião',
  decision: 'Decisão',
  idea: 'Ideia',
  reminder: 'Lembrete',
  general: 'Geral',
};

export interface MeetingNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  meetingDate: string;
  participants?: string[]; // Array of person IDs
  category: NoteCategory;  // Note category type
  templateData?: NoteTemplateData; // Category-specific structured data
  createdAt: string;
  updatedAt: string;
}

// Helper types
export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];
export type ProjectStatus = Project['status'];
export type PersonType = Person['type'];

export const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Progresso',
  blocked: 'Bloqueado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: 'Planejamento',
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const personTypeLabels: Record<PersonType, string> = {
  internal: 'Interno',
  partner: 'Parceiro',
};
