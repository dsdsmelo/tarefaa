import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  Download,
  Loader2,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Cloud,
  RefreshCw,
  WrapText,
  Columns,
  Rows,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Paintbrush,
  Type,
  Merge,
  Clipboard,
  TableProperties,
  Split,
} from 'lucide-react';
import { useSpreadsheetClipboard } from '@/hooks/useSpreadsheetClipboard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useData } from '@/contexts/DataContext';
import { Spreadsheet, SpreadsheetSheet, SpreadsheetColumn, SpreadsheetRow, SpreadsheetCell, SpreadsheetMerge } from '@/lib/types';
import { SheetTabs } from './SheetTabs';

interface SpreadsheetEditorProps {
  spreadsheet: Spreadsheet;
}

interface CellStyle {
  bgColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface CellData {
  value: string;
  style?: CellStyle;
}

interface RowData {
  id: string;
  cells: { [colId: string]: CellData };
  height: number;
  isHeader?: boolean;
}

interface MergeData {
  id: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface ColData extends SpreadsheetColumn {
  width: number;
}

// Color palette for background
const BG_COLORS = [
  { color: '', label: 'Nenhuma' },
  { color: '#fef3c7', label: 'Amarelo claro' },
  { color: '#fde68a', label: 'Amarelo' },
  { color: '#fed7aa', label: 'Laranja claro' },
  { color: '#fecaca', label: 'Vermelho claro' },
  { color: '#fecdd3', label: 'Rosa claro' },
  { color: '#e9d5ff', label: 'Roxo claro' },
  { color: '#ddd6fe', label: 'Violeta claro' },
  { color: '#c7d2fe', label: 'Índigo claro' },
  { color: '#bfdbfe', label: 'Azul claro' },
  { color: '#a5f3fc', label: 'Ciano claro' },
  { color: '#99f6e4', label: 'Teal claro' },
  { color: '#bbf7d0', label: 'Verde claro' },
  { color: '#d9f99d', label: 'Lima claro' },
  { color: '#e5e7eb', label: 'Cinza claro' },
  { color: '#d1d5db', label: 'Cinza' },
];

// Color palette for text
const TEXT_COLORS = [
  { color: '', label: 'Padrão' },
  { color: '#000000', label: 'Preto' },
  { color: '#374151', label: 'Cinza escuro' },
  { color: '#6b7280', label: 'Cinza' },
  { color: '#dc2626', label: 'Vermelho' },
  { color: '#ea580c', label: 'Laranja' },
  { color: '#d97706', label: 'Âmbar' },
  { color: '#ca8a04', label: 'Amarelo' },
  { color: '#16a34a', label: 'Verde' },
  { color: '#0d9488', label: 'Teal' },
  { color: '#0891b2', label: 'Ciano' },
  { color: '#2563eb', label: 'Azul' },
  { color: '#7c3aed', label: 'Violeta' },
  { color: '#9333ea', label: 'Roxo' },
  { color: '#db2777', label: 'Rosa' },
  { color: '#be185d', label: 'Pink' },
];

export function SpreadsheetEditor({ spreadsheet }: SpreadsheetEditorProps) {
  const { fetchSpreadsheetData, saveSpreadsheetData, addSheet, updateSheet, deleteSheet, addMerge, deleteMerge } = useData();

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  // Sheet states
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | undefined>(undefined);

  const [columns, setColumns] = useState<ColData[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [merges, setMerges] = useState<MergeData[]>([]);
  const [wrapText, setWrapText] = useState(false);

  // Editing states
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Selection state (single cell)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);

  // Multi-cell selection state
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Resize states
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [resizingRow, setResizingRow] = useState<string | null>(null);
  const resizeStartRef = useRef<{ pos: number; size: number }>({ pos: 0, size: 0 });

  // Get selection bounds
  const getSelectionBounds = useCallback(() => {
    if (!selectionStart) return null;
    const end = selectionEnd || selectionStart;
    return {
      startRow: Math.min(selectionStart.row, end.row),
      endRow: Math.max(selectionStart.row, end.row),
      startCol: Math.min(selectionStart.col, end.col),
      endCol: Math.max(selectionStart.col, end.col),
    };
  }, [selectionStart, selectionEnd]);

  // Check if cell is in selection range
  const isInSelection = useCallback((rowIndex: number, colIndex: number) => {
    const bounds = getSelectionBounds();
    if (!bounds) return false;
    return rowIndex >= bounds.startRow && rowIndex <= bounds.endRow &&
           colIndex >= bounds.startCol && colIndex <= bounds.endCol;
  }, [getSelectionBounds]);

  // Check if cell is merged
  const getMergeAt = useCallback((rowIndex: number, colIndex: number) => {
    return merges.find(m =>
      rowIndex >= m.startRow && rowIndex <= m.endRow &&
      colIndex >= m.startCol && colIndex <= m.endCol
    );
  }, [merges]);

  // Check if cell is the start of a merge
  const isMergeStart = useCallback((rowIndex: number, colIndex: number) => {
    return merges.find(m => m.startRow === rowIndex && m.startCol === colIndex);
  }, [merges]);

  // Get current cell style
  const getCurrentCellStyle = (): CellStyle => {
    if (!selectedCell) return {};
    const row = rows.find(r => r.id === selectedCell.rowId);
    return row?.cells[selectedCell.colId]?.style || {};
  };

  // Load data for a specific sheet
  const loadSheetData = useCallback(async (sheetId?: string) => {
    try {
      const data = await fetchSpreadsheetData(spreadsheet.id, sheetId);

      // Set sheets
      setSheets(data.sheets || []);
      setActiveSheetId(data.activeSheetId);

      // Load merges
      const loadedMerges: MergeData[] = (data.merges || []).map((m: SpreadsheetMerge) => ({
        id: m.id,
        startRow: m.startRow,
        startCol: m.startCol,
        endRow: m.endRow,
        endCol: m.endCol,
      }));
      setMerges(loadedMerges);

      if (data.columns.length === 0) {
        const defaultCols: ColData[] = ['A', 'B', 'C', 'D', 'E'].map((letter, i) => ({
          id: crypto.randomUUID(),
          spreadsheetId: spreadsheet.id,
          sheetId: data.activeSheetId,
          name: letter,
          type: 'text',
          width: 150,
          orderIndex: i,
          createdAt: new Date().toISOString(),
        }));
        const defaultRows: RowData[] = Array.from({ length: 10 }, () => ({
          id: crypto.randomUUID(),
          cells: {},
          height: 36,
        }));
        setColumns(defaultCols);
        setRows(defaultRows);
        return { cols: defaultCols, rows: defaultRows, isNew: true };
      } else {
        const cols: ColData[] = data.columns.map((c: SpreadsheetColumn) => ({ ...c, width: c.width || 150 }));
        setColumns(cols);
        const loadedRows: RowData[] = data.rows.map((r: SpreadsheetRow) => {
          const cells: { [colId: string]: CellData } = {};
          data.cells.filter((c: SpreadsheetCell) => c.rowId === r.id).forEach((c: SpreadsheetCell) => {
            let style: CellStyle = {};
            if (c.formula) {
              try {
                style = JSON.parse(c.formula);
              } catch {}
            }
            cells[c.columnId] = { value: c.value || '', style };
          });
          return { id: r.id, cells, height: 36, isHeader: r.isHeader };
        });
        const finalRows = loadedRows.length > 0 ? loadedRows : Array.from({ length: 10 }, () => ({ id: crypto.randomUUID(), cells: {}, height: 36 }));
        setRows(finalRows);
        return { cols, rows: finalRows, isNew: false };
      }
    } catch (err) {
      console.error('Load error:', err);
      toast.error('Erro ao carregar planilha');
      return null;
    }
  }, [fetchSpreadsheetData, spreadsheet.id]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const result = await loadSheetData();
      if (!mounted) return;
      if (result?.isNew) {
        queueSave(result.cols, result.rows);
      }
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [spreadsheet.id]);

  // Save function
  const doSave = useCallback(async (cols: ColData[], rws: RowData[], mrgs?: MergeData[]) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');

    try {
      const dbCols = cols.map((c, i) => ({ ...c, spreadsheetId: spreadsheet.id, sheetId: activeSheetId, orderIndex: i }));
      const dbRows: SpreadsheetRow[] = rws.map((r, i) => ({
        id: r.id,
        spreadsheetId: spreadsheet.id,
        sheetId: activeSheetId,
        orderIndex: i,
        isHeader: r.isHeader,
        createdAt: new Date().toISOString(),
      }));
      const dbCells: SpreadsheetCell[] = [];
      rws.forEach(r => {
        Object.entries(r.cells).forEach(([colId, cellData]) => {
          if (cellData.value || (cellData.style && Object.keys(cellData.style).length > 0)) {
            dbCells.push({
              id: crypto.randomUUID(),
              rowId: r.id,
              columnId: colId,
              value: cellData.value,
              formula: cellData.style ? JSON.stringify(cellData.style) : undefined,
            });
          }
        });
      });

      const dbMerges: SpreadsheetMerge[] = (mrgs || merges).map(m => ({
        id: m.id,
        spreadsheetId: spreadsheet.id,
        sheetId: activeSheetId,
        startRow: m.startRow,
        startCol: m.startCol,
        endRow: m.endRow,
        endCol: m.endCol,
      }));

      await saveSpreadsheetData(spreadsheet.id, dbCols, dbRows, dbCells, activeSheetId, dbMerges);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    } finally {
      savingRef.current = false;
    }
  }, [spreadsheet.id, activeSheetId, merges, saveSpreadsheetData]);

  const queueSave = useCallback((cols: ColData[], rws: RowData[], mrgs?: MergeData[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(cols, rws, mrgs), 1500);
  }, [doSave]);

  // Sheet management
  const handleAddSheet = async () => {
    try {
      const newSheet = await addSheet({
        spreadsheetId: spreadsheet.id,
        name: `Planilha ${sheets.length + 1}`,
        orderIndex: sheets.length,
      });
      setSheets(prev => [...prev, newSheet]);
      // Switch to new sheet
      setActiveSheetId(newSheet.id);
      // Create default data for new sheet
      const defaultCols: ColData[] = ['A', 'B', 'C', 'D', 'E'].map((letter, i) => ({
        id: crypto.randomUUID(),
        spreadsheetId: spreadsheet.id,
        sheetId: newSheet.id,
        name: letter,
        type: 'text',
        width: 150,
        orderIndex: i,
        createdAt: new Date().toISOString(),
      }));
      const defaultRows: RowData[] = Array.from({ length: 10 }, () => ({
        id: crypto.randomUUID(),
        cells: {},
        height: 36,
      }));
      setColumns(defaultCols);
      setRows(defaultRows);
      setMerges([]);
      queueSave(defaultCols, defaultRows, []);
      toast.success('Planilha criada');
    } catch (err) {
      toast.error('Erro ao criar planilha');
    }
  };

  const handleSelectSheet = async (sheetId: string) => {
    if (sheetId === activeSheetId) return;
    setLoading(true);
    setActiveSheetId(sheetId);
    await loadSheetData(sheetId);
    setLoading(false);
  };

  const handleRenameSheet = async (sheetId: string, newName: string) => {
    try {
      await updateSheet(sheetId, { name: newName });
      setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, name: newName } : s));
    } catch (err) {
      toast.error('Erro ao renomear');
    }
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (sheets.length <= 1) {
      toast.error('Precisa ter pelo menos 1 planilha');
      return;
    }
    try {
      await deleteSheet(sheetId);
      const newSheets = sheets.filter(s => s.id !== sheetId);
      setSheets(newSheets);
      // Switch to first remaining sheet
      if (activeSheetId === sheetId) {
        handleSelectSheet(newSheets[0].id);
      }
      toast.success('Planilha excluída');
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  const handleDuplicateSheet = async (sheetId: string) => {
    const sourceSheet = sheets.find(s => s.id === sheetId);
    if (!sourceSheet) return;
    try {
      const newSheet = await addSheet({
        spreadsheetId: spreadsheet.id,
        name: `${sourceSheet.name} (cópia)`,
        orderIndex: sheets.length,
      });
      setSheets(prev => [...prev, newSheet]);
      toast.success('Planilha duplicada');
    } catch (err) {
      toast.error('Erro ao duplicar');
    }
  };

  // Toggle header row
  const toggleHeaderRow = (rowIndex: number) => {
    const newRows = rows.map((r, i) => ({
      ...r,
      isHeader: i === rowIndex ? !r.isHeader : r.isHeader,
    }));
    setRows(newRows);
    queueSave(columns, newRows);
  };

  // Merge cells
  const handleMergeCells = () => {
    const bounds = getSelectionBounds();
    if (!bounds) {
      toast.error('Selecione células para mesclar');
      return;
    }
    if (bounds.startRow === bounds.endRow && bounds.startCol === bounds.endCol) {
      toast.error('Selecione pelo menos 2 células');
      return;
    }

    // Check if any cell in range is already merged
    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        if (getMergeAt(r, c)) {
          toast.error('Remova a mesclagem existente primeiro');
          return;
        }
      }
    }

    const newMerge: MergeData = {
      id: crypto.randomUUID(),
      startRow: bounds.startRow,
      startCol: bounds.startCol,
      endRow: bounds.endRow,
      endCol: bounds.endCol,
    };
    const newMerges = [...merges, newMerge];
    setMerges(newMerges);
    queueSave(columns, rows, newMerges);
    toast.success('Células mescladas');
  };

  // Unmerge cells
  const handleUnmergeCells = () => {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    const merge = getMergeAt(bounds.startRow, bounds.startCol);
    if (!merge) {
      toast.error('Nenhuma mesclagem para desfazer');
      return;
    }

    const newMerges = merges.filter(m => m.id !== merge.id);
    setMerges(newMerges);
    queueSave(columns, rows, newMerges);
    toast.success('Mesclagem desfeita');
  };

  // Check if selection has merge
  const selectionHasMerge = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds) return false;
    return !!getMergeAt(bounds.startRow, bounds.startCol);
  }, [getSelectionBounds, getMergeAt]);

  // Clipboard hook
  const { handleCopy, handlePaste } = useSpreadsheetClipboard({
    rows,
    columns,
    selectedCell,
    editingCell,
    editingColId,
  });

  // Handle paste data with auto-expand
  const handlePasteData = useCallback(async () => {
    const data = await handlePaste();
    if (!data || !selectedCell) return;

    const { cells: pasteData, rowCount, colCount } = data;

    // Find starting position
    const startRowIndex = rows.findIndex(r => r.id === selectedCell.rowId);
    const startColIndex = columns.findIndex(c => c.id === selectedCell.colId);

    if (startRowIndex < 0 || startColIndex < 0) return;

    // Calculate how many rows/columns we need
    const requiredRows = startRowIndex + rowCount;
    const requiredCols = startColIndex + colCount;

    let newColumns = [...columns];
    let newRows = [...rows];

    // Auto-expand columns if needed (limit to 100 new columns)
    const maxNewCols = Math.min(requiredCols, columns.length + 100);
    while (newColumns.length < maxNewCols) {
      const letter = String.fromCharCode(65 + (newColumns.length % 26));
      const prefix = newColumns.length >= 26 ? String.fromCharCode(64 + Math.floor(newColumns.length / 26)) : '';
      newColumns.push({
        id: crypto.randomUUID(),
        spreadsheetId: spreadsheet.id,
        name: prefix + letter,
        type: 'text',
        width: 150,
        orderIndex: newColumns.length,
        createdAt: new Date().toISOString(),
      });
    }

    // Auto-expand rows if needed (limit to 100 new rows)
    const maxNewRows = Math.min(requiredRows, rows.length + 100);
    while (newRows.length < maxNewRows) {
      newRows.push({
        id: crypto.randomUUID(),
        cells: {},
        height: 36,
      });
    }

    // Apply pasted data
    for (let r = 0; r < rowCount; r++) {
      const targetRowIndex = startRowIndex + r;
      if (targetRowIndex >= newRows.length) break;

      const targetRow = newRows[targetRowIndex];

      for (let c = 0; c < colCount; c++) {
        const targetColIndex = startColIndex + c;
        if (targetColIndex >= newColumns.length) break;

        const targetCol = newColumns[targetColIndex];
        const pasteCell = pasteData[r]?.[c];

        if (targetRow && targetCol && pasteCell) {
          const existingCell = targetRow.cells[targetCol.id] || { value: '' };
          targetRow.cells[targetCol.id] = {
            ...existingCell,
            value: pasteCell.value,
          };
        }
      }
    }

    // Update state
    if (newColumns.length !== columns.length) {
      setColumns(newColumns);
    }
    setRows([...newRows]);
    queueSave(newColumns, newRows);

    toast.success(`Colado: ${rowCount} linha${rowCount > 1 ? 's' : ''} × ${colCount} coluna${colCount > 1 ? 's' : ''}`);
  }, [handlePaste, selectedCell, rows, columns, spreadsheet.id, queueSave]);

  // Clear value of all cells in the current selection
  const clearSelectedCells = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!selectedCell && !bounds) return;
    const newRows = rows.map((r, rowIndex) => {
      const inRowRange = bounds
        ? rowIndex >= bounds.startRow && rowIndex <= bounds.endRow
        : r.id === selectedCell?.rowId;
      if (!inRowRange) return r;
      const newCells = { ...r.cells };
      columns.forEach((col, colIndex) => {
        const inColRange = bounds
          ? colIndex >= bounds.startCol && colIndex <= bounds.endCol
          : col.id === selectedCell?.colId;
        if (inColRange && newCells[col.id]) {
          newCells[col.id] = { ...newCells[col.id], value: '' };
        }
      });
      return { ...r, cells: newCells };
    });
    setRows(newRows);
    queueSave(columns, newRows);
  }, [getSelectionBounds, selectedCell, rows, columns, queueSave]);

  // Move the single-cell selection by (rowDelta, colDelta)
  const moveSelection = useCallback((rowDelta: number, colDelta: number) => {
    const fromRow = selectionStart?.row ?? (selectedCell ? rows.findIndex(r => r.id === selectedCell.rowId) : 0);
    const fromCol = selectionStart?.col ?? (selectedCell ? columns.findIndex(c => c.id === selectedCell.colId) : 0);
    const newRowIdx = Math.max(0, Math.min(rows.length - 1, fromRow + rowDelta));
    const newColIdx = Math.max(0, Math.min(columns.length - 1, fromCol + colDelta));
    const newRow = rows[newRowIdx];
    const newCol = columns[newColIdx];
    if (newRow && newCol) {
      setSelectedCell({ rowId: newRow.id, colId: newCol.id });
      setSelectionStart({ row: newRowIdx, col: newColIdx });
      setSelectionEnd({ row: newRowIdx, col: newColIdx });
    }
  }, [selectedCell, selectionStart, rows, columns]);

  // Extend the selection end by (rowDelta, colDelta) — Shift+Arrow
  const extendSelection = useCallback((rowDelta: number, colDelta: number) => {
    if (!selectionStart) return;
    const curEnd = selectionEnd ?? selectionStart;
    const newEndRow = Math.max(0, Math.min(rows.length - 1, curEnd.row + rowDelta));
    const newEndCol = Math.max(0, Math.min(columns.length - 1, curEnd.col + colDelta));
    setSelectionEnd({ row: newEndRow, col: newEndCol });
  }, [selectionStart, selectionEnd, rows.length, columns.length]);

  // Copy selected range as TSV (falls back to single cell if only 1 cell selected)
  const handleCopyRange = useCallback(() => {
    if (editingCell || editingColId) return;
    const bounds = getSelectionBounds();
    if (!bounds || (bounds.startRow === bounds.endRow && bounds.startCol === bounds.endCol)) {
      handleCopy();
      return;
    }
    const lines: string[] = [];
    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      const row = rows[r];
      if (!row) continue;
      const vals: string[] = [];
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        const col = columns[c];
        vals.push(col ? (row.cells[col.id]?.value || '') : '');
      }
      lines.push(vals.join('\t'));
    }
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    const rc = bounds.endRow - bounds.startRow + 1;
    const cc = bounds.endCol - bounds.startCol + 1;
    toast.success(`Copiado: ${rc} linha${rc > 1 ? 's' : ''} × ${cc} coluna${cc > 1 ? 's' : ''}`);
  }, [editingCell, editingColId, getSelectionBounds, rows, columns, handleCopy]);

  // Keyboard shortcuts — navigation, editing, copy/paste, delete, select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with text editing
      if (editingCell || editingColId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const modKey = e.metaKey || e.ctrlKey;

      if (modKey && e.key === 'c') {
        e.preventDefault();
        handleCopyRange();
      } else if (modKey && e.key === 'v') {
        e.preventDefault();
        handlePasteData();
      } else if (modKey && e.key === 'a') {
        e.preventDefault();
        if (rows.length > 0 && columns.length > 0) {
          setSelectionStart({ row: 0, col: 0 });
          setSelectionEnd({ row: rows.length - 1, col: columns.length - 1 });
          setSelectedCell({ rowId: rows[0].id, colId: columns[0].id });
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedCell || getSelectionBounds())) {
        e.preventDefault();
        clearSelectedCells();
      } else if (e.key === 'Escape') {
        setSelectedCell(null);
        setSelectionStart(null);
        setSelectionEnd(null);
      } else if ((e.key === 'Enter' || e.key === 'F2') && selectedCell) {
        e.preventDefault();
        startEditCell(selectedCell.rowId, selectedCell.colId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.shiftKey ? extendSelection(-1, 0) : moveSelection(-1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.shiftKey ? extendSelection(1, 0) : moveSelection(1, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.shiftKey ? extendSelection(0, -1) : moveSelection(0, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.shiftKey ? extendSelection(0, 1) : moveSelection(0, 1);
      } else if (!modKey && !e.altKey && e.key.length === 1 && selectedCell) {
        // Any printable character starts editing the selected cell
        startEditCellWithValue(selectedCell.rowId, selectedCell.colId, e.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    editingCell, editingColId, handleCopyRange, handlePasteData,
    selectedCell, rows, columns, getSelectionBounds,
    clearSelectedCells, moveSelection, extendSelection,
  ]);

  // Mouse up handler for selection
  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(false);
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Cell mouse handlers for multi-select
  const handleCellMouseDown = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    if (editingCell) return;

    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectionEnd({ row: rowIndex, col: colIndex });
    setIsSelecting(true);

    // Also update selectedCell for compatibility
    const row = rows[rowIndex];
    const col = columns[colIndex];
    if (row && col) {
      setSelectedCell({ rowId: row.id, colId: col.id });
    }
  };

  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    if (isSelecting) {
      setSelectionEnd({ row: rowIndex, col: colIndex });
    }
  };

  // Cell editing
  const startEditCell = (rowId: string, colId: string) => {
    const row = rows.find(r => r.id === rowId);
    setEditValue(row?.cells[colId]?.value || '');
    setEditingCell({ rowId, colId });
    setSelectedCell({ rowId, colId });
  };

  // Start editing with an initial typed character (press any key to start editing)
  const startEditCellWithValue = (rowId: string, colId: string, initialValue: string) => {
    setEditValue(initialValue);
    setEditingCell({ rowId, colId });
    setSelectedCell({ rowId, colId });
  };

  const saveCell = () => {
    if (!editingCell) return;
    const newRows = rows.map(r => {
      if (r.id === editingCell.rowId) {
        const existingCell = r.cells[editingCell.colId] || { value: '' };
        return {
          ...r,
          cells: {
            ...r.cells,
            [editingCell.colId]: { ...existingCell, value: editValue }
          }
        };
      }
      return r;
    });
    setRows(newRows);
    setEditingCell(null);
    queueSave(columns, newRows);
  };

  // Column header editing
  const startEditColumn = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    setEditValue(col?.name || '');
    setEditingColId(colId);
  };

  const saveColumn = () => {
    if (!editingColId) return;
    const newCols = columns.map(c => {
      if (c.id === editingColId) {
        return { ...c, name: editValue.trim() || c.name };
      }
      return c;
    });
    setColumns(newCols);
    setEditingColId(null);
    queueSave(newCols, rows);
  };

  // Apply style to all cells in the current selection range (or single selectedCell)
  const applyStyle = (styleUpdate: Partial<CellStyle>) => {
    const bounds = getSelectionBounds();
    if (!selectedCell && !bounds) {
      toast.error('Selecione uma célula primeiro');
      return;
    }

    const newRows = rows.map((r, rowIndex) => {
      const inRowRange = bounds
        ? rowIndex >= bounds.startRow && rowIndex <= bounds.endRow
        : r.id === selectedCell?.rowId;
      if (!inRowRange) return r;

      const newCells = { ...r.cells };
      columns.forEach((col, colIndex) => {
        const inColRange = bounds
          ? colIndex >= bounds.startCol && colIndex <= bounds.endCol
          : col.id === selectedCell?.colId;
        if (inColRange) {
          const existingCell = newCells[col.id] || { value: '' };
          newCells[col.id] = {
            ...existingCell,
            style: { ...(existingCell.style || {}), ...styleUpdate },
          };
        }
      });
      return { ...r, cells: newCells };
    });
    setRows(newRows);
    queueSave(columns, newRows);
  };

  // Toggle style
  const toggleStyle = (key: 'bold' | 'italic' | 'underline') => {
    const currentStyle = getCurrentCellStyle();
    applyStyle({ [key]: !currentStyle[key] });
  };

  // Column resize
  const startColResize = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columns.find(c => c.id === colId);
    if (!col) return;
    setResizingCol(colId);
    resizeStartRef.current = { pos: e.clientX, size: col.width };

    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartRef.current.pos;
      const newWidth = Math.max(60, resizeStartRef.current.size + delta);
      setColumns(prev => prev.map(c => c.id === colId ? { ...c, width: newWidth } : c));
    };

    const handleUp = () => {
      setResizingCol(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      queueSave(columns, rows);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  // Row resize
  const startRowResize = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    setResizingRow(rowId);
    resizeStartRef.current = { pos: e.clientY, size: row.height };

    const handleMove = (e: MouseEvent) => {
      const delta = e.clientY - resizeStartRef.current.pos;
      const newHeight = Math.max(24, resizeStartRef.current.size + delta);
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, height: newHeight } : r));
    };

    const handleUp = () => {
      setResizingRow(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      queueSave(columns, rows);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  // Set all columns width
  const setAllColumnsWidth = (width: number) => {
    const newCols = columns.map(c => ({ ...c, width }));
    setColumns(newCols);
    queueSave(newCols, rows);
  };

  // Set all rows height
  const setAllRowsHeight = (height: number) => {
    const newRows = rows.map(r => ({ ...r, height }));
    setRows(newRows);
    queueSave(columns, newRows);
  };

  // Add column
  const addColumn = () => {
    const letter = String.fromCharCode(65 + columns.length);
    const newCol: ColData = {
      id: crypto.randomUUID(),
      spreadsheetId: spreadsheet.id,
      name: letter,
      type: 'text',
      width: 150,
      orderIndex: columns.length,
      createdAt: new Date().toISOString(),
    };
    const newCols = [...columns, newCol];
    setColumns(newCols);
    queueSave(newCols, rows);
    toast.success(`Coluna ${letter} adicionada`);
  };

  // Delete column
  const deleteColumn = (colId: string) => {
    if (columns.length <= 1) {
      toast.error('Precisa ter pelo menos 1 coluna');
      return;
    }
    const newCols = columns.filter(c => c.id !== colId);
    const newRows = rows.map(r => {
      const { [colId]: _, ...rest } = r.cells;
      return { ...r, cells: rest };
    });
    setColumns(newCols);
    setRows(newRows);
    queueSave(newCols, newRows);
  };

  // Add row
  const addRow = () => {
    const newRow: RowData = { id: crypto.randomUUID(), cells: {}, height: 36 };
    const newRows = [...rows, newRow];
    setRows(newRows);
    queueSave(columns, newRows);
  };

  // Delete row
  const deleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      toast.error('Precisa ter pelo menos 1 linha');
      return;
    }
    const newRows = rows.filter(r => r.id !== rowId);
    setRows(newRows);
    queueSave(columns, newRows);
  };

  // Sort column
  const sortColumn = (colId: string, direction: 'asc' | 'desc') => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a.cells[colId]?.value || '';
      const bVal = b.cells[colId]?.value || '';
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    setRows(sorted);
    queueSave(columns, sorted);
  };

  // Export
  const exportExcel = () => {
    const data = [
      columns.map(c => c.name),
      ...rows.map(r => columns.map(c => r.cells[c.id]?.value || '')),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = columns.map(c => ({ wch: Math.round(c.width / 8) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, spreadsheet.name);
    XLSX.writeFile(wb, `${spreadsheet.name}.xlsx`);
    toast.success('Exportado!');
  };

  // Calculate formula
  const calculateValue = (value: string): string => {
    if (!value.startsWith('=')) return value;
    const formula = value.toUpperCase();

    const sumMatch = formula.match(/=SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/);
    if (sumMatch) {
      const [, colLetter, startRow, , endRow] = sumMatch;
      const colIdx = colLetter.charCodeAt(0) - 65;
      const colId = columns[colIdx]?.id;
      if (!colId) return '#ERR';
      let sum = 0;
      for (let i = parseInt(startRow) - 1; i <= parseInt(endRow) - 1 && i < rows.length; i++) {
        const val = parseFloat(rows[i].cells[colId]?.value || '0');
        if (!isNaN(val)) sum += val;
      }
      return sum.toString();
    }

    const avgMatch = formula.match(/=AVG\(([A-Z])(\d+):([A-Z])(\d+)\)/);
    if (avgMatch) {
      const [, colLetter, startRow, , endRow] = avgMatch;
      const colIdx = colLetter.charCodeAt(0) - 65;
      const colId = columns[colIdx]?.id;
      if (!colId) return '#ERR';
      let sum = 0, count = 0;
      for (let i = parseInt(startRow) - 1; i <= parseInt(endRow) - 1 && i < rows.length; i++) {
        const val = parseFloat(rows[i].cells[colId]?.value || '');
        if (!isNaN(val)) { sum += val; count++; }
      }
      return count > 0 ? (sum / count).toFixed(2) : '0';
    }

    return value;
  };

  const currentStyle = getCurrentCellStyle();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate total table width
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0) + 48; // 48 for row number column

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg border flex-wrap">
        {/* Structural */}
        <Button variant="outline" size="sm" onClick={addRow} title="Adicionar linha">
          <Plus className="h-4 w-4 mr-1" />Linha
        </Button>
        <Button variant="outline" size="sm" onClick={addColumn} title="Adicionar coluna">
          <Plus className="h-4 w-4 mr-1" />Coluna
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Text Formatting */}
        <Button
          variant={currentStyle.bold ? "default" : "outline"}
          size="sm"
          onClick={() => toggleStyle('bold')}
          title="Negrito"
          className="w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={currentStyle.italic ? "default" : "outline"}
          size="sm"
          onClick={() => toggleStyle('italic')}
          title="Itálico"
          className="w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={currentStyle.underline ? "default" : "outline"}
          size="sm"
          onClick={() => toggleStyle('underline')}
          title="Sublinhado"
          className="w-8 p-0"
        >
          <Underline className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Alignment */}
        <Button
          variant={currentStyle.align === 'left' || !currentStyle.align ? "default" : "outline"}
          size="sm"
          onClick={() => applyStyle({ align: 'left' })}
          title="Alinhar à esquerda"
          className="w-8 p-0"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={currentStyle.align === 'center' ? "default" : "outline"}
          size="sm"
          onClick={() => applyStyle({ align: 'center' })}
          title="Centralizar"
          className="w-8 p-0"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={currentStyle.align === 'right' ? "default" : "outline"}
          size="sm"
          onClick={() => applyStyle({ align: 'right' })}
          title="Alinhar à direita"
          className="w-8 p-0"
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Background Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" title="Cor de fundo" className="gap-1">
              <Paintbrush className="h-4 w-4" />
              <div
                className="w-4 h-3 rounded border"
                style={{ backgroundColor: currentStyle.bgColor || '#ffffff' }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2">
            <p className="text-xs font-medium mb-2">Cor de fundo</p>
            <div className="grid grid-cols-4 gap-1">
              {BG_COLORS.map((c) => (
                <button
                  key={c.color || 'none'}
                  className={`w-10 h-8 rounded border hover:scale-110 transition-transform ${
                    currentStyle.bgColor === c.color ? 'ring-2 ring-primary ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: c.color || '#ffffff' }}
                  onClick={() => applyStyle({ bgColor: c.color })}
                  title={c.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" title="Cor do texto" className="gap-1">
              <Type className="h-4 w-4" />
              <div
                className="w-4 h-1 rounded"
                style={{ backgroundColor: currentStyle.textColor || '#000000' }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2">
            <p className="text-xs font-medium mb-2">Cor do texto</p>
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.color || 'default'}
                  className={`w-10 h-8 rounded border hover:scale-110 transition-transform flex items-center justify-center ${
                    currentStyle.textColor === c.color ? 'ring-2 ring-primary ring-offset-1' : ''
                  }`}
                  onClick={() => applyStyle({ textColor: c.color })}
                  title={c.label}
                >
                  <span style={{ color: c.color || '#000000', fontWeight: 600 }}>A</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Wrap Text */}
        <Button
          variant={wrapText ? "default" : "outline"}
          size="sm"
          onClick={() => setWrapText(!wrapText)}
          title="Quebra de texto"
        >
          <WrapText className="h-4 w-4" />
        </Button>

        {/* Column Width */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" title="Largura das colunas">
              <Columns className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3">
            <p className="text-xs font-medium mb-3">Largura de todas as colunas</p>
            <div className="space-y-3">
              <Slider
                defaultValue={[150]}
                min={60}
                max={400}
                step={10}
                onValueCommit={(v) => setAllColumnsWidth(v[0])}
              />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllColumnsWidth(80)}>80</Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllColumnsWidth(120)}>120</Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllColumnsWidth(150)}>150</Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllColumnsWidth(200)}>200</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Row Height */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" title="Altura das linhas">
              <Rows className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3">
            <p className="text-xs font-medium mb-3">Altura de todas as linhas</p>
            <div className="space-y-3">
              <Slider
                defaultValue={[36]}
                min={24}
                max={100}
                step={4}
                onValueCommit={(v) => setAllRowsHeight(v[0])}
              />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllRowsHeight(28)}>28</Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllRowsHeight(36)}>36</Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllRowsHeight(50)}>50</Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setAllRowsHeight(80)}>80</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Merge/Unmerge */}
        {selectionHasMerge() ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnmergeCells}
            title="Desfazer mesclagem"
          >
            <Split className="h-4 w-4 mr-1" />Separar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMergeCells}
            title="Mesclar células selecionadas"
            disabled={!getSelectionBounds() || (getSelectionBounds()?.startRow === getSelectionBounds()?.endRow && getSelectionBounds()?.startCol === getSelectionBounds()?.endCol)}
          >
            <Merge className="h-4 w-4 mr-1" />Mesclar
          </Button>
        )}

        {/* Header Row Toggle */}
        <Button
          variant={rows[0]?.isHeader ? "default" : "outline"}
          size="sm"
          onClick={() => toggleHeaderRow(0)}
          title="Definir primeira linha como cabeçalho"
        >
          <TableProperties className="h-4 w-4 mr-1" />Cabeçalho
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Paste */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePasteData}
          title="Colar (Ctrl+V)"
          disabled={!selectedCell}
        >
          <Clipboard className="h-4 w-4 mr-1" />Colar
        </Button>

        {/* Export */}
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-1" />Excel
        </Button>

        <div className="flex-1" />

        {/* Save status */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <Cloud className="h-3 w-3" /> Salvo
            </span>
          )}
          {saveStatus === 'error' && (
            <Button variant="destructive" size="sm" onClick={() => doSave(columns, rows)}>
              <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="border rounded-lg overflow-auto bg-card" style={{ maxHeight: '60vh' }}>
        <table
          className="border-collapse"
          style={{ width: totalWidth, minWidth: '100%', tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: 48 }} />
            {columns.map((col) => (
              <col key={col.id} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur">
              {/* Corner */}
              <th className="border-r border-b text-center text-xs font-medium text-muted-foreground p-2 bg-muted/80">
                #
              </th>
              {/* Column headers */}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="border-r border-b text-left p-0 group relative bg-muted/80"
                >
                  {editingColId === col.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveColumn}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveColumn();
                        if (e.key === 'Escape') setEditingColId(null);
                      }}
                      autoFocus
                      className="w-full px-2 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border-2 border-primary outline-none"
                    />
                  ) : (
                    <div className="flex items-center justify-between px-2 py-2">
                      <span
                        className="text-xs font-semibold cursor-text flex-1 truncate"
                        onClick={() => startEditColumn(col.id)}
                      >
                        {col.name}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditColumn(col.id)}>Renomear</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => sortColumn(col.id, 'asc')}>
                            <ArrowUp className="h-4 w-4 mr-2" /> Ordenar A-Z
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sortColumn(col.id, 'desc')}>
                            <ArrowDown className="h-4 w-4 mr-2" /> Ordenar Z-A
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Columns className="h-4 w-4 mr-2" /> Largura
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => {
                                const newCols = columns.map(c => c.id === col.id ? { ...c, width: 80 } : c);
                                setColumns(newCols);
                                queueSave(newCols, rows);
                              }}>Estreita (80px)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const newCols = columns.map(c => c.id === col.id ? { ...c, width: 150 } : c);
                                setColumns(newCols);
                                queueSave(newCols, rows);
                              }}>Normal (150px)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const newCols = columns.map(c => c.id === col.id ? { ...c, width: 250 } : c);
                                setColumns(newCols);
                                queueSave(newCols, rows);
                              }}>Larga (250px)</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteColumn(col.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                    onMouseDown={(e) => startColResize(e, col.id)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className={`group/row hover:bg-muted/20 relative ${row.isHeader ? 'bg-primary/10' : ''}`}>
                {/* Row number */}
                <td
                  className={`border-r border-b text-center text-xs text-muted-foreground relative ${row.isHeader ? 'bg-primary/20 font-semibold' : 'bg-muted/30'}`}
                  style={{ height: row.height }}
                >
                  <div className="flex items-center justify-center h-full">
                    <span className="group-hover/row:hidden">{rowIndex + 1}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="hidden group-hover/row:block p-0.5 rounded hover:bg-muted">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={addRow}>
                          <Plus className="h-4 w-4 mr-2" /> Adicionar linha
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleHeaderRow(rowIndex)}>
                          <TableProperties className="h-4 w-4 mr-2" /> {row.isHeader ? 'Remover cabeçalho' : 'Definir como cabeçalho'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Rows className="h-4 w-4 mr-2" /> Altura
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => {
                              const newRows = rows.map(r => r.id === row.id ? { ...r, height: 28 } : r);
                              setRows(newRows);
                              queueSave(columns, newRows);
                            }}>Compacta (28px)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const newRows = rows.map(r => r.id === row.id ? { ...r, height: 36 } : r);
                              setRows(newRows);
                              queueSave(columns, newRows);
                            }}>Normal (36px)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const newRows = rows.map(r => r.id === row.id ? { ...r, height: 60 } : r);
                              setRows(newRows);
                              queueSave(columns, newRows);
                            }}>Alta (60px)</DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteRow(row.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* Row resize handle */}
                  <div
                    className="absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize hover:bg-primary/50 active:bg-primary"
                    onMouseDown={(e) => startRowResize(e, row.id)}
                  />
                </td>
                {/* Cells */}
                {columns.map((col, colIndex) => {
                  const cell = row.cells[col.id];
                  const cellStyle = cell?.style || {};
                  const isSelected = selectedCell?.rowId === row.id && selectedCell?.colId === col.id;
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                  const inSelection = isInSelection(rowIndex, colIndex);

                  // Check for merge
                  const merge = getMergeAt(rowIndex, colIndex);
                  const mergeStart = isMergeStart(rowIndex, colIndex);

                  // If cell is inside a merge but not the start, skip rendering
                  if (merge && !mergeStart) {
                    return null;
                  }

                  // Calculate colspan and rowspan
                  const colSpan = mergeStart ? mergeStart.endCol - mergeStart.startCol + 1 : 1;
                  const rowSpan = mergeStart ? mergeStart.endRow - mergeStart.startRow + 1 : 1;

                  // Header row default style
                  const headerStyle: CellStyle = row.isHeader ? {
                    bold: true,
                    bgColor: cellStyle.bgColor || '#e0e7ff',
                    textColor: cellStyle.textColor || '#1e40af',
                  } : {};

                  const finalStyle = { ...headerStyle, ...cellStyle };

                  return (
                    <td
                      key={col.id}
                      colSpan={colSpan}
                      rowSpan={rowSpan}
                      className={`border-r border-b p-0 ${isSelected && !isEditing ? 'ring-2 ring-primary ring-inset' : ''} ${inSelection && !isEditing ? 'bg-primary/10' : ''}`}
                      style={{ height: row.height * rowSpan }}
                      onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    >
                      {isEditing ? (
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveCell}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              saveCell();
                              const nextRowIndex = rowIndex + 1;
                              if (nextRowIndex < rows.length) {
                                setTimeout(() => startEditCell(rows[nextRowIndex].id, col.id), 50);
                              }
                            }
                            if (e.key === 'Escape') setEditingCell(null);
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              saveCell();
                              const nextColIndex = colIndex + 1;
                              if (nextColIndex < columns.length) {
                                setTimeout(() => startEditCell(row.id, columns[nextColIndex].id), 50);
                              }
                            }
                          }}
                          autoFocus
                          className="w-full h-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border-2 border-primary outline-none resize-none"
                          style={{ minHeight: row.height }}
                        />
                      ) : (
                        <div
                          className="w-full h-full px-2 py-1 text-sm cursor-cell hover:bg-primary/5 overflow-hidden"
                          style={{
                            backgroundColor: finalStyle.bgColor || undefined,
                            color: finalStyle.textColor || undefined,
                            fontWeight: finalStyle.bold ? 'bold' : undefined,
                            fontStyle: finalStyle.italic ? 'italic' : undefined,
                            textDecoration: finalStyle.underline ? 'underline' : undefined,
                            textAlign: finalStyle.align || 'left',
                            whiteSpace: wrapText ? 'pre-wrap' : 'nowrap',
                            wordBreak: wrapText ? 'break-word' : 'normal',
                            minHeight: row.height * rowSpan,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: finalStyle.align === 'center' ? 'center' : finalStyle.align === 'right' ? 'flex-end' : 'flex-start',
                          }}
                          onDoubleClick={() => startEditCell(row.id, col.id)}
                        >
                          {calculateValue(cell?.value || '')}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs */}
      {sheets.length > 0 && (
        <SheetTabs
          sheets={sheets}
          activeSheetId={activeSheetId}
          onSelectSheet={handleSelectSheet}
          onAddSheet={handleAddSheet}
          onRenameSheet={handleRenameSheet}
          onDeleteSheet={handleDeleteSheet}
          onDuplicateSheet={handleDuplicateSheet}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{rows.length} linhas × {columns.length} colunas</span>
        <span>Arraste ou Shift+↑↓←→ para selecionar • Digite para editar • Enter/F2 para editar • Delete para limpar • Ctrl+C/V copiar/colar • Ctrl+A selecionar tudo</span>
      </div>
    </div>
  );
}

export default SpreadsheetEditor;
