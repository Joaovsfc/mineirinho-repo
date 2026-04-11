import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/services/api";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

const ConnectionStatus = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["healthCheck"],
    queryFn: () => apiService.healthCheck(),
    retry: 1,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando conexão...
      </span>
    );
  }

  if (isError || !data) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive font-medium">
        <WifiOff className="h-3 w-3" />
        Servidor offline
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500 font-medium">
      <Wifi className="h-3 w-3" />
      Conectado
    </span>
  );
};

export default ConnectionStatus;
