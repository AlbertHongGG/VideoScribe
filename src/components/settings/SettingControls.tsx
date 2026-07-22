import React from "react";
import { Select } from "../ui/Select";
import { Toggle } from "../ui/Toggle";
import { Slider } from "../ui/Slider";
import { useSettingChange } from "../../hooks/useSettingChange";

export interface SettingSelectProps {
  settingKey: string;
  value: string;
  options: { value: string; label: string }[];
  setter: (val: string) => void;
  sideEffect?: (val: string) => void;
}

export const SettingSelect: React.FC<SettingSelectProps> = ({ settingKey, value, options, setter, sideEffect }) => {
  const handleChange = useSettingChange<string>();
  return <Select options={options} value={value} onChange={(val) => handleChange(settingKey, val, setter, sideEffect)} />;
};

export interface SettingToggleProps {
  settingKey: string;
  checked: boolean;
  setter: (val: boolean) => void;
  sideEffect?: (val: boolean) => void;
}

export const SettingToggle: React.FC<SettingToggleProps> = ({ settingKey, checked, setter, sideEffect }) => {
  const handleChange = useSettingChange<boolean>();
  return <Toggle checked={checked} onChange={(val) => handleChange(settingKey, val, setter, sideEffect)} />;
};

export interface SettingSliderProps {
  settingKey: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  setter: (val: number) => void;
  sideEffect?: (val: number) => void;
}

export const SettingSlider: React.FC<SettingSliderProps> = ({ settingKey, label, value, min, max, unit, setter, sideEffect }) => {
  const handleChange = useSettingChange<number>();
  return <Slider label={label} value={value} min={min} max={max} unit={unit} onChange={(val) => handleChange(settingKey, val, setter, sideEffect)} />;
};
