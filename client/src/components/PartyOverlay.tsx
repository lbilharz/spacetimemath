import { ReactNode } from 'react';

interface PartyOverlayProps {
  icon: string | ReactNode;
  title?: string;
  message: string;
  subMessage?: string;
  subMessageClassName?: string;
  onClick: () => void;
}

export default function PartyOverlay({ 
  icon, 
  title = 'BÄÄM!', 
  message, 
  subMessage, 
  subMessageClassName = 'animate-pulse',
  onClick 
}: PartyOverlayProps) {
  return (
    <div 
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center bg-brand-yellow px-14 py-12 rounded-[40px] shadow-[0_20px_60px_rgba(250,204,21,0.4)] animate-in zoom-in slide-in-from-bottom-5 duration-500 text-center pt-8 cursor-pointer hover:scale-105 active:scale-95 transition-transform">
        <div className="text-[100px] leading-none mb-4 animate-[bounce_2s_infinite] drop-shadow-md">
          {icon}
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">
          {title}
        </h2>
        <p className="text-slate-800 text-[17px] font-bold mt-2 max-w-[300px]">
          {message}
        </p>
        {subMessage && (
          <p className={`text-slate-700/60 text-[10px] font-black uppercase mt-8 tracking-widest ${subMessageClassName}`}>
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
}
