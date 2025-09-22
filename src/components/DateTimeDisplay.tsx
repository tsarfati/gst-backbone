import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function DateTimeDisplay() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-sm text-muted-foreground font-medium">
      {format(currentDateTime, 'MMM dd, yyyy • h:mm:ss a')}
    </div>
  );
}