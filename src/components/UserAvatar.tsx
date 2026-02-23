import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** Resolved avatar URL (from useUserAvatar / useUserAvatars / direct) */
  src?: string | null;
  /** Full name for initials fallback */
  name: string;
  /** Additional className for the Avatar root */
  className?: string;
  /** Additional className for the fallback */
  fallbackClassName?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Standardized user avatar with initials fallback.
 * Use with useUserAvatar/useUserAvatars hooks for the full
 * avatar → punch photo → initials cascade.
 */
const UserAvatar = React.forwardRef<HTMLDivElement, UserAvatarProps>(
  ({ src, name, className, fallbackClassName }, ref) => {
    return (
      <Avatar ref={ref} className={cn('h-9 w-9', className)}>
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback className={cn('bg-primary/10 text-primary text-sm', fallbackClassName)}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  }
);

UserAvatar.displayName = 'UserAvatar';

export default UserAvatar;
