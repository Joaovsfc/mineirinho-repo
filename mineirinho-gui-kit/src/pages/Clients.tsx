import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, X, ChevronLeft, ChevronRight, ChevronDown, Info, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { jsPDF } from "jspdf";

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
    fantasy_name: "",
    price_tier: "1",
  });
  const [phones, setPhones] = useState<Array<{ phone: string; phone_type: string }>>([
    { phone: "", phone_type: "Principal" }
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const [idFilter, setIdFilter] = useState("");
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<{ id: number; name: string } | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<number>>(new Set());
  const [salesCurrentPage, setSalesCurrentPage] = useState(1);
  const [salesIdFilter, setSalesIdFilter] = useState("");
  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");
  const salesItemsPerPage = 5;
  const [activeHistoryTab, setActiveHistoryTab] = useState("vendas");
  const [consignmentsCurrentPage, setConsignmentsCurrentPage] = useState(1);
  const [consignmentsIdFilter, setConsignmentsIdFilter] = useState("");
  const [consignmentsDateFrom, setConsignmentsDateFrom] = useState("");
  const [consignmentsDateTo, setConsignmentsDateTo] = useState("");
  const [expandedConsignmentIds, setExpandedConsignmentIds] = useState<Set<number>>(new Set());
  const consignmentsItemsPerPage = 5;
  const itemsPerPage = 10;

  // Buscar clientes
  const { data: clients = [], isLoading, isError } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiService.getClients(),
  });

  // Filtrar clientes
  const filteredClients = useMemo(() => {
    if (!idFilter.trim()) return clients;
    return clients.filter((client: any) => String(client.id).includes(idFilter.trim()));
  }, [clients, idFilter]);

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredClients.slice(startIndex, endIndex);
  }, [filteredClients, currentPage]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, idFilter]);

  // Mutation para criar cliente
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email?: string;
      address?: string;
      cnpj_cpf?: string;
      state_registration?: string;
      buyer_name?: string;
      fantasy_name?: string;
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
      setFormData({ name: "", email: "", address: "", cnpj_cpf: "", state_registration: "", buyer_name: "", fantasy_name: "", price_tier: "1" });
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
        fantasy_name?: string;
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
      setFormData({ name: "", email: "", address: "", cnpj_cpf: "", state_registration: "", buyer_name: "", fantasy_name: "", price_tier: "1" });
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

  // Buscar vendas do cliente selecionado para o histórico
  const { data: clientSales = [], isLoading: isLoadingClientSales } = useQuery({
    queryKey: ['clientSales', selectedClientForHistory?.id],
    queryFn: () => apiService.getClientSales(selectedClientForHistory!.id),
    enabled: !!selectedClientForHistory && isHistoryDialogOpen,
  });

  // Buscar consignações do cliente selecionado para o histórico
  const { data: clientConsignments = [], isLoading: isLoadingClientConsignments } = useQuery({
    queryKey: ['clientConsignments', selectedClientForHistory?.id],
    queryFn: () => apiService.getClientConsignments(selectedClientForHistory!.id),
    enabled: !!selectedClientForHistory && isHistoryDialogOpen,
  });

  const filteredSales = useMemo(() => {
    let result = clientSales;
    if (salesIdFilter.trim()) {
      result = result.filter((sale: any) => String(sale.id).includes(salesIdFilter.trim()));
    }
    if (salesDateFrom) {
      result = result.filter((sale: any) => sale.date && sale.date.split('T')[0] >= salesDateFrom);
    }
    if (salesDateTo) {
      result = result.filter((sale: any) => sale.date && sale.date.split('T')[0] <= salesDateTo);
    }
    return result;
  }, [clientSales, salesIdFilter, salesDateFrom, salesDateTo]);

  const filteredConsignments = useMemo(() => {
    let result = clientConsignments;
    if (consignmentsIdFilter.trim()) {
      result = result.filter((c: any) => String(c.id).includes(consignmentsIdFilter.trim()));
    }
    if (consignmentsDateFrom) {
      result = result.filter((c: any) => c.date && c.date.split('T')[0] >= consignmentsDateFrom);
    }
    if (consignmentsDateTo) {
      result = result.filter((c: any) => c.date && c.date.split('T')[0] <= consignmentsDateTo);
    }
    return result;
  }, [clientConsignments, consignmentsIdFilter, consignmentsDateFrom, consignmentsDateTo]);

  const consignmentsTotalPages = Math.ceil(filteredConsignments.length / consignmentsItemsPerPage);

  const paginatedConsignments = useMemo(() => {
    const start = (consignmentsCurrentPage - 1) * consignmentsItemsPerPage;
    return filteredConsignments.slice(start, start + consignmentsItemsPerPage);
  }, [filteredConsignments, consignmentsCurrentPage, consignmentsItemsPerPage]);

  const salesTotalPages = Math.ceil(filteredSales.length / salesItemsPerPage);

  const paginatedSales = useMemo(() => {
    const start = (salesCurrentPage - 1) * salesItemsPerPage;
    return filteredSales.slice(start, start + salesItemsPerPage);
  }, [filteredSales, salesCurrentPage, salesItemsPerPage]);

  const toggleConsignmentExpanded = (id: number) => {
    setExpandedConsignmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getConsignmentStatusBadge = (status: string) => {
    if (status === "Encerrado") {
      return <Badge variant="outline" className="bg-muted/50 text-muted-foreground">Encerrado</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Ativo</Badge>;
  };

  const handleClientDoubleClick = (client: any) => {
    setSelectedClientForHistory({ id: client.id, name: client.name });
    setExpandedSaleIds(new Set());
    setExpandedConsignmentIds(new Set());
    setSalesCurrentPage(1);
    setSalesIdFilter("");
    setSalesDateFrom("");
    setSalesDateTo("");
    setConsignmentsCurrentPage(1);
    setConsignmentsIdFilter("");
    setConsignmentsDateFrom("");
    setConsignmentsDateTo("");
    setActiveHistoryTab("vendas");
    setIsHistoryDialogOpen(true);
  };

  const toggleSaleExpanded = (saleId: number) => {
    setExpandedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === "Pago" || status === "Recebido") {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">{status}</Badge>;
    }
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">{status || "Pendente"}</Badge>;
  };

  const generateClientPDF = async () => {
    const client = selectedClientForHistory;
    if (!client) return;

    try {
      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - margin * 2;

      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (e) {}

      const checkPageBreak = (space: number) => {
        if (yPos + space > pageHeight - 20) {
          if (logoData) doc.addImage(logoData, 'PNG', margin, pageHeight - 15, 30, 22);
          doc.addPage();
          yPos = 20;
          if (logoData) {
            doc.addImage(logoData, 'PNG', margin, 10, 40, 30);
            yPos = 45;
          }
        }
      };

      if (logoData) {
        doc.addImage(logoData, 'PNG', margin, 10, 40, 30);
        yPos = 45;
      }

      if (activeHistoryTab === "vendas") {
        const data = filteredSales;

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Relatório de Vendas", 105, yPos, { align: "center" });
        yPos += 8;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Cliente: ${client.name}`, 105, yPos, { align: "center" });
        yPos += 6;
        if (salesDateFrom || salesDateTo) {
          const from = salesDateFrom ? new Date(salesDateFrom + 'T00:00:00').toLocaleDateString('pt-BR') : "início";
          const to = salesDateTo ? new Date(salesDateTo + 'T00:00:00').toLocaleDateString('pt-BR') : "hoje";
          doc.setFontSize(10);
          doc.text(`Período: ${from} a ${to}`, 105, yPos, { align: "center" });
          yPos += 6;
        }
        yPos += 6;

        // Resumo
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo", margin, yPos);
        yPos += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const totalValue = data.reduce((sum: number, s: any) => sum + parseFloat(s.total || 0), 0);
        doc.text(`Total de Vendas: ${data.length}`, margin, yPos); yPos += 6;
        doc.text(`Valor Total: R$ ${totalValue.toFixed(2)}`, margin, yPos); yPos += 6;
        if (data[0]?.date) {
          doc.text(`Última Venda: ${new Date(data[0].date).toLocaleDateString('pt-BR')}`, margin, yPos); yPos += 6;
        }
        yPos += 6;

        // Detalhamento
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Detalhamento de Vendas", margin, yPos);
        yPos += 8;

        data.forEach((sale: any) => {
          checkPageBreak(20);
          const saleDate = sale.date ? new Date(sale.date).toLocaleDateString('pt-BR') : "-";

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`Venda #${sale.id} — ${saleDate}`, margin, yPos);
          doc.text(`R$ ${parseFloat(sale.total || 0).toFixed(2)}`, maxWidth + margin, yPos, { align: "right" });
          yPos += 5;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          let info = `Status: ${sale.status || "Pendente"}`;
          if (sale.payment_method) info += ` | Pagamento: ${sale.payment_method}`;
          if (sale.nf_number) info += ` | NF: ${sale.nf_number}`;
          doc.text(info, margin + 3, yPos); yPos += 5;

          if (sale.items && sale.items.length > 0) {
            doc.setFont("helvetica", "italic");
            sale.items.forEach((item: any) => {
              checkPageBreak(5);
              const name = item.product_name || `Produto #${item.product_id}`;
              const qty = `${item.quantity} ${item.product_unit || "un"}`;
              const price = `R$ ${parseFloat(item.price || 0).toFixed(2)}`;
              const sub = `R$ ${(parseFloat(item.quantity || 0) * parseFloat(item.price || 0)).toFixed(2)}`;
              const line = `  • ${name}: ${qty} × ${price} = ${sub}`;
              doc.text(doc.splitTextToSize(line, maxWidth - 5)[0], margin + 3, yPos); yPos += 4;
            });
          }

          doc.setLineWidth(0.1);
          doc.line(margin, yPos, maxWidth + margin, yPos);
          yPos += 4;
        });

        const fileName = `vendas_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        if (logoData) doc.addImage(logoData, 'PNG', margin, pageHeight - 15, 30, 22);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, pageHeight - 5);
        doc.save(fileName);

      } else {
        const data = filteredConsignments;

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Relatório de Consignações", 105, yPos, { align: "center" });
        yPos += 8;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Cliente: ${client.name}`, 105, yPos, { align: "center" });
        yPos += 6;
        if (consignmentsDateFrom || consignmentsDateTo) {
          const from = consignmentsDateFrom ? new Date(consignmentsDateFrom + 'T00:00:00').toLocaleDateString('pt-BR') : "início";
          const to = consignmentsDateTo ? new Date(consignmentsDateTo + 'T00:00:00').toLocaleDateString('pt-BR') : "hoje";
          doc.setFontSize(10);
          doc.text(`Período: ${from} a ${to}`, 105, yPos, { align: "center" });
          yPos += 6;
        }
        yPos += 6;

        // Resumo
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo", margin, yPos);
        yPos += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const emAberto = data.filter((c: any) => c.status !== "Encerrado").length;
        const encerradas = data.filter((c: any) => c.status === "Encerrado").length;
        doc.text(`Total de Consignações: ${data.length}`, margin, yPos); yPos += 6;
        doc.text(`Em Aberto: ${emAberto}`, margin, yPos); yPos += 6;
        doc.text(`Encerradas: ${encerradas}`, margin, yPos); yPos += 6;
        yPos += 6;

        // Detalhamento
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Detalhamento de Consignações", margin, yPos);
        yPos += 8;

        data.forEach((cons: any) => {
          checkPageBreak(20);
          const consDate = cons.date ? new Date(cons.date).toLocaleDateString('pt-BR') : "-";
          const consTotal = cons.items
            ? cons.items.reduce((s: number, i: any) => s + parseFloat(i.quantity || 0) * parseFloat(i.price || 0), 0)
            : 0;

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`Consignação #${cons.id} — ${consDate}`, margin, yPos);
          doc.text(cons.status || "Ativo", maxWidth + margin, yPos, { align: "right" });
          yPos += 5;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          if (consTotal > 0) {
            doc.text(`Valor estimado: R$ ${consTotal.toFixed(2)}`, margin + 3, yPos); yPos += 4;
          }

          if (cons.items && cons.items.length > 0) {
            doc.setFont("helvetica", "italic");
            cons.items.forEach((item: any) => {
              checkPageBreak(5);
              const name = item.product_name || `Produto #${item.product_id}`;
              const qty = `${item.quantity} ${item.product_unit || "un"}`;
              const price = item.price ? ` × R$ ${parseFloat(item.price).toFixed(2)}` : "";
              const line = `  • ${name}: ${qty}${price}`;
              doc.text(doc.splitTextToSize(line, maxWidth - 5)[0], margin + 3, yPos); yPos += 4;
            });
          }

          doc.setLineWidth(0.1);
          doc.line(margin, yPos, maxWidth + margin, yPos);
          yPos += 4;
        });

        const fileName = `consignacoes_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        if (logoData) doc.addImage(logoData, 'PNG', margin, pageHeight - 15, 30, 22);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, pageHeight - 5);
        doc.save(fileName);
      }

      toast({
        title: "PDF gerado com sucesso!",
        description: `Relatório de ${activeHistoryTab === "vendas" ? "vendas" : "consignações"} exportado.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clientData = {
      name: formData.name,
      email: formData.email || undefined,
      address: formData.address || undefined,
      cnpj_cpf: formData.cnpj_cpf || undefined,
      state_registration: formData.state_registration || undefined,
      buyer_name: formData.buyer_name || undefined,
      fantasy_name: formData.fantasy_name || undefined,
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
      fantasy_name: client.fantasy_name || "",
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
    setFormData({ name: "", email: "", address: "", cnpj_cpf: "", state_registration: "", buyer_name: "", fantasy_name: "", price_tier: "1" });
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

              <div className="space-y-2">
                <Label htmlFor="fantasy_name">Nome Fantasia</Label>
                <Input
                  id="fantasy_name"
                  value={formData.fantasy_name}
                  onChange={(e) => setFormData({ ...formData, fantasy_name: e.target.value })}
                  placeholder="Ex: Padaria Central"
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
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Clientes</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="id-filter" className="text-sm">ID:</Label>
              <Input
                id="id-filter"
                value={idFilter}
                onChange={(e) => setIdFilter(e.target.value)}
                placeholder="Filtrar..."
                className="w-[80px]"
              />
            </div>
          </div>
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
          ) : filteredClients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                {clients.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado com o filtro informado."}
              </p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome/Razão Social</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
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
                <TableRow
                  key={client.id}
                  onDoubleClick={() => handleClientDoubleClick(client)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">{client.id}</TableCell>
                  <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.fantasy_name || "-"}</TableCell>
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
          {filteredClients.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredClients.length)} de {filteredClients.length} cliente(s)
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
      {/* Dialog de Histórico do Cliente */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico — {selectedClientForHistory?.name}</DialogTitle>
            <DialogDescription>
              Histórico completo de transações deste cliente
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeHistoryTab} onValueChange={setActiveHistoryTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vendas">
                Vendas {clientSales.length > 0 && `(${clientSales.length})`}
              </TabsTrigger>
              <TabsTrigger value="consignacoes">
                Consignações {clientConsignments.length > 0 && `(${clientConsignments.length})`}
              </TabsTrigger>
            </TabsList>

            {/* ── ABA VENDAS ── */}
            <TabsContent value="vendas" className="space-y-4 mt-4">
              {isLoadingClientSales ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando vendas...</span>
                </div>
              ) : clientSales.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Nenhuma venda registrada para este cliente.</p>
                </div>
              ) : (
                <>
                  {/* Estatísticas */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total de Vendas</p>
                      <p className="text-2xl font-bold">{clientSales.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold">
                        R$ {clientSales.reduce((sum: number, s: any) => sum + parseFloat(s.total || 0), 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Última Venda</p>
                      <p className="text-lg font-semibold">
                        {clientSales[0]?.date ? new Date(clientSales[0].date).toLocaleDateString('pt-BR') : "-"}
                      </p>
                    </div>
                  </div>

                  {/* Filtros */}
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sales-id-filter" className="text-sm shrink-0">ID:</Label>
                      <Input
                        id="sales-id-filter"
                        value={salesIdFilter}
                        onChange={(e) => { setSalesIdFilter(e.target.value); setSalesCurrentPage(1); }}
                        placeholder="Filtrar..."
                        className="w-[90px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sales-date-from" className="text-sm shrink-0">De:</Label>
                      <Input
                        id="sales-date-from"
                        type="date"
                        value={salesDateFrom}
                        onChange={(e) => { setSalesDateFrom(e.target.value); setSalesCurrentPage(1); }}
                        className="w-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sales-date-to" className="text-sm shrink-0">Até:</Label>
                      <Input
                        id="sales-date-to"
                        type="date"
                        value={salesDateTo}
                        onChange={(e) => { setSalesDateTo(e.target.value); setSalesCurrentPage(1); }}
                        className="w-[150px]"
                      />
                    </div>
                    {(salesIdFilter || salesDateFrom || salesDateTo) && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{filteredSales.length} resultado(s)</span>
                        <Button variant="ghost" size="sm" onClick={() => { setSalesIdFilter(""); setSalesDateFrom(""); setSalesDateTo(""); setSalesCurrentPage(1); }}>
                          Limpar
                        </Button>
                      </div>
                    )}
                  </div>

                  {filteredSales.length === 0 ? (
                    <div className="flex items-center justify-center py-6">
                      <p className="text-muted-foreground">Nenhuma venda encontrada com esse ID.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paginatedSales.map((sale: any) => {
                        const isExpanded = expandedSaleIds.has(sale.id);
                        const saleDate = sale.date
                          ? new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : "-";
                        return (
                          <div key={sale.id} className="border rounded-lg overflow-hidden">
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => toggleSaleExpanded(sale.id)}
                            >
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">#{sale.id}</span>
                                <span className="text-sm font-medium">{saleDate}</span>
                                {sale.nf_number && <span className="text-xs text-muted-foreground">NF: {sale.nf_number}</span>}
                                {getStatusBadge(sale.status)}
                                {sale.payment_method && <Badge variant="outline" className="text-xs">{sale.payment_method}</Badge>}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-semibold text-sm">R$ {parseFloat(sale.total || 0).toFixed(2)}</span>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t bg-muted/20 p-3 space-y-3">
                                {sale.notes && <p className="text-sm text-muted-foreground italic">Observação: {sale.notes}</p>}
                                {sale.items && sale.items.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sale.items.map((item: any) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.product_name || `Produto #${item.product_id}`}</TableCell>
                                          <TableCell className="text-right">{item.quantity} {item.product_unit || "un"}</TableCell>
                                          <TableCell className="text-right">R$ {parseFloat(item.price || 0).toFixed(2)}</TableCell>
                                          <TableCell className="text-right font-medium">R$ {(parseFloat(item.quantity || 0) * parseFloat(item.price || 0)).toFixed(2)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Sem itens registrados.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {filteredSales.length > salesItemsPerPage && (
                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((salesCurrentPage - 1) * salesItemsPerPage) + 1} a {Math.min(salesCurrentPage * salesItemsPerPage, filteredSales.length)} de {filteredSales.length} venda(s)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSalesCurrentPage(p => Math.max(1, p - 1))} disabled={salesCurrentPage === 1} className="gap-1">
                          <ChevronLeft className="h-4 w-4" />Anterior
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: salesTotalPages }, (_, i) => i + 1).map((page) => {
                            if (page === 1 || page === salesTotalPages || (page >= salesCurrentPage - 1 && page <= salesCurrentPage + 1)) {
                              return <Button key={page} variant={salesCurrentPage === page ? "outline" : "ghost"} size="sm" onClick={() => setSalesCurrentPage(page)} className="min-w-[36px]">{page}</Button>;
                            } else if (page === salesCurrentPage - 2 || page === salesCurrentPage + 2) {
                              return <span key={page} className="px-1 text-muted-foreground">...</span>;
                            }
                            return null;
                          })}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSalesCurrentPage(p => Math.min(salesTotalPages, p + 1))} disabled={salesCurrentPage === salesTotalPages} className="gap-1">
                          Próxima<ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── ABA CONSIGNAÇÕES ── */}
            <TabsContent value="consignacoes" className="space-y-4 mt-4">
              {isLoadingClientConsignments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando consignações...</span>
                </div>
              ) : clientConsignments.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Nenhuma consignação registrada para este cliente.</p>
                </div>
              ) : (
                <>
                  {/* Estatísticas */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{clientConsignments.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Em Aberto</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {clientConsignments.filter((c: any) => c.status !== "Encerrado").length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Encerradas</p>
                      <p className="text-2xl font-bold">
                        {clientConsignments.filter((c: any) => c.status === "Encerrado").length}
                      </p>
                    </div>
                  </div>

                  {/* Filtros */}
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="cons-id-filter" className="text-sm shrink-0">ID:</Label>
                      <Input
                        id="cons-id-filter"
                        value={consignmentsIdFilter}
                        onChange={(e) => { setConsignmentsIdFilter(e.target.value); setConsignmentsCurrentPage(1); }}
                        placeholder="Filtrar..."
                        className="w-[90px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="cons-date-from" className="text-sm shrink-0">De:</Label>
                      <Input
                        id="cons-date-from"
                        type="date"
                        value={consignmentsDateFrom}
                        onChange={(e) => { setConsignmentsDateFrom(e.target.value); setConsignmentsCurrentPage(1); }}
                        className="w-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="cons-date-to" className="text-sm shrink-0">Até:</Label>
                      <Input
                        id="cons-date-to"
                        type="date"
                        value={consignmentsDateTo}
                        onChange={(e) => { setConsignmentsDateTo(e.target.value); setConsignmentsCurrentPage(1); }}
                        className="w-[150px]"
                      />
                    </div>
                    {(consignmentsIdFilter || consignmentsDateFrom || consignmentsDateTo) && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{filteredConsignments.length} resultado(s)</span>
                        <Button variant="ghost" size="sm" onClick={() => { setConsignmentsIdFilter(""); setConsignmentsDateFrom(""); setConsignmentsDateTo(""); setConsignmentsCurrentPage(1); }}>
                          Limpar
                        </Button>
                      </div>
                    )}
                  </div>

                  {filteredConsignments.length === 0 ? (
                    <div className="flex items-center justify-center py-6">
                      <p className="text-muted-foreground">Nenhuma consignação encontrada com esse ID.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paginatedConsignments.map((cons: any) => {
                        const isExpanded = expandedConsignmentIds.has(cons.id);
                        const consDate = cons.date
                          ? new Date(cons.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : "-";
                        const consTotal = cons.items
                          ? cons.items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.price || 0)), 0)
                          : 0;
                        return (
                          <div key={cons.id} className="border rounded-lg overflow-hidden">
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => toggleConsignmentExpanded(cons.id)}
                            >
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">#{cons.id}</span>
                                <span className="text-sm font-medium">{consDate}</span>
                                {getConsignmentStatusBadge(cons.status)}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {consTotal > 0 && <span className="font-semibold text-sm">R$ {consTotal.toFixed(2)}</span>}
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t bg-muted/20 p-3 space-y-3">
                                {cons.notes && <p className="text-sm text-muted-foreground italic">Observação: {cons.notes}</p>}
                                {cons.items && cons.items.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Qtd Enviada</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {cons.items.map((item: any) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.product_name || `Produto #${item.product_id}`}</TableCell>
                                          <TableCell className="text-right">{item.quantity} {item.product_unit || "un"}</TableCell>
                                          <TableCell className="text-right">
                                            {item.price ? `R$ ${parseFloat(item.price).toFixed(2)}` : "-"}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {item.price ? `R$ ${(parseFloat(item.quantity || 0) * parseFloat(item.price)).toFixed(2)}` : "-"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Sem itens registrados.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {filteredConsignments.length > consignmentsItemsPerPage && (
                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((consignmentsCurrentPage - 1) * consignmentsItemsPerPage) + 1} a {Math.min(consignmentsCurrentPage * consignmentsItemsPerPage, filteredConsignments.length)} de {filteredConsignments.length} consignação(ões)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setConsignmentsCurrentPage(p => Math.max(1, p - 1))} disabled={consignmentsCurrentPage === 1} className="gap-1">
                          <ChevronLeft className="h-4 w-4" />Anterior
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: consignmentsTotalPages }, (_, i) => i + 1).map((page) => {
                            if (page === 1 || page === consignmentsTotalPages || (page >= consignmentsCurrentPage - 1 && page <= consignmentsCurrentPage + 1)) {
                              return <Button key={page} variant={consignmentsCurrentPage === page ? "outline" : "ghost"} size="sm" onClick={() => setConsignmentsCurrentPage(page)} className="min-w-[36px]">{page}</Button>;
                            } else if (page === consignmentsCurrentPage - 2 || page === consignmentsCurrentPage + 2) {
                              return <span key={page} className="px-1 text-muted-foreground">...</span>;
                            }
                            return null;
                          })}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setConsignmentsCurrentPage(p => Math.min(consignmentsTotalPages, p + 1))} disabled={consignmentsCurrentPage === consignmentsTotalPages} className="gap-1">
                          Próxima<ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="outline" size="sm" onClick={generateClientPDF}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF ({activeHistoryTab === "vendas" ? "Vendas" : "Consignações"})
            </Button>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
