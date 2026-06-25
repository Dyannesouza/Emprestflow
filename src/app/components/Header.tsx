import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Hamburger menu for mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden bg-[#de8f1700]"
          >
            <Menu className="h-6 w-6" />
          </Button>
          
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">
              Sistema de Controle e Cobrança
            </h2>
            <p className="text-xs md:text-sm text-gray-500">
              São Paulo - SP | Conforme LGPD
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <NotificationBell />
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}