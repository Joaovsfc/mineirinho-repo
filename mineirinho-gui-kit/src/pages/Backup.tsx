import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Database, Loader2, AlertTriangle, CheckCircle2, ShieldX, Usb, Save, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Backup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Verificar se o usuário é admin
  if (!user || !user.is_admin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground">Apenas administradores podem acessar esta página</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <ShieldX className="h-4 w-4" />
              <AlertTitle>Acesso Restrito</AlertTitle>
              <AlertDescription>
                Você não tem permissão para acessar esta página. Apenas administradores podem fazer backup e restaurar o banco de dados.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => navigate('/')}>
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Estado do formulário de backup automático
  const [usbPath, setUsbPath] = useState('');
  const [usbEnabled, setUsbEnabled] = useState(false);
  const [usbIntervalHours, setUsbIntervalHours] = useState('24');
  const [isSavingUsbSettings, setIsSavingUsbSettings] = useState(false);
  const [isTriggeringUsbBackup, setIsTriggeringUsbBackup] = useState(false);
  const [usbSettingsLoaded, setUsbSettingsLoaded] = useState(false);

  // Buscar informações do banco de dados
  const { data: dbInfo, isLoading: isLoadingInfo, refetch: refetchInfo } = useQuery({
    queryKey: ['databaseInfo'],
    queryFn: () => apiService.getDatabaseInfo(),
    enabled: !!user && user.is_admin,
  });

  // Buscar configurações de backup USB
  const { data: usbSettings, isLoading: isLoadingUsbSettings, refetch: refetchUsbSettings } = useQuery({
    queryKey: ['backupSettings'],
    queryFn: async () => {
      const data = await apiService.getBackupSettings();
      if (!usbSettingsLoaded) {
        setUsbPath(data.usb_path || '');
        setUsbEnabled(data.enabled || false);
        setUsbIntervalHours(String(data.interval_hours || 24));
        setUsbSettingsLoaded(true);
      }
      return data;
    },
    enabled: !!user && user.is_admin,
    refetchInterval: 60000, // atualiza status a cada 1min
  });

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const blob = await apiService.exportDatabase();
      
      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mineirinho-backup-${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Backup exportado!",
        description: "O banco de dados foi exportado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message || "Não foi possível exportar o banco de dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "Arquivo não selecionado",
        description: "Selecione um arquivo de backup para importar.",
        variant: "destructive",
      });
      return;
    }

    // Validar extensão do arquivo
    if (!selectedFile.name.endsWith('.db')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo .db válido.",
        variant: "destructive",
      });
      return;
    }

    // Confirmar importação
    const confirmed = window.confirm(
      "⚠️ ATENÇÃO: Esta operação irá substituir o banco de dados atual!\n\n" +
      "Um backup automático será criado antes da importação.\n\n" +
      "Deseja continuar?"
    );

    if (!confirmed) {
      return;
    }

    if (!user) return;
    setIsImporting(true);
    try {
      const result = await apiService.importDatabase(selectedFile);
      
      toast({
        title: "Banco importado com sucesso!",
        description: result.message || "O banco de dados foi importado. Reinicie o aplicativo para aplicar as mudanças.",
      });
      
      setSelectedFile(null);
      
      // Resetar input de arquivo
      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // Atualizar informações do banco
      setTimeout(() => {
        refetchInfo();
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message || "Não foi possível importar o banco de dados.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSaveUsbSettings = async () => {
    setIsSavingUsbSettings(true);
    try {
      await apiService.saveBackupSettings({
        usb_path: usbPath,
        enabled: usbEnabled,
        interval_hours: Number(usbIntervalHours),
      });
      setUsbSettingsLoaded(false);
      await refetchUsbSettings();
      toast({
        title: "Configurações salvas!",
        description: usbEnabled
          ? `Backup automático ativado para: ${usbPath}`
          : "Backup automático desativado.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSavingUsbSettings(false);
    }
  };

  const handleTriggerUsbBackup = async () => {
    setIsTriggeringUsbBackup(true);
    try {
      const result = await apiService.triggerUsbBackup();
      setUsbSettingsLoaded(false);
      await refetchUsbSettings();
      toast({
        title: "Backup realizado!",
        description: `Arquivo salvo: ${result.file}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no backup",
        description: error.message || "Não foi possível realizar o backup no pendrive.",
        variant: "destructive",
      });
    } finally {
      setIsTriggeringUsbBackup(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Backup e Restauração</h1>
        <p className="text-muted-foreground">Exporte ou importe o banco de dados do sistema</p>
      </div>

      {/* Informações do Banco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Informações do Banco de Dados
          </CardTitle>
          <CardDescription>
            Detalhes sobre o banco de dados atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInfo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando informações...</span>
            </div>
          ) : dbInfo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Tamanho do Banco</Label>
                  <p className="text-lg font-semibold">{dbInfo.sizeFormatted}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Última Modificação</Label>
                  <p className="text-lg font-semibold">
                    {new Date(dbInfo.lastModified).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Número de Tabelas</Label>
                  <p className="text-lg font-semibold">{dbInfo.tables.length}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Caminho</Label>
                  <p className="text-sm font-mono text-muted-foreground break-all">
                    {dbInfo.path}
                  </p>
                </div>
              </div>

              {dbInfo.tables.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-sm font-medium mb-2 block">Registros por Tabela</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {dbInfo.tables.map((table) => (
                      <div key={table} className="text-sm">
                        <span className="text-muted-foreground">{table}:</span>{' '}
                        <span className="font-medium">{dbInfo.tableCounts[table] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Não foi possível carregar as informações do banco.</p>
          )}
        </CardContent>
      </Card>

      {/* Exportar Banco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Banco de Dados
          </CardTitle>
          <CardDescription>
            Faça um backup completo do banco de dados atual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Backup Completo</AlertTitle>
            <AlertDescription>
              O arquivo exportado contém todos os dados do sistema, incluindo produtos, clientes, vendas, 
              consignações, contas a pagar/receber e usuários.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleExport}
            disabled={isExporting || isLoadingInfo}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar Banco de Dados
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Importar Banco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Banco de Dados
          </CardTitle>
          <CardDescription>
            Restaure um backup anterior do banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção!</AlertTitle>
            <AlertDescription>
              Esta operação irá substituir completamente o banco de dados atual. 
              Um backup automático será criado antes da importação, mas é recomendado 
              fazer um backup manual antes de prosseguir.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="import-file">Selecionar Arquivo de Backup (.db)</Label>
            <Input
              id="import-file"
              type="file"
              accept=".db"
              onChange={handleFileChange}
              disabled={isImporting}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: <span className="font-medium">{selectedFile.name}</span> (
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={isImporting || !selectedFile || isLoadingInfo}
            className="w-full"
            size="lg"
            variant="destructive"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar Banco de Dados
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Backup Automático no Pendrive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Usb className="h-5 w-5" />
            Backup Automático no Pendrive
          </CardTitle>
          <CardDescription>
            Configure um pendrive ou pasta para receber backups automáticos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Status do último backup */}
          {usbSettings && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Último backup automático</p>
                {usbSettings.last_backup_at ? (
                  <p className="text-sm text-muted-foreground">
                    {new Date(usbSettings.last_backup_at).toLocaleString('pt-BR')}
                    {usbSettings.last_backup_file && (
                      <span className="ml-1 font-mono text-xs">— {usbSettings.last_backup_file}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum backup realizado ainda</p>
                )}
                {usbSettings.last_backup_status === 'error' && usbSettings.last_backup_error && (
                  <p className="text-xs text-destructive mt-0.5">{usbSettings.last_backup_error}</p>
                )}
              </div>
              {usbSettings.last_backup_status === 'success' && (
                <Badge variant="outline" className="text-green-600 border-green-600 shrink-0">OK</Badge>
              )}
              {usbSettings.last_backup_status === 'error' && (
                <Badge variant="destructive" className="shrink-0">Erro</Badge>
              )}
              {!usbSettings.last_backup_status && (
                <Badge variant="outline" className="shrink-0">—</Badge>
              )}
            </div>
          )}

          {/* Ativar/desativar */}
          <div className="flex items-center justify-between">
            <Label htmlFor="usb-enabled" className="text-base">Ativar backup automático</Label>
            <Switch
              id="usb-enabled"
              checked={usbEnabled}
              onCheckedChange={setUsbEnabled}
              disabled={isLoadingUsbSettings}
            />
          </div>

          {/* Caminho */}
          <div className="space-y-2">
            <Label htmlFor="usb-path">Caminho do pendrive ou pasta de destino</Label>
            <Input
              id="usb-path"
              placeholder="Ex: E:\ ou E:\backups ou D:\Mineirinho\backups"
              value={usbPath}
              onChange={e => setUsbPath(e.target.value)}
              disabled={isLoadingUsbSettings}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Informe a letra do pendrive (ex: <code className="bg-muted px-1 rounded">E:\</code>) ou qualquer pasta no computador.
              A pasta precisa existir quando o backup for executado.
            </p>
          </div>

          {/* Intervalo */}
          <div className="space-y-2">
            <Label>Frequência do backup automático</Label>
            <Select
              value={usbIntervalHours}
              onValueChange={setUsbIntervalHours}
              disabled={isLoadingUsbSettings}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">A cada 6 horas</SelectItem>
                <SelectItem value="12">A cada 12 horas</SelectItem>
                <SelectItem value="24">Diário (24 horas)</SelectItem>
                <SelectItem value="48">A cada 2 dias</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Os últimos 5 backups são mantidos. Os mais antigos são removidos automaticamente.
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleSaveUsbSettings}
              disabled={isSavingUsbSettings || isLoadingUsbSettings}
              className="flex-1 min-w-32"
            >
              {isSavingUsbSettings ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Salvar configurações</>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleTriggerUsbBackup}
              disabled={isTriggeringUsbBackup || isLoadingUsbSettings || !usbPath.trim()}
              className="flex-1 min-w-32"
            >
              {isTriggeringUsbBackup ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fazendo backup...</>
              ) : (
                <><Play className="mr-2 h-4 w-4" />Fazer backup agora</>
              )}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Instruções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Exportar:</strong> Clique em "Exportar Banco de Dados" para baixar um arquivo .db com todos os seus dados.</p>
          <p><strong>Importar:</strong> Selecione um arquivo .db de backup e clique em "Importar Banco de Dados". O sistema criará um backup automático antes de importar.</p>
          <p><strong>Reiniciar:</strong> Após importar, é necessário reiniciar o aplicativo para que as mudanças sejam aplicadas.</p>
          <p><strong>Segurança:</strong> Mantenha seus backups em local seguro. Os arquivos contêm todos os dados do sistema.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Backup;

