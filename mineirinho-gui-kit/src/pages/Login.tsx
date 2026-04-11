import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, UserPlus } from "lucide-react";
import { apiService } from "@/services/api";
import ConnectionStatus from "@/components/ConnectionStatus";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    username: "",
    password: "",
    email: "",
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const navigate = useNavigate();
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();

  // Verificar se existe algum usuário
  const { data: firstUserCheck, isLoading: checkingUsers, error: checkError } = useQuery({
    queryKey: ['checkFirstUser'],
    queryFn: () => apiService.checkFirstUser(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    refetchOnWindowFocus: false,
  });

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Erro ao fazer login",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao sistema Mineirinho de Ouro",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Usuário ou senha inválidos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFirstUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createUserData.username || !createUserData.password) {
      toast({
        title: "Erro ao criar usuário",
        description: "Username e senha são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      await register(createUserData.username, createUserData.password, createUserData.email);
      toast({
        title: "Usuário criado com sucesso!",
        description: "Agora você pode fazer login",
      });
      setShowCreateUser(false);
      setCreateUserData({ username: "", password: "", email: "" });
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Mineirinho de Ouro
          </CardTitle>
          <CardDescription className="text-center">
            Sistema de Gestão de Fábrica de Pão de Queijo
          </CardDescription>
          <div className="flex justify-center pt-1">
            <ConnectionStatus />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          {/* Mensagem de erro se o servidor não estiver disponível */}
          {checkError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                {checkError instanceof Error ? checkError.message : 'Erro ao conectar com o servidor'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Verifique se o aplicativo foi iniciado corretamente e tente novamente.
              </p>
            </div>
          )}

          {/* Botão para criar primeiro usuário */}
          {!checkingUsers && firstUserCheck && !firstUserCheck.hasUsers && (
            <div className="mt-4 pt-4 border-t">
              <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" type="button">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Criar Primeiro Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Primeiro Usuário</DialogTitle>
                    <DialogDescription>
                      Crie o primeiro usuário do sistema. Este usuário terá acesso completo ao sistema.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateFirstUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-username">Usuário *</Label>
                      <Input
                        id="create-username"
                        type="text"
                        placeholder="Digite o nome de usuário"
                        value={createUserData.username}
                        onChange={(e) => setCreateUserData({ ...createUserData, username: e.target.value })}
                        required
                        disabled={isCreatingUser}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-password">Senha *</Label>
                      <Input
                        id="create-password"
                        type="password"
                        placeholder="Digite a senha"
                        value={createUserData.password}
                        onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                        required
                        disabled={isCreatingUser}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-email">Email (opcional)</Label>
                      <Input
                        id="create-email"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={createUserData.email}
                        onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                        disabled={isCreatingUser}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowCreateUser(false);
                          setCreateUserData({ username: "", password: "", email: "" });
                        }}
                        disabled={isCreatingUser}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isCreatingUser}>
                        {isCreatingUser ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          "Criar Usuário"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
