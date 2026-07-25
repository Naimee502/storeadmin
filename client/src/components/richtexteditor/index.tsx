import React, { useEffect, useRef } from 'react';
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaListUl,
  FaListOl,
  FaLink,
  FaHeading,
  FaParagraph,
  FaEraser,
} from 'react-icons/fa';

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Small, dependency-free WYSIWYG editor (contentEditable + execCommand) so
// About Us / Privacy Policy / Terms & Conditions content can have real
// formatting (bold, lists, links, headings) instead of a flat textarea.
// Stores/returns plain HTML — clientweb renders it directly.
const RichTextEditor: React.FC<RichTextEditorProps> = ({ label, value, onChange, disabled, placeholder }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Only push external value changes into the DOM when they didn't
  // originate from this editor (avoids clobbering cursor position while typing).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (cmd: string, arg?: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const ToolbarButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex items-center justify-center h-7 w-7 rounded text-gray-600 hover:bg-gray-200 disabled:opacity-40"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col w-full gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className={`rounded-lg border border-gray-300 overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1">
          <ToolbarButton title="Bold" onClick={() => exec('bold')}><FaBold size={12} /></ToolbarButton>
          <ToolbarButton title="Italic" onClick={() => exec('italic')}><FaItalic size={12} /></ToolbarButton>
          <ToolbarButton title="Underline" onClick={() => exec('underline')}><FaUnderline size={12} /></ToolbarButton>
          <span className="mx-1 h-4 w-px bg-gray-300" />
          <ToolbarButton title="Heading" onClick={() => exec('formatBlock', 'H3')}><FaHeading size={12} /></ToolbarButton>
          <ToolbarButton title="Paragraph" onClick={() => exec('formatBlock', 'P')}><FaParagraph size={12} /></ToolbarButton>
          <span className="mx-1 h-4 w-px bg-gray-300" />
          <ToolbarButton title="Bullet list" onClick={() => exec('insertUnorderedList')}><FaListUl size={12} /></ToolbarButton>
          <ToolbarButton title="Numbered list" onClick={() => exec('insertOrderedList')}><FaListOl size={12} /></ToolbarButton>
          <span className="mx-1 h-4 w-px bg-gray-300" />
          <ToolbarButton
            title="Insert link"
            onClick={() => {
              const url = window.prompt('Link URL (https://...)');
              if (url) exec('createLink', url);
            }}
          >
            <FaLink size={12} />
          </ToolbarButton>
          <ToolbarButton title="Clear formatting" onClick={() => exec('removeFormat')}><FaEraser size={12} /></ToolbarButton>
        </div>
        <div
          ref={ref}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          data-placeholder={placeholder}
          className="prose-sm min-h-[140px] max-h-[360px] overflow-y-auto px-3 py-2 text-sm leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_h3]:text-base [&_h3]:font-semibold empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
