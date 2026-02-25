import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Truck,
  CreditCard,
  Receipt,
  FileText,
  UserCog,
  Database,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLogoPath } from "@/lib/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { open } = useSidebar();
  const { user } = useAuth();
  
  const menuItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Produtos", url: "/products", icon: Package },
    { title: "Clientes", url: "/clients", icon: Users },
    { title: "Vendas", url: "/sales", icon: ShoppingCart },
    { title: "Consignação", url: "/consignment", icon: Truck },
    { title: "Contas a Pagar", url: "/accounts-payable", icon: CreditCard },
    { title: "Contas a Receber", url: "/accounts-receivable", icon: Receipt },
    { title: "Relatórios", url: "/reports", icon: FileText },
    { title: "Usuários", url: "/users", icon: UserCog },
    // Mostrar Backup apenas para administradores
    ...(user?.is_admin ? [{ title: "Backup", url: "/backup", icon: Database }] : []),
    { title: "Suporte", url: "/support", icon: HelpCircle },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center justify-center">
          {open ? (
            <img 
              src={getLogoPath()} 
              alt="Mineirinho de Ouro" 
              className="h-48 w-auto object-contain"
            />
          ) : (
            <img 
              src={getLogoPath()} 
              alt="Mineirinho de Ouro" 
              className="h-8 w-8 object-contain"
            />
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
