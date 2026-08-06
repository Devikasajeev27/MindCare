import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { Link } from 'wouter';

interface CompanionCardProps {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'busy';
  bio: string;
  interests: string[];
  avatar: string;
}

export function CompanionCard({
  id, username, status, bio, interests, avatar
}: CompanionCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-card-hover transition-all duration-300 border-border bg-card">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <Avatar className="w-20 h-20 border-2 border-border">
              <AvatarImage src={avatar} alt={username} />
              <AvatarFallback>{username.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
              status === 'online' ? 'bg-green-500' : status === 'busy' ? 'bg-orange-500' : 'bg-gray-400'
            }`}></span>
          </div>
          <h3 className="font-bold text-lg text-foreground mb-1">{username}</h3>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 italic">"{bio}"</p>
          
          <div className="flex flex-wrap justify-center gap-1.5 mb-6">
            {interests.map(interest => (
              <Badge key={interest} variant="outline" className="text-xs rounded-full">
                {interest}
              </Badge>
            ))}
          </div>

          <Button asChild className="w-full rounded-full" disabled={status === 'offline'}>
            <Link href={`/companions/chat/${id}`}>
              <MessageCircle className="w-4 h-4 mr-2" />
              {status === 'online' ? 'Start Chat' : 'Offline'}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
