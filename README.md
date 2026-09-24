# Zevo Tech

Sistema interno de gestão desenvolvido para a **Zevo Tech**, focado em organização de pagamentos, ordens de serviço, contratos e cadastro de clientes. Aplicação **single-tenant**, construída para uso exclusivo da empresa.

## Sobre o projeto

O sistema centraliza o controle financeiro e operacional da empresa em um único painel, eliminando planilhas soltas e processos manuais. Ele gerencia desde o cadastro de clientes e endereços até contratos de mensalidade recorrente, pagamentos, agendamento de visitas e controle de equipamentos.

## Funcionalidades

- **Gestão de clientes** — cadastro completo com endereços vinculados
- **Contratos** — controle de mensalidades recorrentes por cliente
- **Pagamentos mensais** — geração e acompanhamento automático de cobranças, com detecção de atraso
- **Ordens de serviço** — abertura, acompanhamento e histórico
- **Agenda de visitas** — organização de compromissos e visitas técnicas
- **Equipamentos** — cadastro de tipos de equipamento e controle de quantidade em estoque
- **Dashboard** — visão consolidada de indicadores financeiros e operacionais
- **Relatórios** — extração de dados para análise
- **Alertas** — notificações automáticas (ex: pagamentos em atraso)
- **Autenticação** — controle de acesso via JWT

## Backup automático

O sistema conta com rotina própria de backup do banco de dados, executada diariamente via `pg_dump`, com:

- Retenção configurável (backups diários, semanais e mensais)
- Cópia secundária automática em pasta sincronizada na nuvem, como camada extra de segurança contra falha de disco

## Stack técnica

**Backend**
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT para autenticação

**Frontend**
- React
- Vite

## Estrutura do projeto

```
zevo-v2/
├── backend/
│   ├── prisma/          # Schema, migrations e seed do banco
│   ├── src/
│   │   └── controllers/ # Lógica de negócio por domínio (clientes, contratos, pagamentos, etc.)
│   ├── scripts/         # Scripts utilitários (backup, verificação de sintaxe)
│   └── .env.example     # Referência de variáveis de ambiente necessárias
└── frontend/
    └── ...              # Aplicação React
```

## Roadmap

- [ ] Deploy em produção (backend + banco)
- [ ] Ajustes finais de UX no painel

## Autor

Desenvolvido por **Matheus Borges**
[GitHub](https://github.com/matheussoldiermonster-afk) · [LinkedIn](https://linkedin.com/in/matheus-borges-a27b26225)
