import { createContext, useContext, ReactNode } from 'react';
import { Person, Project, Phase, Cell, Task, CustomColumn, Milestone, MeetingNote, Spreadsheet, SpreadsheetColumn, SpreadsheetRow, SpreadsheetCell } from '@/lib/types';
import { useSupabaseData } from '@/hooks/useSupabaseData';

interface DataContextType {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  phases: Phase[];
  setPhases: React.Dispatch<React.SetStateAction<Phase[]>>;
  cells: Cell[];
  setCells: React.Dispatch<React.SetStateAction<Cell[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  customColumns: CustomColumn[];
  setCustomColumns: React.Dispatch<React.SetStateAction<CustomColumn[]>>;
  milestones: Milestone[];
  setMilestones: React.Dispatch<React.SetStateAction<Milestone[]>>;
  meetingNotes: MeetingNote[];
  setMeetingNotes: React.Dispatch<React.SetStateAction<MeetingNote[]>>;
  spreadsheets: Spreadsheet[];
  setSpreadsheets: React.Dispatch<React.SetStateAction<Spreadsheet[]>>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // CRUD operations
  addPerson: (person: Omit<Person, 'id'>) => Promise<Person>;
  updatePerson: (id: string, updates: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  addProject: (project: Omit<Project, 'id'>) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addPhase: (phase: Omit<Phase, 'id'>) => Promise<Phase>;
  updatePhase: (id: string, updates: Partial<Phase>) => Promise<void>;
  deletePhase: (id: string) => Promise<void>;
  addCell: (cell: Omit<Cell, 'id'>) => Promise<Cell>;
  updateCell: (id: string, updates: Partial<Cell>) => Promise<void>;
  deleteCell: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'updatedAt'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addCustomColumn: (column: Omit<CustomColumn, 'id'>) => Promise<CustomColumn>;
  updateCustomColumn: (id: string, updates: Partial<CustomColumn>) => Promise<void>;
  deleteCustomColumn: (id: string) => Promise<void>;
  addMilestone: (milestone: Omit<Milestone, 'id'>) => Promise<Milestone>;
  updateMilestone: (id: string, updates: Partial<Milestone>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  addMeetingNote: (note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MeetingNote>;
  updateMeetingNote: (id: string, updates: Partial<MeetingNote>) => Promise<void>;
  deleteMeetingNote: (id: string) => Promise<void>;
  // Spreadsheets CRUD
  addSpreadsheet: (spreadsheet: Omit<Spreadsheet, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<Spreadsheet>;
  updateSpreadsheet: (id: string, updates: Partial<Spreadsheet>) => Promise<void>;
  deleteSpreadsheet: (id: string) => Promise<void>;
  duplicateSpreadsheet: (spreadsheet: Spreadsheet) => Promise<Spreadsheet>;
  fetchSpreadsheetData: (spreadsheetId: string) => Promise<{
    columns: SpreadsheetColumn[];
    rows: SpreadsheetRow[];
    cells: SpreadsheetCell[];
  }>;
  saveSpreadsheetData: (
    spreadsheetId: string,
    columns: SpreadsheetColumn[],
    rows: SpreadsheetRow[],
    cells: SpreadsheetCell[]
  ) => Promise<void>;
  addSpreadsheetColumn: (column: Omit<SpreadsheetColumn, 'id' | 'createdAt'>) => Promise<SpreadsheetColumn>;
  updateSpreadsheetColumn: (id: string, updates: Partial<SpreadsheetColumn>) => Promise<void>;
  deleteSpreadsheetColumn: (id: string) => Promise<void>;
  addSpreadsheetRow: (row: Omit<SpreadsheetRow, 'id' | 'createdAt'>) => Promise<SpreadsheetRow>;
  deleteSpreadsheetRow: (id: string) => Promise<void>;
  upsertSpreadsheetCell: (cell: Omit<SpreadsheetCell, 'id'> & { id?: string }) => Promise<SpreadsheetCell>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const supabaseData = useSupabaseData();

  return (
    <DataContext.Provider value={supabaseData}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
