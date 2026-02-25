import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { apiService } from "@/services/api";
import { useMemo } from "react";

const Dashboard = () => {
  // Buscar dados
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiService.getProducts(),
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiService.getSales(),
  });

  const { data: accountsReceivable = [], isLoading: accountsReceivableLoading } = useQuery({
    queryKey: ['accountsReceivable'],
    queryFn: () => apiService.getAccountsReceivable(),
  });

  const { data: accountsPayable = [], isLoading: accountsPayableLoading } = useQuery({
    queryKey: ['accountsPayable'],
    queryFn: () => apiService.getAccountsPayable(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiService.getClients(),
  });

  const isLoading = productsLoading || salesLoading || accountsReceivableLoading || accountsPayableLoading;

  // Calcular estatísticas
  const stats = useMemo(() => {
    // Estoque Total
    const totalStock = products.reduce((sum: number, p: any) => sum + parseFloat(p.stock || 0), 0);

    // Vendas Hoje
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter((sale: any) => {
      const saleDate = sale.date ? new Date(sale.date).toISOString().split('T')[0] : null;
      return saleDate === today;
    });
    const todaySalesTotal = todaySales.reduce((sum: number, sale: any) => sum + parseFloat(sale.total || 0), 0);

    // Contas a Receber Pendentes
    const pendingReceivable = accountsReceivable.filter((acc: any) => acc.status === "Pendente" || !acc.status);
    const totalReceivable = pendingReceivable.reduce((sum: number, acc: any) => sum + parseFloat(acc.value || 0), 0);

    // Contas a Pagar Pendentes
    const pendingPayable = accountsPayable.filter((acc: any) => acc.status === "Pendente" || !acc.status);
    const totalPayable = pendingPayable.reduce((sum: number, acc: any) => sum + parseFloat(acc.value || 0), 0);

    return {
      totalStock,
      todaySalesTotal,
      todaySalesCount: todaySales.length,
      totalReceivable,
      receivableCount: pendingReceivable.length,
      totalPayable,
      payableCount: pendingPayable.length,
    };
  }, [products, sales, accountsReceivable, accountsPayable]);

  // Produtos com estoque baixo (menor que 100)
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p: any) => parseFloat(p.stock || 0) < 100)
      .sort((a: any, b: any) => parseFloat(a.stock || 0) - parseFloat(b.stock || 0))
      .slice(0, 5);
  }, [products]);

  // Últimas vendas
  const recentSales = useMemo(() => {
    return sales
      .sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [sales]);

  // Função auxiliar para obter nome do cliente
  const getClientName = (clientId: number | null) => {
    if (!clientId) return "Cliente não informado";
    const client = clients.find((c: any) => c.id === clientId);
    return client ? client.name : "Cliente não encontrado";
  };

  const statsCards = [
    {
      title: "Estoque Total",
      value: stats.totalStock.toFixed(2),
      subtitle: `${products.length} produtos`,
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "Vendas Hoje",
      value: `R$ ${stats.todaySalesTotal.toFixed(2)}`,
      subtitle: `${stats.todaySalesCount} venda(s)`,
      icon: ShoppingCart,
      color: "text-green-600",
    },
    {
      title: "Contas a Receber",
      value: `R$ ${stats.totalReceivable.toFixed(2)}`,
      subtitle: `${stats.receivableCount} pendente(s)`,
      icon: TrendingUp,
      color: "text-orange-600",
    },
    {
      title: "Contas a Pagar",
      value: `R$ ${stats.totalPayable.toFixed(2)}`,
      subtitle: `${stats.payableCount} pendente(s)`,
      icon: DollarSign,
      color: "text-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Carregando...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        ) : (
          statsCards.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos com Estoque Baixo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">Nenhum produto com estoque baixo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm">{product.name}</span>
                    <span className="text-sm font-medium text-warning">
                      {parseFloat(product.stock || 0).toFixed(2)} {product.unit || "un"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentSales.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">Nenhuma venda registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm">{getClientName(sale.client_id)}</span>
                    <span className="text-sm font-medium text-success">
                      R$ {parseFloat(sale.total || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
