import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, X, Check, FileText, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { jsPDF } from "jspdf";

interface SaleItem {
  product_id: number;
  quantity: number;
  price: number;
}

const Sales = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [autoPriceSelected, setAutoPriceSelected] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    product_id: "",
    quantity: "",
    price: "",
    notes: "",
    due_date: "",
    nf_number: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [idFilter, setIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"asc" | "desc" | null>("desc"); // Padrão: mais recente primeiro
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const itemsPerPage = 10;

  // Buscar vendas
  const { data: sales = [], isLoading, isError } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiService.getSales(),
  });

  // Filtrar e ordenar vendas
  const filteredSales = useMemo(() => {
    let filtered = sales;

    if (idFilter.trim()) {
      filtered = filtered.filter((sale: any) => String(sale.id).includes(idFilter.trim()));
    }

    // Filtrar por status
    if (statusFilter !== "all") {
      filtered = filtered.filter((sale: any) => {
        const saleStatus = sale.status || "Pendente";
        return saleStatus === statusFilter;
      });
    }
    
    // Filtrar por data
    if (dateFrom) {
      filtered = filtered.filter((sale: any) => {
        if (!sale.date) return false;
        const saleDate = sale.date.split('T')[0]; // Pegar apenas a data (YYYY-MM-DD)
        return saleDate >= dateFrom;
      });
    }
    
    if (dateTo) {
      filtered = filtered.filter((sale: any) => {
        if (!sale.date) return false;
        const saleDate = sale.date.split('T')[0]; // Pegar apenas a data (YYYY-MM-DD)
        return saleDate <= dateTo;
      });
    }
    
    // Ordenar por data
    if (dateSort) {
      filtered = [...filtered].sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateSort === "asc" ? dateA - dateB : dateB - dateA;
      });
    }
    
    return filtered;
  }, [sales, idFilter, statusFilter, dateSort, dateFrom, dateTo]);

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSales.slice(startIndex, endIndex);
  }, [filteredSales, currentPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, idFilter, statusFilter, dateSort, dateFrom, dateTo]);

  // Handler para alternar ordenação por data
  const handleDateSort = () => {
    if (dateSort === null || dateSort === "desc") {
      setDateSort("asc");
    } else {
      setDateSort("desc");
    }
  };

  // Buscar clientes
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiService.getClients(),
  });

  // Buscar produtos
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiService.getProducts(),
  });

  // Seleção automática de preço baseado na faixa do cliente
  useEffect(() => {
    if (formData.product_id && formData.client_id) {
      const product = products.find((p: any) => p.id === parseInt(formData.product_id));
      const client = clients.find((c: any) => c.id === parseInt(formData.client_id));
      
      if (product && client && client.price_tier) {
        // Buscar preço da faixa do cliente
        const tierPrice = product[`price_tier_${client.price_tier}`] || product.price;
        
        // Só atualizar se o campo de preço estiver vazio ou se o preço atual for diferente
        if (!formData.price || parseFloat(formData.price) !== tierPrice) {
          setFormData(prev => ({ ...prev, price: tierPrice.toString() }));
          setAutoPriceSelected(true);
        }
      }
    } else if (formData.product_id && !formData.client_id) {
      // Se apenas produto foi selecionado, usar preço padrão
      const product = products.find((p: any) => p.id === parseInt(formData.product_id));
      if (product && (!formData.price || parseFloat(formData.price) !== product.price)) {
        setFormData(prev => ({ ...prev, price: product.price.toString() }));
        setAutoPriceSelected(true);
      }
    } else {
      setAutoPriceSelected(false);
    }
  }, [formData.product_id, formData.client_id, products, clients]);

  // Resetar indicador quando o usuário editar manualmente o preço
  const handlePriceChange = (value: string) => {
    setFormData({ ...formData, price: value });
    setAutoPriceSelected(false);
  };

  // Buscar usuários
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiService.getUsers(),
  });

  // Buscar detalhes da venda selecionada
  const { data: saleDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['sale', selectedSaleId],
    queryFn: () => apiService.getSale(selectedSaleId!),
    enabled: !!selectedSaleId && isDetailsDialogOpen,
  });

  // Mutation para criar venda
  const createMutation = useMutation({
    mutationFn: (data: { client_id?: number; total: number; items: SaleItem[] }) =>
      apiService.createSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Atualizar estoque
      toast({
        title: "Venda registrada!",
        description: "A venda foi cadastrada com sucesso.",
      });
      setFormData({ client_id: "", product_id: "", quantity: "", price: "", notes: "", due_date: "", nf_number: "" });
      setSaleItems([]);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro desconhecido";
      const errorDetails = error?.response?.data?.details;
      
      if (errorDetails && Array.isArray(errorDetails)) {
        const detailsMessage = errorDetails.map((d: any) => 
          `${d.product_name}: necessário ${d.required}, disponível ${d.available}`
        ).join("; ");
        
        toast({
          title: "Estoque insuficiente",
          description: detailsMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao registrar venda",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Mutation para atualizar status da venda
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, payment_method }: { id: number; status: string; payment_method?: string }) =>
      apiService.updateSale(id, { status, payment_method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['accountsReceivable'] }); // Atualizar contas a receber
      toast({
        title: "Status atualizado!",
        description: "O status da venda foi atualizado com sucesso.",
      });
      setIsPaymentDialogOpen(false);
      setSelectedSaleId(null);
      setPaymentMethod("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar venda
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast({
        title: "Venda deletada!",
        description: "A venda foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar venda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addItem = () => {
    if (!formData.product_id || !formData.quantity || !formData.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha produto, quantidade e preço antes de adicionar.",
        variant: "destructive",
      });
      return;
    }

    const productId = parseInt(formData.product_id);
    const quantity = parseFloat(formData.quantity);
    const product = products.find((p: any) => p.id === productId);
    
    // Validar estoque disponível
    if (product) {
      const availableStock = product.stock || product.calculated_stock || 0;
      
      // Calcular quantidade total já adicionada para este produto
      const alreadyAdded = saleItems
        .filter(item => item.product_id === productId)
        .reduce((sum, item) => sum + item.quantity, 0);
      
      const totalNeeded = alreadyAdded + quantity;
      
      if (totalNeeded > availableStock) {
        toast({
          title: "Estoque insuficiente",
          description: `${product.name}: necessário ${totalNeeded.toFixed(2)}, disponível ${availableStock.toFixed(2)} ${product.unit || "un"}`,
          variant: "destructive",
        });
        return;
      }
    }

    const newItem: SaleItem = {
      product_id: productId,
      quantity: parseInt(formData.quantity, 10),
      price: parseFloat(formData.price),
    };

    setSaleItems([...saleItems, newItem]);
    setFormData({ ...formData, product_id: "", quantity: "", price: "" });
  };

  const removeItem = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const handleNewSale = () => {
    setFormData({ client_id: "", product_id: "", quantity: "", price: "", notes: "", due_date: "", nf_number: "" });
    setSaleItems([]);
    setAutoPriceSelected(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (saleItems.length === 0) {
    toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item à venda.",
        variant: "destructive",
      });
      return;
    }

    const total = saleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const saleData = {
      client_id: formData.client_id && formData.client_id !== "none" ? parseInt(formData.client_id) : undefined,
      total,
      items: saleItems,
      user_id: user?.id || null,
      notes: formData.notes || null,
      due_date: formData.due_date || null,
      nf_number: formData.nf_number || null,
    };

    createMutation.mutate(saleData);
  };

  // Funções auxiliares
  const getClientName = (clientId: number | null) => {
    if (!clientId) return "-";
    const client = clients.find((c: any) => c.id === clientId);
    return client ? client.name : "-";
  };

  const getProductName = (productId: number) => {
    const product = products.find((p: any) => p.id === productId);
    return product ? product.name : "-";
  };

  const getStatusBadge = (status: string) => {
    if (status === "Pago") {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Pago</Badge>;
    }
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return "-";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.username : "-";
  };

  const handleRowDoubleClick = (saleId: number) => {
    setSelectedSaleId(saleId);
    setIsDetailsDialogOpen(true);
  };

  const generatePDF = async () => {
    if (!saleDetails) return;

    const doc = new jsPDF();
    let yPos = 20;
    let logoData: string | null = null;

    // Carregar logo uma vez
    try {
      const { loadLogoAsBase64 } = await import('@/lib/logo');
      logoData = await loadLogoAsBase64();
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }

    // Adicionar logo no topo da primeira página
    if (logoData) {
      const logoWidth = 40;
      const logoHeight = 30; // Altura fixa para manter proporção
      doc.addImage(logoData, 'PNG', 14, 10, logoWidth, logoHeight);
      yPos = Math.max(yPos, 10 + logoHeight + 5);
    }

    // Título
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Venda", 105, yPos, { align: "center" });
    yPos += 10;

    // Número da venda
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`Venda #${saleDetails.id}`, 105, yPos, { align: "center" });
    yPos += 15;

    // Informações gerais
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Informações da Venda", 14, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const saleDate = saleDetails.date 
      ? new Date(saleDetails.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : "-";

    doc.text(`Data: ${saleDate}`, 14, yPos);
    yPos += 6;
    doc.text(`Cliente: ${getClientName(saleDetails.client_id)}`, 14, yPos);
    yPos += 6;
    doc.text(`Status: ${saleDetails.status || "Pendente"}`, 14, yPos);
    yPos += 6;
    doc.text(`Vendedor: ${getUserName(saleDetails.user_id)}`, 14, yPos);
    yPos += 6;

    if (saleDetails.nf_number) {
      doc.text(`NF: ${saleDetails.nf_number}`, 14, yPos);
      yPos += 6;
    }

    if (saleDetails.payment_method) {
      doc.text(`Forma de Pagamento: ${saleDetails.payment_method}`, 14, yPos);
      yPos += 6;
    }

    yPos += 5;

    // Itens da venda
    if (saleDetails.items && saleDetails.items.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Itens da Venda", 14, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Produto", 14, yPos);
      doc.text("Qtd", 100, yPos);
      doc.text("Preço Unit.", 120, yPos);
      doc.text("Subtotal", 160, yPos, { align: "right" });
      yPos += 6;

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(14, yPos - 2, 196, yPos - 2);
      yPos += 3;

      // Itens
      doc.setFont("helvetica", "normal");
      saleDetails.items.forEach((item: any) => {
        if (yPos > 270) {
          doc.addPage();
          // Adicionar logo no topo de novas páginas
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', 14, 10, logoWidth, logoHeight);
          }
          yPos = 20;
        }

        const product = products.find((p: any) => p.id === item.product_id);
        const productName = product?.name || `Produto #${item.product_id}`;
        const quantity = `${item.quantity} ${product?.unit || "un"}`;
        const price = `R$ ${parseFloat(item.price || 0).toFixed(2)}`;
        const subtotal = `R$ ${parseFloat(item.subtotal || 0).toFixed(2)}`;

        // Quebrar nome do produto se muito longo
        const lines = doc.splitTextToSize(productName, 80);
        doc.text(lines[0], 14, yPos);
        if (lines.length > 1) {
          doc.text(lines[1], 14, yPos + 4);
        }
        doc.text(quantity, 100, yPos);
        doc.text(price, 120, yPos);
        doc.text(subtotal, 196, yPos, { align: "right" });
        
        yPos += lines.length > 1 ? 8 : 6;
      });

      yPos += 3;
      doc.setLineWidth(0.5);
      doc.line(14, yPos, 196, yPos);
      yPos += 6;

      // Total
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Total:", 160, yPos);
      doc.text(`R$ ${parseFloat(saleDetails.total || 0).toFixed(2)}`, 196, yPos, { align: "right" });
      yPos += 10;
    }

    // Observações
    if (saleDetails.notes) {
      if (yPos > 250) {
        doc.addPage();
        // Adicionar logo no topo de novas páginas
        if (logoData) {
          const logoWidth = 40;
          const logoHeight = 30;
          doc.addImage(logoData, 'PNG', 14, 10, logoWidth, logoHeight);
        }
        yPos = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Observações", 14, yPos);
      yPos += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const notesLines = doc.splitTextToSize(saleDetails.notes, 180);
      doc.text(notesLines, 14, yPos);
    }

    // Rodapé com logo em todas as páginas
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Adicionar logo no rodapé de cada página (se carregado)
      if (logoData) {
        const logoWidth = 20;
        const logoHeight = 15;
        doc.addImage(logoData, 'PNG', 14, 275, logoWidth, logoHeight);
      }
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Página ${i} de ${pageCount}`,
        105,
        287,
        { align: "center" }
      );
      doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        105,
        292,
        { align: "center" }
      );
    }

    // Salvar PDF
    doc.save(`Venda_${saleDetails.id}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Relatório gerado!",
      description: "O PDF foi baixado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">Registre e acompanhe suas vendas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewSale}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nova Venda</DialogTitle>
              <DialogDescription>
                Preencha os dados da venda e adicione os produtos vendidos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente (Opcional)</Label>
                <Select 
                  value={formData.client_id || undefined} 
                  onValueChange={(value) => setFormData({ ...formData, client_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum cliente</SelectItem>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nf_number">Número da NF (Opcional)</Label>
                <Input
                  id="nf_number"
                  value={formData.nf_number}
                  onChange={(e) => setFormData({ ...formData, nf_number: e.target.value })}
                  placeholder="Ex: 001234"
                />
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Itens da Venda</Label>
                <div className="space-y-3 mt-2">
                  <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                      <Label htmlFor="product_id">Produto</Label>
                      <Select 
                        value={formData.product_id} 
                        onValueChange={(value) => {
                          const selectedProduct = products.find((p: any) => p.id.toString() === value);
                          setFormData({ 
                            ...formData, 
                            product_id: value,
                            price: selectedProduct ? selectedProduct.price.toString() : formData.price
                          });
                        }}
                      >
                  <SelectTrigger>
                          <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                          {products.map((product: any) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name}
                            </SelectItem>
                          ))}
                  </SelectContent>
                </Select>
              </div>
                <div className="space-y-2">
                      <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                        step="1"
                        min="0"
                    value={formData.quantity}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Permitir apenas números inteiros
                          if (value === '' || /^\d+$/.test(value)) {
                            setFormData({ ...formData, quantity: value });
                          }
                        }}
                    placeholder="0"
                  />
                      {formData.product_id && (() => {
                        const product = products.find((p: any) => p.id.toString() === formData.product_id);
                        if (product) {
                          const availableStock = product.stock || product.calculated_stock || 0;
                          const alreadyAdded = saleItems
                            .filter(item => item.product_id === parseInt(formData.product_id))
                            .reduce((sum, item) => sum + item.quantity, 0);
                          const requested = parseInt(formData.quantity || "0", 10);
                          const totalNeeded = alreadyAdded + requested;
                          const isInsufficient = totalNeeded > availableStock;
                          
                          return (
                            <p className={`text-xs ${isInsufficient ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              Disponível: {Math.floor(availableStock)} {product.unit || "un"}
                              {requested > 0 && (
                                <span className={isInsufficient ? " text-destructive" : ""}>
                                  {" "}• Solicitado: {totalNeeded}
                                </span>
                              )}
                            </p>
                          );
                        }
                        return null;
                      })()}
                </div>
                <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="price">Preço Unitário (R$)</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-sm">
                                O preço será selecionado automaticamente baseado na faixa de preço do cliente. 
                                Você pode editar manualmente se necessário.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                  <div className="relative">
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      placeholder="0.00"
                    />
                    {autoPriceSelected && formData.price && (
                      <div className="absolute -top-2 right-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs cursor-help">
                                Preço automático
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">
                                {formData.client_id && (() => {
                                  const client = clients.find((c: any) => c.id === parseInt(formData.client_id));
                                  return client 
                                    ? `Preço da Faixa ${client.price_tier || 1} aplicado automaticamente`
                                    : 'Preço padrão aplicado';
                                })()}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                  {autoPriceSelected && formData.client_id && formData.product_id && (() => {
                    const client = clients.find((c: any) => c.id === parseInt(formData.client_id));
                    const product = products.find((p: any) => p.id === parseInt(formData.product_id));
                    if (client && product) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          Preço da Faixa {client.price_tier || 1} aplicado automaticamente
                        </p>
                      );
                    }
                    return null;
                  })()}
                      {formData.quantity && formData.price && (
                        <p className="text-sm font-medium text-primary">
                          Subtotal: R$ {(parseFloat(formData.quantity || "0") * parseFloat(formData.price || "0")).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addItem}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Item
                  </Button>
                </div>

                {saleItems.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Itens Adicionados</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {saleItems.map((item, index) => {
                        const product = products.find((p: any) => p.id === item.product_id);
                        const availableStock = product ? (product.stock || product.calculated_stock || 0) : 0;
                        const isInsufficient = item.quantity > availableStock;
                        return (
                          <div key={index} className={`flex items-center justify-between p-2 rounded ${isInsufficient ? "bg-destructive/10 border border-destructive/20" : "bg-muted"}`}>
                            <div className="flex-1">
                              <span className="font-medium">{product?.name || "-"}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {item.quantity} x R$ {item.price.toFixed(2)} = R$ {(item.quantity * item.price).toFixed(2)}
                              </span>
                              {isInsufficient && (
                                <p className="text-xs text-destructive font-medium mt-1">
                                  ⚠️ Estoque insuficiente: disponível {availableStock.toFixed(2)} {product?.unit || "un"}
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between font-bold">
                        <span>Total:</span>
                        <span>
                          R$ {saleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-2">
                <Label htmlFor="due_date">Data de Vencimento (Opcional)</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Se não informado, será calculado automaticamente (30 dias a partir da data da venda)
                </p>
              </div>

              <div className="border-t pt-4 space-y-2">
                <Label htmlFor="notes">Observações (Opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Digite observações sobre esta venda..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setFormData({ client_id: "", product_id: "", quantity: "", price: "", notes: "", due_date: "", nf_number: "" });
                    setSaleItems([]);
                  }}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || saleItems.length === 0}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Registrar Venda"
                  )}
              </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Histórico de Vendas</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm">#</Label>
                <Input
                  type="number"
                  placeholder="ID"
                  value={idFilter}
                  onChange={(e) => { setIdFilter(e.target.value); setCurrentPage(1); }}
                  className="w-[80px]"
                />
                <Label htmlFor="status-filter" className="text-sm">Filtrar por status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="date-from" className="text-sm">Data inicial:</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date-to" className="text-sm">Data final:</Label>
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
              <span className="ml-2 text-muted-foreground">Carregando vendas...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">Erro ao carregar vendas. Tente novamente.</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8 data-[state=open]:bg-accent"
                    onClick={handleDateSort}
                  >
                    Data
                    {dateSort === "asc" ? (
                      <ArrowUp className="ml-2 h-4 w-4" />
                    ) : dateSort === "desc" ? (
                      <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedData.map((sale: any) => (
                  <TableRow
                    key={sale.id}
                    onDoubleClick={() => handleRowDoubleClick(sale.id)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">{sale.id}</TableCell>
                    <TableCell>
                      {sale.date
                        ? new Date(sale.date).toLocaleDateString('pt-BR')
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="font-medium text-xs">
                      {sale.nf_number || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getClientName(sale.client_id)}
                    </TableCell>
                    <TableCell>R$ {parseFloat(sale.total || 0).toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(sale.status || "Pendente")}</TableCell>
                  <TableCell>
                      {sale.payment_method ? (
                        <Badge variant="outline">{sale.payment_method}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(sale.status === "Pendente" || !sale.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSaleId(sale.id);
                              setIsPaymentDialogOpen(true);
                            }}
                            disabled={updateStatusMutation.isPending}
                          >
                            {updateStatusMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            Marcar como Pago
                          </Button>
                        )}
                      </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
          
          {/* Paginação */}
          {filteredSales.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredSales.length)} de {filteredSales.length} venda(s)
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
              Selecione a forma de pagamento para confirmar o pagamento desta venda.
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
                disabled={updateStatusMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!paymentMethod) {
                    toast({
                      title: "Forma de pagamento obrigatória",
                      description: "Selecione a forma de pagamento.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedSaleId) {
                    updateStatusMutation.mutate({ 
                      id: selectedSaleId, 
                      status: "Pago",
                      payment_method: paymentMethod
                    });
                  }
                }}
                disabled={updateStatusMutation.isPending || !paymentMethod}
              >
                {updateStatusMutation.isPending ? (
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

      {/* Dialog de Detalhes da Venda */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda #{selectedSaleId}</DialogTitle>
            <DialogDescription>
              Informações completas da venda
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
            </div>
          ) : saleDetails ? (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Data da Venda</Label>
                  <p className="text-base">
                    {saleDetails.date 
                      ? new Date(saleDetails.date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : "-"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(saleDetails.status || "Pendente")}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-base">{getClientName(saleDetails.client_id)}</p>
                </div>
                {saleDetails.nf_number && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Número da NF</Label>
                    <p className="text-base font-medium">{saleDetails.nf_number}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Total</Label>
                  <p className="text-base font-semibold text-lg">
                    R$ {parseFloat(saleDetails.total || 0).toFixed(2)}
                  </p>
                </div>
                {saleDetails.payment_method && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Forma de Pagamento</Label>
                    <p className="text-base">
                      <Badge variant="outline">{saleDetails.payment_method}</Badge>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Vendedor</Label>
                  <p className="text-base font-medium">
                    {getUserName(saleDetails.user_id)}
                  </p>
                </div>
              </div>

              {/* Itens da Venda */}
              {saleDetails.items && saleDetails.items.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Itens da Venda</Label>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Preço Unitário</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleDetails.items.map((item: any, index: number) => {
                          const product = products.find((p: any) => p.id === item.product_id);
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {product?.name || `Produto #${item.product_id}`}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {product?.unit || "un"}
                              </TableCell>
                              <TableCell className="text-right">
                                R$ {parseFloat(item.price || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {parseFloat(item.subtotal || 0).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end pt-2 border-t">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">Total:</span>
                      <span className="text-lg font-bold">
                        R$ {parseFloat(saleDetails.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              {saleDetails.notes && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Observações</Label>
                  <p className="text-sm p-3 bg-muted rounded-md">{saleDetails.notes}</p>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={generatePDF}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Gerar Relatório PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDetailsDialogOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Erro ao carregar detalhes da venda.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
