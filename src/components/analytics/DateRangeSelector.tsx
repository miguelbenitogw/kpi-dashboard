'use client';

interface DateRangeSelectorProps {
  selected: string;
  onChange: (range: string) => void;
}

const presets = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
];

export default function DateRangeSelector({
  selected,
  onChange,
}: DateRangeSelectorProps) {
  return (
    <div className="flex gap-2">
      {presets.map((preset) => (
        <button
          key={preset.value}
          onClick={() => onChange(preset.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            selected === preset.value
              ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/40'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
