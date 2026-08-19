import { Label } from '@/components/ui/label';
import { RichTextEditor } from '../RichTextEditor';
import { GeneralTemplateData } from '@/lib/spreadsheet-types';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneralTemplateProps {
  data: GeneralTemplateData;
  onChange: (data: GeneralTemplateData) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function GeneralTemplate({ data, onChange, isExpanded, onToggleExpand }: GeneralTemplateProps) {
  return (
    <div className={cn('flex flex-col min-h-0', isExpanded ? 'flex-1 space-y-2' : 'space-y-4')}>
      <div className={cn('flex flex-col min-h-0', isExpanded ? 'flex-1' : 'space-y-2')}>
        {!isExpanded && (
          <Label className="text-sm font-medium flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-slate-500" />
            Conteúdo
          </Label>
        )}
        <RichTextEditor
          content={data.content}
          onChange={(html) => onChange({ ...data, content: html })}
          placeholder="Digite o conteúdo da anotação..."
          minHeight={isExpanded ? '100%' : '250px'}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          className={cn(isExpanded && 'flex-1 min-h-0')}
        />
      </div>
    </div>
  );
}

export default GeneralTemplate;
