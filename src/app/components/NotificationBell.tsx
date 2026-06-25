import { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiCall } from '../lib/supabase';
import { Button } from './ui/button';

interface AdminNotif {
  id: string;
  type: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  read: boolean;
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const data = await apiCall('/admin/notifications');
      setNotifs(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      // silencioso — não atrapalha o painel se falhar
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // atualiza a cada 60s
    return () => clearInterval(interval);
  }, []);

  // Fechar o dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    // Ao abrir, marca as não lidas como lidas (zera o contador)
    if (next && unread > 0) {
      try {
        await apiCall('/admin/notifications/read', { method: 'POST' });
        setUnread(0);
        setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch {
        // mantém o estado se falhar
      }
    }
  };

  const openClient = (clientId: string) => {
    setOpen(false);
    navigate(`/clients/${clientId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={toggle} className="relative">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b font-semibold text-gray-800 text-sm">
            Notificações
          </div>
          {notifs.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">Nenhuma notificação</p>
          ) : (
            notifs.map((n) => (
              <button
                key={n.id}
                onClick={() => openClient(n.clientId)}
                className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                  !n.read ? 'bg-emerald-50/60' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-800">📋 Novo cadastro recebido</p>
                <p className="text-sm text-gray-600 truncate">{n.clientName}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleString('pt-BR')}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
