import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '../RichTextEditor';
import { IdeaTemplateData } from '@/lib/spreadsheet-types';
import { Lightbulb, TrendingUp, Package, ArrowRight } from 'lucide-react';

interface IdeaTemplateProps {
  data: IdeaTemplateData;
  onChange: (data: IdeaTemplateData) => void;
}

export function IdeaTemplate({ data, onChange }: IdeaTemplateProps) {
  return (
    <div className="space-y-4">
      {/* Descrição */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          Descrição da Ideia
        </Label>
        <RichTextEditor
          content={data.description}
          onChange={(html) => onChange({ ...data, description: html })}
          placeholder="Descreva sua ideia em detalhes..."
          minHeight="120px"
        />
      </div>

      {/* Benefícios Esperados */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Benefícios Esperados
        </Label>
        <RichTextEditor
          content={data.expectedBenefits}
          onChange={(html) => onChange({ ...data, expectedBenefits: html })}
          placeholder="Quais são os benefícios que essa ideia pode trazer?"
          minHeight="100px"
        />
      </div>

      {/* Recursos Necessários */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Recursos Necessários
        </Label>
        <Textarea
          placeholder="Liste os recursos necessários para implementar essa ideia (pessoas, tempo, ferramentas, orçamento, etc.)..."
          value={data.requiredResources}
          onChange={(e) => onChange({ ...data, requiredResources: e.target.value })}
          className="min-h-[80px] resize-y"
        />
      </div>

      {/* Próximos Passos */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          Próximos Passos
        </Label>
        <RichTextEditor
          content={data.nextSteps}
          onChange={(html) => onChange({ ...data, nextSteps: html })}
          placeholder="Quais são os próximos passos para desenvolver essa ideia?"
          minHeight="100px"
        />
      </div>
    </div>
  );
}

export default IdeaTemplate;
