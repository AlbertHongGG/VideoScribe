import React from "react";

interface SettingRowProps {
  label: string;
  description?: string;
  layout?: "grid" | "flex";
  children: React.ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({ label, description, layout = "flex", children }) => {
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center">
        <div>
          <label className="text-sm font-medium text-gray-300">{label}</label>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="md:col-span-2">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
};

export const SettingDivider: React.FC = () => {
  return <div className="h-px bg-white/5 w-full my-6"></div>;
};

interface SettingGroupProps {
  title: string;
  children: React.ReactNode;
}

export const SettingGroup: React.FC<SettingGroupProps> = ({ title, children }) => {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h4>
      <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-6">
        {children}
      </div>
    </div>
  );
};
