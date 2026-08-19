import { Image } from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useRef } from 'react';

// Node view com alça de redimensionamento no canto inferior direito
function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const width = node.attrs.width as number | null;

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current?.offsetWidth || 0;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(60, Math.round(startWidth + (ev.clientX - startX)));
      updateAttributes({ width: next });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <NodeViewWrapper
      className="tf-img-wrapper"
      style={{ display: 'inline-block', position: 'relative', lineHeight: 0, maxWidth: '100%' }}
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        draggable={false}
        style={{
          width: width ? `${width}px` : 'auto',
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '0.375rem',
          display: 'block',
          outline: selected ? '2px solid hsl(var(--primary))' : 'none',
          outlineOffset: '2px',
        }}
      />
      {selected && (
        <span
          onMouseDown={startResize}
          title="Arraste para redimensionar"
          style={{
            position: 'absolute',
            right: '-6px',
            bottom: '-6px',
            width: '14px',
            height: '14px',
            borderRadius: '9999px',
            background: 'hsl(var(--primary))',
            border: '2px solid #fff',
            cursor: 'nwse-resize',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('width');
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

export default ResizableImage;
