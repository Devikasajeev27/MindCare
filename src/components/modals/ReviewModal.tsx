import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  therapistName: string;
}

export function ReviewModal({ open, onOpenChange, therapistName }: ReviewModalProps) {
  const [rating, setRating] = React.useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your session?</DialogTitle>
          <DialogDescription>
            Please rate your recent session with {therapistName}. Your feedback helps us maintain quality care.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star}
                onClick={() => setRating(star)}
                className={`p-2 transition-transform hover:scale-110`}
              >
                <Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
              </button>
            ))}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Feedback (Optional)</label>
            <Textarea 
              placeholder="What went well? What could be improved?"
              className="resize-none h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Skip</Button>
          <Button onClick={() => onOpenChange(false)} disabled={rating === 0}>Submit Review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
