const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiError {
  error: string;
  message?: string;
}

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handleUnauthorized() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/login';
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...options?.headers,
        },
      });

      if (response.status === 401) {
        // Don't redirect on login/register failures
        const isAuthRoute = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
        if (!isAuthRoute) {
          handleUnauthorized();
          throw new Error('Sessão expirada. Faça login novamente.');
        }
      }

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: response.statusText,
        }));
        throw new Error(errorData.error || `API Error: ${response.statusText}`);
      }

      // Se a resposta estiver vazia, retornar objeto vazio
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }

      return {} as T;
    } catch (error) {
      // Tratamento específico para erros de rede (servidor não disponível)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Servidor não está disponível. Verifique se o aplicativo foi iniciado corretamente.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido na requisição');
    }
  }

  // ==================== Products ====================
  async getProducts() {
    return this.request<any[]>('/products');
  }

  async getProduct(id: number) {
    return this.request<any>(`/products/${id}`);
  }

  async createProduct(data: {
    name: string;
    price?: number;
    price_tier_1?: number;
    price_tier_2?: number;
    price_tier_3?: number;
    price_tier_4?: number;
    stock: number;
    unit?: string
  }) {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: number, data: {
    name?: string;
    price?: number;
    price_tier_1?: number;
    price_tier_2?: number;
    price_tier_3?: number;
    price_tier_4?: number;
    stock?: number;
    unit?: string
  }) {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: number) {
    return this.request<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getProductMovements(id: number) {
    return this.request<any[]>(`/products/${id}/movements`);
  }

  async addProductStock(id: number, quantity: number, type: 'entrada' | 'saida' = 'entrada', notes?: string) {
    return this.request<any>(`/products/${id}/add-stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, type, notes }),
    });
  }

  // ==================== Clients ====================
  async getClients() {
    return this.request<any[]>('/clients');
  }

  async getClient(id: number) {
    return this.request<any>(`/clients/${id}`);
  }

  async createClient(data: {
    name: string;
    email?: string;
    address?: string;
    cnpj_cpf?: string;
    state_registration?: string;
    buyer_name?: string;
    price_tier?: number; // 1-4
    phones?: Array<{ phone: string; phone_type: string }>;
  }) {
    return this.request<any>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: number, data: {
    name?: string;
    email?: string;
    address?: string;
    cnpj_cpf?: string;
    state_registration?: string;
    buyer_name?: string;
    price_tier?: number; // 1-4
    phones?: Array<{ phone: string; phone_type: string }>;
  }) {
    return this.request<any>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: number) {
    return this.request<{ success: boolean }>(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== Sales ====================
  async getSales() {
    return this.request<any[]>('/sales');
  }

  async getSale(id: number) {
    return this.request<any>(`/sales/${id}`);
  }

  async createSale(data: { client_id?: number; total: number; items: Array<{ product_id: number; quantity: number; price: number }>; due_date?: string | null; notes?: string | null; user_id?: number | null }) {
    return this.request<any>('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSale(id: number, data: { status?: string; total?: number; payment_method?: string }) {
    return this.request<any>(`/sales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSale(id: number) {
    return this.request<{ success: boolean }>(`/sales/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== Consignments ====================
  async getConsignments() {
    return this.request<any[]>('/consignments');
  }

  async getConsignment(id: number) {
    return this.request<any>(`/consignments/${id}`);
  }

  async createConsignment(data: {
    client_id: number;
    items: Array<{ product_id: number; quantity: number; price?: number }>;
    status?: string;
    notes?: string;
    user_id?: number | null;
  }) {
    return this.request<any>('/consignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateConsignment(id: number, data: { quantity?: number; status?: string }) {
    return this.request<any>(`/consignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async closeConsignment(id: number, data: {
    items: Array<{ product_id: number; quantity_sold: number; price: number; subtotal: number }>;
    total: number;
    due_date?: string;
    date?: string;
    notes?: string | null;
  }) {
    return this.request<any>(`/consignments/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteConsignment(id: number) {
    return this.request<{ success: boolean }>(`/consignments/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== Accounts Payable ====================
  async getAccountsPayable() {
    return this.request<any[]>('/accounts/payable');
  }

  async getAccountPayable(id: number) {
    return this.request<any>(`/accounts/payable/${id}`);
  }

  async createAccountPayable(data: { description: string; value: number; due_date: string }) {
    return this.request<any>('/accounts/payable', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountPayable(id: number, data: { description?: string; value?: number; due_date?: string; status?: string; paid_date?: string; payment_method?: string }) {
    return this.request<any>(`/accounts/payable/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccountPayable(id: number) {
    return this.request<{ success: boolean }>(`/accounts/payable/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== Accounts Receivable ====================
  async getAccountsReceivable() {
    return this.request<any[]>('/accounts/receivable');
  }

  async getAccountReceivable(id: number) {
    return this.request<any>(`/accounts/receivable/${id}`);
  }

  async createAccountReceivable(data: { client_id?: number; description?: string; value: number; due_date: string }) {
    return this.request<any>('/accounts/receivable', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountReceivable(id: number, data: { description?: string; value?: number; due_date?: string; status?: string; received_date?: string; payment_method?: string }) {
    return this.request<any>(`/accounts/receivable/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccountReceivable(id: number) {
    return this.request<{ success: boolean }>(`/accounts/receivable/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== Reports ====================
  async getDashboardStats() {
    return this.request<any>('/reports/dashboard-stats');
  }

  async getSalesPeriod(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/sales-period?${params.toString()}`);
  }

  async getProductsSold(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/products-sold?${params.toString()}`);
  }

  async getAverageTicket(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/average-ticket?${params.toString()}`);
  }

  async getSalesReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/sales?${params.toString()}`);
  }

  async getSalesPaidReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/sales-paid?${params.toString()}`);
  }

  async getInventoryReport() {
    return this.request<any>('/reports/inventory');
  }

  async getFinancialReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/financial?${params.toString()}`);
  }

  async getConsignmentReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/consignment?${params.toString()}`);
  }

  async getStockMovementsByProductReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/stock-movements-by-product?${params.toString()}`);
  }

  async getStockMovementsByTypeReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/reports/stock-movements-by-type?${params.toString()}`);
  }

  async getStockMovementsDailyReport(startDate: string, endDate: string) {
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    return this.request<any>(`/reports/stock-movements-daily?${params.toString()}`);
  }

  // ==================== Health Check ====================
  async healthCheck() {
    return this.request<{ status: string; database: string; timestamp?: string }>('/health');
  }

  // ==================== Authentication ====================
  async login(username: string, password: string) {
    return this.request<{ success: boolean; user: any; token: string; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async register(username: string, password: string, email?: string, is_admin?: boolean) {
    return this.request<{ success: boolean; user: any; token: string; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, is_admin }),
    });
  }

  async checkFirstUser() {
    return this.request<{ hasUsers: boolean }>('/auth/check-first-user');
  }

  async getUsers() {
    return this.request<any[]>('/auth/users');
  }

  async toggleUserActive(id: number) {
    return this.request<{ success: boolean; message: string; active: boolean }>(`/auth/users/${id}/toggle-active`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async adminResetPassword(targetUserId: number, newPassword: string) {
    return this.request<{ success: boolean; message: string }>('/auth/admin/reset-password', {
      method: 'PUT',
      body: JSON.stringify({ targetUserId, newPassword }),
    });
  }

  // Métodos de banco de dados (export/import)
  async exportDatabase(): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/database/export`, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Erro ao exportar banco de dados');
    }

    return await response.blob();
  }

  async importDatabase(file: File): Promise<{ success: boolean; message: string; backupPath?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/database/import`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Erro ao importar banco de dados');
    }

    return await response.json();
  }

  async getDatabaseInfo() {
    return this.request<{
      path: string;
      size: number;
      sizeFormatted: string;
      tables: string[];
      tableCounts: Record<string, number>;
      lastModified: string;
    }>('/database/info');
  }
}

export const apiService = new ApiService();
