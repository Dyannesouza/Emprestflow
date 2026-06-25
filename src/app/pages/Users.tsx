import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { apiCall } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Users as UsersIcon, 
  Search, 
  Trash2, 
  KeyRound, 
  AlertTriangle,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  MoreVertical,
  CheckCircle,
  UserPlus,
  Eye,
  EyeOff,
  Shuffle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  createdAt: string;
  lastLogin?: string;
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Reset password confirmation dialog
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetting, setResetting] = useState(false);

  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as 'admin' | 'operator',
  });

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, filterRole, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Fetch from backend
      const data = await apiCall('/users');
      setUsers(data.users || []);

      // Show success message with breakdown
      const adminCount = (data.users || []).filter(u => u.role === 'admin').length;
      const operatorCount = (data.users || []).filter(u => u.role === 'operator').length;

      toast.success(
        <div>
          <p className="font-semibold">✅ {data.users?.length || 0} usuários carregados</p>
          <p className="text-xs mt-1">
            {adminCount} administrador(es) • {operatorCount} funcionário(s)
          </p>
        </div>,
        { duration: 4000 }
      );
    } catch (error: any) {
      console.error('Error loading users:', error);

      // Show detailed error message
      toast.error(
        <div>
          <p className="font-semibold">❌ Erro ao carregar usuários</p>
          <p className="text-xs mt-1">{error.message || 'Erro desconhecido'}</p>
          <p className="text-xs mt-1">Verifique se o backend está configurado corretamente.</p>
        </div>,
        { duration: 8000 }
      );

      // Show at least current user on error
      if (currentUser) {
        setUsers([{
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
          createdAt: new Date().toISOString(),
        }]);

        toast.info(
          <div>
            <p className="font-semibold">ℹ️ Mostrando apenas seu usuário</p>
            <p className="text-xs mt-1">O backend precisa estar configurado para listar todos os usuários.</p>
          </div>,
          { duration: 5000 }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Filter by role
    if (filterRole !== 'all') {
      filtered = filtered.filter(u => u.role === filterRole);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    }

    setFilteredUsers(filtered);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      await apiCall(`/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      toast.success('Usuário excluído com sucesso');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPasswordClick = (user: User) => {
    setUserToReset(user);
    setResetPasswordDialogOpen(true);
  };

  const handleResetPasswordConfirm = async () => {
    if (!userToReset) return;

    try {
      setResetting(true);
      const result = await apiCall(`/users/${userToReset.id}/reset-password`, {
        method: 'POST',
      });
      toast.success(
        <div>
          <p className="font-semibold">Senha resetada com sucesso!</p>
          <p className="text-sm mt-1">Nova senha: <strong>{result.newPassword}</strong></p>
          <p className="text-xs text-gray-500 mt-1">Anote esta senha e envie ao usuário</p>
        </div>,
        { duration: 10000 }
      );
      setResetPasswordDialogOpen(false);
      setUserToReset(null);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erro ao resetar senha');
    } finally {
      setResetting(false);
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let password = '';
    
    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%&*'[Math.floor(Math.random() * 7)]; // special
    
    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleCreateUserClick = () => {
    setNewUser({
      name: '',
      email: '',
      password: generateRandomPassword(),
      role: 'operator',
    });
    setCreateDialogOpen(true);
  };

  const handleCreateUser = async () => {
    // Validate fields
    if (!newUser.name.trim()) {
      toast.error('Por favor, informe o nome do usuário');
      return;
    }
    if (!newUser.email.trim()) {
      toast.error('Por favor, informe o e-mail do usuário');
      return;
    }
    if (!newUser.password.trim()) {
      toast.error('Por favor, informe a senha do usuário');
      return;
    }
    if (newUser.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    try {
      setCreating(true);

      // Create user via backend
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUser.name.trim(),
          email: newUser.email.trim().toLowerCase(),
          password: newUser.password,
          role: newUser.role,
        }),
      });

      toast.success(
        <div>
          <p className="font-semibold">✅ Usuário criado com sucesso!</p>
          <p className="text-sm mt-1">E-mail: {newUser.email}</p>
          <p className="text-sm">Senha: <strong>{newUser.password}</strong></p>
          <p className="text-xs text-gray-500 mt-1">⚠️ Anote esta senha e envie ao usuário</p>
        </div>,
        { duration: 10000 }
      );

      setCreateDialogOpen(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'operator',
      });
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(
        <div>
          <p className="font-semibold">❌ Erro ao criar usuário</p>
          <p className="text-xs mt-1">{error.message || 'Erro desconhecido'}</p>
        </div>,
        { duration: 8000 }
      );
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-600 text-white"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
      case 'operator':
        return <Badge className="bg-emerald-600 text-white"><UsersIcon className="h-3 w-3 mr-1" />Funcionário</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Check authorization
  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            Acesso negado. Esta funcionalidade está disponível apenas para administradores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-gray-600 mt-1">
            Visualize, gerencie e controle o acesso de todos os usuários do sistema
          </p>
        </div>
        <Button
          onClick={handleCreateUserClick}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Administradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {users.filter(u => u.role === 'operator').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Role filter */}
            <div className="md:w-48">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Todos os tipos</option>
                <option value="admin">Administradores</option>
                <option value="operator">Funcionários</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs">Nome</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs">Tipo</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs">Cadastro</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700 text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      <UserX className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">Nenhum usuário encontrado</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-gray-900 truncate">{user.name}</span>
                            <span className="text-gray-600 text-xs truncate">{user.email}</span>
                            {user.id === currentUser?.id && (
                              <Badge variant="outline" className="text-[10px] w-fit px-1 py-0 mt-0.5">Você</Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-gray-600 text-xs whitespace-nowrap">{formatDate(user.createdAt)}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleResetPasswordClick(user)}
                              className="cursor-pointer text-sm"
                            >
                              <KeyRound className="h-3.5 w-3.5 mr-2" />
                              Resetar Senha
                            </DropdownMenuItem>
                            {user.id !== currentUser?.id && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(user)}
                                className="cursor-pointer text-red-600 focus:text-red-600 text-sm"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Excluir Usuário
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?
                </p>
                <p className="mt-4">
                  <span className="text-red-600 font-semibold">Esta ação não pode ser desfeita!</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Excluir Usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Confirmation Dialog */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Resetar Senha
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Deseja resetar a senha do usuário <strong>{userToReset?.name}</strong> ({userToReset?.email})?
                </p>
                <p className="mt-4">
                  Uma nova senha temporária será gerada automaticamente. Você deverá anotar e enviar esta senha ao usuário.
                </p>
                <Alert className="mt-4 border-blue-200 bg-blue-50">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900 text-sm">
                    <strong>Importante:</strong> A nova senha será exibida apenas uma vez após a confirmação. Anote-a com cuidado.
                  </AlertDescription>
                </Alert>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPasswordConfirm}
              disabled={resetting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {resetting ? 'Resetando...' : 'Resetar Senha'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Adicionar Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                disabled={creating}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="Ex: joao.silva@empresa.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                disabled={creating}
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Usuário *</Label>
              <select
                id="role"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                disabled={creating}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="operator">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="text-xs text-gray-500">
                {newUser.role === 'admin' && '⚠️ Acesso total ao sistema (financeiro, edição de clientes, usuários e configurações)'}
                {newUser.role === 'operator' && 'Acesso restrito: NÃO vê o Financeiro nem edita clientes. Pode ver clientes, criar contratos e registrar cobranças.'}
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Senha Temporária *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    disabled={creating}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewUser({ ...newUser, password: generateRandomPassword() })}
                  disabled={creating}
                  title="Gerar senha aleatória"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                💡 Use o botão <Shuffle className="h-3 w-3 inline" /> para gerar uma senha segura automaticamente
              </p>
            </div>

            {/* Warning Alert */}
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                <strong>Importante:</strong> Anote a senha antes de criar o usuário. Ela será exibida novamente após a criação.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={creating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {creating ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}