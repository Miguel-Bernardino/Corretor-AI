import React, { ReactNode } from 'react';
import { AppColors } from '../types';

interface ContainerProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export const TerminalContainer: React.FC<ContainerProps> = ({ children, title, className = "" }) => (
  <div className={`border border-[#00E5FF] bg-black/90 p-6 relative ${className}`}>
    {title && (
      <div className="absolute -top-3 left-4 bg-black px-2 text-[#00E5FF] text-sm font-bold uppercase tracking-widest">
        [{title}]
      </div>
    )}
    {children}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success';
}

export const TerminalButton: React.FC<ButtonProps> = ({ children, variant = 'primary', className = "", ...props }) => {
  let colors = "border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black";
  if (variant === 'success') {
    colors = "border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14] hover:text-black";
  } else if (variant === 'secondary') {
    colors = "border-[#E6E6E6] text-[#E6E6E6] hover:bg-[#E6E6E6] hover:text-black";
  }

  return (
    <button
      className={`border px-6 py-3 font-mono font-bold uppercase transition-all duration-200 active:scale-95 ${colors} ${className}`}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

export const TerminalInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    className="w-full bg-black border-b border-[#00E5FF] text-[#E6E6E6] py-2 px-1 focus:outline-none focus:border-[#39FF14] focus:bg-[#001100] transition-colors font-mono placeholder-gray-600"
    {...props}
  />
);

export const TerminalLabel: React.FC<{ children: ReactNode }> = ({ children }) => (
  <label className="block text-[#00E5FF] text-xs uppercase tracking-wider mb-1 mt-4">
    {children}
  </label>
);

export const FileUpload: React.FC<{
  label: string;
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}> = ({ label, onChange, accept = ".pdf,.jpg,.png", multiple = true }) => {
  const [fileNames, setFileNames] = React.useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Explicitly cast to File[] to fix 'Property name does not exist on type unknown' error
      const filesArray = Array.from(e.target.files) as File[];
      setFileNames(filesArray.map(f => f.name));
      onChange(filesArray);
    }
  };

  return (
    <div className="mt-4">
      <TerminalLabel>{label}</TerminalLabel>
      <div className="relative border border-dashed border-[#E6E6E6] hover:border-[#00E5FF] p-4 text-center cursor-pointer transition-colors group">
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
          accept={accept}
          multiple={multiple}
        />
        {fileNames.length > 0 ? (
          <div className="text-[#39FF14] text-sm">
            {fileNames.map(f => <div key={f}>{'>'} {f}</div>)}
          </div>
        ) : (
          <div className="text-gray-500 text-sm group-hover:text-[#00E5FF]">
            [CLIQUE PARA CARREGAR ARQUIVOS]
          </div>
        )}
      </div>
    </div>
  );
};