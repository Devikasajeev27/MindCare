import React from 'react';

interface MoodPickerProps {
  selectedMood: number | null;
  onSelect: (moodValue: number) => void;
}

export function MoodPicker({ selectedMood, onSelect }: MoodPickerProps) {
  const moodLevels = [
    { value: 1, label: "Awful", icon: "😫" },
    { value: 2, label: "Bad", icon: "😞" },
    { value: 3, label: "Okay", icon: "😐" },
    { value: 4, label: "Good", icon: "🙂" },
    { value: 5, label: "Great", icon: "😁" },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {moodLevels.map((mood) => (
        <button
          key={mood.value}
          onClick={() => onSelect(mood.value)}
          className={`flex flex-col items-center p-3 rounded-xl transition-all duration-200 ${
            selectedMood === mood.value 
              ? 'bg-primary/10 ring-2 ring-primary scale-110' 
              : 'bg-muted hover:bg-muted/80 hover:scale-105'
          }`}
        >
          <span className="text-3xl mb-2 grayscale filter hover:grayscale-0 transition-all">{mood.icon}</span>
          <span className={`text-xs font-medium ${selectedMood === mood.value ? 'text-primary' : 'text-muted-foreground'}`}>
            {mood.label}
          </span>
        </button>
      ))}
    </div>
  );
}
