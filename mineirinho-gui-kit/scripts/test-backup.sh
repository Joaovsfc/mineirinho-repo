#!/bin/bash

# Script para testar backup/restauração em produção
# Uso: ./scripts/test-backup.sh

echo "🧪 Teste de Backup e Restauração"
echo "================================"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script a partir da raiz do projeto (mineirinho-gui-kit)"
    exit 1
fi

# Verificar sistema operacional
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    DB_PATH="$HOME/Library/Application Support/mineirinho-de-ouro/mineirinho.db"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    DB_PATH="$HOME/.config/mineirinho-de-ouro/mineirinho.db"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
    DB_PATH="$APPDATA/mineirinho-de-ouro/mineirinho.db"
else
    echo "❌ Sistema operacional não suportado: $OSTYPE"
    exit 1
fi

echo "📋 Informações do Sistema:"
echo "   OS: $OS"
echo "   Caminho do banco: $DB_PATH"
echo ""

# Função para verificar se o banco existe
check_db_exists() {
    if [ -f "$DB_PATH" ]; then
        SIZE=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
        echo "✅ Banco encontrado: $DB_PATH"
        echo "   Tamanho: $(numfmt --to=iec-i --suffix=B $SIZE 2>/dev/null || echo "$SIZE bytes")"
        return 0
    else
        echo "⚠️  Banco não encontrado: $DB_PATH"
        return 1
    fi
}

# Função para fazer backup manual
backup_db() {
    if [ -f "$DB_PATH" ]; then
        BACKUP_PATH="${DB_PATH}.manual-backup-$(date +%Y%m%d-%H%M%S)"
        cp "$DB_PATH" "$BACKUP_PATH"
        echo "✅ Backup manual criado: $BACKUP_PATH"
        return 0
    else
        echo "❌ Não foi possível criar backup: banco não encontrado"
        return 1
    fi
}

# Função para limpar banco
clean_db() {
    if [ -f "$DB_PATH" ]; then
        read -p "⚠️  Tem certeza que deseja apagar o banco? (sim/não): " CONFIRM
        if [ "$CONFIRM" = "sim" ] || [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "yes" ]; then
            rm -f "$DB_PATH"
            rm -f "${DB_PATH}-wal"
            rm -f "${DB_PATH}-shm"
            echo "✅ Banco removido"
            return 0
        else
            echo "❌ Operação cancelada"
            return 1
        fi
    else
        echo "⚠️  Banco não encontrado para remover"
        return 1
    fi
}

# Menu principal
echo "Escolha uma opção:"
echo "1. Verificar status do banco"
echo "2. Criar backup manual"
echo "3. Limpar banco (CUIDADO!)"
echo "4. Verificar arquivos WAL/SHM"
echo "5. Sair"
echo ""
read -p "Opção: " OPTION

case $OPTION in
    1)
        check_db_exists
        ;;
    2)
        backup_db
        ;;
    3)
        clean_db
        ;;
    4)
        echo "📁 Arquivos relacionados ao banco:"
        DIR=$(dirname "$DB_PATH")
        if [ -d "$DIR" ]; then
            ls -lh "$DIR"/mineirinho.db* 2>/dev/null || echo "   Nenhum arquivo encontrado"
        else
            echo "   Diretório não existe: $DIR"
        fi
        ;;
    5)
        echo "👋 Até logo!"
        exit 0
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

