# CRM Simples

CRM básico para gestão de contatos, negócios (pipeline) e tarefas.

100% front-end, sem backend: os dados ficam salvos no `localStorage` do
navegador onde o app é aberto. Não há sincronização entre dispositivos — use
o botão **Exportar** para gerar um backup em JSON e **Importar** para
restaurá-lo (em outro navegador/computador, por exemplo).

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
- **Negócios** — quadro Kanban por estágio (Lead → Proposta → Negociação →
  Ganho/Perdido), com valor e contato vinculado. O estágio é trocado
  arrastando o card para outra coluna.
- **Tarefas** — lista com data de vencimento, vínculo opcional a um contato
  e/ou negócio, marcação de concluída e destaque para tarefas atrasadas.

## Importação em massa (CSV)

Tanto em **Contatos** quanto em **Negócios** há um botão **Baixar modelo
CSV** (gera o arquivo com o cabeçalho e uma linha de exemplo) e um botão
**Importar CSV** para subir a planilha preenchida.

- **Contatos**: colunas `nome, empresa, email, telefone, notas`. Só `nome`
  é obrigatório. Um contato com o mesmo `email` de um já cadastrado é
  **atualizado** em vez de duplicado; sem e-mail, sempre entra como novo.
- **Negócios**: colunas `titulo, valor, estagio, contato_nome,
  contato_email`. Só `titulo` é obrigatório. `estagio` aceita o nome
  (Lead/Proposta/Negociação/Ganho/Perdido, sem diferenciar acento/maiúsculas)
  ou o id interno (`lead`, `proposta`, ...); valor não reconhecido cai em
  Lead. `valor` aceita tanto `1500.00` quanto o formato BR `1.500,00`. O
  contato é resolvido primeiro por `contato_email`, depois por
  `contato_nome` (comparação exata); se nenhum bater, o negócio é importado
  sem contato vinculado.
- O parser aceita `,` ou `;` como separador (detectado automaticamente pelo
  cabeçalho) e campos entre aspas, então funciona tanto com CSV exportado
  por planilhas em PT-BR quanto no formato "internacional" do modelo.

## Estrutura

- `index.html` — estrutura das telas e do modal de formulário.
- `style.css` — estilos.
- `app.js` — estado da aplicação (`localStorage`), renderização, regras de
  cada tela (CRUD de contatos/negócios/tarefas, filtros, drag-and-drop do
  Kanban) e importação/exportação (backup em JSON, CSV de contatos/negócios).

## Limitações conhecidas

- Dados por navegador/dispositivo (sem login, sem servidor).
- Importação de negócios sempre cria registros novos (não tenta atualizar um
  negócio existente); só a importação de contatos faz dedupe, por e-mail.
- Drag-and-drop usa a API nativa do HTML5, que tem suporte limitado em
  navegadores mobile — nesses casos, edite o negócio para trocar o estágio.
