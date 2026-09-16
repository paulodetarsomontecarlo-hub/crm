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
  Ganho/Perdido), com valor e contato vinculado. O estágio é trocado direto
  no card, pelo seletor.
- **Tarefas** — lista com data de vencimento, vínculo opcional a um contato
  e/ou negócio, marcação de concluída e destaque para tarefas atrasadas.

## Estrutura

- `index.html` — estrutura das telas e do modal de formulário.
- `style.css` — estilos.
- `app.js` — estado da aplicação (`localStorage`), renderização e regras de
  cada tela (CRUD de contatos/negócios/tarefas, filtros, export/import).

## Limitações conhecidas

- Dados por navegador/dispositivo (sem login, sem servidor).
- Sem validação de duplicidade de contatos/e-mails.
- Kanban não tem arrastar-e-soltar; a troca de estágio é feita pelo seletor
  no próprio card, para manter a implementação simples e sem dependências.
