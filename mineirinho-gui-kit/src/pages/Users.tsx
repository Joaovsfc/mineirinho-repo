import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight, KeyRound, Shield, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const Users = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isAdminResetPasswordDialogOpen, setIsAdminResetPasswordDialogOpen] = useState(false);
  const [selectedUserForPasswordReset, setSelectedUserForPasswordReset] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    is_admin: false,
  });
  const [changePasswordData, setChangePasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [adminResetPasswordData, setAdminResetPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Buscar usuários
  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiService.getUsers(),
  });

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return users.slice(startIndex, endIndex);
  }, [users, currentPage]);

  const totalPages = Math.ceil(users.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Mutation para criar usuário
  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; email?: string; is_admin?: boolean }) =>
      apiService.register(data.username, data.password, data.email, data.is_admin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Usuário cadastrado!",
        description: "O usuário foi criado com sucesso.",
      });
      setFormData({ username: "", password: "", email: "", is_admin: false });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para desativar/ativar usuário
  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) => {
      return apiService.toggleUserActive(id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: data.active ? "Usuário ativado!" : "Usuário desativado!",
        description: data.message || (data.active ? "O usuário foi ativado com sucesso." : "O usuário foi desativado com sucesso."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar status do usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para alterar senha
  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      apiService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast({
        title: "Senha alterada!",
        description: "Sua senha foi alterada com sucesso.",
      });
      setChangePasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsChangePasswordDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Erro ao alterar senha",
        variant: "destructive",
      });
    },
  });

  // Mutation para admin resetar senha de outro usuário
  const adminResetPasswordMutation = useMutation({
    mutationFn: ({ targetUserId, newPassword }: { targetUserId: number; newPassword: string }) => {
      return apiService.adminResetPassword(targetUserId, newPassword);
    },
    onSuccess: () => {
      toast({
        title: "Senha alterada!",
        description: `A senha do usuário foi alterada com sucesso.`,
      });
      setAdminResetPasswordData({
        newPassword: "",
        confirmPassword: "",
      });
      setIsAdminResetPasswordDialogOpen(false);
      setSelectedUserForPasswordReset(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Erro ao alterar senha",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast({
        title: "Erro ao cadastrar usuário",
        description: "Username e senha são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const userData = {
      username: formData.username,
      password: formData.password,
      email: formData.email || undefined,
      is_admin: user?.is_admin ? formData.is_admin : false, // Só admins podem criar outros admins
    };

    createMutation.mutate(userData);
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    if (id === user?.id) {
      toast({
        title: "Erro ao alterar status",
        description: "Você não pode desativar seu próprio usuário",
        variant: "destructive",
      });
      return;
    }
    toggleActiveMutation.mutate(id);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!changePasswordData.currentPassword || !changePasswordData.newPassword || !changePasswordData.confirmPassword) {
      toast({
        title: "Erro ao alterar senha",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      toast({
        title: "Erro ao alterar senha",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (changePasswordData.newPassword.length < 4) {
      toast({
        title: "Erro ao alterar senha",
        description: "A nova senha deve ter pelo menos 4 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erro ao alterar senha",
        description: "Usuário não encontrado",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: changePasswordData.currentPassword,
      newPassword: changePasswordData.newPassword,
    });
  };

  const handleAdminResetPassword = (userItem: any) => {
    setSelectedUserForPasswordReset(userItem);
    setIsAdminResetPasswordDialogOpen(true);
  };

  const handleAdminResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminResetPasswordData.newPassword || !adminResetPasswordData.confirmPassword) {
      toast({
        title: "Erro ao alterar senha",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (adminResetPasswordData.newPassword !== adminResetPasswordData.confirmPassword) {
      toast({
        title: "Erro ao alterar senha",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (adminResetPasswordData.newPassword.length < 4) {
      toast({
        title: "Erro ao alterar senha",
        description: "A nova senha deve ter pelo menos 4 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!selectedUserForPasswordReset || !user) {
      toast({
        title: "Erro ao alterar senha",
        description: "Usuário não encontrado",
        variant: "destructive",
      });
      return;
    }

    adminResetPasswordMutation.mutate({
      targetUserId: selectedUserForPasswordReset.id,
      newPassword: adminResetPasswordData.newPassword,
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return dateString;
    }
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerenciar usuários do sistema</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Erro ao carregar usuários</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerenciar usuários do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Alterar Minha Senha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Senha</DialogTitle>
                  <DialogDescription>
                    Digite sua senha atual e a nova senha desejada.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Senha Atual *</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={changePasswordData.currentPassword}
                      onChange={(e) => setChangePasswordData({ ...changePasswordData, currentPassword: e.target.value })}
                      placeholder="Digite sua senha atual"
                      required
                      disabled={changePasswordMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha *</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={changePasswordData.newPassword}
                      onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                      placeholder="Digite a nova senha (mínimo 4 caracteres)"
                      required
                      disabled={changePasswordMutation.isPending}
                      minLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={changePasswordData.confirmPassword}
                      onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                      placeholder="Confirme a nova senha"
                      required
                      disabled={changePasswordMutation.isPending}
                      minLength={4}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsChangePasswordDialogOpen(false);
                        setChangePasswordData({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                      }}
                      disabled={changePasswordMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={changePasswordMutation.isPending}>
                      {changePasswordMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Alterando...
                        </>
                      ) : (
                        "Alterar Senha"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo usuário no sistema.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Digite o nome de usuário"
                    required
                    disabled={createMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Digite a senha"
                    required
                    disabled={createMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@exemplo.com"
                    disabled={createMutation.isPending}
                  />
                </div>
                {user?.is_admin && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_admin"
                      checked={formData.is_admin}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked === true })}
                      disabled={createMutation.isPending}
                    />
                    <Label htmlFor="is_admin" className="flex items-center gap-2 cursor-pointer">
                      <Shield className="h-4 w-4" />
                      Criar como Administrador
                    </Label>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setFormData({ username: "", password: "", email: "", is_admin: false });
                    }}
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Modal para Admin Resetar Senha de Outro Usuário */}
      <Dialog open={isAdminResetPasswordDialogOpen} onOpenChange={setIsAdminResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha do Usuário</DialogTitle>
            <DialogDescription>
              {selectedUserForPasswordReset && (
                <>Defina uma nova senha para o usuário <strong>{selectedUserForPasswordReset.username}</strong>. Você não precisa saber a senha atual.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminResetPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminNewPassword">Nova Senha *</Label>
              <Input
                id="adminNewPassword"
                type="password"
                value={adminResetPasswordData.newPassword}
                onChange={(e) => setAdminResetPasswordData({ ...adminResetPasswordData, newPassword: e.target.value })}
                placeholder="Digite a nova senha (mínimo 4 caracteres)"
                required
                disabled={adminResetPasswordMutation.isPending}
                minLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminConfirmPassword">Confirmar Nova Senha *</Label>
              <Input
                id="adminConfirmPassword"
                type="password"
                value={adminResetPasswordData.confirmPassword}
                onChange={(e) => setAdminResetPasswordData({ ...adminResetPasswordData, confirmPassword: e.target.value })}
                placeholder="Confirme a nova senha"
                required
                disabled={adminResetPasswordMutation.isPending}
                minLength={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdminResetPasswordDialogOpen(false);
                  setAdminResetPasswordData({
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setSelectedUserForPasswordReset(null);
                }}
                disabled={adminResetPasswordMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={adminResetPasswordMutation.isPending}>
                {adminResetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Alterar Senha"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum usuário cadastrado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((userItem: any) => (
                  <TableRow key={userItem.id}>
                    <TableCell>{userItem.id}</TableCell>
                    <TableCell className="font-medium">{userItem.username}</TableCell>
                    <TableCell>{userItem.email || "-"}</TableCell>
                    <TableCell>
                      {userItem.is_admin ? (
                        <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Usuário</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {userItem.active !== false ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                          <UserX className="h-3 w-3 mr-1" />
                          Desativado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(userItem.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user?.is_admin && userItem.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAdminResetPassword(userItem)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Redefinir senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        {userItem.id !== user?.id && user?.is_admin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={userItem.active !== false ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                                title={userItem.active !== false ? "Desativar usuário" : "Ativar usuário"}
                              >
                                {userItem.active !== false ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {userItem.active !== false ? "Confirmar desativação" : "Confirmar ativação"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {userItem.active !== false ? (
                                    <>
                                      Tem certeza que deseja desativar o usuário "{userItem.username}"? 
                                      O usuário não poderá mais fazer login, mas seus dados serão mantidos para histórico.
                                    </>
                                  ) : (
                                    <>
                                      Tem certeza que deseja ativar o usuário "{userItem.username}"? 
                                      O usuário poderá fazer login novamente no sistema.
                                    </>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleToggleActive(userItem.id, userItem.active !== false)}
                                  className={userItem.active !== false ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-green-600 text-white hover:bg-green-700"}
                                  disabled={toggleActiveMutation.isPending}
                                >
                                  {toggleActiveMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      {userItem.active !== false ? "Desativando..." : "Ativando..."}
                                    </>
                                  ) : (
                                    userItem.active !== false ? "Desativar" : "Ativar"
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Paginação */}
          {users.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, users.length)} de {users.length} usuário(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Anterior</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px]"
                        >
                          {page}
                        </Button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return (
                        <span key={page} className="px-2 text-muted-foreground">...</span>
                      );
                    }
                    return null;
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Users;

