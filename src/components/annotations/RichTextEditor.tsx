import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { ResizableImage } from './ResizableImage';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Highlighter,
  Undo,
  Redo,
  Quote,
  Minus,
  Code2,
  Baseline,
  ImagePlus,
  Eraser,
  Maximize2,
  Minimize2,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';

const NOTE_IMAGES_BUCKET = 'note-images';

// Heurística: o texto colado "parece" markdown? (evita converter texto comum)
const looksLikeMarkdown = (t: string): boolean => {
  return (
    /(^|\n)\s*#{1,6}\s+\S/.test(t) ||        // títulos
    /(^|\n)\s*[-*+]\s+\S/.test(t) ||         // lista com marcadores
    /(^|\n)\s*\d+\.\s+\S/.test(t) ||         // lista numerada
    /(^|\n)\s*>\s+\S/.test(t) ||             // citação
    /```[\s\S]*```/.test(t) ||               // bloco de código
    /(^|\n)\s*(-{3,}|\*{3,})\s*(\n|$)/.test(t) || // linha horizontal
    /\*\*[^*\n]+\*\*/.test(t) ||             // negrito
    /\[[^\]\n]+\]\([^)\n]+\)/.test(t)        // link
  );
};

const TEXT_COLORS = [
  { name: 'Padrão', value: null },
  { name: 'Cinza', value: '#64748b' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Âmbar', value: '#f59e0b' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', value: '#fef08a' },
  { name: 'Verde', value: '#bbf7d0' },
  { name: 'Azul', value: '#bfdbfe' },
  { name: 'Rosa', value: '#fbcfe8' },
  { name: 'Laranja', value: '#fed7aa' },
  { name: 'Roxo', value: '#e9d5ff' },
];

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  editable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const paragraphStyleLabel = (editor: Editor) => {
  if (editor.isActive('heading', { level: 1 })) return 'Título 1';
  if (editor.isActive('heading', { level: 2 })) return 'Título 2';
  if (editor.isActive('heading', { level: 3 })) return 'Título 3';
  return 'Normal';
};

const MenuBar = ({
  editor,
  onImageUpload,
  isUploading,
  isExpanded,
  onToggleExpand,
}: {
  editor: Editor | null;
  onImageUpload: () => void;
  isUploading: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) => {
  if (!editor) return null;

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1 border-b border-border bg-muted/30 rounded-t-md sticky top-0 z-10">
      {/* Estilo de parágrafo */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 font-normal min-w-[92px] justify-between">
            {paragraphStyleLabel(editor)}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>Normal</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <span className="text-xl font-bold">Título 1</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <span className="text-lg font-bold">Título 2</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span className="text-base font-semibold">Título 3</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Negrito">
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Itálico">
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Sublinhado">
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('strike')} onPressedChange={() => editor.chain().focus().toggleStrike().run()} aria-label="Riscado">
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('code')} onPressedChange={() => editor.chain().focus().toggleCode().run()} aria-label="Código">
        <Code2 className="h-4 w-4" />
      </Toggle>

      {/* Cor do texto */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Cor do texto">
            <Baseline className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-3 gap-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => (c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run())}
                className="w-7 h-7 rounded border border-border flex items-center justify-center hover:scale-110 transition-transform"
                style={{ backgroundColor: c.value ?? 'transparent' }}
              >
                {!c.value && <span className="text-[10px] text-muted-foreground">A</span>}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cor de realce */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Cor de realce">
            <Highlighter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-3 gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
                className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c.value }}
              />
            ))}
            <button
              type="button"
              title="Remover realce"
              onClick={() => editor.chain().focus().unsetHighlight().run()}
              className="w-7 h-7 rounded border border-border flex items-center justify-center hover:scale-110 transition-transform"
            >
              <Eraser className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Lista com marcadores">
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Lista numerada">
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('taskList')} onPressedChange={() => editor.chain().focus().toggleTaskList().run()} aria-label="Checklist">
        <ListChecks className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Citação">
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('codeBlock')} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Bloco de código">
        <Code2 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onPressedChange={() => editor.chain().focus().setHorizontalRule().run()} aria-label="Linha horizontal">
        <Minus className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()} aria-label="Alinhar à esquerda">
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()} aria-label="Centralizar">
        <AlignCenter className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()} aria-label="Alinhar à direita">
        <AlignRight className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'justify' })} onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()} aria-label="Justificar">
        <AlignJustify className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle size="sm" pressed={editor.isActive('link')} onPressedChange={addLink} aria-label="Link">
        <LinkIcon className="h-4 w-4" />
      </Toggle>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onImageUpload} disabled={isUploading} aria-label="Inserir imagem">
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        aria-label="Limpar formatação"
      >
        <Eraser className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle size="sm" onPressedChange={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label="Desfazer">
        <Undo className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onPressedChange={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label="Refazer">
        <Redo className="h-4 w-4" />
      </Toggle>

      {onToggleExpand && (
        <>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onToggleExpand} aria-label={isExpanded ? 'Recolher' : 'Expandir'}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </>
      )}
    </div>
  );
};

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Digite aqui...',
  className,
  minHeight = '150px',
  editable = true,
  isExpanded = false,
  onToggleExpand,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
        },
      }),
      Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage.configure({ HTMLAttributes: { class: 'rounded-md max-w-full h-auto' } }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3',
          'prose-headings:font-semibold prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0',
          'prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-0.5 prose-blockquote:px-2 prose-blockquote:my-2',
          'prose-pre:bg-muted prose-pre:text-foreground prose-img:rounded-md',
        ),
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Ressincroniza quando o conteúdo muda externamente
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notes/${fileName}`;
      const { error: uploadError } = await supabase.storage.from(NOTE_IMAGES_BUCKET).upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(NOTE_IMAGES_BUCKET).getPublicUrl(filePath);
      editor?.chain().focus().setImage({ src: urlData.publicUrl }).run();
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  }, [editor]);

  const handleImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Colar: imagem (Ctrl+V) faz upload; texto em markdown é convertido em documento formatado
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData;
      if (!cd) return;

      const imageFile = Array.from(cd.files).find((f) => f.type.startsWith('image/'));
      if (imageFile) {
        e.preventDefault();
        void uploadImage(imageFile);
        return;
      }

      const html = cd.getData('text/html');
      const text = cd.getData('text/plain');
      if (!html && text && looksLikeMarkdown(text)) {
        e.preventDefault();
        const converted = marked.parse(text, { async: false }) as string;
        editor.chain().focus().insertContent(converted).run();
      }
    };
    dom.addEventListener('paste', onPaste);
    return () => dom.removeEventListener('paste', onPaste);
  }, [editor, uploadImage]);

  const wordCount = editor ? editor.getText().trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className={cn('border border-input rounded-md bg-background flex flex-col min-h-0', className)}>
      {editable && (
        <MenuBar
          editor={editor}
          onImageUpload={() => fileInputRef.current?.click()}
          isUploading={isUploading}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      {editable && (
        <div className="flex items-center justify-end px-3 py-1 border-t border-border bg-muted/20 text-[11px] text-muted-foreground rounded-b-md">
          {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .ProseMirror:focus { outline: none; }
        .ProseMirror a { color: hsl(var(--primary)); text-decoration: underline; }
        /* Garante marcadores de lista (o reset do Tailwind os remove) */
        .ProseMirror ul { list-style: disc outside; padding-left: 1.5rem; }
        .ProseMirror ol { list-style: decimal outside; padding-left: 1.5rem; }
        .ProseMirror li { margin: 0.15rem 0; }
        .ProseMirror li p { margin: 0; }
        .ProseMirror h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; }
        .ProseMirror h2 { font-size: 1.35em; font-weight: 700; margin: 0.6em 0 0.3em; }
        .ProseMirror h3 { font-size: 1.15em; font-weight: 600; margin: 0.5em 0 0.25em; }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .ProseMirror ul[data-type="taskList"] li > label { margin-top: 0.2rem; }
        .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
        .ProseMirror ul[data-type="taskList"] input[type="checkbox"] { cursor: pointer; }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.375rem; }
        .ProseMirror img.ProseMirror-selectednode { outline: 2px solid hsl(var(--primary)); }
      `}</style>
    </div>
  );
}

export default RichTextEditor;
