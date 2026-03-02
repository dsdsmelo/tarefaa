import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import { Person, Project, Phase, Cell, Task, CustomColumn, Milestone, MeetingNote, Spreadsheet, SpreadsheetSheet, SpreadsheetColumn, SpreadsheetRow, SpreadsheetCell, SpreadsheetMerge } from '@/lib/types';

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export function useSupabaseData() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  // Mapa de projectId -> array de personIds (membros do projeto)
  const [projectMembers, setProjectMembers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    // Check if user is authenticated before fetching
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      initialLoadDone.current = true;
      return;
    }

    // Only show loading spinner on initial load, not on background refetches
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const [
        { data: peopleData, error: peopleError },
        { data: projectsData, error: projectsError },
        { data: phasesData, error: phasesError },
        { data: cellsData, error: cellsError },
        { data: tasksData, error: tasksError },
        { data: columnsData, error: columnsError },
        { data: milestonesData, error: milestonesError },
        { data: meetingNotesData, error: meetingNotesError },
        { data: spreadsheetsData, error: spreadsheetsError },
        { data: projectMembersData, error: projectMembersError },
      ] = await Promise.all([
        supabase.from('people').select('*').order('name'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('phases').select('*').order('order'),
        supabase.from('cells').select('*').order('name'),
        supabase.from('tasks').select('*').order('updated_at', { ascending: false }),
        supabase.from('custom_columns').select('*').order('order'),
        supabase.from('milestones').select('*').order('name'),
        supabase.from('meeting_notes').select('*').order('meeting_date', { ascending: false }),
        supabase.from('project_spreadsheets').select('*').order('created_at', { ascending: false }),
        supabase.from('project_members').select('project_id, person_id'),
      ]);

      if (peopleError) throw peopleError;
      if (projectsError) throw projectsError;
      if (phasesError) throw phasesError;
      if (cellsError) throw cellsError;
      if (tasksError) throw tasksError;
      if (columnsError) throw columnsError;
      if (milestonesError) throw milestonesError;
      if (meetingNotesError) throw meetingNotesError;
      if (spreadsheetsError) throw spreadsheetsError;
      // projectMembersError é ignorado se a tabela não existir ainda
      if (projectMembersError && !projectMembersError.message?.includes('does not exist')) {
        console.warn('Error fetching project members:', projectMembersError);
      }

      // Map snake_case to camelCase - ensure arrays are never undefined
      setPeople(Array.isArray(peopleData) ? peopleData.map(mapPerson) : []);
      setProjects(Array.isArray(projectsData) ? projectsData.map(mapProject) : []);
      setPhases(Array.isArray(phasesData) ? phasesData.map(mapPhase) : []);
      setCells(Array.isArray(cellsData) ? cellsData.map(mapCell) : []);
      setTasks(Array.isArray(tasksData) ? tasksData.map(mapTask) : []);
      setCustomColumns(Array.isArray(columnsData) ? columnsData.map(mapCustomColumn) : []);
      setMilestones(Array.isArray(milestonesData) ? milestonesData.map(mapMilestone) : []);
      setMeetingNotes(Array.isArray(meetingNotesData) ? meetingNotesData.map(mapMeetingNote) : []);
      setSpreadsheets(Array.isArray(spreadsheetsData) ? spreadsheetsData.map(mapSpreadsheet) : []);

      // Build project members map: { projectId: [personId1, personId2, ...] }
      const membersMap: Record<string, string[]> = {};
      if (Array.isArray(projectMembersData)) {
        projectMembersData.forEach((row: { project_id: string; person_id: string }) => {
          if (!membersMap[row.project_id]) {
            membersMap[row.project_id] = [];
          }
          membersMap[row.project_id].push(row.person_id);
        });
      }
      setProjectMembers(membersMap);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Listen for auth state changes to refetch data
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchData();
      } else if (event === 'SIGNED_OUT') {
        // Clear all data on sign out
        setPeople([]);
        setProjects([]);
        setPhases([]);
        setCells([]);
        setTasks([]);
        setCustomColumns([]);
        setMilestones([]);
        setMeetingNotes([]);
        setSpreadsheets([]);
        setProjectMembers({});
        setLoading(false);
        initialLoadDone.current = false;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchData]);

  // CRUD operations for People
  const addPerson = async (person: Omit<Person, 'id'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('people')
      .insert([{ ...personToDb(person), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newPerson = mapPerson(data);
    setPeople(prev => [...prev, newPerson]);

    return newPerson;
  };

  const updatePerson = async (id: string, updates: Partial<Person>) => {
    const { error } = await supabase
      .from('people')
      .update(personToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePerson = async (id: string) => {
    const { error } = await supabase.from('people').delete().eq('id', id);
    if (error) throw error;
    setPeople(prev => prev.filter(p => p.id !== id));
  };

  // CRUD operations for Projects
  const addProject = async (project: Omit<Project, 'id'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .insert([{ ...projectToDb(project), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newProject = mapProject(data);
    setProjects(prev => [...prev, newProject]);

    logAuditEvent({ action: 'project_created', entity_type: 'project', entity_id: newProject.id, entity_name: newProject.name, level: 'success', details: `Projeto "${newProject.name}" criado` });

    return newProject;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const { error } = await supabase
      .from('projects')
      .update(projectToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    setProjects(prev => prev.filter(p => p.id !== id));
    // Também remove os membros do projeto do estado local
    setProjectMembers(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    logAuditEvent({ action: 'project_deleted', entity_type: 'project', entity_id: id, entity_name: project?.name, level: 'warning', details: `Projeto "${project?.name || id}" excluído` });
  };

  // Project Members operations
  const getProjectMemberIds = (projectId: string): string[] => {
    return projectMembers[projectId] || [];
  };

  const updateProjectMembers = async (projectId: string, memberIds: string[]) => {
    // Remove todos os membros atuais
    const { error: deleteError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId);
    if (deleteError) throw deleteError;

    // Adiciona os novos membros
    if (memberIds.length > 0) {
      const inserts = memberIds.map(personId => ({
        project_id: projectId,
        person_id: personId,
      }));
      const { error: insertError } = await supabase
        .from('project_members')
        .insert(inserts);
      if (insertError) throw insertError;
    }

    // Atualiza o estado local
    setProjectMembers(prev => ({
      ...prev,
      [projectId]: memberIds,
    }));
  };

  // CRUD operations for Phases
  const addPhase = async (phase: Omit<Phase, 'id'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('phases')
      .insert([{ ...phaseToDb(phase), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newPhase = mapPhase(data);
    setPhases(prev => [...prev, newPhase]);

    const project = projects.find(p => p.id === newPhase.projectId);
    logAuditEvent({ action: 'phase_created', entity_type: 'phase', entity_id: newPhase.id, entity_name: newPhase.name, level: 'success', details: `Fase "${newPhase.name}" criada no projeto "${project?.name || ''}"` });

    return newPhase;
  };

  const updatePhase = async (id: string, updates: Partial<Phase>) => {
    const { error } = await supabase
      .from('phases')
      .update(phaseToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePhase = async (id: string) => {
    const phase = phases.find(p => p.id === id);
    const { error } = await supabase.from('phases').delete().eq('id', id);
    if (error) throw error;
    setPhases(prev => prev.filter(p => p.id !== id));
    logAuditEvent({ action: 'phase_deleted', entity_type: 'phase', entity_id: id, entity_name: phase?.name, level: 'warning', details: `Fase "${phase?.name || id}" excluída` });
  };

  // CRUD operations for Cells
  const addCell = async (cell: Omit<Cell, 'id'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('cells')
      .insert([{ ...cellToDb(cell), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newCell = mapCell(data);
    setCells(prev => [...prev, newCell]);
    return newCell;
  };

  const updateCell = async (id: string, updates: Partial<Cell>) => {
    const { error } = await supabase
      .from('cells')
      .update(cellToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setCells(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCell = async (id: string) => {
    const { error } = await supabase.from('cells').delete().eq('id', id);
    if (error) throw error;
    setCells(prev => prev.filter(c => c.id !== id));
  };

  // CRUD operations for Tasks
  const addTask = async (task: Omit<Task, 'id' | 'updatedAt'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...taskToDb(task), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newTask = mapTask(data);
    setTasks(prev => [newTask, ...prev]);

    logAuditEvent({ action: 'task_created', entity_type: 'task', entity_id: newTask.id, entity_name: newTask.name, level: 'success', details: `Tarefa "${newTask.name}" criada` });

    return newTask;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const dbUpdates = taskToDb({ ...updates, updatedAt: new Date().toISOString() });
    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id);
    if (error) throw error;
    const task = tasks.find(t => t.id === id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
    if (updates.completed === true && task) {
      logAuditEvent({ action: 'task_completed', entity_type: 'task', entity_id: id, entity_name: task.name, level: 'success', details: `Tarefa "${task.name}" concluída` });
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    setTasks(prev => prev.filter(t => t.id !== id));
    logAuditEvent({ action: 'task_deleted', entity_type: 'task', entity_id: id, entity_name: task?.name, level: 'warning', details: `Tarefa "${task?.name || id}" excluída` });
  };

  // CRUD operations for Custom Columns
  const addCustomColumn = async (column: Omit<CustomColumn, 'id'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('custom_columns')
      .insert([{ ...customColumnToDb(column), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newColumn = mapCustomColumn(data);
    setCustomColumns(prev => [...prev, newColumn]);
    return newColumn;
  };

  const updateCustomColumn = async (id: string, updates: Partial<CustomColumn>) => {
    const { error } = await supabase
      .from('custom_columns')
      .update(customColumnToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setCustomColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomColumn = async (id: string) => {
    const { error } = await supabase.from('custom_columns').delete().eq('id', id);
    if (error) throw error;
    setCustomColumns(prev => prev.filter(c => c.id !== id));
  };

  // CRUD operations for Milestones
  const addMilestone = async (milestone: Omit<Milestone, 'id'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('milestones')
      .insert([{ ...milestoneToDb(milestone), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newMilestone = mapMilestone(data);
    setMilestones(prev => [...prev, newMilestone]);

    logAuditEvent({ action: 'milestone_created', entity_type: 'milestone', entity_id: newMilestone.id, entity_name: newMilestone.name, level: 'success', details: `Marco "${newMilestone.name}" criado` });

    return newMilestone;
  };

  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    const { error } = await supabase
      .from('milestones')
      .update(milestoneToDb(updates))
      .eq('id', id);
    if (error) throw error;
    const milestone = milestones.find(m => m.id === id);
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    if (updates.completed === true && milestone) {
      logAuditEvent({ action: 'milestone_completed', entity_type: 'milestone', entity_id: id, entity_name: milestone.name, level: 'success', details: `Marco "${milestone.name}" concluído` });
    }
  };

  const deleteMilestone = async (id: string) => {
    const milestone = milestones.find(m => m.id === id);
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (error) throw error;
    setMilestones(prev => prev.filter(m => m.id !== id));
    logAuditEvent({ action: 'milestone_deleted', entity_type: 'milestone', entity_id: id, entity_name: milestone?.name, level: 'warning', details: `Marco "${milestone?.name || id}" excluído` });
  };

  // CRUD operations for Meeting Notes
  const addMeetingNote = async (note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('meeting_notes')
      .insert([{ ...meetingNoteToDb(note), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newNote = mapMeetingNote(data);
    setMeetingNotes(prev => [newNote, ...prev]);
    return newNote;
  };

  const updateMeetingNote = async (id: string, updates: Partial<MeetingNote>) => {
    const { error } = await supabase
      .from('meeting_notes')
      .update(meetingNoteToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setMeetingNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  };

  const deleteMeetingNote = async (id: string) => {
    const { error } = await supabase.from('meeting_notes').delete().eq('id', id);
    if (error) throw error;
    setMeetingNotes(prev => prev.filter(n => n.id !== id));
  };

  // CRUD operations for Spreadsheets
  const addSpreadsheet = async (spreadsheet: Omit<Spreadsheet, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('project_spreadsheets')
      .insert([{ ...spreadsheetToDb(spreadsheet), user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    const newSpreadsheet = mapSpreadsheet(data);
    setSpreadsheets(prev => [newSpreadsheet, ...prev]);
    return newSpreadsheet;
  };

  const updateSpreadsheet = async (id: string, updates: Partial<Spreadsheet>) => {
    const { error } = await supabase
      .from('project_spreadsheets')
      .update(spreadsheetToDb(updates))
      .eq('id', id);
    if (error) throw error;
    setSpreadsheets(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
  };

  const deleteSpreadsheet = async (id: string) => {
    const { error } = await supabase.from('project_spreadsheets').delete().eq('id', id);
    if (error) throw error;
    setSpreadsheets(prev => prev.filter(s => s.id !== id));
  };

  const duplicateSpreadsheet = async (original: Spreadsheet) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // 1. Create new spreadsheet
    const { data: newSpData, error: spError } = await supabase
      .from('project_spreadsheets')
      .insert([{
        project_id: original.projectId,
        user_id: userId,
        name: `${original.name} (cópia)`,
        description: original.description || null,
      }])
      .select()
      .single();
    if (spError) throw spError;
    const newSpreadsheet = mapSpreadsheet(newSpData);

    // 2. Fetch all sheets from original
    const { data: sheetsData, error: sheetsError } = await supabase
      .from('spreadsheet_sheets')
      .select('*')
      .eq('spreadsheet_id', original.id)
      .order('order_index');
    if (sheetsError) throw sheetsError;
    const sheets = sheetsData || [];

    // Helper to copy columns/rows/cells/merges for one sheet (or spreadsheet-level)
    const copySheetContent = async (originalSheetId: string | null, newSheetId: string | null) => {
      const colQuery = originalSheetId
        ? supabase.from('spreadsheet_columns').select('*').eq('sheet_id', originalSheetId).order('order_index')
        : supabase.from('spreadsheet_columns').select('*').eq('spreadsheet_id', original.id).order('order_index');
      const rowQuery = originalSheetId
        ? supabase.from('spreadsheet_rows').select('*').eq('sheet_id', originalSheetId).order('order_index')
        : supabase.from('spreadsheet_rows').select('*').eq('spreadsheet_id', original.id).order('order_index');
      const mergeQuery = originalSheetId
        ? supabase.from('spreadsheet_merges').select('*').eq('sheet_id', originalSheetId)
        : supabase.from('spreadsheet_merges').select('*').eq('spreadsheet_id', original.id);

      const [{ data: colsData, error: colsError }, { data: rowsData, error: rowsError }, { data: mergesData, error: mergesError }] =
        await Promise.all([colQuery, rowQuery, mergeQuery]);
      if (colsError) throw colsError;
      if (rowsError) throw rowsError;
      if (mergesError) throw mergesError;

      const colIdMap: Record<string, string> = {};
      const rowIdMap: Record<string, string> = {};

      if ((colsData || []).length > 0) {
        const payload = (colsData || []).map(col => ({
          spreadsheet_id: newSpreadsheet.id,
          ...(newSheetId ? { sheet_id: newSheetId } : {}),
          name: col.name,
          type: col.type,
          width: col.width,
          order_index: col.order_index,
          formula: col.formula || null,
          format: col.format || null,
        }));
        const { data: newCols, error: newColsError } = await supabase.from('spreadsheet_columns').insert(payload).select();
        if (newColsError) throw newColsError;
        (colsData || []).forEach((oldCol, i) => { colIdMap[oldCol.id] = newCols![i].id; });
      }

      if ((rowsData || []).length > 0) {
        const payload = (rowsData || []).map(row => ({
          spreadsheet_id: newSpreadsheet.id,
          ...(newSheetId ? { sheet_id: newSheetId } : {}),
          order_index: row.order_index,
          is_header: row.is_header || false,
        }));
        const { data: newRows, error: newRowsError } = await supabase.from('spreadsheet_rows').insert(payload).select();
        if (newRowsError) throw newRowsError;
        (rowsData || []).forEach((oldRow, i) => { rowIdMap[oldRow.id] = newRows![i].id; });
      }

      const oldRowIds = (rowsData || []).map(r => r.id);
      if (oldRowIds.length > 0) {
        const { data: cellsData, error: cellsError } = await supabase.from('spreadsheet_cells').select('*').in('row_id', oldRowIds);
        if (cellsError) throw cellsError;
        const newCellsPayload = (cellsData || [])
          .filter(cell => rowIdMap[cell.row_id] && colIdMap[cell.column_id])
          .map(cell => ({
            row_id: rowIdMap[cell.row_id],
            column_id: colIdMap[cell.column_id],
            value: cell.value || null,
            computed_value: cell.computed_value || null,
          }));
        if (newCellsPayload.length > 0) {
          const { error: newCellsError } = await supabase.from('spreadsheet_cells').insert(newCellsPayload);
          if (newCellsError) throw newCellsError;
        }
      }

      if ((mergesData || []).length > 0) {
        const mergesPayload = (mergesData || []).map(merge => ({
          spreadsheet_id: newSpreadsheet.id,
          ...(newSheetId ? { sheet_id: newSheetId } : {}),
          start_row: merge.start_row,
          start_col: merge.start_col,
          end_row: merge.end_row,
          end_col: merge.end_col,
        }));
        const { error: newMergesError } = await supabase.from('spreadsheet_merges').insert(mergesPayload);
        if (newMergesError) throw newMergesError;
      }
    };

    if (sheets.length === 0) {
      await copySheetContent(null, null);
    } else {
      for (const sheet of sheets) {
        const { data: newSheetData, error: newSheetError } = await supabase
          .from('spreadsheet_sheets')
          .insert([{ spreadsheet_id: newSpreadsheet.id, name: sheet.name, order_index: sheet.order_index }])
          .select()
          .single();
        if (newSheetError) throw newSheetError;
        await copySheetContent(sheet.id, newSheetData.id);
      }
    }

    setSpreadsheets(prev => [newSpreadsheet, ...prev]);
    return newSpreadsheet;
  };

  // Fetch full spreadsheet data (sheets, columns, rows, cells, merges) for editor
  const fetchSpreadsheetData = async (spreadsheetId: string, sheetId?: string) => {
    // Fetch sheets first
    const { data: sheetsData, error: sheetsError } = await supabase
      .from('spreadsheet_sheets')
      .select('*')
      .eq('spreadsheet_id', spreadsheetId)
      .order('order_index');

    if (sheetsError) throw sheetsError;

    const sheets = (sheetsData || []).map(mapSpreadsheetSheet);

    // Determine which sheet to load (first one if not specified)
    const activeSheetId = sheetId || sheets[0]?.id;

    // Build query filters - filter by sheet_id if available, otherwise by spreadsheet_id
    const columnQuery = activeSheetId
      ? supabase.from('spreadsheet_columns').select('*').eq('sheet_id', activeSheetId).order('order_index')
      : supabase.from('spreadsheet_columns').select('*').eq('spreadsheet_id', spreadsheetId).order('order_index');

    const rowQuery = activeSheetId
      ? supabase.from('spreadsheet_rows').select('*').eq('sheet_id', activeSheetId).order('order_index')
      : supabase.from('spreadsheet_rows').select('*').eq('spreadsheet_id', spreadsheetId).order('order_index');

    const mergeQuery = activeSheetId
      ? supabase.from('spreadsheet_merges').select('*').eq('sheet_id', activeSheetId)
      : supabase.from('spreadsheet_merges').select('*').eq('spreadsheet_id', spreadsheetId);

    const [
      { data: columnsData, error: columnsError },
      { data: rowsData, error: rowsError },
      { data: mergesData, error: mergesError },
    ] = await Promise.all([columnQuery, rowQuery, mergeQuery]);

    if (columnsError) throw columnsError;
    if (rowsError) throw rowsError;
    if (mergesError) throw mergesError;

    // Fetch cells for all rows
    const rowIds = rowsData?.map(r => r.id) || [];
    let cellsData: any[] = [];
    if (rowIds.length > 0) {
      const { data, error: cellsError } = await supabase
        .from('spreadsheet_cells')
        .select('*')
        .in('row_id', rowIds);
      if (cellsError) throw cellsError;
      cellsData = data || [];
    }

    return {
      sheets,
      activeSheetId,
      columns: (columnsData || []).map(mapSpreadsheetColumn),
      rows: (rowsData || []).map(mapSpreadsheetRow),
      cells: cellsData.map(mapSpreadsheetCell),
      merges: (mergesData || []).map(mapSpreadsheetMerge),
    };
  };

  // Sheet CRUD operations
  const addSheet = async (sheet: Omit<SpreadsheetSheet, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('spreadsheet_sheets')
      .insert([spreadsheetSheetToDb(sheet)])
      .select()
      .single();
    if (error) throw error;
    return mapSpreadsheetSheet(data);
  };

  const updateSheet = async (id: string, updates: Partial<SpreadsheetSheet>) => {
    const { error } = await supabase
      .from('spreadsheet_sheets')
      .update(spreadsheetSheetToDb(updates))
      .eq('id', id);
    if (error) throw error;
  };

  const deleteSheet = async (id: string) => {
    const { error } = await supabase.from('spreadsheet_sheets').delete().eq('id', id);
    if (error) throw error;
  };

  // Merge CRUD operations
  const addMerge = async (merge: Omit<SpreadsheetMerge, 'id'>) => {
    const { data, error } = await supabase
      .from('spreadsheet_merges')
      .insert([spreadsheetMergeToDb(merge)])
      .select()
      .single();
    if (error) throw error;
    return mapSpreadsheetMerge(data);
  };

  const deleteMerge = async (id: string) => {
    const { error } = await supabase.from('spreadsheet_merges').delete().eq('id', id);
    if (error) throw error;
  };

  const deleteMergesInRange = async (spreadsheetId: string, sheetId: string | undefined, startRow: number, startCol: number, endRow: number, endCol: number) => {
    let query = supabase
      .from('spreadsheet_merges')
      .delete()
      .eq('spreadsheet_id', spreadsheetId);

    if (sheetId) {
      query = query.eq('sheet_id', sheetId);
    }

    // Delete any merge that overlaps with the specified range
    query = query
      .lte('start_row', endRow)
      .gte('end_row', startRow)
      .lte('start_col', endCol)
      .gte('end_col', startCol);

    const { error } = await query;
    if (error) throw error;
  };

  // Spreadsheet columns CRUD
  const addSpreadsheetColumn = async (column: Omit<SpreadsheetColumn, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('spreadsheet_columns')
      .insert([spreadsheetColumnToDb(column)])
      .select()
      .single();
    if (error) throw error;
    return mapSpreadsheetColumn(data);
  };

  const updateSpreadsheetColumn = async (id: string, updates: Partial<SpreadsheetColumn>) => {
    const { error } = await supabase
      .from('spreadsheet_columns')
      .update(spreadsheetColumnToDb(updates))
      .eq('id', id);
    if (error) throw error;
  };

  const deleteSpreadsheetColumn = async (id: string) => {
    const { error } = await supabase.from('spreadsheet_columns').delete().eq('id', id);
    if (error) throw error;
  };

  // Spreadsheet rows CRUD
  const addSpreadsheetRow = async (row: Omit<SpreadsheetRow, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('spreadsheet_rows')
      .insert([spreadsheetRowToDb(row)])
      .select()
      .single();
    if (error) throw error;
    return mapSpreadsheetRow(data);
  };

  const deleteSpreadsheetRow = async (id: string) => {
    const { error } = await supabase.from('spreadsheet_rows').delete().eq('id', id);
    if (error) throw error;
  };

  // Spreadsheet cells CRUD
  const upsertSpreadsheetCell = async (cell: Omit<SpreadsheetCell, 'id'> & { id?: string }) => {
    const dbCell = spreadsheetCellToDb(cell);
    const { data, error } = await supabase
      .from('spreadsheet_cells')
      .upsert([dbCell], { onConflict: 'row_id,column_id' })
      .select()
      .single();
    if (error) throw error;
    return mapSpreadsheetCell(data);
  };

  // Batch operations for spreadsheet data
  const saveSpreadsheetData = async (
    spreadsheetId: string,
    columns: SpreadsheetColumn[],
    rows: SpreadsheetRow[],
    cells: SpreadsheetCell[],
    sheetId?: string,
    merges?: SpreadsheetMerge[]
  ) => {
    // Update spreadsheet timestamp
    await supabase
      .from('project_spreadsheets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', spreadsheetId);

    // Delete existing data for the specific sheet or spreadsheet
    if (sheetId) {
      await supabase.from('spreadsheet_columns').delete().eq('sheet_id', sheetId);
      await supabase.from('spreadsheet_rows').delete().eq('sheet_id', sheetId);
      await supabase.from('spreadsheet_merges').delete().eq('sheet_id', sheetId);
    } else {
      await supabase.from('spreadsheet_columns').delete().eq('spreadsheet_id', spreadsheetId);
      await supabase.from('spreadsheet_rows').delete().eq('spreadsheet_id', spreadsheetId);
      await supabase.from('spreadsheet_merges').delete().eq('spreadsheet_id', spreadsheetId);
    }

    // Insert new columns
    if (columns.length > 0) {
      const { error: colError } = await supabase
        .from('spreadsheet_columns')
        .insert(columns.map(spreadsheetColumnToDb));
      if (colError) throw colError;
    }

    // Insert new rows
    if (rows.length > 0) {
      const { error: rowError } = await supabase
        .from('spreadsheet_rows')
        .insert(rows.map(spreadsheetRowToDb));
      if (rowError) throw rowError;
    }

    // Insert new cells
    if (cells.length > 0) {
      const { error: cellError } = await supabase
        .from('spreadsheet_cells')
        .insert(cells.map(spreadsheetCellToDb));
      if (cellError) throw cellError;
    }

    // Insert new merges
    if (merges && merges.length > 0) {
      const { error: mergeError } = await supabase
        .from('spreadsheet_merges')
        .insert(merges.map(spreadsheetMergeToDb));
      if (mergeError) throw mergeError;
    }

    // Update local state
    setSpreadsheets(prev => prev.map(s =>
      s.id === spreadsheetId ? { ...s, updatedAt: new Date().toISOString() } : s
    ));
  };

  return {
    // Data
    people, projects, phases, cells, tasks, customColumns, milestones, meetingNotes, spreadsheets,
    loading, error,
    // State setters for local updates
    setPeople, setProjects, setPhases, setCells, setTasks, setCustomColumns, setMilestones, setMeetingNotes, setSpreadsheets,
    // Refresh
    refetch: fetchData,
    // People CRUD
    addPerson, updatePerson, deletePerson,
    // Projects CRUD
    addProject, updateProject, deleteProject,
    // Project Members
    projectMembers, getProjectMemberIds, updateProjectMembers,
    // Phases CRUD
    addPhase, updatePhase, deletePhase,
    // Cells CRUD
    addCell, updateCell, deleteCell,
    // Tasks CRUD
    addTask, updateTask, deleteTask,
    // Custom Columns CRUD
    addCustomColumn, updateCustomColumn, deleteCustomColumn,
    // Milestones CRUD
    addMilestone, updateMilestone, deleteMilestone,
    // Meeting Notes CRUD
    addMeetingNote, updateMeetingNote, deleteMeetingNote,
    // Spreadsheets CRUD
    addSpreadsheet, updateSpreadsheet, deleteSpreadsheet, duplicateSpreadsheet,
    fetchSpreadsheetData, saveSpreadsheetData,
    addSpreadsheetColumn, updateSpreadsheetColumn, deleteSpreadsheetColumn,
    addSpreadsheetRow, deleteSpreadsheetRow,
    upsertSpreadsheetCell,
    // Sheets CRUD
    addSheet, updateSheet, deleteSheet,
    // Merges CRUD
    addMerge, deleteMerge, deleteMergesInRange,
  };
}

// Mapping functions (DB snake_case -> App camelCase)
function mapPerson(data: any): Person {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    type: data.type,
    color: data.color,
    active: data.active,
    avatarUrl: data.avatar_url,
  };
}

function mapProject(data: any): Project {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    coverColor: data.cover_color,
  };
}

function mapPhase(data: any): Phase {
  return {
    id: data.id,
    name: data.name,
    order: data.order,
    color: data.color,
    projectId: data.project_id,
    startDate: data.start_date,
    endDate: data.end_date,
    description: data.description,
  };
}

function mapCell(data: any): Cell {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    active: data.active,
  };
}

function mapTask(data: any): Task {
  // Suporta migração: se responsible_ids existe usa ele, senão converte responsible_id para array
  const responsibleIds = data.responsible_ids
    || (data.responsible_id ? [data.responsible_id] : undefined);

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    projectId: data.project_id,
    phaseId: data.phase_id,
    cellId: data.cell_id,
    deviceId: data.device_id,
    responsibleIds,
    quantity: data.quantity,
    collected: data.collected,
    startDate: data.start_date,
    endDate: data.end_date,
    sprintDate: data.sprint_date,
    status: data.status,
    priority: data.priority,
    observation: data.observation,
    updatedAt: data.updated_at,
    customValues: data.custom_values,
  };
}

function mapCustomColumn(data: any): CustomColumn {
  return {
    id: data.id,
    name: data.name,
    type: data.type,
    projectId: data.project_id,
    order: data.order,
    options: data.options,
    isMilestone: data.is_milestone,
    active: data.active,
    hidden: data.hidden || false,
    wrapText: data.wrap_text || false,
    standardField: data.standard_field,
  };
}

// Reverse mapping (App camelCase -> DB snake_case)
function personToDb(person: Partial<Person>): any {
  const result: any = {};
  if (person.name !== undefined) result.name = person.name;
  if (person.email !== undefined) result.email = person.email;
  if (person.type !== undefined) result.type = person.type;
  if (person.color !== undefined) result.color = person.color;
  if (person.active !== undefined) result.active = person.active;
  if (person.avatarUrl !== undefined) result.avatar_url = person.avatarUrl;
  return result;
}

function projectToDb(project: Partial<Project>): any {
  const result: any = {};
  if (project.name !== undefined) result.name = project.name;
  if (project.description !== undefined) result.description = project.description;
  if (project.startDate !== undefined) result.start_date = project.startDate;
  if (project.endDate !== undefined) result.end_date = project.endDate;
  if (project.status !== undefined) result.status = project.status;
  if (project.coverColor !== undefined) result.cover_color = project.coverColor;
  return result;
}

function phaseToDb(phase: Partial<Phase>): any {
  const result: any = {};
  if (phase.name !== undefined) result.name = phase.name;
  if (phase.order !== undefined) result.order = phase.order;
  if (phase.color !== undefined) result.color = phase.color;
  if (phase.projectId !== undefined) result.project_id = phase.projectId;
  if (phase.startDate !== undefined) result.start_date = phase.startDate;
  if (phase.endDate !== undefined) result.end_date = phase.endDate;
  if (phase.description !== undefined) result.description = phase.description;
  return result;
}

function cellToDb(cell: Partial<Cell>): any {
  const result: any = {};
  if (cell.name !== undefined) result.name = cell.name;
  if (cell.description !== undefined) result.description = cell.description;
  if (cell.active !== undefined) result.active = cell.active;
  return result;
}

function taskToDb(task: Partial<Task>): any {
  const result: any = {};
  if (task.name !== undefined) result.name = task.name;
  if (task.description !== undefined) result.description = task.description;
  if (task.projectId !== undefined) result.project_id = task.projectId;
  if (task.phaseId !== undefined) result.phase_id = task.phaseId;
  if (task.cellId !== undefined) result.cell_id = task.cellId;
  if (task.deviceId !== undefined) result.device_id = task.deviceId;
  if (task.responsibleIds !== undefined) result.responsible_ids = task.responsibleIds;
  if (task.quantity !== undefined) result.quantity = task.quantity;
  if (task.collected !== undefined) result.collected = task.collected;
  if (task.startDate !== undefined) result.start_date = task.startDate;
  if (task.endDate !== undefined) result.end_date = task.endDate;
  if (task.sprintDate !== undefined) result.sprint_date = task.sprintDate;
  if (task.status !== undefined) result.status = task.status;
  if (task.priority !== undefined) result.priority = task.priority;
  if (task.observation !== undefined) result.observation = task.observation;
  if (task.updatedAt !== undefined) result.updated_at = task.updatedAt;
  if (task.customValues !== undefined) result.custom_values = task.customValues;
  return result;
}

function customColumnToDb(column: Partial<CustomColumn>): any {
  const result: any = {};
  if (column.name !== undefined) result.name = column.name;
  if (column.type !== undefined) result.type = column.type;
  if (column.projectId !== undefined) result.project_id = column.projectId;
  if (column.order !== undefined) result.order = column.order;
  if (column.options !== undefined) result.options = column.options;
  if (column.isMilestone !== undefined) result.is_milestone = column.isMilestone;
  if (column.active !== undefined) result.active = column.active;
  if (column.hidden !== undefined) result.hidden = column.hidden;
  if (column.wrapText !== undefined) result.wrap_text = column.wrapText;
  if (column.standardField !== undefined) result.standard_field = column.standardField;
  return result;
}

function mapMilestone(data: any): Milestone {
  return {
    id: data.id,
    name: data.name,
    projectId: data.project_id,
    phaseId: data.phase_id || undefined,
    description: data.description,
    color: data.color,
    date: data.date || data.start_date || '',
    completed: data.completed ?? false,
  };
}

function milestoneToDb(milestone: Partial<Milestone>): any {
  const result: any = {};
  if (milestone.name !== undefined) result.name = milestone.name;
  if (milestone.projectId !== undefined) result.project_id = milestone.projectId;
  if (milestone.phaseId !== undefined) result.phase_id = milestone.phaseId || null;
  if (milestone.description !== undefined) result.description = milestone.description;
  if (milestone.color !== undefined) result.color = milestone.color;
  if (milestone.date !== undefined) result.date = milestone.date;
  if (milestone.completed !== undefined) result.completed = milestone.completed;
  return result;
}

function mapMeetingNote(data: any): MeetingNote {
  // Extract category from participants array if not in separate field (backward compat)
  let category = data.category || 'general';
  if (!data.category && data.participants && Array.isArray(data.participants)) {
    const catEntry = data.participants.find((p: string) => p?.startsWith?.('cat:'));
    if (catEntry) {
      category = catEntry.replace('cat:', '');
    }
  }

  return {
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    content: data.content || '',
    meetingDate: data.meeting_date,
    participants: data.participants,
    category: category,
    templateData: data.template_data,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function meetingNoteToDb(note: Partial<MeetingNote>): any {
  const result: any = {};
  if (note.projectId !== undefined) result.project_id = note.projectId;
  if (note.title !== undefined) result.title = note.title;
  if (note.content !== undefined) result.content = note.content;
  if (note.meetingDate !== undefined) result.meeting_date = note.meetingDate;
  if (note.participants !== undefined) result.participants = note.participants;
  if (note.category !== undefined) result.category = note.category;
  if (note.templateData !== undefined) result.template_data = note.templateData;
  return result;
}

// Spreadsheet mapping functions
function mapSpreadsheet(data: any): Spreadsheet {
  return {
    id: data.id,
    projectId: data.project_id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function spreadsheetToDb(spreadsheet: Partial<Spreadsheet>): any {
  const result: any = {};
  if (spreadsheet.projectId !== undefined) result.project_id = spreadsheet.projectId;
  if (spreadsheet.name !== undefined) result.name = spreadsheet.name;
  if (spreadsheet.description !== undefined) result.description = spreadsheet.description;
  return result;
}

function mapSpreadsheetSheet(data: any): SpreadsheetSheet {
  return {
    id: data.id,
    spreadsheetId: data.spreadsheet_id,
    name: data.name,
    orderIndex: data.order_index,
    createdAt: data.created_at,
  };
}

function spreadsheetSheetToDb(sheet: Partial<SpreadsheetSheet>): any {
  const result: any = {};
  if (sheet.id !== undefined) result.id = sheet.id;
  if (sheet.spreadsheetId !== undefined) result.spreadsheet_id = sheet.spreadsheetId;
  if (sheet.name !== undefined) result.name = sheet.name;
  if (sheet.orderIndex !== undefined) result.order_index = sheet.orderIndex;
  return result;
}

function mapSpreadsheetColumn(data: any): SpreadsheetColumn {
  return {
    id: data.id,
    spreadsheetId: data.spreadsheet_id,
    sheetId: data.sheet_id,
    name: data.name,
    type: data.type,
    width: data.width,
    orderIndex: data.order_index,
    formula: data.formula,
    format: data.format,
    createdAt: data.created_at,
  };
}

function spreadsheetColumnToDb(column: Partial<SpreadsheetColumn>): any {
  const result: any = {};
  if (column.id !== undefined) result.id = column.id;
  if (column.spreadsheetId !== undefined) result.spreadsheet_id = column.spreadsheetId;
  if (column.sheetId !== undefined) result.sheet_id = column.sheetId;
  if (column.name !== undefined) result.name = column.name;
  if (column.type !== undefined) result.type = column.type;
  if (column.width !== undefined) result.width = column.width;
  if (column.orderIndex !== undefined) result.order_index = column.orderIndex;
  if (column.formula !== undefined) result.formula = column.formula;
  if (column.format !== undefined) result.format = column.format;
  return result;
}

function mapSpreadsheetRow(data: any): SpreadsheetRow {
  return {
    id: data.id,
    spreadsheetId: data.spreadsheet_id,
    sheetId: data.sheet_id,
    orderIndex: data.order_index,
    isHeader: data.is_header,
    createdAt: data.created_at,
  };
}

function spreadsheetRowToDb(row: Partial<SpreadsheetRow>): any {
  const result: any = {};
  if (row.id !== undefined) result.id = row.id;
  if (row.spreadsheetId !== undefined) result.spreadsheet_id = row.spreadsheetId;
  if (row.sheetId !== undefined) result.sheet_id = row.sheetId;
  if (row.orderIndex !== undefined) result.order_index = row.orderIndex;
  if (row.isHeader !== undefined) result.is_header = row.isHeader;
  return result;
}

function mapSpreadsheetMerge(data: any): SpreadsheetMerge {
  return {
    id: data.id,
    spreadsheetId: data.spreadsheet_id,
    sheetId: data.sheet_id,
    startRow: data.start_row,
    startCol: data.start_col,
    endRow: data.end_row,
    endCol: data.end_col,
  };
}

function spreadsheetMergeToDb(merge: Partial<SpreadsheetMerge>): any {
  const result: any = {};
  if (merge.id !== undefined) result.id = merge.id;
  if (merge.spreadsheetId !== undefined) result.spreadsheet_id = merge.spreadsheetId;
  if (merge.sheetId !== undefined) result.sheet_id = merge.sheetId;
  if (merge.startRow !== undefined) result.start_row = merge.startRow;
  if (merge.startCol !== undefined) result.start_col = merge.startCol;
  if (merge.endRow !== undefined) result.end_row = merge.endRow;
  if (merge.endCol !== undefined) result.end_col = merge.endCol;
  return result;
}

function mapSpreadsheetCell(data: any): SpreadsheetCell {
  return {
    id: data.id,
    rowId: data.row_id,
    columnId: data.column_id,
    value: data.value,
    computedValue: data.computed_value,
  };
}

function spreadsheetCellToDb(cell: Partial<SpreadsheetCell>): any {
  const result: any = {};
  if (cell.id !== undefined) result.id = cell.id;
  if (cell.rowId !== undefined) result.row_id = cell.rowId;
  if (cell.columnId !== undefined) result.column_id = cell.columnId;
  if (cell.value !== undefined) result.value = cell.value;
  if (cell.computedValue !== undefined) result.computed_value = cell.computedValue;
  return result;
}
