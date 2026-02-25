import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, User, Code } from "lucide-react";

const Support = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Suporte</h1>
        <p className="text-muted-foreground">Entre em contato com o desenvolvedor para suporte técnico</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Informações do Desenvolvedor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Desenvolvedor
            </CardTitle>
            <CardDescription>
              Informações de contato do desenvolvedor do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">João Vitorino</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <a 
                    href="tel:+5544997211139" 
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    44 99721-1139
                  </a>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a 
                    href="mailto:j.vitorino2008@gmail.com" 
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline break-all"
                  >
                    j.vitorino2008@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Informações do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Sobre o Sistema
            </CardTitle>
            <CardDescription>
              Informações sobre o Mineirinho de Ouro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                O <strong>Mineirinho de Ouro</strong> é um sistema completo de gestão desenvolvido para 
                gerenciar produtos, clientes, vendas, consignações, contas a pagar e receber, 
                além de relatórios detalhados e backup de dados.
              </p>
              <p className="text-sm text-muted-foreground">
                Para suporte técnico, dúvidas ou solicitações de funcionalidades, 
                entre em contato através dos canais acima.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Ajuda */}
      <Card>
        <CardHeader>
          <CardTitle>Precisa de Ajuda?</CardTitle>
          <CardDescription>
            Como podemos ajudá-lo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">Suporte Técnico</h3>
              <p className="text-sm text-muted-foreground">
                Problemas técnicos, bugs ou erros no sistema? Entre em contato para receber suporte.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Nova Funcionalidade</h3>
              <p className="text-sm text-muted-foreground">
                Tem uma ideia de funcionalidade? Sugestões são sempre bem-vindas!
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Dúvidas</h3>
              <p className="text-sm text-muted-foreground">
                Precisa de ajuda para usar alguma funcionalidade? Estamos aqui para ajudar.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Treinamento</h3>
              <p className="text-sm text-muted-foreground">
                Precisa de treinamento para sua equipe? Entre em contato para mais informações.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Support;

