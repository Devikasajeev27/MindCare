import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { useCurrency } from '@/context/CurrencyContext';

interface TherapistCardProps {
  id: string;
  name: string;
  title: string;
  specializations: string[];
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  consultationFee: number;
  availability: string;
  avatar: string;
}

export function TherapistCard({
  id, name, title, specializations, rating, reviewCount, yearsExperience, consultationFee, availability, avatar
}: TherapistCardProps) {
  const { format } = useCurrency();

  return (
    <Card className="overflow-hidden hover:shadow-card-hover transition-all duration-300 border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16 border border-border">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <div className="flex items-center gap-1 text-sm mb-3">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-foreground">{rating}</span>
              <span className="text-muted-foreground">({reviewCount} reviews)</span>
              <span className="text-muted-foreground mx-2">•</span>
              <span className="text-muted-foreground">{yearsExperience} yrs exp.</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {specializations.map(spec => (
                <Badge key={spec} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                  {spec}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 border-t flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">{format(consultationFee)} <span className="text-muted-foreground font-normal">/ session</span></div>
          <div className="text-xs flex items-center gap-1 text-green-600 mt-1 font-medium">
            <Clock className="w-3 h-3" /> {availability}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full">Profile</Button>
          <Button size="sm" className="rounded-full">Book</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
