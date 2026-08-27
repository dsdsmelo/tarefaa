// Spreadsheet Types

export interface Spreadsheet {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type ColumnType = 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'formula';

export interface SpreadsheetColumn {
  id: string;
  spreadsheetId: string;
  name: string;
  type: ColumnType;
  width: number;
  order: number;
  formula?: string;
  format?: ConditionalFormat[];
}

export interface SpreadsheetRow {
  id: string;
  spreadsheetId: string;
  order: number;
}

export interface SpreadsheetCell {
  id: string;
  rowId: string;
  columnId: string;
  value: string | null;
  computedValue?: string;
}

export interface SpreadsheetMerge {
  id: string;
  spreadsheetId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// Conditional Formatting
export type ConditionType = 'greaterThan' | 'lessThan' | 'equals' | 'between' | 'contains' | 'isEmpty' | 'notEmpty';

export interface ConditionalFormat {
  id: string;
  condition: ConditionType;
  value: string | number;
  value2?: string | number; // For 'between'
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
}

// Formula support
export type FormulaFunction = 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'IF';

// Spreadsheet data for editing
export interface SpreadsheetData {
  spreadsheet: Spreadsheet;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
  cells: Map<string, SpreadsheetCell>; // key: `${rowId}-${columnId}`
  merges: SpreadsheetMerge[];
}

// Cell position
export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

// Selection range
export interface SelectionRange {
  start: CellPosition;
  end: CellPosition;
}

// Template Data Types for Annotations

export interface MeetingTemplateData {
  agenda: string;           // Pauta
  participants: string[];   // Participantes (person IDs)
  decisions: string;        // Ações/Decisões (rich text HTML)
  nextSteps: string;        // Próximos Passos (rich text HTML)
}

export interface DecisionTemplateData {
  context: string;              // Contexto (rich text HTML)
  optionsConsidered: string[];  // Opções Consideradas
  finalDecision: string;        // Decisão Final (rich text HTML)
  responsibleId?: string;       // Responsável (person ID)
  deadline?: string;            // Data Limite (ISO date string)
}

export interface IdeaTemplateData {
  description: string;        // Descrição (rich text HTML)
  expectedBenefits: string;   // Benefícios Esperados (rich text HTML)
  requiredResources: string;  // Recursos Necessários
  nextSteps: string;          // Próximos Passos (rich text HTML)
}

export interface ReminderTemplateData {
  description: string;        // Descrição (rich text HTML)
  deadline?: string;          // Data Limite (ISO date string)
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
}

export interface GeneralTemplateData {
  content: string;            // Conteúdo (rich text HTML with full formatting)
  lastEditedByName?: string;  // Quem editou por último (nome exibido)
  lastEditedAt?: string;      // Quando foi a última edição (ISO)
}

export type NoteTemplateData =
  | MeetingTemplateData
  | DecisionTemplateData
  | IdeaTemplateData
  | ReminderTemplateData
  | GeneralTemplateData;

// Default template data creators
export const createDefaultMeetingData = (): MeetingTemplateData => ({
  agenda: '',
  participants: [],
  decisions: '',
  nextSteps: '',
});

export const createDefaultDecisionData = (): DecisionTemplateData => ({
  context: '',
  optionsConsidered: [],
  finalDecision: '',
  responsibleId: undefined,
  deadline: undefined,
});

export const createDefaultIdeaData = (): IdeaTemplateData => ({
  description: '',
  expectedBenefits: '',
  requiredResources: '',
  nextSteps: '',
});

export const createDefaultReminderData = (): ReminderTemplateData => ({
  description: '',
  deadline: undefined,
  priority: 'medium',
  status: 'pending',
});

export const createDefaultGeneralData = (): GeneralTemplateData => ({
  content: '',
});
