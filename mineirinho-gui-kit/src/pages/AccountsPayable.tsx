import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

const AccountsPayable = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"asc" | "desc" | null>("asc"); // Padrão: mais antigo primeiro (vencimento)
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    description: "",
    value: "",
    dueDate: "",
  });

  // Buscar contas a pagar
  const { data: accounts = [], isLoading, isError } = useQuery({
    queryKey: ['accountsPayable'],
    queryFn: () => apiService.getAccountsPayable(),
  });

  // Filtrar e ordenar contas
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    // Filtrar por status
    if (statusFilter !== "all") {
      filtered = filtered.filter((account: any) => {
        const accountStatus = account.status || "Pendente";
        if (statusFilter === "Vencido") {
          // Verificar se está vencida
          if (accountStatus === "Pago") return false;
          if (account.due_date) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            return account.due_date < todayStr;
          }
          return false;
        }
        return accountStatus === statusFilter;
      });
    }
    
    // Filtrar por data de vencimento
    if (dateFrom) {
      filtered = filtered.filter((account: any) => {
        if (!account.due_date) return false;
        return account.due_date >= dateFrom;
      });
    }
    
    if (dateTo) {
      filtered = filtered.filter((account: any) => {
        if (!account.due_date) return false;
        return account.due_date <= dateTo;
      });
    }
    
    // Ordenar por data de vencimento
    if (dateSort) {
      filtered = [...filtered].sort((a: any, b: any) => {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
        return dateSort === "asc" ? dateA - dateB : dateB - dateA;
      });
    }
    
    return filtered;
  }, [accounts, statusFilter, dateSort, dateFrom, dateTo]);

  // Mutation para criar conta
  const createMutation = useMutation({
    mutationFn: (data: { description: string; value: number; due_date: string }) =>
      apiService.createAccountPayable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      toast({
        title: "Conta cadastrada!",
        description: "A conta a pagar foi adicionada com sucesso.",
      });
      setFormData({ description: "", value: "", dueDate: "" });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar conta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para marcar como pago
  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, payment_method }: { id: number; payment_method: string }) =>
      apiService.updateAccountPayable(id, {
        status: "Pago",
        paid_date: new Date().toISOString().split('T')[0],
        payment_method: payment_method,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      toast({
        title: "Pagamento registrado!",
        description: "A conta foi marcada como paga.",
      });
      setIsPaymentDialogOpen(false);
      setSelectedAccountId(null);
      setPaymentMethod("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar conta
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteAccountPayable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      toast({
        title: "Conta deletada!",
        description: "A conta foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar conta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const accountData = {
      description: formData.description,
      value: parseFloat(formData.value),
      due_date: formData.dueDate,
    };
    createMutation.mutate(accountData);
  };

  const handlePayment = (id: number) => {
    setSelectedAccountId(id);
    setIsPaymentDialogOpen(true);
  };

  const confirmPayment = () => {
    if (!paymentMethod) {
      toast({
        title: "Forma de pagamento obrigatória",
        description: "Selecione a forma de pagamento.",
        variant: "destructive",
      });
      return;
    }
    if (selectedAccountId) {
      markAsPaidMutation.mutate({ id: selectedAccountId, payment_method: paymentMethod });
    }
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const pending = accounts.filter((acc: any) => acc.status === "Pendente");
    const paid = accounts.filter((acc: any) => acc.status === "Pago");
    // Obter data de hoje no formato YYYY-MM-DD sem problemas de timezone
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dueToday = pending.filter((acc: any) => acc.due_date === todayStr);

    const totalPending = pending.reduce((sum: number, acc: any) => sum + parseFloat(acc.value || 0), 0);

    return {
      totalPending,
      pendingCount: pending.length,
      dueTodayCount: dueToday.length,
      paidCount: paid.length,
    };
  }, [accounts]);

  const getStatusBadge = (status: string, dueDate?: string) => {
    if (status === "Pago") {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Pago</Badge>;
    }
    
    // Verificar se está vencida
    if (dueDate && (status === "Pendente" || !status)) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      if (dueDate < todayStr) {
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Vencido</Badge>;
      }
    }
    
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
  };

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAccounts.slice(startIndex, endIndex);
  }, [filteredAccounts, currentPage]);

  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, statusFilter, dateSort, dateFrom, dateTo]);

  // Handler para alternar ordenação por data de vencimento
  const handleDateSort = () => {
    if (dateSort === null || dateSort === "desc") {
      setDateSort("asc");
    } else {
      setDateSort("desc");
    }
  };

  const totalPending = accounts
    .filter(acc => acc.status === "Pendente")
    .reduce((sum, acc) => sum + parseFloat(acc.value), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-muted-foreground">Gerencie seus compromissos financeiros</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Conta a Pagar</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Fornecedor - Matéria Prima"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="value">Valor (R$)</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Vencimento</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Cadastrar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive">
                  R$ {stats.totalPending.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingCount} contas em aberto
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencendo Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats.dueTodayCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.dueTodayCount === 0 ? "Nenhuma conta vencendo" : "conta(s) vencendo hoje"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pagas este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold text-success">
                  {stats.paidCount}
                </div>
                <p className="text-xs text-muted-foreground">Contas quitadas</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Contas a Pagar</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm">Filtrar por status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Vencido">Vencido</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="date-from" className="text-sm">Vencimento inicial:</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date-to" className="text-sm">Vencimento final:</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Limpar filtros de data
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando contas...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">Erro ao carregar contas. Tente novamente.</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                {accounts.length === 0 
                  ? "Nenhuma conta a pagar cadastrada ainda."
                  : "Nenhuma conta encontrada com o filtro selecionado."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={handleDateSort}
                    >
                      Vencimento
                      {dateSort === "asc" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                      ) : dateSort === "desc" ? (
                        <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((account: any) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.description}</TableCell>
                    <TableCell>
                      {account.due_date 
                        ? (() => {
                            // Parse a data sem considerar timezone para evitar problemas de d-1
                            const [year, month, day] = account.due_date.split('-');
                            return `${day}/${month}/${year}`;
                          })()
                        : "-"
                      }
                    </TableCell>
                    <TableCell>R$ {parseFloat(account.value || 0).toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(account.status || "Pendente", account.due_date)}</TableCell>
                    <TableCell>
                      {account.payment_method ? (
                        <Badge variant="outline">{account.payment_method}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(account.status === "Pendente" || !account.status) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePayment(account.id)}
                          disabled={markAsPaidMutation.isPending}
                        >
                          {markAsPaidMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Marcar como Pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Paginação */}
          {filteredAccounts.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAccounts.length)} de {filteredAccounts.length} conta(s)
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

      {/* Dialog para selecionar forma de pagamento */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Selecione a forma de pagamento para confirmar o pagamento desta conta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPaymentDialogOpen(false);
                  setPaymentMethod("");
                }}
                disabled={markAsPaidMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmPayment}
                disabled={markAsPaidMutation.isPending || !paymentMethod}
              >
                {markAsPaidMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  "Confirmar Pagamento"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsPayable;
