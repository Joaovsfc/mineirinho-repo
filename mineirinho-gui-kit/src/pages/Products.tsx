import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, PackagePlus, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

const Products = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMovementsDialogOpen, setIsMovementsDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductForMovements, setSelectedProductForMovements] = useState<{ id: number; name: string } | null>(null);
  const [productToDelete, setProductToDelete] = useState<{ id: number; name: string } | null>(null);
  const [addStockData, setAddStockData] = useState({
    quantity: "",
    notes: "",
    type: "entrada" as "entrada" | "saida",
  });
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    price_tier_1: "",
    price_tier_2: "",
    price_tier_3: "",
    price_tier_4: "",
    stock: "",
    unit: "un",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [idFilter, setIdFilter] = useState("");
  const itemsPerPage = 10;

  // Buscar produtos
  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiService.getProducts(),
  });

  // Filtrar produtos
  const filteredProducts = useMemo(() => {
    if (!idFilter.trim()) return products;
    return products.filter((product: any) => String(product.id).includes(idFilter.trim()));
  }, [products, idFilter]);

  // Calcular paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Resetar para primeira página quando os dados mudarem
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, idFilter]);

  // Buscar movimentações do produto selecionado
  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ['productMovements', selectedProductForMovements?.id],
    queryFn: () => apiService.getProductMovements(selectedProductForMovements!.id),
    enabled: !!selectedProductForMovements && isMovementsDialogOpen,
  });

  // Mutation para criar produto
  const createMutation = useMutation({
    mutationFn: (data: { 
      name: string; 
      price?: number; 
      price_tier_1?: number;
      price_tier_2?: number;
      price_tier_3?: number;
      price_tier_4?: number;
      stock: number; 
      unit: string 
    }) =>
      apiService.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Produto cadastrado!",
        description: "O produto foi adicionado com sucesso.",
      });
      setFormData({ name: "", price: "", price_tier_1: "", price_tier_2: "", price_tier_3: "", price_tier_4: "", stock: "", unit: "un" });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar produto
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { 
      id: number; 
      data: { 
        name?: string; 
        price?: number; 
        price_tier_1?: number;
        price_tier_2?: number;
        price_tier_3?: number;
        price_tier_4?: number;
        stock?: number; 
        unit?: string 
      } 
    }) =>
      apiService.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Produto atualizado!",
        description: "O produto foi atualizado com sucesso.",
      });
      setFormData({ name: "", price: "", price_tier_1: "", price_tier_2: "", price_tier_3: "", price_tier_4: "", stock: "", unit: "un" });
      setEditingProduct(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para desativar produto
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Produto desativado!",
        description: "O produto foi desativado e não poderá mais ser usado.",
      });
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desativar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para adicionar/remover estoque
  const addStockMutation = useMutation({
    mutationFn: ({ id, quantity, type, notes }: { id: number; quantity: number; type: "entrada" | "saida"; notes?: string }) =>
      apiService.addProductStock(id, parseInt(quantity, 10), type, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: addStockData.type === "entrada" ? "Estoque adicionado!" : "Baixa registrada!",
        description: addStockData.type === "entrada" 
          ? "O estoque foi atualizado com sucesso." 
          : "A baixa foi registrada com sucesso.",
      });
      setAddStockData({ quantity: "", notes: "", type: "entrada" });
      setIsAddStockDialogOpen(false);
      setSelectedProductId(null);
    },
    onError: (error: Error) => {
      toast({
        title: addStockData.type === "entrada" ? "Erro ao adicionar estoque" : "Erro ao registrar baixa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Preparar dados de preço - sincronizar price e price_tier_1
    const priceValue = formData.price && formData.price.trim() !== "" ? parseFloat(formData.price) : undefined;
    const tier1Value = formData.price_tier_1 && formData.price_tier_1.trim() !== "" ? parseFloat(formData.price_tier_1) : undefined;
    
    // Se price_tier_1 foi fornecido mas price não, usar tier1 como price
    const finalPrice = priceValue !== undefined ? priceValue : (tier1Value !== undefined ? tier1Value : undefined);
    const finalTier1 = tier1Value !== undefined ? tier1Value : (priceValue !== undefined ? priceValue : undefined);
    
    // Validar que pelo menos um preço foi fornecido
    if (finalPrice === undefined && finalTier1 === undefined) {
      toast({
        title: "Preço obrigatório",
        description: "Informe pelo menos o Preço Padrão ou a Faixa 1.",
        variant: "destructive",
      });
      return;
    }
    
    // Validar que se outras faixas estão preenchidas, a Faixa 1 também deve estar
    const hasOtherTiers = (formData.price_tier_2 && formData.price_tier_2.trim() !== "") || 
                          (formData.price_tier_3 && formData.price_tier_3.trim() !== "") || 
                          (formData.price_tier_4 && formData.price_tier_4.trim() !== "");
    if (hasOtherTiers && !finalTier1) {
      toast({
        title: "Faixa 1 obrigatória",
        description: "A Faixa 1 é obrigatória quando outras faixas são configuradas.",
        variant: "destructive",
      });
      return;
    }
    
    const productData: any = {
      name: formData.name,
      unit: formData.unit,
    };
    
    // Adicionar preços - sempre enviar se tiver valor
    if (finalPrice !== undefined) productData.price = finalPrice;
    if (finalTier1 !== undefined) productData.price_tier_1 = finalTier1;
    if (formData.price_tier_2 && formData.price_tier_2.trim() !== "") {
      productData.price_tier_2 = parseFloat(formData.price_tier_2);
    }
    if (formData.price_tier_3 && formData.price_tier_3.trim() !== "") {
      productData.price_tier_3 = parseFloat(formData.price_tier_3);
    }
    if (formData.price_tier_4 && formData.price_tier_4.trim() !== "") {
      productData.price_tier_4 = parseFloat(formData.price_tier_4);
    }
    
    if (editingProduct) {
      // Ao editar, não enviar stock (quantidade só pode ser alterada via adicionar estoque)
      updateMutation.mutate({ id: editingProduct, data: productData });
    } else {
      // Ao criar, incluir stock
      productData.stock = parseInt(formData.stock, 10);
      createMutation.mutate(productData);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product.id);
    setFormData({
      name: product.name,
      price: product.price?.toString() || "",
      price_tier_1: product.price_tier_1?.toString() || product.price?.toString() || "",
      price_tier_2: product.price_tier_2?.toString() || "",
      price_tier_3: product.price_tier_3?.toString() || "",
      price_tier_4: product.price_tier_4?.toString() || "",
      stock: "", // Não preencher stock ao editar
      unit: product.unit || "un",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    setProductToDelete({ id, name });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete.id);
    }
  };

  const handleRowDoubleClick = (productId: number, productName: string) => {
    setSelectedProductForMovements({ id: productId, name: productName });
    setIsMovementsDialogOpen(true);
  };

  const getMovementTypeLabel = (type: string) => {
    if (type === 'entrada') return 'Entrada';
    if (type === 'saida') return 'Saída';
    return type;
  };

  const getMovementTypeBadge = (type: string) => {
    if (type === 'entrada') {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Entrada</Badge>;
    }
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Saída</Badge>;
  };

  const getReferenceLabel = (referenceType: string, referenceId: number | null) => {
    if (!referenceType) return '-';
    const labels: { [key: string]: string } = {
      'venda': 'Venda',
      'consignacao': 'Consignação',
      'producao': 'Produção',
      'ajuste': 'Ajuste',
    };
    const label = labels[referenceType] || referenceType;
    return referenceId ? `${label} #${referenceId}` : label;
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setFormData({ name: "", price: "", price_tier_1: "", price_tier_2: "", price_tier_3: "", price_tier_4: "", stock: "", unit: "kg" });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu catálogo de produtos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewProduct}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Cadastrar Produto"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pão de Queijo Tradicional"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço Padrão (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ 
                        ...formData, 
                        price: value,
                        // Sincronizar com Faixa 1 se estiver vazia
                        price_tier_1: formData.price_tier_1 || value
                      });
                    }}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Sincronizado com Faixa 1</p>
                </div>
                {!editingProduct && (
                  <div className="space-y-2">
                    <Label htmlFor="stock">Estoque</Label>
                    <Input
                      id="stock"
                      type="number"
                      step="1"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permitir apenas números inteiros
                        if (value === '' || /^\d+$/.test(value)) {
                          setFormData({ ...formData, stock: value });
                        }
                      }}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
              
              {/* Seção de Faixas de Preço */}
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Faixas de Preço</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Configure diferentes preços para diferentes faixas de clientes. 
                          Cada cliente pertence a uma faixa (1-4) e verá o preço correspondente nas vendas.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure até 4 faixas de preço diferentes para este produto
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="price_tier_1">Faixa 1 (R$) *</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Preço padrão aplicado a clientes da Faixa 1</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="price_tier_1"
                      type="number"
                      step="0.01"
                      value={formData.price_tier_1}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ 
                          ...formData, 
                          price_tier_1: value,
                          // Sincronizar com Preço Padrão se estiver vazio
                          price: formData.price || value
                        });
                      }}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_tier_2">Faixa 2 (R$)</Label>
                    <Input
                      id="price_tier_2"
                      type="number"
                      step="0.01"
                      value={formData.price_tier_2}
                      onChange={(e) => setFormData({ ...formData, price_tier_2: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_tier_3">Faixa 3 (R$)</Label>
                    <Input
                      id="price_tier_3"
                      type="number"
                      step="0.01"
                      value={formData.price_tier_3}
                      onChange={(e) => setFormData({ ...formData, price_tier_3: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_tier_4">Faixa 4 (R$)</Label>
                    <Input
                      id="price_tier_4"
                      type="number"
                      step="0.01"
                      value={formData.price_tier_4}
                      onChange={(e) => setFormData({ ...formData, price_tier_4: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
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
                {editingProduct ? "Atualizar" : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Produtos</CardTitle>
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
              <span className="ml-2 text-muted-foreground">Carregando produtos...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">Erro ao carregar produtos. Tente novamente.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                {products.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com o filtro informado."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço Unitário</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((product: any) => {
                  // Coletar todas as faixas configuradas
                  const tiersInfo = [];
                  if (product.price_tier_1 !== null && product.price_tier_1 !== undefined) {
                    tiersInfo.push({ tier: 1, price: parseFloat(product.price_tier_1) });
                  }
                  if (product.price_tier_2 !== null && product.price_tier_2 !== undefined) {
                    tiersInfo.push({ tier: 2, price: parseFloat(product.price_tier_2) });
                  }
                  if (product.price_tier_3 !== null && product.price_tier_3 !== undefined) {
                    tiersInfo.push({ tier: 3, price: parseFloat(product.price_tier_3) });
                  }
                  if (product.price_tier_4 !== null && product.price_tier_4 !== undefined) {
                    tiersInfo.push({ tier: 4, price: parseFloat(product.price_tier_4) });
                  }
                  
                  // Mostrar badge se tiver pelo menos 2 faixas configuradas
                  const hasMultipleTiers = tiersInfo.length >= 2;
                  
                  return (
                  <TableRow 
                    key={product.id}
                    onDoubleClick={() => handleRowDoubleClick(product.id, product.name)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">{product.id}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>R$ {parseFloat(product.price).toFixed(2)}</span>
                        {hasMultipleTiers && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex items-center">
                                <Badge variant="outline" className="text-xs cursor-help hover:bg-primary/10">
                                  {tiersInfo.length} faixas
                                </Badge>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs" side="top" align="start" sideOffset={5}>
                              <div className="space-y-2">
                                <p className="font-semibold text-sm mb-2 border-b pb-1">Faixas de Preço Configuradas:</p>
                                <div className="space-y-1.5">
                                  {tiersInfo.map((tierInfo) => (
                                    <div key={tierInfo.tier} className="flex items-center justify-between gap-4">
                                      <span className="text-sm font-medium">Faixa {tierInfo.tier}:</span>
                                      <span className="text-sm text-primary font-semibold">R$ {tierInfo.price.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={product.stock < 100 ? "text-warning font-medium" : ""}>
                        {product.stock} {product.unit || "un"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setAddStockData({ quantity: "", notes: "", type: "entrada" });
                            setIsAddStockDialogOpen(true);
                          }}
                          title="Adicionar estoque"
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(product)}
                          title="Editar produto"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(product.id, product.name)}
                          title="Desativar produto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          
          {/* Paginação */}
          {filteredProducts.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} produto(s)
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

      {/* Dialog para ajustar estoque */}
      <Dialog open={isAddStockDialogOpen} onOpenChange={setIsAddStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addStockData.type === "entrada" ? "Adicionar Estoque" : "Registrar Baixa"}
            </DialogTitle>
            <DialogDescription>
              {addStockData.type === "entrada" 
                ? "Adicione produtos ao estoque (produção ou entrada de mercadoria)."
                : "Registre uma baixa de estoque (perda, vencimento, ajuste, etc.)."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedProductId || !addStockData.quantity) {
                toast({
                  title: "Campos obrigatórios",
                  description: "Preencha a quantidade.",
                  variant: "destructive",
                });
                return;
              }
              
              // Validar estoque disponível para saídas
              if (addStockData.type === "saida") {
                const product = products.find((p: any) => p.id === selectedProductId);
                const currentStock = product?.calculated_stock || product?.stock || 0;
                const quantity = parseInt(addStockData.quantity, 10);
                if (quantity > currentStock) {
                  toast({
                    title: "Estoque insuficiente",
                    description: `Estoque disponível: ${currentStock.toFixed(2)} ${product?.unit || "un"}. Quantidade solicitada: ${quantity}.`,
                    variant: "destructive",
                  });
                  return;
                }
              }
              
              addStockMutation.mutate({
                id: selectedProductId,
                quantity: parseInt(addStockData.quantity, 10),
                type: addStockData.type,
                notes: addStockData.notes || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Movimentação *</Label>
              <Select
                value={addStockData.type}
                onValueChange={(value: "entrada" | "saida") => 
                  setAddStockData({ ...addStockData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">
                    <ArrowUp className="inline h-4 w-4 mr-2 text-success" />
                    Entrada (Produção/Recebimento)
                  </SelectItem>
                  <SelectItem value="saida">
                    <ArrowDown className="inline h-4 w-4 mr-2 text-destructive" />
                    Saída (Baixa/Perda)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input
                id="quantity"
                type="number"
                step="1"
                min="0"
                value={addStockData.quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  // Permitir apenas números inteiros
                  if (value === '' || /^\d+$/.test(value)) {
                    setAddStockData({ ...addStockData, quantity: value });
                  }
                }}
                placeholder="0"
                required
              />
              {addStockData.type === "saida" && selectedProductId && (
                <p className="text-xs text-muted-foreground">
                  Estoque disponível: {
                    (products.find((p: any) => p.id === selectedProductId)?.calculated_stock || 
                     products.find((p: any) => p.id === selectedProductId)?.stock || 0).toFixed(2)
                  } {products.find((p: any) => p.id === selectedProductId)?.unit || "un"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (Opcional)</Label>
              <Textarea
                id="notes"
                value={addStockData.notes}
                onChange={(e) => setAddStockData({ ...addStockData, notes: e.target.value })}
                placeholder={
                  addStockData.type === "entrada" 
                    ? "Ex: Produção do dia, Recebimento de fornecedor, etc."
                    : "Ex: Produto vencido, Perda por quebra, Ajuste de inventário, etc."
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddStockDialogOpen(false);
                  setAddStockData({ quantity: "", notes: "", type: "entrada" });
                }}
                disabled={addStockMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={addStockMutation.isPending}
                variant={addStockData.type === "saida" ? "destructive" : "default"}
              >
                {addStockMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {addStockData.type === "entrada" ? "Adicionando..." : "Registrando..."}
                  </>
                ) : (
                  <>
                    {addStockData.type === "entrada" ? (
                      <>
                        <PackagePlus className="mr-2 h-4 w-4" />
                        Adicionar Estoque
                      </>
                    ) : (
                      <>
                        <ArrowDown className="mr-2 h-4 w-4" />
                        Registrar Baixa
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Movimentações do Produto */}
      <Dialog open={isMovementsDialogOpen} onOpenChange={setIsMovementsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extrato de Movimentações - {selectedProductForMovements?.name}</DialogTitle>
            <DialogDescription>
              Histórico completo de entradas e saídas de estoque
            </DialogDescription>
          </DialogHeader>
          {isLoadingMovements ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando movimentações...</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Nenhuma movimentação registrada para este produto.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement: any) => {
                      const product = products.find((p: any) => p.id === selectedProductForMovements?.id);
                      const unit = product?.unit || "un";
                      
                      return (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {movement.date 
                              ? new Date(movement.date).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {getMovementTypeBadge(movement.type)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${movement.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                            {movement.type === 'entrada' ? '+' : '-'}
                            {parseFloat(movement.quantity || 0).toFixed(2)} {unit}
                          </TableCell>
                          <TableCell>
                            {getReferenceLabel(movement.reference_type, movement.reference_id)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {movement.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Resumo */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total de Entradas</p>
                    <p className="text-lg font-bold text-success">
                      +{movements
                        .filter((m: any) => m.type === 'entrada')
                        .reduce((sum: number, m: any) => sum + parseFloat(m.quantity || 0), 0)
                        .toFixed(2)} {products.find((p: any) => p.id === selectedProductForMovements?.id)?.unit || "un"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total de Saídas</p>
                    <p className="text-lg font-bold text-destructive">
                      -{movements
                        .filter((m: any) => m.type === 'saida')
                        .reduce((sum: number, m: any) => sum + parseFloat(m.quantity || 0), 0)
                        .toFixed(2)} {products.find((p: any) => p.id === selectedProductForMovements?.id)?.unit || "un"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">Estoque Atual</p>
                    <p className="text-xl font-bold">
                      {products.find((p: any) => p.id === selectedProductForMovements?.id)?.calculated_stock?.toFixed(2) || 
                       products.find((p: any) => p.id === selectedProductForMovements?.id)?.stock?.toFixed(2) || 
                       "0.00"} {products.find((p: any) => p.id === selectedProductForMovements?.id)?.unit || "un"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMovementsDialogOpen(false);
                    setSelectedProductForMovements(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de desativação */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar Produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar este produto?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-md">
              <p className="text-sm text-foreground">
                <strong>Produto: {productToDelete?.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Uma vez desativado, este produto não poderá mais ser usado em vendas, consignações ou outras operações. 
                O registro será mantido no sistema apenas para fins de histórico.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setProductToDelete(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Desativando...
                  </>
                ) : (
                  "Desativar Produto"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
