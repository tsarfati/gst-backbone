import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';

interface NavBarProps {
  scrollY: number;
  onSignIn: () => void;
}

export function NavBar({ scrollY, onSignIn }: NavBarProps) {
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrollY > 50
          ? 'backdrop-blur-lg shadow-lg border-b border-white/10 opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
      style={{ backgroundColor: scrollY > 50 ? 'rgba(15, 20, 25, 0.95)' : 'transparent' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2">
            <img src={builderlynkIcon} alt="BuilderLYNK" className="h-14 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Button
              onClick={onSignIn}
              variant="outline"
              className="border-white/50 text-gray-900 bg-white hover:bg-white/90"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
