# m4t CRM

CRM básico para gestão de contatos, negócios (pipeline) e tarefas.

Front-end estático (sem servidor próprio), mas com dados de verdade num
banco Postgres gerenciado pelo [Supabase](https://supabase.com): contatos,
negócios, tarefas e estágios do funil ficam disponíveis em qualquer
navegador/dispositivo que fizer login, não só no aparelho onde foram
criados. Ver seção **Banco de dados (Supabase)** abaixo.

O botão **Exportar** continua existindo como backup manual em JSON (útil
antes de mudanças arriscadas ou para migrar de projeto Supabase);
**Importar** restaura um backup, **substituindo tudo que está no banco**.

## Login

Tela de login com dois usuários fixos, definidos em `app.js`:

| Usuário   | Senha    |
|-----------|----------|
| `matheus` | `m4t123` |
| `paulo`   | `123456` |

A sessão fica salva no `localStorage` até clicar em **Sair**. As senhas são
comparadas por hash (SHA-256), então não aparecem em texto puro no código —
mas isso **não é segurança de verdade**: é só uma trava de acesso para não
deixar o app aberto pra qualquer um. Como é 100% front-end (sem servidor),
qualquer pessoa com acesso ao `app.js` pode ver os hashes ou pular a
checagem de login direto pelo devtools do navegador. Não use essas
credenciais nem essa tela para proteger dados sensíveis de verdade.

## Banco de dados (Supabase)

O app carrega a biblioteca `@supabase/supabase-js` via CDN e se conecta
usando a URL/chave definidas em `config.js` (a "publishable key" é pública
por design — protegida pelas regras de Row Level Security do banco, não é
segredo). Antes de usar o app pela primeira vez:

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
   — cria as tabelas `contacts`, `deals`, `tasks`, `estagios`, os 5 estágios
   padrão e as políticas de RLS.
3. Em **Project Settings → API**, copie a **Publishable key** e a
   **Project URL** e cole em `config.js`.

Sem isso, a tela de login mostra "Carregando dados..." e depois um alerta
de erro de conexão — é o app avisando que ainda não achou o banco.

## Como rodar

Não há build. Sirva a pasta com qualquer servidor estático (não abra
`index.html` direto com duplo-clique: o `fetch` para o Supabase e o script
do CDN se comportam melhor servidos por http/https do que por `file://`):

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Telas

- **Dashboard** — total de contatos, negócios em aberto, valor em pipeline,
  tarefas pendentes, tarefas atrasadas e os negócios mais recentes.
- **Contatos** — cadastro (nome, empresa, e-mail, telefone, notas) com busca
  por nome/empresa.
- **Negócios** — quadro Kanban por estágio, com valor e contato vinculado. O
  estágio é trocado arrastando o card para outra coluna (o quadro rola
  horizontalmente sozinho se você arrastar perto da borda). O seletor
  **Filtrar por estágio** mostra só a coluna escolhida, útil quando o funil
  tem muitos estágios.
- **Tarefas** — lista com data de vencimento, vínculo opcional a um contato
  e/ou negócio, marcação de concluída e destaque para tarefas atrasadas.
- **Funil** — cadastro dos estágios usados no Kanban de Negócios: adicionar,
  renomear, reordenar (setas ▲▼) e excluir (só é permitido excluir um
  estágio sem negócios nele). Por padrão vem com Lead → Proposta →
  Negociação → Ganho → Perdido, mas isso é só o ponto de partida.

## Importação em massa (CSV)

Tanto em **Contatos** quanto em **Negócios** há um botão **Baixar modelo
CSV** (gera o arquivo com o cabeçalho e uma linha de exemplo) e um botão
**Importar CSV** para subir a planilha preenchida.

- **Contatos**: colunas `nome, empresa, email, telefone, notas`. Só `nome`
  é obrigatório. Um contato com o mesmo `email` de um já cadastrado é
  **atualizado** em vez de duplicado; sem e-mail, sempre entra como novo.
- **Negócios**: colunas `titulo, valor, estagio, contato_nome,
  contato_email`. Só `titulo` é obrigatório. `estagio` aceita o nome
  cadastrado na aba **Funil** (sem diferenciar acento/maiúsculas) ou o id
  interno; se não reconhecer, cai no primeiro estágio da lista. `valor`
  aceita tanto `1500.00` quanto o formato BR `1.500,00`. O contato é
  resolvido primeiro por `contato_email`, depois por `contato_nome`
  (comparação exata); se nenhum bater, o negócio é importado sem contato
  vinculado.
- O parser aceita `,` ou `;` como separador (detectado automaticamente pelo
  cabeçalho) e campos entre aspas, então funciona tanto com CSV exportado
  por planilhas em PT-BR quanto no formato "internacional" do modelo.

## Estrutura

- `index.html` — tela de login, estrutura das telas do app e do modal de
  formulário; carrega `@supabase/supabase-js` via CDN antes de `config.js`
  e `app.js`.
- `config.js` — URL e publishable key do projeto Supabase.
- `supabase/schema.sql` — tabelas, seed dos estágios padrão e políticas RLS.
- `style.css` — estilos.
- `app.js` — login, acesso ao Supabase (`carregarDados`, uma função
  `criar/atualizar/excluir` por entidade), renderização, regras de cada tela
  (CRUD de contatos/negócios/tarefas/estágios, filtros, drag-and-drop do
  Kanban) e importação/exportação (backup em JSON, CSV de
  contatos/negócios).

## Limitações conhecidas

- O login é só uma trava de acesso visual (ver seção **Login**) — quem tiver
  a URL do Supabase e a publishable key (visíveis em `config.js`, no
  navegador de qualquer um) acessa a API do banco direto, sem passar pela
  tela de login. A proteção de verdade dos dados é a política de RLS no
  banco, não essa tela.
- Importação de negócios sempre cria registros novos (não tenta atualizar um
  negócio existente); só a importação de contatos faz dedupe, por e-mail.
- Drag-and-drop usa a API nativa do HTML5, que tem suporte limitado em
  navegadores mobile — nesses casos, edite o negócio para trocar o estágio.
- O Dashboard considera negócio "em aberto" quando o estágio não é o padrão
  `ganho` nem `perdido`. Se você excluir/renomear esses dois estágios padrão
  na aba Funil e criar outros com o mesmo sentido, o Dashboard não vai saber
  que eles são "estágios finais" — só afeta o card de resumo, não os dados.
- Sem tratamento de concorrência: se dois usuários editarem o mesmo registro
  ao mesmo tempo, vale a última escrita (não há aviso de conflito).
