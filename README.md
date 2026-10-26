# Espaço Óptico Luísa — E-commerce

Loja virtual da ótica Espaço Óptico Luísa (Suzano/SP), construída a partir da documentação técnica aprovada.

**Tecnologias:** Next.js 15 (App Router) + TypeScript · PostgreSQL + Prisma · Tailwind CSS 4 · Mercado Pago (Pix e cartão) · Vercel.

## O que já está pronto

**Loja (cliente)**
- Página inicial com banner editável, categorias, destaques, novidades e passos de compra.
- Catálogo com busca, filtros (marca, formato, material, público, preço, disponibilidade, promoção), ordenação e paginação.
- Página de produto: galeria com zoom, variações, guia de medidas, simulador de frete por CEP, "avise-me quando chegar", WhatsApp com o produto e dados estruturados para o Google.
- **Monte seu óculos**: tipo de lente → material/índice → tratamentos → resumo, com preço recalculado a cada passo.
- Carrinho com cupons e checkout em uma página: dados, entrega (Suzano e região, por faixa de CEP) ou **retirada grátis**, **receita** (digitar graus OD/OE, eixo, adição, DNP + foto/PDF, ou enviar depois), pagamento e revisão.
- **Pix** (QR Code + copia e cola + contador; a página atualiza sozinha) e **cartão** pelo Checkout Pro do Mercado Pago (o site nunca vê o cartão).
- Acompanhamento do pedido, envio de receita depois da compra, conta do cliente, exportação dos dados (JSON) e pedido de exclusão (LGPD).
- Páginas Sobre (com dados de negócio local para o Google), Fale conosco, páginas institucionais editáveis, preferências de cookies.

**Painel (`/admin`)**
- Login com bloqueio progressivo + **verificação em duas etapas obrigatória** (aplicativo autenticador) + códigos de recuperação.
- Perfis: Proprietário, Gerente, Atendente e Responsável óptico (matriz do capítulo 3.1), verificados no servidor em toda ação.
- Início com vendas do dia/semana/mês, ticket médio, pedidos por status, receitas a conferir, estoque baixo, mais vendidos.
- Pedidos: filtros, linha do tempo, mudança de status só por transições válidas (com e-mail ao cliente), observações internas, reembolso (só proprietário), impressão da ordem de serviço.
- **Fila de receitas**: imagem descriptografada só no servidor, zoom/rotação, valores digitados ao lado, alertas de valores incomuns, aprovar/pedir correção/recusar com motivo, registro de cada acesso.
- Produtos (formulário por tipo, promoção agendada, variações, fotos com texto alternativo, duplicar, lixeira, reajuste em massa com prévia), estoque (ajuste com motivo, histórico, nunca negativo), lentes e tratamentos, cupons, banners e páginas, frete por CEP, mensagens, clientes e solicitações LGPD (anonimização), relatórios com CSV, usuários da equipe e registro de atividades.

**Segurança e LGPD**
- Receitas, CPF e segredo do 2FA criptografados (AES-256-GCM). Arquivos de receita criptografados antes de salvar; metadados de localização removidos das fotos.
- Sessões no banco (token só no cookie, `HttpOnly`/`Secure`/`SameSite`), painel expira após 30 min sem uso.
- Política de Segurança de Conteúdo com *nonce*, HSTS, proteção contra incorporação, cabeçalhos da OWASP, páginas privadas sem cache.
- Limite de tentativas no banco (login, cupom, contato, checkout), validação de tipo real dos arquivos, aviso do Mercado Pago validado por assinatura + consulta direta ao gateway + idempotência, preços sempre recalculados no servidor, reserva de estoque atômica.
- Consentimentos registrados com versão do texto; rotina diária elimina receitas após o prazo de retenção.

## Rodando no seu computador

Pré-requisitos: **Node.js 20 ou mais novo** e um **PostgreSQL** (local, ou gratuito na nuvem: [Neon](https://neon.tech) ou [Supabase](https://supabase.com)).

```bash
npm install
cp .env.example .env          # preencha as variáveis (veja abaixo)
npx prisma migrate dev --name inicial
npm run db:seed               # categorias, lentes, frete, textos legais, produtos de exemplo e o proprietário
npm run dev                   # abre em http://localhost:3000
```

Gerar as chaves do `.env`:

```bash
openssl rand -base64 32   # ENCRYPTION_KEY  (guarde uma cópia segura: sem ela as receitas não podem ser lidas)
openssl rand -base64 48   # SESSION_SECRET
```

Com `PAYMENT_PROVIDER="mock"` os pagamentos são simulados: na página do pedido aparece o botão **"Simular pagamento aprovado"** (nunca aparece em produção).

Primeiro acesso ao painel: entre em `/admin` com `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`, leia o QR Code com o Google Authenticator (ou similar) e **guarde os códigos de recuperação**.

Testes: `npm test` · Verificação de tipos: `npm run typecheck`.

## Publicando na Vercel

1. Suba o código para um repositório **privado** no GitHub e importe no projeto `espaco-optico-luisa` da Vercel (já criado, região São Paulo).
2. Crie o banco (Neon/Supabase) e um **Vercel Blob** (Storage → Blob) para fotos e receitas.
3. Em *Settings → Environment Variables*, cadastre as variáveis do `.env.example` (produção com `PAYMENT_PROVIDER="mercadopago"`, `STORAGE_DRIVER="vercel-blob"`, `APP_URL` com o domínio final).
4. Comando de build: `prisma migrate deploy && npm run build`. Rode o seed uma vez apontando para o banco de produção.
5. No Mercado Pago (Suas integrações): copie o *Access Token* de produção e configure o webhook para `https://SEU-DOMINIO/api/webhooks/mercadopago` (evento **Pagamentos**); copie a *assinatura secreta* para `MP_WEBHOOK_SECRET`.
6. Domínio: adicione o `.com.br` em *Settings → Domains*; o certificado SSL é automático.
7. Defina `CRON_SECRET` para a rotina diária (`vercel.json`).

> O plano gratuito (Hobby) da Vercel costuma ser restrito a uso não comercial: confirme os termos atuais antes de abrir a loja ao público.

## Antes de lançar (pendências do capítulo 10)

- [ ] Endereço, horários, CNPJ e razão social em `src/lib/site.ts`
- [ ] Logo em formato vetorial e fotos reais dos produtos (as ilustrações em `public/produtos` são provisórias)
- [ ] Textos legais revisados por advogado (painel → Banners e páginas)
- [ ] Faixas de CEP conferidas nos Correios e valores de frete (painel → Frete)
- [ ] Regras de venda online de lentes de contato/óculos de grau validadas com o responsável técnico
- [ ] Parcelamento máximo, desconto no Pix e prazo de guarda da retirada
- [ ] Conta no Mercado Pago, Resend (e-mail) e domínio
- [ ] Perfil da Empresa no Google com o link do site

## Estrutura

```
prisma/            modelo de dados, dados iniciais e textos legais
src/app/(loja)/    páginas da loja
src/app/admin/     painel administrativo
src/app/api/       webhook, rotina diária, exportações e arquivos protegidos
src/lib/           regras de negócio, segurança, pagamentos, estoque, receitas
tests/             testes automatizados
```
