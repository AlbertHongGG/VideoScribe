import React from "react";

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => {
  return (
    <section className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-sm hover:border-white/10 transition-colors">
      <h3 className="text-sm font-bold tracking-widest text-gray-200 uppercase mb-6 flex items-center gap-2">
        <div className="w-1 h-3.5 bg-[#facc15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
        {title}
      </h3>
      <div className="space-y-6">
        {children}
      </div>
    </section>
  );
};
