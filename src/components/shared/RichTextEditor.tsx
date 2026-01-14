import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const modules = {
  toolbar: [
    [{ 'font': ['', 'arial', 'times-new-roman', 'georgia', 'verdana', 'courier-new', 'trebuchet-ms'] }],
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    ['clean'],
  ],
};

const formats = [
  'font',
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'align',
  'link',
];

export const RichTextEditor = ({ value, onChange, placeholder, className }: RichTextEditorProps) => {
  const [QuillComponent, setQuillComponent] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Dynamically import react-quill only on client side
    const loadQuill = async () => {
      try {
        const ReactQuill = (await import('react-quill')).default;
        const Quill = (await import('quill')).default;
        await import('react-quill/dist/quill.snow.css');
        
        // Register custom fonts
        const Font = Quill.import('formats/font') as any;
        Font.whitelist = ['arial', 'times-new-roman', 'georgia', 'verdana', 'courier-new', 'trebuchet-ms'];
        Quill.register(Font, true);
        
        setQuillComponent(() => ReactQuill);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load rich text editor:', error);
      }
    };
    
    loadQuill();
  }, []);

  if (!isLoaded || !QuillComponent) {
    return (
      <div className={`rich-text-editor ${className || ''}`}>
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className={`rich-text-editor ${className || ''}`}>
      <QuillComponent
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
};
