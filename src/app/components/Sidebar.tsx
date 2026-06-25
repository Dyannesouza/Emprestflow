import { Link, useLocation } from 'react-router';
import { Home, Users, FileText, Shield, DollarSign, MessageSquare, X, UserCog, KeyRound, Calendar } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Clientes', href: '/clients', icon: Users },
    { name: 'Contratos', href: '/contracts', icon: FileText },
    { name: '📅 Cobranças', href: '/automatic-billing', icon: Calendar },
    { name: 'Whatsapp', href: '/reminders', icon:  MessageSquare},
    { name: '🔑 Alterar Senha', href: '/change-password', icon: KeyRound },
    ...(user?.role === 'admin' ? [
      { name: 'Financeiro', href: '/financial', icon: DollarSign },
      { name: '👥 Usuários', href: '/users', icon: UserCog },
      { name: '🔒 Segurança', href: '/security', icon: Shield },
    ] : []),
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col
        transform transition-transform duration-300 ease-in-out border-r-4 border-amber-500
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 text-amber-300 hover:text-amber-400"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="p-6 border-b-2 border-amber-500/30">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ALEMÃO.CREFISA" className="h-12 w-12 object-contain rounded-full drop-shadow-md" />
            <div>
              <h1 className="text-xl font-bold text-amber-400">ALEMÃO.CREFISA</h1>
              <p className="text-xs text-emerald-100">Sistema de Gestão</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-[10px]">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));

              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-1.5 rounded-lg transition-colors ${ isActive ? 'bg-amber-500 text-emerald-950 font-semibold shadow-lg' : 'text-emerald-100 hover:bg-emerald-800 hover:text-amber-300' } p-[10px]`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t-2 border-amber-500/30 p-[10px]">
          <div className="text-sm">
            <p className="font-semibold text-amber-400">{user?.name}</p>
            <p className="text-xs text-emerald-100">{user?.email}</p>
            <p className="text-xs mt-2">
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                user?.role === 'admin' ? 'bg-amber-600 text-emerald-950' : 'bg-emerald-700 text-amber-100'
              }`}>
                {user?.role === 'admin' ? 'Administrador' : 'Cliente'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}