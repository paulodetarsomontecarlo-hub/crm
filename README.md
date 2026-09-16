# m4t CRM

CRM básico para gestão de contatos, negócios (pipeline) e tarefas.

100% front-end, sem backend: os dados ficam salvos no `localStorage` do
navegador onde o app é aberto. Não há sincronização entre dispositivos — use
o botão **Exportar** para gerar um backup em JSON e **Importar** para
restaurá-lo (em outro navegador/computador, por exemplo).

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

## Como rodar

Não há build nem dependências. Duas opções:

- Abra `index.html` diretamente no navegador.
- Ou sirva a pasta com qualquer servidor estático, por exemplo:

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
  horizontalmente sozinho se você arrastar perto da borda).
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
  formulário.
- `style.css` — estilos.
- `app.js` — login, estado da aplicação (`localStorage`), renderização,
  regras de cada tela (CRUD de contatos/negócios/tarefas/estágios, filtros,
  drag-and-drop do Kanban) e importação/exportação (backup em JSON, CSV de
  contatos/negócios).

## Limitações conhecidas

- Dados por navegador/dispositivo (o login é só uma trava de acesso local —
  ver seção **Login** — não uma conta de verdade com dados na nuvem).
- Importação de negócios sempre cria registros novos (não tenta atualizar um
  negócio existente); só a importação de contatos faz dedupe, por e-mail.
- Drag-and-drop usa a API nativa do HTML5, que tem suporte limitado em
  navegadores mobile — nesses casos, edite o negócio para trocar o estágio.
- O Dashboard considera negócio "em aberto" quando o estágio não é o padrão
  `ganho` nem `perdido`. Se você excluir/renomear esses dois estágios padrão
  na aba Funil e criar outros com o mesmo sentido, o Dashboard não vai saber
  que eles são "estágios finais" — só afeta o card de resumo, não os dados.
