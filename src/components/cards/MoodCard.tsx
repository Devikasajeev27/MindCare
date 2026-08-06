import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface MoodCardProps {
  mood: string;
  description: string;
  trend?: string;
}

export function MoodCard({ mood, description, trend }: MoodCardProps) {
  return (
    <Card className="bg-card border-none shadow-card hover:shadow-card-hover transition-all">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Current Mood</p>
            <div className="text-3xl font-bold text-foreground">{mood}</div>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Activity className="w-6 h-6 text-blue-500" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">{description}</p>
        {trend && <p className="text-sm text-green-500 mt-1 font-medium">{trend}</p>}
      </CardContent>
    </Card>
  );
}
