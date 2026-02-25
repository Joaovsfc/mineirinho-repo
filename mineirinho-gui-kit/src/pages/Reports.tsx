import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { jsPDF } from "jspdf";

interface RecentReport {
  id: string;
  type: string;
  typeLabel: string;
  startDate: string | null;
  endDate: string | null;
  fileName: string;
  generatedAt: string;
}

const STORAGE_KEY = "recent_reports";
const MAX_RECENT_REPORTS = 10;

const Reports = () => {
  const [filters, setFilters] = useState({
    reportType: "",
    startDate: "",
    endDate: "",
  });
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);

  // Calcular datas padrão (últimos 30 dias)
  const getDefaultDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  const defaultDates = getDefaultDates();
  const effectiveStartDate = filters.startDate || defaultDates.start;
  const effectiveEndDate = filters.endDate || defaultDates.end;

  // Carregar relatórios recentes do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const reports = JSON.parse(stored) as RecentReport[];
        setRecentReports(reports);
      }
    } catch (error) {
      console.warn("Erro ao carregar relatórios recentes:", error);
    }
  }, []);

  // Função para salvar um relatório recente
  const saveRecentReport = (type: string, typeLabel: string, startDate: string | null, endDate: string | null, fileName: string) => {
    const newReport: RecentReport = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      typeLabel,
      startDate,
      endDate,
      fileName,
      generatedAt: new Date().toISOString(),
    };

    const updated = [newReport, ...recentReports].slice(0, MAX_RECENT_REPORTS);
    setRecentReports(updated);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn("Erro ao salvar relatório recente:", error);
    }
  };

  // Função para regenerar um relatório
  const regenerateReport = async (report: RecentReport) => {
    // Definir os filtros do relatório
    setFilters({
      reportType: report.type,
      startDate: report.startDate || "",
      endDate: report.endDate || "",
    });

    // Aguardar um pouco para os filtros serem aplicados e os dados serem recarregados
    setTimeout(async () => {
      try {
        if (report.type === "sales") {
          await generateSalesReportPDF();
        } else if (report.type === "sales-paid") {
          await generateSalesPaidReportPDF();
        } else if (report.type === "inventory") {
          await generateInventoryReportPDF();
        } else if (report.type === "financial") {
          await generateFinancialReportPDF();
        } else if (report.type === "consignment") {
          await generateConsignmentReportPDF();
        } else if (report.type === "stock-movements-by-product") {
          await generateStockMovementsByProductReportPDF();
        } else if (report.type === "stock-movements-by-type") {
          await generateStockMovementsByTypeReportPDF();
        } else if (report.type === "stock-movements-daily") {
          await generateStockMovementsDailyReportPDF();
        }
      } catch (error: any) {
        toast({
          title: "Erro ao regenerar relatório",
          description: error.message || "Ocorreu um erro ao regenerar o relatório.",
          variant: "destructive",
        });
      }
    }, 300);
  };

  // Função para formatar nome do relatório
  const getReportDisplayName = (report: RecentReport) => {
    const typeName = report.typeLabel;
    if (report.startDate && report.endDate) {
      const start = new Date(report.startDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      const end = new Date(report.endDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      if (start === end) {
        return `${typeName} - ${start}`;
      }
      return `${typeName} - ${start} a ${end}`;
    }
    return typeName;
  };

  // Buscar vendas no período
  const { data: salesPeriod, isLoading: isLoadingSales } = useQuery({
    queryKey: ['reports', 'sales-period', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getSalesPeriod(effectiveStartDate, effectiveEndDate),
  });

  // Buscar produtos vendidos
  const { data: productsSold, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['reports', 'products-sold', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getProductsSold(effectiveStartDate, effectiveEndDate),
  });

  // Buscar ticket médio
  const { data: averageTicket, isLoading: isLoadingTicket } = useQuery({
    queryKey: ['reports', 'average-ticket', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getAverageTicket(effectiveStartDate, effectiveEndDate),
  });

  // Buscar relatório de vendas quando necessário
  const { data: salesReport, isLoading: isLoadingSalesReport, refetch: refetchSalesReport } = useQuery({
    queryKey: ['reports', 'sales', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getSalesReport(effectiveStartDate, effectiveEndDate),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório de vendas concretizadas quando necessário
  const { data: salesPaidReport, isLoading: isLoadingSalesPaidReport, refetch: refetchSalesPaidReport } = useQuery({
    queryKey: ['reports', 'sales-paid', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getSalesPaidReport(effectiveStartDate, effectiveEndDate),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório de estoque quando necessário
  const { data: inventoryReport, isLoading: isLoadingInventoryReport, refetch: refetchInventoryReport } = useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: () => apiService.getInventoryReport(),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório financeiro quando necessário
  const { data: financialReport, isLoading: isLoadingFinancialReport, refetch: refetchFinancialReport } = useQuery({
    queryKey: ['reports', 'financial', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getFinancialReport(effectiveStartDate, effectiveEndDate),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório de consignação quando necessário
  const { data: consignmentReport, isLoading: isLoadingConsignmentReport, refetch: refetchConsignmentReport } = useQuery({
    queryKey: ['reports', 'consignment', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getConsignmentReport(effectiveStartDate, effectiveEndDate),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório de movimentações por produto quando necessário
  const { data: stockMovementsByProductReport, isLoading: isLoadingStockMovementsByProduct, refetch: refetchStockMovementsByProduct } = useQuery({
    queryKey: ['reports', 'stock-movements-by-product', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getStockMovementsByProductReport(effectiveStartDate, effectiveEndDate),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório de movimentações por tipo quando necessário
  const { data: stockMovementsByTypeReport, isLoading: isLoadingStockMovementsByType, refetch: refetchStockMovementsByType } = useQuery({
    queryKey: ['reports', 'stock-movements-by-type', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getStockMovementsByTypeReport(effectiveStartDate, effectiveEndDate),
    enabled: false, // Não buscar automaticamente
  });

  // Buscar relatório de movimentações diárias quando necessário
  const { data: stockMovementsDailyReport, isLoading: isLoadingStockMovementsDaily, refetch: refetchStockMovementsDaily } = useQuery({
    queryKey: ['reports', 'stock-movements-daily', effectiveStartDate, effectiveEndDate],
    queryFn: () => apiService.getStockMovementsDailyReport(effectiveStartDate!, effectiveEndDate!),
    enabled: false, // Não buscar automaticamente
  });

  const generateSalesReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchSalesReport();
      const data = reportData.data;

      if (!data || !data.sales || data.sales.length === 0) {
        toast({
          title: "Nenhuma venda encontrada",
          description: "Não há vendas no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          // Adicionar logo no rodapé da página atual
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          // Adicionar logo no topo da nova página
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Vendas", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = data.summary.startDate && data.summary.endDate
        ? `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`
        : "Período: Todos os registros";
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Vendas: ${data.summary.count}`, margin, yPos);
      yPos += 6;
      doc.text(`Total em R$: R$ ${data.summary.total.toFixed(2)}`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Itens: ${data.summary.totalItems.toFixed(0)}`, margin, yPos);
      yPos += 10;

      // Tabela de vendas
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento de Vendas", margin, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let xPos = margin;
      doc.text("ID", xPos, yPos);
      xPos += 15;
      doc.text("Data", xPos, yPos);
      xPos += 35;
      doc.text("Cliente", xPos, yPos);
      xPos += 50;
      doc.text("Total", xPos, yPos);
      xPos += 30;
      doc.text("Status", xPos, yPos);
      yPos += 5;

      // Linha separadora
      doc.setLineWidth(0.1);
      doc.line(margin, yPos, maxWidth + margin, yPos);
      yPos += 5;

      // Dados das vendas
      doc.setFont("helvetica", "normal");
      data.sales.forEach((sale: any) => {
        checkPageBreak(20);

        const saleDate = sale.date 
          ? new Date(sale.date).toLocaleDateString('pt-BR')
          : "-";
        const clientName = sale.client_name || "-";
        const total = parseFloat(sale.total || 0).toFixed(2);
        const status = sale.status || "Pendente";

        xPos = margin;
        doc.text(`#${sale.id}`, xPos, yPos);
        xPos += 15;
        doc.text(saleDate, xPos, yPos);
        xPos += 35;
        // Truncar nome do cliente se muito longo
        const clientNameTruncated = doc.splitTextToSize(clientName, 45);
        doc.text(clientNameTruncated[0], xPos, yPos);
        if (clientNameTruncated.length > 1) {
          yPos += 4;
        }
        xPos += 50;
        doc.text(`R$ ${total}`, xPos, yPos);
        xPos += 30;
        doc.text(status, xPos, yPos);
        yPos += 6;

        // Adicionar itens da venda (se couber)
        if (sale.items && sale.items.length > 0) {
          checkPageBreak(10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          sale.items.forEach((item: any) => {
            checkPageBreak(5);
            const itemText = `  • ${item.product_name || `Produto #${item.product_id}`}: ${item.quantity} ${item.unit || "un"} x R$ ${parseFloat(item.price || 0).toFixed(2)}`;
            const itemLines = doc.splitTextToSize(itemText, maxWidth - 10);
            doc.text(itemLines[0], margin + 5, yPos);
            yPos += 4;
          });
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
        }

        yPos += 2;
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_vendas_${data.summary.startDate || 'all'}_${data.summary.endDate || 'all'}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("sales", "Relatório de Vendas", data.summary.startDate, data.summary.endDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de vendas salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateSalesPaidReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchSalesPaidReport();
      const data = reportData.data;

      if (!data || !data.sales || data.sales.length === 0) {
        toast({
          title: "Nenhuma venda encontrada",
          description: "Não há vendas concretizadas (pagas) no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          // Adicionar logo no rodapé da página atual
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          // Adicionar logo no topo da nova página
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Vendas Concretizadas", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = data.summary.startDate && data.summary.endDate
        ? `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`
        : "Período: Todos os registros";
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Vendas Pagas: ${data.summary.count}`, margin, yPos);
      yPos += 6;
      doc.text(`Total em R$: R$ ${data.summary.total.toFixed(2)}`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Itens: ${data.summary.totalItems.toFixed(0)}`, margin, yPos);
      yPos += 10;

      // Tabela de vendas
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento de Vendas Concretizadas", margin, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let xPos = margin;
      doc.text("ID", xPos, yPos);
      xPos += 15;
      doc.text("Data", xPos, yPos);
      xPos += 35;
      doc.text("Cliente", xPos, yPos);
      xPos += 50;
      doc.text("Total", xPos, yPos);
      xPos += 30;
      doc.text("Pagamento", xPos, yPos);
      yPos += 5;

      // Linha separadora
      doc.setLineWidth(0.1);
      doc.line(margin, yPos, maxWidth + margin, yPos);
      yPos += 5;

      // Dados das vendas
      doc.setFont("helvetica", "normal");
      data.sales.forEach((sale: any) => {
        checkPageBreak(20);

        const saleDate = sale.date 
          ? new Date(sale.date).toLocaleDateString('pt-BR')
          : "-";
        const clientName = sale.client_name || "-";
        const total = parseFloat(sale.total || 0).toFixed(2);
        const paymentMethod = sale.payment_method || "-";

        xPos = margin;
        doc.text(`#${sale.id}`, xPos, yPos);
        xPos += 15;
        doc.text(saleDate, xPos, yPos);
        xPos += 35;
        // Truncar nome do cliente se muito longo
        const clientNameTruncated = doc.splitTextToSize(clientName, 45);
        doc.text(clientNameTruncated[0], xPos, yPos);
        if (clientNameTruncated.length > 1) {
          yPos += 4;
        }
        xPos += 50;
        doc.text(`R$ ${total}`, xPos, yPos);
        xPos += 30;
        doc.text(paymentMethod, xPos, yPos);
        yPos += 6;

        // Adicionar itens da venda (se couber)
        if (sale.items && sale.items.length > 0) {
          checkPageBreak(10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          sale.items.forEach((item: any) => {
            checkPageBreak(5);
            const itemText = `  • ${item.product_name || `Produto #${item.product_id}`}: ${item.quantity} ${item.unit || "un"} x R$ ${parseFloat(item.price || 0).toFixed(2)}`;
            const itemLines = doc.splitTextToSize(itemText, maxWidth - 10);
            doc.text(itemLines[0], margin + 5, yPos);
            yPos += 4;
          });
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
        }

        yPos += 2;
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_vendas_concretizadas_${data.summary.startDate || 'all'}_${data.summary.endDate || 'all'}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("sales-paid", "Vendas Concretizadas", data.summary.startDate, data.summary.endDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de vendas concretizadas salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateInventoryReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchInventoryReport();
      const data = reportData.data;

      if (!data || !data.products || data.products.length === 0) {
        toast({
          title: "Nenhum produto encontrado",
          description: "Não há produtos cadastrados no sistema.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          // Adicionar logo no rodapé da página atual
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          // Adicionar logo no topo da nova página
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de quantidade em estoque", 105, yPos, { align: "center" });
      yPos += 10;

      // Data de geração
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Produtos: ${data.summary.totalProducts}`, margin, yPos);
      yPos += 6;
      doc.text(`Total em Estoque: ${data.summary.totalStockQuantity.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.text(`Valor Total do Estoque: R$ ${data.summary.totalStockValue.toFixed(2)}`, margin, yPos);
      yPos += 6;
      if (data.summary.lowStockProducts > 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 0, 0); // Vermelho
        doc.text(`Produtos sem Estoque: ${data.summary.lowStockProducts}`, margin, yPos);
        doc.setTextColor(0, 0, 0); // Voltar ao preto
        yPos += 6;
      }
      yPos += 5;

      // Tabela de produtos
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento de Produtos", margin, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let xPos = margin;
      doc.text("ID", xPos, yPos);
      xPos += 15;
      doc.text("Produto", xPos, yPos);
      xPos += 70;
      doc.text("Preço Unit.", xPos, yPos);
      xPos += 30;
      doc.text("Estoque", xPos, yPos);
      xPos += 25;
      doc.text("Valor Total", xPos, yPos);
      yPos += 5;

      // Linha separadora
      doc.setLineWidth(0.1);
      doc.line(margin, yPos, maxWidth + margin, yPos);
      yPos += 5;

      // Dados dos produtos
      doc.setFont("helvetica", "normal");
      data.products.forEach((product: any) => {
        checkPageBreak(10);

        const productName = product.name || "-";
        const price = parseFloat(product.price || 0).toFixed(2);
        const stock = product.calculated_stock || 0;
        const stockValue = parseFloat(product.stock_value || 0).toFixed(2);
        const unit = product.unit || "un";

        // Destacar produtos sem estoque
        if (stock <= 0) {
          doc.setTextColor(255, 0, 0); // Vermelho
        }

        xPos = margin;
        doc.text(`#${product.id}`, xPos, yPos);
        xPos += 15;
        // Truncar nome do produto se muito longo
        const productNameTruncated = doc.splitTextToSize(productName, 65);
        doc.text(productNameTruncated[0], xPos, yPos);
        if (productNameTruncated.length > 1) {
          yPos += 4;
        }
        xPos += 70;
        doc.text(`R$ ${price}`, xPos, yPos);
        xPos += 30;
        doc.text(`${stock.toFixed(2)} ${unit}`, xPos, yPos);
        xPos += 25;
        doc.text(`R$ ${stockValue}`, xPos, yPos);
        yPos += 6;

        // Voltar cor ao normal
        doc.setTextColor(0, 0, 0);
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração no rodapé
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_estoque_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("inventory", "Relatório de produtos em estoque", null, null, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de estoque salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateFinancialReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchFinancialReport();
      const data = reportData.data;

      if (!data || (!data.accountsPayable || data.accountsPayable.length === 0) && (!data.accountsReceivable || data.accountsReceivable.length === 0)) {
        toast({
          title: "Nenhuma conta encontrada",
          description: "Não há contas a pagar ou receber no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          // Adicionar logo no rodapé da página atual
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          // Adicionar logo no topo da nova página
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Financeiro", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = data.summary.startDate && data.summary.endDate
        ? `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`
        : "Período: Todos os registros";
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo Financeiro
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total a Pagar: R$ ${data.summary.totalPayable.toFixed(2)}`, margin, yPos);
      yPos += 6;
      doc.text(`  - Pendente: R$ ${data.summary.totalPayablePending.toFixed(2)}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`  - Pago: R$ ${data.summary.totalPayablePaid.toFixed(2)}`, margin + 5, yPos);
      yPos += 8;
      
      doc.text(`Total a Receber: R$ ${data.summary.totalReceivable.toFixed(2)}`, margin, yPos);
      yPos += 6;
      doc.text(`  - Pendente: R$ ${data.summary.totalReceivablePending.toFixed(2)}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`  - Recebido: R$ ${data.summary.totalReceivableReceived.toFixed(2)}`, margin + 5, yPos);
      yPos += 8;
      
      doc.setFont("helvetica", "bold");
      doc.text(`Saldo Realizado: R$ ${data.summary.balance.toFixed(2)}`, margin, yPos);
      yPos += 6;
      doc.text(`Saldo Projetado: R$ ${data.summary.projectedBalance.toFixed(2)}`, margin, yPos);
      yPos += 10;

      // Contas a Pagar
      if (data.accountsPayable && data.accountsPayable.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Contas a Pagar", margin, yPos);
        yPos += 8;

        // Cabeçalho da tabela
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        let xPos = margin;
        doc.text("ID", xPos, yPos);
        xPos += 15;
        doc.text("Descrição", xPos, yPos);
        xPos += 60;
        doc.text("Vencimento", xPos, yPos);
        xPos += 30;
        doc.text("Valor", xPos, yPos);
        xPos += 25;
        doc.text("Status", xPos, yPos);
        yPos += 5;

        // Linha separadora
        doc.setLineWidth(0.1);
        doc.line(margin, yPos, maxWidth + margin, yPos);
        yPos += 5;

        // Dados das contas a pagar
        doc.setFont("helvetica", "normal");
        data.accountsPayable.forEach((account: any) => {
          checkPageBreak(10);

          const description = account.description || "-";
          const dueDate = account.due_date 
            ? (() => {
                const [year, month, day] = account.due_date.split('-');
                return `${day}/${month}/${year}`;
              })()
            : "-";
          const value = parseFloat(account.value || 0).toFixed(2);
          const status = account.status || "Pendente";

          // Destacar contas vencidas
          if (status === "Pendente" && account.due_date) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (account.due_date < todayStr) {
              doc.setTextColor(255, 0, 0); // Vermelho
            }
          }

          xPos = margin;
          doc.text(`#${account.id}`, xPos, yPos);
          xPos += 15;
          const descTruncated = doc.splitTextToSize(description, 55);
          doc.text(descTruncated[0], xPos, yPos);
          if (descTruncated.length > 1) {
            yPos += 4;
          }
          xPos += 60;
          doc.text(dueDate, xPos, yPos);
          xPos += 30;
          doc.text(`R$ ${value}`, xPos, yPos);
          xPos += 25;
          doc.text(status, xPos, yPos);
          yPos += 6;

          // Voltar cor ao normal
          doc.setTextColor(0, 0, 0);
        });

        yPos += 5;
      }

      // Contas a Receber
      if (data.accountsReceivable && data.accountsReceivable.length > 0) {
        checkPageBreak(15);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Contas a Receber", margin, yPos);
        yPos += 8;

        // Cabeçalho da tabela
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        let xPos = margin;
        doc.text("ID", xPos, yPos);
        xPos += 15;
        doc.text("Cliente", xPos, yPos);
        xPos += 50;
        doc.text("Descrição", xPos, yPos);
        xPos += 40;
        doc.text("Vencimento", xPos, yPos);
        xPos += 30;
        doc.text("Valor", xPos, yPos);
        xPos += 25;
        doc.text("Status", xPos, yPos);
        yPos += 5;

        // Linha separadora
        doc.setLineWidth(0.1);
        doc.line(margin, yPos, maxWidth + margin, yPos);
        yPos += 5;

        // Dados das contas a receber
        doc.setFont("helvetica", "normal");
        data.accountsReceivable.forEach((account: any) => {
          checkPageBreak(10);

          const clientName = account.client_name || "-";
          const description = account.description || "-";
          const dueDate = account.due_date 
            ? (() => {
                const [year, month, day] = account.due_date.split('-');
                return `${day}/${month}/${year}`;
              })()
            : "-";
          const value = parseFloat(account.value || 0).toFixed(2);
          const status = account.status || "Pendente";

          // Destacar contas vencidas
          if (status === "Pendente" && account.due_date) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (account.due_date < todayStr) {
              doc.setTextColor(255, 0, 0); // Vermelho
            }
          }

          xPos = margin;
          doc.text(`#${account.id}`, xPos, yPos);
          xPos += 15;
          const clientTruncated = doc.splitTextToSize(clientName, 45);
          doc.text(clientTruncated[0], xPos, yPos);
          if (clientTruncated.length > 1) {
            yPos += 4;
          }
          xPos += 50;
          const descTruncated = doc.splitTextToSize(description, 35);
          doc.text(descTruncated[0], xPos, yPos);
          if (descTruncated.length > 1) {
            yPos += 4;
          }
          xPos += 40;
          doc.text(dueDate, xPos, yPos);
          xPos += 30;
          doc.text(`R$ ${value}`, xPos, yPos);
          xPos += 25;
          doc.text(status, xPos, yPos);
          yPos += 6;

          // Voltar cor ao normal
          doc.setTextColor(0, 0, 0);
        });
      }

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_financeiro_${data.summary.startDate || 'all'}_${data.summary.endDate || 'all'}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("financial", "Relatório Financeiro", data.summary.startDate, data.summary.endDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório financeiro salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateConsignmentReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchConsignmentReport();
      const data = reportData.data;

      if (!data || !data.consignments || data.consignments.length === 0) {
        toast({
          title: "Nenhuma consignação encontrada",
          description: "Não há consignações no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          // Adicionar logo no rodapé da página atual
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          // Adicionar logo no topo da nova página
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Consignações", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = data.summary.startDate && data.summary.endDate
        ? `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`
        : "Período: Todos os registros";
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Consignações: ${data.summary.totalConsignments}`, margin, yPos);
      yPos += 6;
      doc.text(`  - Ativas: ${data.summary.activeConsignments}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`  - Encerradas: ${data.summary.closedConsignments}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Total de Itens Consignados: ${data.summary.totalItems.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      if (data.summary.totalClosedValue > 0) {
        doc.text(`Total Encerrado: R$ ${data.summary.totalClosedValue.toFixed(2)}`, margin, yPos);
        yPos += 6;
      }
      yPos += 5;

      // Tabela de consignações
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento de Consignações", margin, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let xPos = margin;
      doc.text("ID", xPos, yPos);
      xPos += 15;
      doc.text("Data", xPos, yPos);
      xPos += 30;
      doc.text("Cliente", xPos, yPos);
      xPos += 50;
      doc.text("Itens", xPos, yPos);
      xPos += 30;
      doc.text("Status", xPos, yPos);
      xPos += 30;
      doc.text("Total Encerrado", xPos, yPos);
      yPos += 5;

      // Linha separadora
      doc.setLineWidth(0.1);
      doc.line(margin, yPos, maxWidth + margin, yPos);
      yPos += 5;

      // Dados das consignações
      doc.setFont("helvetica", "normal");
      data.consignments.forEach((consignment: any) => {
        checkPageBreak(25);

        const consignmentDate = consignment.date 
          ? new Date(consignment.date).toLocaleDateString('pt-BR')
          : "-";
        const clientName = consignment.client_name || "-";
        const itemsCount = consignment.items ? consignment.items.length : 0;
        const totalQuantity = consignment.items 
          ? consignment.items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0)
          : 0;
        const status = consignment.status || "Ativo";
        const closedTotal = consignment.closed_total ? parseFloat(consignment.closed_total).toFixed(2) : "-";

        xPos = margin;
        doc.text(`#${consignment.id}`, xPos, yPos);
        xPos += 15;
        doc.text(consignmentDate, xPos, yPos);
        xPos += 30;
        // Truncar nome do cliente se muito longo
        const clientNameTruncated = doc.splitTextToSize(clientName, 45);
        doc.text(clientNameTruncated[0], xPos, yPos);
        if (clientNameTruncated.length > 1) {
          yPos += 4;
        }
        xPos += 50;
        doc.text(`${itemsCount} item(ns)`, xPos, yPos);
        xPos += 30;
        doc.text(status, xPos, yPos);
        xPos += 30;
        doc.text(closedTotal !== "-" ? `R$ ${closedTotal}` : "-", xPos, yPos);
        yPos += 6;

        // Adicionar itens da consignação (se couber)
        if (consignment.items && consignment.items.length > 0) {
          checkPageBreak(10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          consignment.items.forEach((item: any) => {
            checkPageBreak(5);
            const itemText = `  • ${item.product_name || `Produto #${item.product_id}`}: ${item.quantity} ${item.product_unit || "un"}${item.price ? ` x R$ ${parseFloat(item.price).toFixed(2)}` : ""}`;
            const itemLines = doc.splitTextToSize(itemText, maxWidth - 10);
            doc.text(itemLines[0], margin + 5, yPos);
            yPos += 4;
          });
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
        }

        yPos += 2;
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_consignacoes_${data.summary.startDate || 'all'}_${data.summary.endDate || 'all'}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("consignment", "Relatório de Consignação", data.summary.startDate, data.summary.endDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de consignações salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateStockMovementsByProductReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchStockMovementsByProduct();
      const data = reportData.data;

      if (!data || !data.products || data.products.length === 0) {
        toast({
          title: "Nenhuma movimentação encontrada",
          description: "Não há movimentações de estoque no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Movimentações de Estoque", 105, yPos, { align: "center" });
      yPos += 5;
      doc.setFontSize(14);
      doc.text("Agrupado por Produto", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = data.summary.startDate && data.summary.endDate
        ? `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`
        : "Período: Todos os registros";
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Geral", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Produtos com Movimentação: ${data.summary.totalProducts}`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Entradas: ${data.summary.totalEntries.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Saídas: ${data.summary.totalExits.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`Saldo Líquido: ${data.summary.netBalance.toFixed(2)} unidades`, margin, yPos);
      yPos += 10;

      // Detalhamento por produto
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento por Produto", margin, yPos);
      yPos += 8;

      data.products.forEach((product: any) => {
        checkPageBreak(30);

        // Cabeçalho do produto
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Produto: ${product.product_name} (ID: ${product.product_id})`, margin, yPos);
        yPos += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Unidade: ${product.unit || "un"}`, margin, yPos);
        yPos += 5;
        doc.text(`Total de Entradas: ${parseFloat(product.total_entradas || 0).toFixed(2)} ${product.unit || "un"}`, margin, yPos);
        yPos += 5;
        doc.text(`Total de Saídas: ${parseFloat(product.total_saidas || 0).toFixed(2)} ${product.unit || "un"}`, margin, yPos);
        yPos += 5;
        doc.setFont("helvetica", "bold");
        doc.text(`Saldo: ${product.saldo.toFixed(2)} ${product.unit || "un"}`, margin, yPos);
        yPos += 5;
        doc.text(`Total de Movimentações: ${product.total_movements}`, margin, yPos);
        yPos += 5;
        
        if (product.primeira_movimentacao) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(`Primeira: ${new Date(product.primeira_movimentacao).toLocaleDateString('pt-BR')}`, margin, yPos);
          yPos += 4;
          doc.text(`Última: ${new Date(product.ultima_movimentacao).toLocaleDateString('pt-BR')}`, margin, yPos);
          yPos += 5;
        }

        // Lista de movimentações (se houver e couber)
        if (product.movements && product.movements.length > 0 && product.movements.length <= 5) {
          checkPageBreak(15);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.text("Movimentações:", margin + 5, yPos);
          yPos += 4;
          product.movements.slice(0, 5).forEach((movement: any) => {
            checkPageBreak(5);
            const typeLabel = movement.type === 'entrada' ? 'Entrada' : 'Saída';
            const date = new Date(movement.date).toLocaleDateString('pt-BR');
            const movementText = `  • ${date} - ${typeLabel}: ${parseFloat(movement.quantity || 0).toFixed(2)} ${product.unit || "un"}${movement.notes ? ` (${movement.notes})` : ''}`;
            const movementLines = doc.splitTextToSize(movementText, maxWidth - 10);
            doc.text(movementLines[0], margin + 5, yPos);
            yPos += 4;
          });
          doc.setFont("helvetica", "normal");
        }

        yPos += 5;
        
        // Linha separadora
        doc.setLineWidth(0.1);
        doc.line(margin, yPos, maxWidth + margin, yPos);
        yPos += 5;
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_movimentacoes_por_produto_${data.summary.startDate || 'all'}_${data.summary.endDate || 'all'}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("stock-movements-by-product", "Movimentações por Produto", data.summary.startDate, data.summary.endDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de movimentações por produto salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateStockMovementsByTypeReportPDF = async () => {
    try {
      // Buscar dados do relatório
      const reportData = await refetchStockMovementsByType();
      const data = reportData.data;

      if (!data || !data.movements || data.movements.length === 0) {
        toast({
          title: "Nenhuma movimentação encontrada",
          description: "Não há movimentações de estoque no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Movimentações de Estoque", 105, yPos, { align: "center" });
      yPos += 5;
      doc.setFontSize(14);
      doc.text("Agrupado por Tipo de Movimentação", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = data.summary.startDate && data.summary.endDate
        ? `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`
        : "Período: Todos os registros";
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Geral", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Movimentações: ${data.summary.totalMovements}`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Entradas: ${data.summary.totalEntries.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Saídas: ${data.summary.totalExits.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`Saldo Líquido: ${data.summary.netBalance.toFixed(2)} unidades`, margin, yPos);
      yPos += 10;

      // Detalhamento por tipo
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento por Tipo de Movimentação", margin, yPos);
      yPos += 8;

      data.movements.forEach((group: any) => {
        checkPageBreak(25);

        // Cabeçalho do grupo
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const typeLabel = group.type === 'entrada' ? 'ENTRADA' : 'SAÍDA';
        const refLabel = group.reference_type === 'producao' ? 'Produção' : 
                        group.reference_type === 'venda' ? 'Venda' :
                        group.reference_type === 'consignacao' ? 'Consignação' :
                        group.reference_type === 'ajuste' ? 'Ajuste' : group.reference_type || 'Outro';
        doc.text(`${typeLabel} - ${refLabel}`, margin, yPos);
        yPos += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Total de Movimentações: ${group.total_movements}`, margin, yPos);
        yPos += 5;
        doc.text(`Quantidade Total: ${parseFloat(group.total_quantity || 0).toFixed(2)} unidades`, margin, yPos);
        yPos += 5;
        
        if (group.primeira_movimentacao) {
          doc.setFontSize(8);
          doc.text(`Primeira: ${new Date(group.primeira_movimentacao).toLocaleDateString('pt-BR')}`, margin, yPos);
          yPos += 4;
          doc.text(`Última: ${new Date(group.ultima_movimentacao).toLocaleDateString('pt-BR')}`, margin, yPos);
          yPos += 5;
        }

        // Lista de movimentações (primeiras 10)
        if (group.movements && group.movements.length > 0) {
          checkPageBreak(15);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.text("Movimentações (primeiras 10):", margin + 5, yPos);
          yPos += 4;
          group.movements.slice(0, 10).forEach((movement: any) => {
            checkPageBreak(5);
            const date = new Date(movement.date).toLocaleDateString('pt-BR');
            const movementText = `  • ${date} - ${movement.product_name || `Produto #${movement.product_id}`}: ${parseFloat(movement.quantity || 0).toFixed(2)} ${movement.unit || "un"}${movement.notes ? ` (${movement.notes})` : ''}`;
            const movementLines = doc.splitTextToSize(movementText, maxWidth - 10);
            doc.text(movementLines[0], margin + 5, yPos);
            yPos += 4;
          });
          if (group.movements.length > 10) {
            doc.text(`  ... e mais ${group.movements.length - 10} movimentação(ões)`, margin + 5, yPos);
            yPos += 4;
          }
          doc.setFont("helvetica", "normal");
        }

        yPos += 5;
        
        // Linha separadora
        doc.setLineWidth(0.1);
        doc.line(margin, yPos, maxWidth + margin, yPos);
        yPos += 5;
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Data de geração
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const generatedAt = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${generatedAt}`, margin, pageHeight - 5);

      // Salvar PDF
      const fileName = `relatorio_movimentacoes_por_tipo_${data.summary.startDate || 'all'}_${data.summary.endDate || 'all'}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("stock-movements-by-type", "Movimentações por Tipo", data.summary.startDate, data.summary.endDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de movimentações por tipo salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const generateStockMovementsDailyReportPDF = async () => {
    try {
      if (!effectiveStartDate || !effectiveEndDate) {
        toast({
          title: "Período não informado",
          description: "Informe a data inicial e final para gerar o relatório.",
          variant: "destructive",
        });
        return;
      }

      // Buscar dados do relatório
      const reportData = await refetchStockMovementsDaily();
      const data = reportData.data;

      if (!data || !data.movements || data.movements.length === 0) {
        toast({
          title: "Nenhuma movimentação encontrada",
          description: "Não há movimentações de estoque no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      let yPos = 20;
      let logoData: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const maxWidth = doc.internal.pageSize.width - (margin * 2);

      // Carregar logo
      try {
        const { loadLogoAsBase64 } = await import('@/lib/logo');
        logoData = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }

      // Função para adicionar nova página se necessário
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          if (logoData) {
            const logoWidth = 30;
            const logoHeight = 22;
            doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
          }
          doc.addPage();
          yPos = 20;
          if (logoData) {
            const logoWidth = 40;
            const logoHeight = 30;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
            yPos = 10 + logoHeight + 5;
          }
        }
      };

      // Adicionar logo no topo da primeira página
      if (logoData) {
        const logoWidth = 40;
        const logoHeight = 30;
        doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);
        yPos = 10 + logoHeight + 5;
      }

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Movimentações de Estoque", 105, yPos, { align: "center" });
      yPos += 5;
      doc.setFontSize(14);
      doc.text("Com Saldo Inicial, Final e por Dia", 105, yPos, { align: "center" });
      yPos += 10;

      // Período
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = `Período: ${new Date(data.summary.startDate).toLocaleDateString('pt-BR')} a ${new Date(data.summary.endDate).toLocaleDateString('pt-BR')}`;
      doc.text(periodText, 105, yPos, { align: "center" });
      yPos += 10;

      // Resumo Geral
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Geral", margin, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Saldo Inicial: ${data.summary.initialBalance.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Entradas: ${data.summary.totalEntries.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.text(`Total de Saídas: ${data.summary.totalExits.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`Saldo Final: ${data.summary.finalBalance.toFixed(2)} unidades`, margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.text(`Saldo Líquido (Entradas - Saídas): ${data.summary.netBalance.toFixed(2)} unidades`, margin, yPos);
      yPos += 10;

      // Saldo por Dia
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Saldo por Dia", margin, yPos);
      yPos += 8;

      data.dailyBalances.forEach((day: any) => {
        checkPageBreak(20);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`Data: ${new Date(day.date).toLocaleDateString('pt-BR')}`, margin, yPos);
        yPos += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Saldo Inicial: ${day.initialBalance.toFixed(2)}`, margin + 5, yPos);
        yPos += 5;
        doc.text(`Entradas: ${day.entries.toFixed(2)}`, margin + 5, yPos);
        yPos += 5;
        doc.text(`Saídas: ${day.exits.toFixed(2)}`, margin + 5, yPos);
        yPos += 5;
        doc.setFont("helvetica", "bold");
        doc.text(`Saldo Final: ${day.finalBalance.toFixed(2)}`, margin + 5, yPos);
        yPos += 8;
      });

      yPos += 5;

      // Detalhamento das Movimentações
      checkPageBreak(30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento das Movimentações", margin, yPos);
      yPos += 8;

      // Agrupar movimentações por data
      const movementsByDate: { [key: string]: any[] } = {};
      data.movements.forEach((movement: any) => {
        if (!movementsByDate[movement.date]) {
          movementsByDate[movement.date] = [];
        }
        movementsByDate[movement.date].push(movement);
      });

      Object.keys(movementsByDate).sort().forEach(date => {
        checkPageBreak(25);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`Data: ${new Date(date).toLocaleDateString('pt-BR')}`, margin, yPos);
        yPos += 6;

        movementsByDate[date].forEach((movement: any) => {
          checkPageBreak(15);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const typeText = movement.type === 'entrada' ? 'Entrada' : 'Saída';
          if (movement.type === 'entrada') {
            doc.setTextColor(0, 128, 0);
          } else {
            doc.setTextColor(255, 0, 0);
          }
          
          const productText = `${movement.product_name} (${movement.quantity.toFixed(2)} ${movement.unit || 'un'})`;
          doc.text(`${typeText}: ${productText}`, margin + 5, yPos);
          yPos += 5;
          
          if (movement.notes) {
            doc.setFontSize(8);
            doc.text(`  Obs: ${movement.notes}`, margin + 10, yPos);
            yPos += 4;
          }
          
          doc.setTextColor(0, 0, 0);
          yPos += 3;
        });
        
        yPos += 5;
      });

      // Adicionar logo no rodapé da última página
      if (logoData) {
        const logoWidth = 30;
        const logoHeight = 22;
        doc.addImage(logoData, 'PNG', margin, pageHeight - 15, logoWidth, logoHeight);
      }

      // Salvar PDF
      const fileName = `relatorio_movimentacoes_diarias_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Salvar nos relatórios recentes
      saveRecentReport("stock-movements-daily", "Movimentações de Estoque com Saldo Diário", effectiveStartDate, effectiveEndDate, fileName);

      toast({
        title: "Relatório gerado!",
        description: `Relatório de movimentações diárias salvo como ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!filters.reportType) {
      toast({
        title: "Tipo de relatório não selecionado",
        description: "Selecione um tipo de relatório antes de gerar.",
        variant: "destructive",
      });
      return;
    }

    // Para relatório de estoque, não precisa de período
    if (filters.reportType !== "inventory" && (!filters.startDate || !filters.endDate)) {
      toast({
        title: "Período não informado",
        description: "Informe a data inicial e final para gerar o relatório.",
        variant: "destructive",
      });
      return;
    }

    if (filters.reportType === "sales") {
      await generateSalesReportPDF();
    } else if (filters.reportType === "sales-paid") {
      await generateSalesPaidReportPDF();
    } else if (filters.reportType === "inventory") {
      await generateInventoryReportPDF();
    } else if (filters.reportType === "financial") {
      await generateFinancialReportPDF();
    } else if (filters.reportType === "consignment") {
      await generateConsignmentReportPDF();
    } else if (filters.reportType === "stock-movements-by-product") {
      await generateStockMovementsByProductReportPDF();
    } else if (filters.reportType === "stock-movements-by-type") {
      await generateStockMovementsByTypeReportPDF();
    } else if (filters.reportType === "stock-movements-daily") {
      await generateStockMovementsDailyReportPDF();
    } else {
      toast({
        title: "Relatório em desenvolvimento",
        description: "Este tipo de relatório ainda não está disponível.",
        variant: "default",
      });
    }
  };

  const reportTypes = [
    { value: "sales", label: "Relatório de Vendas" },
    { value: "sales-paid", label: "Vendas Concretizadas" },
    { value: "inventory", label: "Relatório de produtos em estoque" },
    { value: "financial", label: "Relatório Financeiro" },
    { value: "consignment", label: "Relatório de Consignação" },
    { value: "stock-movements-by-product", label: "Movimentações de Estoque por Produto" },
    { value: "stock-movements-by-type", label: "Movimentações de Estoque por Tipo" },
    { value: "stock-movements-daily", label: "Movimentações de Estoque com Saldo Diário" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Gere relatórios detalhados do seu negócio</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gerar Relatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reportType">Tipo de Relatório</Label>
              <Select 
                value={filters.reportType} 
                onValueChange={(value) => setFilters({ ...filters, reportType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>

            <Button onClick={handleGenerate} className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relatórios Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum relatório gerado ainda</p>
                <p className="text-xs mt-1">Os relatórios gerados aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{getReportDisplayName(report)}</p>
                      <p className="text-xs text-muted-foreground">
                        Gerado em {new Date(report.generatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} • PDF
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => regenerateReport(report)}
                      title="Regenerar relatório"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendas no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSales ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  R$ {salesPeriod?.total?.toFixed(2) || "0,00"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filters.startDate && filters.endDate
                    ? `${new Date(filters.startDate).toLocaleDateString('pt-BR')} a ${new Date(filters.endDate).toLocaleDateString('pt-BR')}`
                    : "Últimos 30 dias"}
                  {salesPeriod?.count && ` • ${salesPeriod.count} venda(s)`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produtos Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingProducts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {productsSold?.total?.toFixed(2) || "0,00"} un
                </div>
                <p className="text-xs text-muted-foreground">
                  {filters.startDate && filters.endDate
                    ? `${new Date(filters.startDate).toLocaleDateString('pt-BR')} a ${new Date(filters.endDate).toLocaleDateString('pt-BR')}`
                    : "Últimos 30 dias"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTicket ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  R$ {averageTicket?.average?.toFixed(2) || "0,00"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filters.startDate && filters.endDate
                    ? `${new Date(filters.startDate).toLocaleDateString('pt-BR')} a ${new Date(filters.endDate).toLocaleDateString('pt-BR')}`
                    : "Por transação"}
                  {averageTicket?.count && ` • ${averageTicket.count} venda(s)`}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
