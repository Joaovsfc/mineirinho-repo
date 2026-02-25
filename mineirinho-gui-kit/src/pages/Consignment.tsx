import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Trash2, X, Check, FileText, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { jsPDF } from "jspdf";

interface ConsignmentItem {
  product_id: number;
  quantity: number;
  price?: number;
}

interface CloseItem {
  product_id: number;
  quantity_sold: number;
  price: number;
  subtotal: number;
}

const Consignment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<any>(null);
  const [selectedConsignmentId, setSelectedConsignmentId] = useState<number | null>(null);
  const [consignmentItems, setConsignmentItems] = useState<ConsignmentItem[]>([]);
  const [closeItems, setCloseItems] = useState<CloseItem[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [formData, setFormData] = useState({
    client_id: "",
    product_id: "",
    quantity: "",
    price: "",
    notes: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"asc" | "desc" | null>("desc"); // Padrão: mais recente primeiro
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const itemsPerPage = 10;

  // Buscar consignações
  const { data: consignments = [], isLoading, isError } = useQuery({
    queryKey: ['consignments'],
    queryFn: () => apiService.getConsignments(),
  });

  // Filtrar e ordenar consignações
  const filteredConsignments = useMemo(() => {
    let filtered = consignments;
    
    // Filtrar por status
    if (statusFilter !== "all") {
      filtered = filtered.filter((consignment: any) => {
        const consignmentStatus = consignment.status || "Ativo";
        if (statusFilter === "Ativo") {
          return consignmentStatus === "Ativo" || consignmentStatus === "Em Aberto" || !consignmentStatus;
        }
        return consignmentStatus === statusFilter;
      });
    }
    
    // Filtrar por data
    if (dateFrom) {
      filtered = filtered.filter((consignment: any) => {
        if (!consignment.date) return false;
        const consignmentDate = consignment.date.split('T')[0]; // Pegar apenas a data (YYYY-MM-DD)
        return consignmentDate >= dateFrom;
      });
    }
    
    if (dateTo) {
      filtered = filtered.filter((consignment: any) => {
        if (!consignment.date) return false;
        const consignmentDate = consignment.date.split('T')[0]; // Pegar apenas a data (YYYY-MM-DD)
        return consignmentDate <= dateTo;
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
  }, [consignments, statusFilter, dateSort, dateFrom, dateTo]);

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredConsignments.slice(startIndex, endIndex);
  }, [filteredConsignments, currentPage]);

  const totalPages = Math.ceil(filteredConsignments.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, statusFilter, dateSort, dateFrom, dateTo]);

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

  // Buscar usuários
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiService.getUsers(),
  });

  // Buscar consignação selecionada para encerramento
  const { data: consignmentDetails } = useQuery({
    queryKey: ['consignment', selectedConsignment?.id],
    queryFn: () => apiService.getConsignment(selectedConsignment.id),
    enabled: !!selectedConsignment && isCloseDialogOpen,
  });

  // Buscar detalhes da consignação selecionada para visualização
  const { data: consignmentDetailsForView, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['consignment', selectedConsignmentId],
    queryFn: () => apiService.getConsignment(selectedConsignmentId!),
    enabled: !!selectedConsignmentId && isDetailsDialogOpen,
  });

  // Auto-preencher preço quando produto é selecionado
  useEffect(() => {
    if (formData.product_id) {
      const product = products.find((p: any) => p.id.toString() === formData.product_id);
      if (product) {
        setFormData({ ...formData, price: product.price.toString() });
      }
    }
  }, [formData.product_id]);

  // Inicializar itens de encerramento quando consignação é carregada
  useEffect(() => {
    if (consignmentDetails && consignmentDetails.items) {
      const items: CloseItem[] = consignmentDetails.items.map((item: any) => ({
        product_id: item.product_id,
        quantity_sold: 0,
        price: item.price || 0,
        subtotal: 0,
      }));
      setCloseItems(items);
      
      // Inicializar data de vencimento com data atual
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setDueDate(todayStr);
    }
  }, [consignmentDetails]);

  // Mutation para criar consignação
  const createMutation = useMutation({
    mutationFn: (data: { client_id: number; items: ConsignmentItem[]; status?: string; notes?: string }) =>
      apiService.createConsignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignments'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Consignação registrada!",
        description: "A consignação foi cadastrada com sucesso.",
      });
      setFormData({ client_id: "", product_id: "", quantity: "", price: "", notes: "" });
      setConsignmentItems([]);
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
          title: "Erro ao registrar consignação",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Mutation para encerrar consignação
  const closeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { items: CloseItem[]; total: number; due_date?: string; date?: string; notes?: string | null } }) =>
      apiService.closeConsignment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignments'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['accountsReceivable'] });
      toast({
        title: "Consignação encerrada!",
        description: "A consignação foi encerrada e a venda foi criada com sucesso.",
      });
      setIsCloseDialogOpen(false);
      setSelectedConsignment(null);
      setCloseItems([]);
      setDueDate("");
      setCloseNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao encerrar consignação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar consignação
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteConsignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignments'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Consignação deletada!",
        description: "A consignação foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar consignação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addItem = () => {
    if (!formData.product_id || !formData.quantity) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha produto e quantidade antes de adicionar.",
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
      const alreadyAdded = consignmentItems
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

    const newItem: ConsignmentItem = {
      product_id: productId,
      quantity: parseInt(formData.quantity, 10),
      price: formData.price ? parseFloat(formData.price) : undefined,
    };

    setConsignmentItems([...consignmentItems, newItem]);
    setFormData({ ...formData, product_id: "", quantity: "", price: "" });
  };

  const removeItem = (index: number) => {
    setConsignmentItems(consignmentItems.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (consignmentItems.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item à consignação.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.client_id) {
      toast({
        title: "Cliente obrigatório",
        description: "Selecione um cliente.",
        variant: "destructive",
      });
      return;
    }

    const consignmentData = {
      client_id: parseInt(formData.client_id),
      items: consignmentItems,
      status: "Ativo",
      notes: formData.notes || null,
      user_id: user?.id || null,
    };

    createMutation.mutate(consignmentData);
  };

  const handleClose = (consignment: any) => {
    setSelectedConsignment(consignment);
    setCloseNotes(consignment.notes || "");
    setIsCloseDialogOpen(true);
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedConsignment) return;

    // Validar itens
    for (const item of closeItems) {
      if (item.quantity_sold < 0) {
        toast({
          title: "Quantidade inválida",
          description: "A quantidade baixada não pode ser negativa.",
          variant: "destructive",
        });
        return;
      }
      
      const consignmentItem = consignmentDetails?.items?.find((ci: any) => ci.product_id === item.product_id);
      if (consignmentItem && item.quantity_sold > consignmentItem.quantity) {
        toast({
          title: "Quantidade inválida",
          description: `A quantidade baixada não pode ser maior que a consignada (${consignmentItem.quantity}).`,
          variant: "destructive",
        });
        return;
      }
    }

    // Calcular totais
    const itemsWithSubtotal = closeItems.map(item => ({
      ...item,
      subtotal: item.quantity_sold * item.price,
    }));

    const total = itemsWithSubtotal.reduce((sum, item) => sum + item.subtotal, 0);

    if (total === 0) {
      toast({
        title: "Valor inválido",
        description: "O valor total deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (!dueDate) {
      toast({
        title: "Data de vencimento obrigatória",
        description: "Informe a data de vencimento da conta a receber.",
        variant: "destructive",
      });
      return;
    }

    closeMutation.mutate({
      id: selectedConsignment.id,
      data: {
        items: itemsWithSubtotal,
        total,
        due_date: dueDate,
        notes: closeNotes.trim() || undefined, // Enviar undefined se vazio, para o backend usar as originais
      },
    });
  };

  const updateCloseItem = (index: number, field: keyof CloseItem, value: any) => {
    const updated = [...closeItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    
    // Recalcular subtotal
    if (field === 'quantity_sold' || field === 'price') {
      updated[index].subtotal = updated[index].quantity_sold * updated[index].price;
    }
    
    setCloseItems(updated);
  };

  // Funções auxiliares
  const getClientName = (clientId: number | null) => {
    if (!clientId) return "-";
    const client = clients.find((c: any) => c.id === clientId);
    return client ? client.name : "-";
  };

  const getProductName = (productId: number | null) => {
    if (!productId) return "-";
    const product = products.find((p: any) => p.id === productId);
    return product ? product.name : "-";
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayConsignments = consignments.filter((c: any) => {
      const consignmentDate = c.date ? new Date(c.date).toISOString().split('T')[0] : null;
      return consignmentDate === today;
    });

    // Calcular total entregue (considerando itens se disponível)
    const totalDelivered = todayConsignments.reduce((sum: number, c: any) => {
      if (c.items && Array.isArray(c.items)) {
        return sum + c.items.reduce((itemSum: number, item: any) => itemSum + parseFloat(item.quantity || 0), 0);
      }
      return sum + parseFloat(c.quantity || 0);
    }, 0);

    const active = consignments.filter((c: any) => c.status === "Ativo" || !c.status || c.status === "Em Aberto");

    return {
      totalDelivered,
      todayCount: todayConsignments.length,
      activeCount: active.length,
    };
  }, [consignments]);

  const getStatusBadge = (status: string) => {
    if (status === "Ativo" || status === "Em Aberto" || !status) {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Ativo</Badge>;
    }
    if (status === "Encerrado") {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Encerrado</Badge>;
    }
    return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Finalizado</Badge>;
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return "-";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.username : "-";
  };

  const handleRowDoubleClick = (consignmentId: number) => {
    setSelectedConsignmentId(consignmentId);
    setIsDetailsDialogOpen(true);
  };

  const generatePDF = async () => {
    if (!consignmentDetailsForView) return;

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
    doc.text("Relatório de Consignação", 105, yPos, { align: "center" });
    yPos += 10;

    // Número da consignação
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`Consignação #${consignmentDetailsForView.id}`, 105, yPos, { align: "center" });
    yPos += 15;

    // Informações gerais
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Informações da Consignação", 14, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const consignmentDate = consignmentDetailsForView.date 
      ? new Date(consignmentDetailsForView.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : "-";

    doc.text(`Data: ${consignmentDate}`, 14, yPos);
    yPos += 6;
    doc.text(`Cliente: ${getClientName(consignmentDetailsForView.client_id)}`, 14, yPos);
    yPos += 6;
    doc.text(`Status: ${consignmentDetailsForView.status || "Ativo"}`, 14, yPos);
    yPos += 6;
    doc.text(`Responsável: ${getUserName(consignmentDetailsForView.user_id)}`, 14, yPos);
    yPos += 6;
    
    if (consignmentDetailsForView.closed_total) {
      doc.text(`Total Encerrado: R$ ${parseFloat(consignmentDetailsForView.closed_total || 0).toFixed(2)}`, 14, yPos);
      yPos += 6;
    }
    
    if (consignmentDetailsForView.sale_id) {
      doc.text(`Venda Gerada: #${consignmentDetailsForView.sale_id}`, 14, yPos);
      yPos += 6;
    }

    yPos += 5;

    // Itens da consignação
    if (consignmentDetailsForView.items && consignmentDetailsForView.items.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Itens Consignados", 14, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Produto", 14, yPos);
      doc.text("Quantidade", 100, yPos);
      doc.text("Preço Unit.", 140, yPos);
      doc.text("Subtotal", 180, yPos, { align: "right" });
      yPos += 6;

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(14, yPos - 2, 196, yPos - 2);
      yPos += 3;

      // Itens
      doc.setFont("helvetica", "normal");
      let totalQuantity = 0;
      consignmentDetailsForView.items.forEach((item: any) => {
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
        totalQuantity += parseFloat(item.quantity || 0);

        // Quebrar nome do produto se muito longo
        const lines = doc.splitTextToSize(productName, 80);
        doc.text(lines[0], 14, yPos);
        if (lines.length > 1) {
          doc.text(lines[1], 14, yPos + 4);
        }
        doc.text(quantity, 100, yPos);
        doc.text(price, 140, yPos);
        doc.text(subtotal, 196, yPos, { align: "right" });
        
        yPos += lines.length > 1 ? 8 : 6;
      });

      yPos += 3;
      doc.setLineWidth(0.5);
      doc.line(14, yPos, 196, yPos);
      yPos += 6;

      // Total de unidades
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Total Consignado: ${totalQuantity.toFixed(2)} unidades`, 14, yPos);
      yPos += 10;
    }

    // Observações
    if (consignmentDetailsForView.notes) {
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
      const notesLines = doc.splitTextToSize(consignmentDetailsForView.notes, 180);
      doc.text(notesLines, 14, yPos);
      yPos += notesLines.length * 5 + 10;
    }

    // Campos de assinatura
    // Verificar se precisa de nova página
    if (yPos > 200) {
      doc.addPage();
      // Adicionar logo no topo de novas páginas
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', 14, 10, logoWidth, logoHeight);
      }
      yPos = 20;
    }

    yPos += 10;
    
    // Linha separadora antes das assinaturas
    doc.setLineWidth(0.5);
    doc.line(14, yPos, 196, yPos);
    yPos += 15;

    // Assinaturas lado a lado
    const signatureY = yPos;
    
    // Assinatura "Entregue por" (esquerda)
    const responsibleName = getUserName(consignmentDetailsForView.user_id);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Entregue por: ${responsibleName !== "-" ? responsibleName : ""}`, 14, signatureY);
    yPos += 20;
    
    // Linha para assinatura de quem entregou
    doc.setLineWidth(0.5);
    doc.line(14, yPos, 90, yPos);

    // Assinatura do Cliente (direita)
    yPos = signatureY;
    const clientName = getClientName(consignmentDetailsForView.client_id);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Cliente: ${clientName !== "-" ? clientName : ""}`, 120, yPos);
    yPos += 20;
    
    // Linha para assinatura do cliente
    doc.setLineWidth(0.5);
    doc.line(120, yPos, 196, yPos);

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
    doc.save(`Consignacao_${consignmentDetailsForView.id}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Relatório gerado!",
      description: "O PDF foi baixado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Consignação</h1>
          <p className="text-muted-foreground">Controle de entregas e devoluções</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setFormData({ client_id: "", product_id: "", quantity: "", price: "", notes: "" });
              setConsignmentItems([]);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Consignação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Consignação</DialogTitle>
              <DialogDescription>
                Preencha os dados da consignação e adicione os produtos consignados.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente *</Label>
                <Select 
                  value={formData.client_id} 
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Itens da Consignação</Label>
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
                          const alreadyAdded = consignmentItems
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
                      <Label htmlFor="price">Preço Unitário (R$)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                      />
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

                {consignmentItems.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Itens Adicionados</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {consignmentItems.map((item, index) => {
                        const product = products.find((p: any) => p.id === item.product_id);
                        const availableStock = product ? (product.stock || product.calculated_stock || 0) : 0;
                        const isInsufficient = item.quantity > availableStock;
                        return (
                          <div key={index} className={`flex items-center justify-between p-2 rounded ${isInsufficient ? "bg-destructive/10 border border-destructive/20" : "bg-muted"}`}>
                            <div className="flex-1">
                              <span className="font-medium">{product?.name || "-"}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {item.quantity} {product?.unit || "un"}
                                {item.price && ` x R$ ${item.price.toFixed(2)}`}
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
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="notes">Observações (Opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Digite observações sobre esta consignação..."
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
                    setFormData({ client_id: "", product_id: "", quantity: "", price: "", notes: "" });
                    setConsignmentItems([]);
                  }}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Registrar Consignação
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Entregue (Hoje)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.totalDelivered.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{stats.todayCount} entrega(s) realizada(s)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Consignações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{consignments.length}</div>
                <p className="text-xs text-muted-foreground">Registros no total</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.activeCount}</div>
                <p className="text-xs text-muted-foreground">Aguardando fechamento</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Histórico de Consignações</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm">Filtrar por status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Encerrado">Encerrado</SelectItem>
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
              <span className="ml-2 text-muted-foreground">Carregando consignações...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">Erro ao carregar consignações. Tente novamente.</p>
            </div>
          ) : filteredConsignments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                {consignments.length === 0 
                  ? "Nenhuma consignação registrada ainda."
                  : "Nenhuma consignação encontrada com o filtro selecionado."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((consignment: any) => {
                  const itemsCount = consignment.items && Array.isArray(consignment.items) 
                    ? consignment.items.length 
                    : 1;
                  const totalQuantity = consignment.items && Array.isArray(consignment.items)
                    ? consignment.items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0)
                    : parseFloat(consignment.quantity || 0);
                  
                  return (
                    <TableRow 
                      key={consignment.id}
                      onDoubleClick={() => handleRowDoubleClick(consignment.id)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        {consignment.date 
                          ? new Date(consignment.date).toLocaleDateString('pt-BR')
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="font-medium">
                        {getClientName(consignment.client_id)}
                      </TableCell>
                      <TableCell>
                        {itemsCount} item(ns) - {totalQuantity.toFixed(2)} total
                      </TableCell>
                      <TableCell>{getStatusBadge(consignment.status || "Ativo")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(consignment.status === "Ativo" || !consignment.status || consignment.status === "Em Aberto") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleClose(consignment)}
                              disabled={closeMutation.isPending}
                            >
                              {closeMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                "Encerrar"
                              )}
                            </Button>
                          )}
                          {consignment.status !== "Encerrado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Tem certeza que deseja deletar esta consignação?")) {
                                  deleteMutation.mutate(consignment.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          
          {/* Paginação */}
          {filteredConsignments.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredConsignments.length)} de {filteredConsignments.length} consignação(ões)
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

      {/* Modal de Encerramento */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Encerrar Consignação</DialogTitle>
            <DialogDescription>
              Informe a quantidade baixada e o valor cobrado para cada item. A diferença será estornada ao estoque.
            </DialogDescription>
          </DialogHeader>
          {consignmentDetails && (
            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente: {getClientName(consignmentDetails.client_id)}</Label>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Itens Consignados</Label>
                <div className="space-y-4 mt-2">
                  {consignmentDetails.items && consignmentDetails.items.map((item: any, index: number) => {
                    const closeItem = closeItems.find(ci => ci.product_id === item.product_id) || closeItems[index];
                    const product = products.find((p: any) => p.id === item.product_id);
                    const maxQuantity = parseFloat(item.quantity || 0);
                    
                    return (
                      <div key={item.product_id || index} className="p-4 border rounded-lg space-y-3">
                        <div className="font-medium">{product?.name || "-"}</div>
                        <div className="text-sm text-muted-foreground">
                          Consignado: {item.quantity} {product?.unit || "un"} 
                          {item.price && ` x R$ ${parseFloat(item.price).toFixed(2)}`}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor={`quantity_sold_${index}`}>Quantidade Baixada *</Label>
                            <Input
                              id={`quantity_sold_${index}`}
                              type="number"
                              step="1"
                              min="0"
                              max={maxQuantity}
                              value={closeItem?.quantity_sold || 0}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Permitir apenas números inteiros
                                if (value === '' || /^\d+$/.test(value)) {
                                  updateCloseItem(index, 'quantity_sold', parseInt(value || "0", 10));
                                }
                              }}
                              placeholder="0"
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              Máximo: {maxQuantity}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`price_${index}`}>Preço Unitário (R$)</Label>
                            <Input
                              id={`price_${index}`}
                              type="number"
                              step="0.01"
                              value={closeItem?.price || 0}
                              onChange={(e) => updateCloseItem(index, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Subtotal</Label>
                            <div className="p-2 bg-muted rounded font-medium">
                              R$ {((closeItem?.quantity_sold || 0) * (closeItem?.price || 0)).toFixed(2)}
                            </div>
                            {closeItem && closeItem.quantity_sold < maxQuantity && (
                              <p className="text-xs text-warning">
                                Estorno: {maxQuantity - (closeItem.quantity_sold || 0)} {product?.unit || "un"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="pt-4 border-t mt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>
                      R$ {closeItems.reduce((sum, item) => sum + ((item.quantity_sold || 0) * (item.price || 0)), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="dueDate">Data de Vencimento *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Data de vencimento da conta a receber que será criada
                </p>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="closeNotes">Editar Observações da Consignação (Opcional)</Label>
                <Textarea
                  id="closeNotes"
                  placeholder="Edite as observações desta consignação. A venda gerada terá uma mensagem padrão indicando que veio desta consignação."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  As observações editadas serão salvas na consignação. A venda gerada terá a mensagem: "Venda gerada a partir da consignação #X"
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCloseDialogOpen(false);
                    setSelectedConsignment(null);
                    setCloseItems([]);
                    setDueDate("");
                    setCloseNotes("");
                  }}
                  disabled={closeMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={closeMutation.isPending}>
                  {closeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Encerrando...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Encerrar Consignação
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes da Consignação */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Consignação #{selectedConsignmentId}</DialogTitle>
            <DialogDescription>
              Informações completas da consignação
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
            </div>
          ) : consignmentDetailsForView ? (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Data da Consignação</Label>
                  <p className="text-base">
                    {consignmentDetailsForView.date 
                      ? new Date(consignmentDetailsForView.date).toLocaleDateString('pt-BR', {
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
                  <div>{getStatusBadge(consignmentDetailsForView.status || "Ativo")}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-base">{getClientName(consignmentDetailsForView.client_id)}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Responsável</Label>
                  <p className="text-base font-medium">
                    {getUserName(consignmentDetailsForView.user_id)}
                  </p>
                </div>
                {consignmentDetailsForView.closed_total && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Total Encerrado</Label>
                    <p className="text-base font-semibold text-lg">
                      R$ {parseFloat(consignmentDetailsForView.closed_total || 0).toFixed(2)}
                    </p>
                  </div>
                )}
                {consignmentDetailsForView.sale_id && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Venda Gerada</Label>
                    <p className="text-base">
                      <Badge variant="outline">Venda #{consignmentDetailsForView.sale_id}</Badge>
                    </p>
                  </div>
                )}
              </div>

              {/* Itens da Consignação */}
              {consignmentDetailsForView.items && consignmentDetailsForView.items.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Itens Consignados</Label>
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
                        {consignmentDetailsForView.items.map((item: any, index: number) => {
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
                      <span className="text-sm text-muted-foreground">Total Consignado:</span>
                      <span className="text-lg font-bold">
                        {consignmentDetailsForView.items.reduce((sum: number, item: any) => 
                          sum + parseFloat(item.quantity || 0), 0
                        ).toFixed(2)} unidades
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              {consignmentDetailsForView.notes && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Observações</Label>
                  <p className="text-sm p-3 bg-muted rounded-md">{consignmentDetailsForView.notes}</p>
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
              <p className="text-muted-foreground">Erro ao carregar detalhes da consignação.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Consignment;
