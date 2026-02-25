import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, X, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

const Clients = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    cnpj_cpf: "",
    state_registration: "",
    buyer_name: "",
    price_tier: "1",
  });
  const [phones, setPhones] = useState<Array<{ phone: string; phone_type: string }>>([
    { phone: "", phone_type: "Principal" }
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Buscar clientes
  const { data: clients = [], isLoading, isError } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiService.getClients(),
  });

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return clients.slice(startIndex, endIndex);
  }, [clients, currentPage]);

  const totalPages = Math.ceil(clients.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Mutation para criar cliente
  const createMutation = useMutation({
    mutationFn: (data: { 
      name: string; 
      email?: string; 
      address?: string;
      cnpj_cpf?: string;
      state_registration?: string;
      buyer_name?: string;
      price_tier?: number;
      phones?: Array<{ phone: string; phone_type: string }>;
    }) =>
      apiService.createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Cliente cadastrado!",
        description: "O cliente foi adicionado com sucesso.",
      });
      setFormData({ name: "", email: "", address: "", cnpj_cpf: "", state_registration: "", buyer_name: "", price_tier: "1" });
      setPhones([{ phone: "", phone_type: "Principal" }]);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar cliente
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { 
      id: number; 
      data: { 
        name?: string; 
        email?: string; 
        address?: string;
        cnpj_cpf?: string;
        state_registration?: string;
        buyer_name?: string;
        price_tier?: number;
        phones?: Array<{ phone: string; phone_type: string }>;
      } 
    }) =>
      apiService.updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Cliente atualizado!",
        description: "O cliente foi atualizado com sucesso.",
      });
      setFormData({ name: "", email: "", address: "", cnpj_cpf: "", state_registration: "", buyer_name: "", price_tier: "1" });
      setPhones([{ phone: "", phone_type: "Principal" }]);
      setEditingClient(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar cliente
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Cliente deletado!",
        description: "O cliente foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clientData = {
      name: formData.name,
      email: formData.email || undefined,
      address: formData.address || undefined,
      cnpj_cpf: formData.cnpj_cpf || undefined,
      state_registration: formData.state_registration || undefined,
      buyer_name: formData.buyer_name || undefined,
      price_tier: parseInt(formData.price_tier) || 1,
      phones: phones.filter(p => p.phone.trim() !== ""),
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient, data: clientData });
    } else {
      createMutation.mutate(clientData);
    }
  };

  const addPhone = () => {
    setPhones([...phones, { phone: "", phone_type: "Secundário" }]);
  };

  const removePhone = (index: number) => {
    if (phones.length > 1) {
      setPhones(phones.filter((_, i) => i !== index));
    }
  };

  const updatePhone = (index: number, field: 'phone' | 'phone_type', value: string) => {
    const updatedPhones = [...phones];
    updatedPhones[index] = { ...updatedPhones[index], [field]: value };
    setPhones(updatedPhones);
  };

  const handleEdit = (client: any) => {
    setEditingClient(client.id);
    setFormData({
      name: client.name || "",
      email: client.email || "",
      address: client.address || "",
      cnpj_cpf: client.cnpj_cpf || "",
      state_registration: client.state_registration || "",
      buyer_name: client.buyer_name || "",
      price_tier: client.price_tier?.toString() || "1",
    });
    // Carregar telefones do cliente
    if (client.phones && client.phones.length > 0) {
      setPhones(client.phones.map((p: any) => ({ phone: p.phone || "", phone_type: p.phone_type || "Principal" })));
    } else {
      setPhones([{ phone: "", phone_type: "Principal" }]);
    }
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar este cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewClient = () => {
    setEditingClient(null);
    setFormData({ name: "", email: "", address: "", cnpj_cpf: "", state_registration: "", buyer_name: "", price_tier: "1" });
    setPhones([{ phone: "", phone_type: "Principal" }]);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewClient}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Editar Cliente" : "Cadastrar Cliente"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome/Razão Social *</Label>
                <Input
                  id="clientName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Padaria Central Ltda"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj_cpf">CNPJ/CPF</Label>
                  <Input
                    id="cnpj_cpf"
                    value={formData.cnpj_cpf}
                    onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input
                    id="state_registration"
                    value={formData.state_registration}
                    onChange={(e) => setFormData({ ...formData, state_registration: e.target.value })}
                    placeholder="000.000.000.000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer_name">Nome do Comprador</Label>
                <Input
                  id="buyer_name"
                  value={formData.buyer_name}
                  onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                  placeholder="Nome da pessoa responsável pelas compras"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="price_tier">Faixa de Preço</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          A faixa de preço determina qual preço do produto será aplicado automaticamente 
                          nas vendas para este cliente. Cada produto pode ter até 4 faixas de preço diferentes.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select
                  value={formData.price_tier}
                  onValueChange={(value) => setFormData({ ...formData, price_tier: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a faixa de preço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Faixa 1 - Preço Padrão</SelectItem>
                    <SelectItem value="2">Faixa 2</SelectItem>
                    <SelectItem value="3">Faixa 3</SelectItem>
                    <SelectItem value="4">Faixa 4</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define qual faixa de preço será aplicada nas vendas para este cliente
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Telefones</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPhone}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Telefone
                  </Button>
                </div>
                <div className="space-y-2">
                  {phones.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          value={phone.phone}
                          onChange={(e) => updatePhone(index, 'phone', e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <Select
                        value={phone.phone_type}
                        onValueChange={(value) => updatePhone(index, 'phone_type', value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Principal">Principal</SelectItem>
                          <SelectItem value="Secundário">Secundário</SelectItem>
                          <SelectItem value="Celular">Celular</SelectItem>
                          <SelectItem value="Comercial">Comercial</SelectItem>
                          <SelectItem value="Residencial">Residencial</SelectItem>
                        </SelectContent>
                      </Select>
                      {phones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePhone(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingClient ? "Atualizar" : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando clientes...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">Erro ao carregar clientes. Tente novamente.</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead>Nome/Razão Social</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Faixa de Preço</TableHead>
                  <TableHead>Telefones</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedData.map((client: any) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.cnpj_cpf || "-"}</TableCell>
                    <TableCell>{client.buyer_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        Faixa {client.price_tier || 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.phones && client.phones.length > 0 ? (
                        <div className="space-y-1">
                          {client.phones.map((p: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{p.phone_type}:</span> {p.phone}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{client.email || "-"}</TableCell>
                  <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(client)}
                        disabled={deleteMutation.isPending}
                      >
                      <Pencil className="h-4 w-4" />
                    </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(client.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                      <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
          
          {/* Paginação */}
          {clients.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, clients.length)} de {clients.length} cliente(s)
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

export default Clients;
