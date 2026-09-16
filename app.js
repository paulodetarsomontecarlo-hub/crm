"use strict";

const SESSAO_KEY = "crm-simples:sessao";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Sem backend, isso é só uma trava de acesso, não segurança de verdade:
// qualquer pessoa com o arquivo app.js pode ler esses hashes ou pular a
// checagem direto no devtools. Não reutilize essas senhas em nada sensível.
const USUARIOS = [
  { usuario: "matheus", hash: "bacb308a6be320fac68d56e5fa1bc4c4a3458c8bb68d4a0855047079f712c79e" },
  { usuario: "paulo", hash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92" },
];

async function sha256Hex(texto) {
  const dados = new TextEncoder().encode(texto);
  const bufferHash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(bufferHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ESTAGIOS_PADRAO = [
  { id: "lead", label: "Lead" },
  { id: "proposta", label: "Proposta" },
  { id: "negociacao", label: "Negociação" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
];

function estagioLabel(id) {
  return (estado.estagios.find((e) => e.id === id) || {}).label || id;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatarMoeda(valorEmCentavos) {
  return (valorEmCentavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(isoDate) {
  if (!isoDate) return "";
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function estadoVazio() {
  return { contacts: [], deals: [], tasks: [], estagios: [] };
}

let estado = estadoVazio();

// ---------- mapeamento linha do banco <-> objeto usado pela UI ----------

function linhaParaContato(l) {
  return { id: l.id, nome: l.nome, empresa: l.empresa || "", email: l.email || "", telefone: l.telefone || "", notas: l.notas || "", criadoEm: l.criado_em };
}

function contatoParaLinha(c) {
  return {
    id: c.id,
    nome: c.nome,
    empresa: c.empresa || null,
    email: c.email || null,
    telefone: c.telefone || null,
    notas: c.notas || null,
    criado_em: c.criadoEm,
  };
}

function linhaParaDeal(l) {
  return { id: l.id, titulo: l.titulo, valor: l.valor, estagio: l.estagio_id, contatoId: l.contato_id, criadoEm: l.criado_em };
}

function dealParaLinha(d) {
  return { id: d.id, titulo: d.titulo, valor: d.valor, estagio_id: d.estagio, contato_id: d.contatoId || null, criado_em: d.criadoEm };
}

function linhaParaTarefa(l) {
  return { id: l.id, titulo: l.titulo, vencimento: l.vencimento, concluida: l.concluida, contatoId: l.contato_id, dealId: l.deal_id, criadoEm: l.criado_em };
}

function tarefaParaLinha(t) {
  return {
    id: t.id,
    titulo: t.titulo,
    vencimento: t.vencimento || null,
    concluida: t.concluida,
    contato_id: t.contatoId || null,
    deal_id: t.dealId || null,
    criado_em: t.criadoEm,
  };
}

function linhaParaEstagio(l) {
  return { id: l.id, label: l.label };
}

// ---------- carregamento e utilitários de acesso ao banco ----------

async function carregarDados() {
  const [estagiosRes, contatosRes, dealsRes, tarefasRes] = await Promise.all([
    db.from("estagios").select("*").order("ordem", { ascending: true }),
    db.from("contacts").select("*"),
    db.from("deals").select("*"),
    db.from("tasks").select("*"),
  ]);
  for (const resultado of [estagiosRes, contatosRes, dealsRes, tarefasRes]) {
    if (resultado.error) throw new Error(resultado.error.message);
  }
  return {
    estagios: estagiosRes.data.map(linhaParaEstagio),
    contacts: contatosRes.data.map(linhaParaContato),
    deals: dealsRes.data.map(linhaParaDeal),
    tasks: tarefasRes.data.map(linhaParaTarefa),
  };
}

async function comTratativaDeErro(operacaoAsync, mensagemErro) {
  try {
    await operacaoAsync();
    return true;
  } catch (erro) {
    console.error(erro);
    alert(`${mensagemErro || "Não foi possível salvar"}: ${erro.message}\n\nVerifique sua conexão e tente de novo.`);
    return false;
  }
}

function mesclarPorId(lista, atualizacoes) {
  const porId = new Map(lista.map((item) => [item.id, item]));
  atualizacoes.forEach((item) => porId.set(item.id, item));
  return Array.from(porId.values());
}

function contatoNome(id) {
  const contato = estado.contacts.find((c) => c.id === id);
  return contato ? contato.nome : "(sem contato)";
}

// ---------- navegação entre views ----------

function trocarView(viewId) {
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById(`view-${viewId}`).classList.add("active");
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
  renderizarView(viewId);
}

function renderizarView(viewId) {
  if (viewId === "dashboard") renderizarDashboard();
  if (viewId === "contatos") renderizarContatos();
  if (viewId === "negocios") renderizarNegocios();
  if (viewId === "tarefas") renderizarTarefas();
  if (viewId === "funil") renderizarFunil();
}

function renderizarTudo() {
  renderizarView(document.querySelector(".tab-btn.active").dataset.view);
}

// ---------- modal genérico ----------

const modalBackdrop = document.getElementById("modal-backdrop");
const modalContent = document.getElementById("modal-content");

function abrirModal(html, aoMontar) {
  modalContent.innerHTML = html;
  modalBackdrop.hidden = false;
  if (aoMontar) aoMontar(modalContent);
}

function fecharModal() {
  modalBackdrop.hidden = true;
  modalContent.innerHTML = "";
}

modalBackdrop.addEventListener("click", (evento) => {
  if (evento.target === modalBackdrop) fecharModal();
});

// ---------- dashboard ----------

function renderizarDashboard() {
  const negociosAbertos = estado.deals.filter((d) => d.estagio !== "ganho" && d.estagio !== "perdido");
  const valorPipeline = negociosAbertos.reduce((soma, d) => soma + d.valor, 0);
  const tarefasPendentes = estado.tasks.filter((t) => !t.concluida);
  const hoje = hojeISO();
  const tarefasAtrasadas = tarefasPendentes.filter((t) => t.vencimento && t.vencimento < hoje);

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${estado.contacts.length}</div>
      <div class="stat-label">Contatos</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${negociosAbertos.length}</div>
      <div class="stat-label">Negócios em aberto</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatarMoeda(valorPipeline)}</div>
      <div class="stat-label">Valor em pipeline</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${tarefasPendentes.length}</div>
      <div class="stat-label">Tarefas pendentes</div>
    </div>
  `;

  const listaAtrasadas = document.getElementById("overdue-tasks");
  listaAtrasadas.innerHTML = tarefasAtrasadas.length
    ? tarefasAtrasadas
        .map((t) => `<li><strong>${t.titulo}</strong> — venceu em ${formatarData(t.vencimento)}</li>`)
        .join("")
    : `<li>Nenhuma tarefa atrasada. 🎉</li>`;

  const recentes = [...estado.deals]
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 5);
  const listaRecentes = document.getElementById("recent-deals");
  listaRecentes.innerHTML = recentes.length
    ? recentes
        .map(
          (d) =>
            `<li><strong>${d.titulo}</strong> — ${contatoNome(d.contatoId)} · ${estagioLabel(d.estagio)} · ${formatarMoeda(d.valor)}</li>`
        )
        .join("")
    : `<li>Nenhum negócio cadastrado ainda.</li>`;
}

// ---------- contatos ----------

function renderizarContatos(filtro = "") {
  const termo = filtro.trim().toLowerCase();
  const lista = estado.contacts.filter(
    (c) => !termo || c.nome.toLowerCase().includes(termo) || (c.empresa || "").toLowerCase().includes(termo)
  );

  document.getElementById("contatos-vazio").hidden = estado.contacts.length > 0;
  document.getElementById("tabela-contatos").innerHTML = lista
    .map(
      (c) => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.empresa || "—"}</td>
        <td>${c.email || "—"}</td>
        <td>${c.telefone || "—"}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-small" data-editar-contato="${c.id}">Editar</button>
            <button class="btn btn-danger btn-small" data-excluir-contato="${c.id}">Excluir</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function formularioContato(contato) {
  const editando = Boolean(contato);
  contato = contato || { nome: "", empresa: "", email: "", telefone: "", notas: "" };

  abrirModal(
    `
    <h2>${editando ? "Editar contato" : "Novo contato"}</h2>
    <form id="form-contato">
      <div class="form-field">
        <label for="c-nome">Nome *</label>
        <input type="text" id="c-nome" required value="${contato.nome}" />
      </div>
      <div class="form-field">
        <label for="c-empresa">Empresa</label>
        <input type="text" id="c-empresa" value="${contato.empresa || ""}" />
      </div>
      <div class="form-field">
        <label for="c-email">E-mail</label>
        <input type="email" id="c-email" value="${contato.email || ""}" />
      </div>
      <div class="form-field">
        <label for="c-telefone">Telefone</label>
        <input type="tel" id="c-telefone" value="${contato.telefone || ""}" />
      </div>
      <div class="form-field">
        <label for="c-notas">Notas</label>
        <textarea id="c-notas" rows="3">${contato.notas || ""}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `,
    (raiz) => {
      raiz.querySelector("#btn-cancelar").addEventListener("click", fecharModal);
      raiz.querySelector("#form-contato").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const dados = {
          nome: raiz.querySelector("#c-nome").value.trim(),
          empresa: raiz.querySelector("#c-empresa").value.trim(),
          email: raiz.querySelector("#c-email").value.trim(),
          telefone: raiz.querySelector("#c-telefone").value.trim(),
          notas: raiz.querySelector("#c-notas").value.trim(),
        };
        if (!dados.nome) return;

        const ok = await comTratativaDeErro(async () => {
          if (editando) {
            const atualizado = { ...contato, ...dados };
            const { error } = await db.from("contacts").update(contatoParaLinha(atualizado)).eq("id", contato.id);
            if (error) throw error;
            Object.assign(contato, dados);
          } else {
            const novoContato = { id: uid(), criadoEm: new Date().toISOString(), ...dados };
            const { error } = await db.from("contacts").insert(contatoParaLinha(novoContato));
            if (error) throw error;
            estado.contacts.push(novoContato);
          }
        });
        if (!ok) return;

        fecharModal();
        renderizarContatos(document.getElementById("search-contatos").value);
        renderizarTudo();
      });
    }
  );
}

async function excluirContato(id) {
  const emUso = estado.deals.some((d) => d.contatoId === id) || estado.tasks.some((t) => t.contatoId === id);
  const mensagem = emUso
    ? "Este contato está vinculado a negócios e/ou tarefas, que perderão essa referência. Excluir mesmo assim?"
    : "Excluir este contato?";
  if (!confirm(mensagem)) return;

  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("contacts").delete().eq("id", id);
    if (error) throw error;
  }, "Não foi possível excluir o contato");
  if (!ok) return;

  estado.contacts = estado.contacts.filter((c) => c.id !== id);
  estado.deals.forEach((d) => {
    if (d.contatoId === id) d.contatoId = null;
  });
  estado.tasks.forEach((t) => {
    if (t.contatoId === id) t.contatoId = null;
  });
  renderizarContatos(document.getElementById("search-contatos").value);
  renderizarTudo();
}

// ---------- negócios (kanban) ----------

let filtroEstagioNegocios = "";

function renderizarNegocios() {
  const total = estado.deals
    .filter((d) => d.estagio !== "perdido")
    .reduce((soma, d) => soma + d.valor, 0);
  document.getElementById("pipeline-total").textContent = `Total (exceto perdidos): ${formatarMoeda(total)}`;

  if (filtroEstagioNegocios && !estado.estagios.some((e) => e.id === filtroEstagioNegocios)) {
    filtroEstagioNegocios = "";
  }
  document.getElementById("filtro-estagio-negocios").innerHTML =
    `<option value="">Todos os estágios</option>` +
    estado.estagios
      .map((e) => `<option value="${e.id}" ${e.id === filtroEstagioNegocios ? "selected" : ""}>${e.label}</option>`)
      .join("");

  const estagiosVisiveis = filtroEstagioNegocios
    ? estado.estagios.filter((e) => e.id === filtroEstagioNegocios)
    : estado.estagios;

  document.getElementById("kanban").innerHTML = estagiosVisiveis.map((estagio) => {
    const negocios = estado.deals.filter((d) => d.estagio === estagio.id);
    const subtotal = negocios.reduce((soma, d) => soma + d.valor, 0);
    return `
      <div class="kanban-column" data-estagio="${estagio.id}">
        <h3><span>${estagio.label} (${negocios.length})</span></h3>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;">${formatarMoeda(subtotal)}</div>
        ${negocios
          .map(
            (d) => `
          <div class="deal-card" draggable="true" data-negocio-id="${d.id}">
            <div class="deal-titulo">${d.titulo}</div>
            <div class="deal-contato">${contatoNome(d.contatoId)}</div>
            <div class="deal-valor">${formatarMoeda(d.valor)}</div>
            <div class="deal-actions">
              <button class="btn btn-ghost btn-small" data-editar-negocio="${d.id}">✎</button>
              <button class="btn btn-danger btn-small" data-excluir-negocio="${d.id}">✕</button>
            </div>
          </div>`
          )
          .join("")}
      </div>`;
  }).join("");
}

function formularioNegocio(negocio) {
  const editando = Boolean(negocio);
  negocio = negocio || { titulo: "", contatoId: "", valor: 0, estagio: estado.estagios[0].id };

  const opcoesContato = `<option value="">Sem contato vinculado</option>` +
    estado.contacts
      .map((c) => `<option value="${c.id}" ${c.id === negocio.contatoId ? "selected" : ""}>${c.nome}</option>`)
      .join("");

  const opcoesEstagio = estado.estagios
    .map((e) => `<option value="${e.id}" ${e.id === negocio.estagio ? "selected" : ""}>${e.label}</option>`)
    .join("");

  abrirModal(
    `
    <h2>${editando ? "Editar negócio" : "Novo negócio"}</h2>
    <form id="form-negocio">
      <div class="form-field">
        <label for="n-titulo">Título *</label>
        <input type="text" id="n-titulo" required value="${negocio.titulo}" />
      </div>
      <div class="form-field">
        <label for="n-contato">Contato</label>
        <select id="n-contato">${opcoesContato}</select>
      </div>
      <div class="form-field">
        <label for="n-valor">Valor (R$)</label>
        <input type="number" id="n-valor" min="0" step="0.01" value="${(negocio.valor / 100).toFixed(2)}" />
      </div>
      <div class="form-field">
        <label for="n-estagio">Estágio</label>
        <select id="n-estagio">${opcoesEstagio}</select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `,
    (raiz) => {
      raiz.querySelector("#btn-cancelar").addEventListener("click", fecharModal);
      raiz.querySelector("#form-negocio").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const dados = {
          titulo: raiz.querySelector("#n-titulo").value.trim(),
          contatoId: raiz.querySelector("#n-contato").value || null,
          valor: Math.round(parseFloat(raiz.querySelector("#n-valor").value || "0") * 100),
          estagio: raiz.querySelector("#n-estagio").value,
        };
        if (!dados.titulo) return;

        const ok = await comTratativaDeErro(async () => {
          if (editando) {
            const atualizado = { ...negocio, ...dados };
            const { error } = await db.from("deals").update(dealParaLinha(atualizado)).eq("id", negocio.id);
            if (error) throw error;
            Object.assign(negocio, dados);
          } else {
            const novoNegocio = { id: uid(), criadoEm: new Date().toISOString(), ...dados };
            const { error } = await db.from("deals").insert(dealParaLinha(novoNegocio));
            if (error) throw error;
            estado.deals.push(novoNegocio);
          }
        });
        if (!ok) return;

        fecharModal();
        renderizarNegocios();
        renderizarDashboard();
      });
    }
  );
}

async function excluirNegocio(id) {
  if (!confirm("Excluir este negócio?")) return;

  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("deals").delete().eq("id", id);
    if (error) throw error;
  }, "Não foi possível excluir o negócio");
  if (!ok) return;

  estado.deals = estado.deals.filter((d) => d.id !== id);
  estado.tasks.forEach((t) => {
    if (t.dealId === id) t.dealId = null;
  });
  renderizarNegocios();
  renderizarDashboard();
}

// ---------- tarefas ----------

let filtroTarefaAtual = "pendentes";

function renderizarTarefas() {
  const hoje = hojeISO();
  let lista = estado.tasks;
  if (filtroTarefaAtual === "pendentes") lista = lista.filter((t) => !t.concluida);
  if (filtroTarefaAtual === "concluidas") lista = lista.filter((t) => t.concluida);

  lista = [...lista].sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));

  document.getElementById("tarefas-vazio").hidden = lista.length > 0;
  document.getElementById("lista-tarefas").innerHTML = lista
    .map((t) => {
      const atrasada = !t.concluida && t.vencimento && t.vencimento < hoje;
      const contexto = [t.contatoId ? contatoNome(t.contatoId) : null, t.dealId ? (estado.deals.find((d) => d.id === t.dealId) || {}).titulo : null]
        .filter(Boolean)
        .join(" · ");
      return `
        <li class="task-item ${t.concluida ? "concluida" : ""} ${atrasada ? "atrasada" : ""}">
          <input type="checkbox" data-alternar-tarefa="${t.id}" ${t.concluida ? "checked" : ""} />
          <div class="task-info">
            <div class="task-titulo">${t.titulo}</div>
            <div class="task-meta">
              ${t.vencimento ? `<span class="task-vencimento">Vence em ${formatarData(t.vencimento)}</span>` : ""}
              ${contexto ? `<span>${contexto}</span>` : ""}
            </div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-small" data-editar-tarefa="${t.id}">Editar</button>
            <button class="btn btn-danger btn-small" data-excluir-tarefa="${t.id}">Excluir</button>
          </div>
        </li>`;
    })
    .join("");
}

function formularioTarefa(tarefa) {
  const editando = Boolean(tarefa);
  tarefa = tarefa || { titulo: "", contatoId: "", dealId: "", vencimento: hojeISO(), concluida: false };

  const opcoesContato = `<option value="">Sem contato vinculado</option>` +
    estado.contacts
      .map((c) => `<option value="${c.id}" ${c.id === tarefa.contatoId ? "selected" : ""}>${c.nome}</option>`)
      .join("");

  const opcoesNegocio = `<option value="">Sem negócio vinculado</option>` +
    estado.deals
      .map((d) => `<option value="${d.id}" ${d.id === tarefa.dealId ? "selected" : ""}>${d.titulo}</option>`)
      .join("");

  abrirModal(
    `
    <h2>${editando ? "Editar tarefa" : "Nova tarefa"}</h2>
    <form id="form-tarefa">
      <div class="form-field">
        <label for="t-titulo">Descrição *</label>
        <input type="text" id="t-titulo" required value="${tarefa.titulo}" />
      </div>
      <div class="form-field">
        <label for="t-vencimento">Vencimento</label>
        <input type="date" id="t-vencimento" value="${tarefa.vencimento || ""}" />
      </div>
      <div class="form-field">
        <label for="t-contato">Contato</label>
        <select id="t-contato">${opcoesContato}</select>
      </div>
      <div class="form-field">
        <label for="t-negocio">Negócio</label>
        <select id="t-negocio">${opcoesNegocio}</select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `,
    (raiz) => {
      raiz.querySelector("#btn-cancelar").addEventListener("click", fecharModal);
      raiz.querySelector("#form-tarefa").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const dados = {
          titulo: raiz.querySelector("#t-titulo").value.trim(),
          vencimento: raiz.querySelector("#t-vencimento").value || null,
          contatoId: raiz.querySelector("#t-contato").value || null,
          dealId: raiz.querySelector("#t-negocio").value || null,
        };
        if (!dados.titulo) return;

        const ok = await comTratativaDeErro(async () => {
          if (editando) {
            const atualizado = { ...tarefa, ...dados };
            const { error } = await db.from("tasks").update(tarefaParaLinha(atualizado)).eq("id", tarefa.id);
            if (error) throw error;
            Object.assign(tarefa, dados);
          } else {
            const novaTarefa = { id: uid(), concluida: false, criadoEm: new Date().toISOString(), ...dados };
            const { error } = await db.from("tasks").insert(tarefaParaLinha(novaTarefa));
            if (error) throw error;
            estado.tasks.push(novaTarefa);
          }
        });
        if (!ok) return;

        fecharModal();
        renderizarTarefas();
        renderizarDashboard();
      });
    }
  );
}

async function excluirTarefa(id) {
  if (!confirm("Excluir esta tarefa?")) return;

  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("tasks").delete().eq("id", id);
    if (error) throw error;
  }, "Não foi possível excluir a tarefa");
  if (!ok) return;

  estado.tasks = estado.tasks.filter((t) => t.id !== id);
  renderizarTarefas();
  renderizarDashboard();
}

// ---------- funil (estágios) ----------

function renderizarFunil() {
  document.getElementById("lista-estagios").innerHTML = estado.estagios
    .map((estagio, indice) => {
      const negocios = estado.deals.filter((d) => d.estagio === estagio.id).length;
      return `
        <li class="stage-item" data-estagio-id="${estagio.id}">
          <div class="stage-order-btns">
            <button type="button" data-mover-estagio="${estagio.id}" data-direcao="-1" ${indice === 0 ? "disabled" : ""} title="Mover para cima">▲</button>
            <button type="button" data-mover-estagio="${estagio.id}" data-direcao="1" ${indice === estado.estagios.length - 1 ? "disabled" : ""} title="Mover para baixo">▼</button>
          </div>
          <input type="text" data-renomear-estagio="${estagio.id}" value="${estagio.label}" />
          <span class="stage-count">${negocios} negócio(s)</span>
          <button type="button" class="btn btn-danger btn-small" data-excluir-estagio="${estagio.id}">Excluir</button>
        </li>`;
    })
    .join("");
}

async function persistirOrdemEstagios() {
  const { error } = await db.from("estagios").upsert(estado.estagios.map((e, indice) => ({ id: e.id, label: e.label, ordem: indice })));
  if (error) throw error;
}

async function moverEstagio(id, direcao) {
  const indice = estado.estagios.findIndex((e) => e.id === id);
  const novoIndice = indice + direcao;
  if (indice < 0 || novoIndice < 0 || novoIndice >= estado.estagios.length) return;
  const [estagio] = estado.estagios.splice(indice, 1);
  estado.estagios.splice(novoIndice, 0, estagio);

  const ok = await comTratativaDeErro(persistirOrdemEstagios, "Não foi possível salvar a nova ordem");
  if (!ok) {
    estado.estagios.splice(novoIndice, 1);
    estado.estagios.splice(indice, 0, estagio);
  }
  renderizarFunil();
  renderizarNegocios();
}

async function renomearEstagio(id, novoLabel) {
  const label = novoLabel.trim();
  const estagio = estado.estagios.find((e) => e.id === id);
  if (!estagio) return;
  if (!label) {
    renderizarFunil();
    return;
  }
  const duplicado = estado.estagios.some(
    (e) => e.id !== id && removerAcentos(e.label.toLowerCase()) === removerAcentos(label.toLowerCase())
  );
  if (duplicado) {
    alert("Já existe um estágio com esse nome.");
    renderizarFunil();
    return;
  }

  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("estagios").update({ label }).eq("id", id);
    if (error) throw error;
  }, "Não foi possível renomear o estágio");
  if (!ok) {
    renderizarFunil();
    return;
  }

  estagio.label = label;
  renderizarFunil();
  renderizarNegocios();
}

async function excluirEstagio(id) {
  if (estado.estagios.length <= 1) {
    alert("É preciso manter ao menos um estágio no funil.");
    return;
  }
  const emUso = estado.deals.some((d) => d.estagio === id);
  if (emUso) {
    alert("Não é possível excluir: há negócio(s) neste estágio. Mova-os para outro estágio primeiro.");
    return;
  }
  if (!confirm(`Excluir o estágio "${estagioLabel(id)}"?`)) return;

  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("estagios").delete().eq("id", id);
    if (error) throw error;
  }, "Não foi possível excluir o estágio");
  if (!ok) return;

  estado.estagios = estado.estagios.filter((e) => e.id !== id);
  renderizarFunil();
}

async function adicionarEstagio(label) {
  const nome = label.trim();
  if (!nome) return;
  const duplicado = estado.estagios.some((e) => removerAcentos(e.label.toLowerCase()) === removerAcentos(nome.toLowerCase()));
  if (duplicado) {
    alert("Já existe um estágio com esse nome.");
    return;
  }

  const novoEstagio = { id: uid(), label: nome };
  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("estagios").insert({ id: novoEstagio.id, label: novoEstagio.label, ordem: estado.estagios.length });
    if (error) throw error;
  }, "Não foi possível adicionar o estágio");
  if (!ok) return;

  estado.estagios.push(novoEstagio);
  renderizarFunil();
}

// ---------- exportar / importar ----------

function baixarArquivoTexto(conteudo, nomeArquivo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

function exportarBackup() {
  baixarArquivoTexto(JSON.stringify(estado, null, 2), `crm-simples-backup-${hojeISO()}.json`, "application/json");
}

async function restaurarBackupNoBanco(dados) {
  // Apaga filhos antes dos pais e insere pais antes dos filhos, por causa das
  // chaves estrangeiras (deals.estagio_id/contato_id, tasks.contato_id/deal_id).
  for (const tabela of ["tasks", "deals", "contacts", "estagios"]) {
    const { error } = await db.from(tabela).delete().neq("id", "");
    if (error) throw error;
  }
  if (dados.estagios.length) {
    const { error } = await db.from("estagios").insert(dados.estagios.map((e, indice) => ({ id: e.id, label: e.label, ordem: indice })));
    if (error) throw error;
  }
  if (dados.contacts.length) {
    const { error } = await db.from("contacts").insert(dados.contacts.map(contatoParaLinha));
    if (error) throw error;
  }
  if (dados.deals.length) {
    const { error } = await db.from("deals").insert(dados.deals.map(dealParaLinha));
    if (error) throw error;
  }
  if (dados.tasks.length) {
    const { error } = await db.from("tasks").insert(dados.tasks.map(tarefaParaLinha));
    if (error) throw error;
  }
}

function importarBackup(arquivo) {
  const leitor = new FileReader();
  leitor.onload = async () => {
    let dados;
    try {
      dados = JSON.parse(leitor.result);
      if (!Array.isArray(dados.contacts) || !Array.isArray(dados.deals) || !Array.isArray(dados.tasks)) {
        throw new Error("Formato inválido");
      }
    } catch (erro) {
      alert("Não foi possível importar o arquivo: " + erro.message);
      return;
    }
    if (!confirm("Importar irá substituir todos os dados atuais no banco. Continuar?")) return;

    dados.estagios = dados.estagios && dados.estagios.length ? dados.estagios : ESTAGIOS_PADRAO.map((e) => ({ ...e }));
    const ok = await comTratativaDeErro(() => restaurarBackupNoBanco(dados), "Não foi possível restaurar o backup");
    if (!ok) return;

    estado = { contacts: dados.contacts, deals: dados.deals, tasks: dados.tasks, estagios: dados.estagios };
    renderizarTudo();
  };
  leitor.readAsText(arquivo);
}

// ---------- importar CSV (contatos e negócios) ----------

function removerAcentos(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseCSV(texto) {
  const linhas = texto
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((linha) => linha.trim() !== "");
  if (!linhas.length) return [];

  const delimitador = linhas[0].split(";").length > linhas[0].split(",").length ? ";" : ",";

  function parseLinha(linha) {
    const campos = [];
    let atual = "";
    let dentroAspas = false;
    for (let i = 0; i < linha.length; i++) {
      const char = linha[i];
      if (dentroAspas) {
        if (char === '"') {
          if (linha[i + 1] === '"') {
            atual += '"';
            i++;
          } else {
            dentroAspas = false;
          }
        } else {
          atual += char;
        }
      } else if (char === '"') {
        dentroAspas = true;
      } else if (char === delimitador) {
        campos.push(atual.trim());
        atual = "";
      } else {
        atual += char;
      }
    }
    campos.push(atual.trim());
    return campos;
  }

  const cabecalho = parseLinha(linhas[0]).map((h) => removerAcentos(h.toLowerCase()));
  return linhas.slice(1).map((linha) => {
    const valores = parseLinha(linha);
    const objeto = {};
    cabecalho.forEach((chave, indice) => {
      objeto[chave] = (valores[indice] || "").trim();
    });
    return objeto;
  });
}

function parseValorMonetario(texto) {
  if (!texto) return 0;
  let limpo = texto.replace(/[^\d,.-]/g, "");
  if (limpo.includes(",") && limpo.includes(".")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  } else if (limpo.includes(",")) {
    limpo = limpo.replace(",", ".");
  }
  const numero = parseFloat(limpo);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function normalizarEstagio(texto) {
  const padrao = estado.estagios[0].id;
  if (!texto) return padrao;
  const chave = removerAcentos(texto.trim().toLowerCase());
  const encontrado = estado.estagios.find((e) => e.id === chave || removerAcentos(e.label.toLowerCase()) === chave);
  return encontrado ? encontrado.id : padrao;
}

function baixarModeloContatos() {
  const conteudo = ["nome,empresa,email,telefone,notas", "Maria Silva,Acme Ltda,maria@acme.com,(11) 99999-0000,Cliente desde 2024"].join(
    "\n"
  );
  baixarArquivoTexto("﻿" + conteudo, "crm-simples-modelo-contatos.csv", "text/csv;charset=utf-8");
}

function baixarModeloNegocios() {
  const conteudo = [
    "titulo,valor,estagio,contato_nome,contato_email",
    "Venda Software X,1500.00,Lead,Maria Silva,maria@acme.com",
  ].join("\n");
  baixarArquivoTexto("﻿" + conteudo, "crm-simples-modelo-negocios.csv", "text/csv;charset=utf-8");
}

function importarContatosCSV(arquivo) {
  const leitor = new FileReader();
  leitor.onload = async () => {
    const linhas = parseCSV(leitor.result);
    let criados = 0;
    let atualizados = 0;

    const paraGravar = [];
    linhas.forEach((linha) => {
      const nome = linha.nome;
      if (!nome) return;
      const dados = {
        nome,
        empresa: linha.empresa || "",
        email: linha.email || "",
        telefone: linha.telefone || "",
        notas: linha.notas || "",
      };
      const existente = dados.email
        ? estado.contacts.find((c) => c.email && c.email.toLowerCase() === dados.email.toLowerCase())
        : null;
      if (existente) {
        atualizados++;
        paraGravar.push({ ...existente, ...dados });
      } else {
        criados++;
        paraGravar.push({ id: uid(), criadoEm: new Date().toISOString(), ...dados });
      }
    });

    if (!paraGravar.length) {
      alert("Nenhum contato válido encontrado no arquivo (é preciso ao menos a coluna 'nome').");
      return;
    }

    const ok = await comTratativaDeErro(async () => {
      const { error } = await db.from("contacts").upsert(paraGravar.map(contatoParaLinha));
      if (error) throw error;
    }, "Não foi possível importar os contatos");
    if (!ok) return;

    estado.contacts = mesclarPorId(estado.contacts, paraGravar);
    renderizarContatos(document.getElementById("search-contatos").value);
    renderizarTudo();
    alert(`Importação concluída: ${criados} contato(s) novo(s), ${atualizados} atualizado(s).`);
  };
  leitor.readAsText(arquivo);
}

function importarNegociosCSV(arquivo) {
  const leitor = new FileReader();
  leitor.onload = async () => {
    const linhas = parseCSV(leitor.result);
    let semContato = 0;

    const paraGravar = [];
    linhas.forEach((linha) => {
      const titulo = linha.titulo;
      if (!titulo) return;

      const email = (linha.contato_email || "").toLowerCase();
      const nomeContato = (linha.contato_nome || "").toLowerCase();
      let contato = null;
      if (email) contato = estado.contacts.find((c) => c.email && c.email.toLowerCase() === email);
      if (!contato && nomeContato) contato = estado.contacts.find((c) => c.nome.toLowerCase() === nomeContato);
      if (!contato) semContato++;

      paraGravar.push({
        id: uid(),
        criadoEm: new Date().toISOString(),
        titulo,
        valor: parseValorMonetario(linha.valor),
        estagio: normalizarEstagio(linha.estagio),
        contatoId: contato ? contato.id : null,
      });
    });

    if (!paraGravar.length) {
      alert("Nenhum negócio válido encontrado no arquivo (é preciso ao menos a coluna 'titulo').");
      return;
    }

    const ok = await comTratativaDeErro(async () => {
      const { error } = await db.from("deals").insert(paraGravar.map(dealParaLinha));
      if (error) throw error;
    }, "Não foi possível importar os negócios");
    if (!ok) return;

    estado.deals.push(...paraGravar);
    renderizarNegocios();
    renderizarDashboard();
    alert(`Importação concluída: ${paraGravar.length} negócio(s) importado(s), ${semContato} sem contato correspondente.`);
  };
  leitor.readAsText(arquivo);
}

// ---------- eventos globais ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => trocarView(btn.dataset.view));
});

document.getElementById("btn-export").addEventListener("click", exportarBackup);
document.getElementById("input-import").addEventListener("change", (evento) => {
  const arquivo = evento.target.files[0];
  if (arquivo) importarBackup(arquivo);
  evento.target.value = "";
});

document.getElementById("btn-novo-contato").addEventListener("click", () => formularioContato(null));
document.getElementById("search-contatos").addEventListener("input", (evento) => renderizarContatos(evento.target.value));
document.getElementById("btn-modelo-contatos").addEventListener("click", baixarModeloContatos);
document.getElementById("input-importar-contatos").addEventListener("change", (evento) => {
  const arquivo = evento.target.files[0];
  if (arquivo) importarContatosCSV(arquivo);
  evento.target.value = "";
});
document.getElementById("tabela-contatos").addEventListener("click", (evento) => {
  const editarId = evento.target.dataset.editarContato;
  const excluirId = evento.target.dataset.excluirContato;
  if (editarId) formularioContato(estado.contacts.find((c) => c.id === editarId));
  if (excluirId) excluirContato(excluirId);
});

document.getElementById("btn-novo-negocio").addEventListener("click", () => formularioNegocio(null));
document.getElementById("filtro-estagio-negocios").addEventListener("change", (evento) => {
  filtroEstagioNegocios = evento.target.value;
  renderizarNegocios();
});
document.getElementById("btn-modelo-negocios").addEventListener("click", baixarModeloNegocios);
document.getElementById("input-importar-negocios").addEventListener("change", (evento) => {
  const arquivo = evento.target.files[0];
  if (arquivo) importarNegociosCSV(arquivo);
  evento.target.value = "";
});

const kanbanEl = document.getElementById("kanban");

kanbanEl.addEventListener("click", (evento) => {
  const editarId = evento.target.dataset.editarNegocio;
  const excluirId = evento.target.dataset.excluirNegocio;
  if (editarId) formularioNegocio(estado.deals.find((d) => d.id === editarId));
  if (excluirId) excluirNegocio(excluirId);
});

kanbanEl.addEventListener("dragstart", (evento) => {
  const card = evento.target.closest(".deal-card");
  if (!card) return;
  evento.dataTransfer.effectAllowed = "move";
  evento.dataTransfer.setData("text/plain", card.dataset.negocioId);
  card.classList.add("dragging");
});

kanbanEl.addEventListener("dragend", (evento) => {
  const card = evento.target.closest(".deal-card");
  if (card) card.classList.remove("dragging");
  kanbanEl.querySelectorAll(".kanban-column").forEach((c) => c.classList.remove("drag-over"));
});

const ZONA_AUTOSCROLL_PX = 60;

kanbanEl.addEventListener("dragover", (evento) => {
  const coluna = evento.target.closest(".kanban-column");
  if (!coluna) return;
  evento.preventDefault();
  evento.dataTransfer.dropEffect = "move";
  kanbanEl.querySelectorAll(".kanban-column").forEach((c) => c.classList.toggle("drag-over", c === coluna));

  const limites = kanbanEl.getBoundingClientRect();
  const distanciaEsquerda = evento.clientX - limites.left;
  const distanciaDireita = limites.right - evento.clientX;
  if (distanciaEsquerda < ZONA_AUTOSCROLL_PX) {
    kanbanEl.scrollLeft -= (ZONA_AUTOSCROLL_PX - distanciaEsquerda) / 2;
  } else if (distanciaDireita < ZONA_AUTOSCROLL_PX) {
    kanbanEl.scrollLeft += (ZONA_AUTOSCROLL_PX - distanciaDireita) / 2;
  }
});

kanbanEl.addEventListener("drop", async (evento) => {
  const coluna = evento.target.closest(".kanban-column");
  if (!coluna) return;
  evento.preventDefault();
  const id = evento.dataTransfer.getData("text/plain");
  const negocio = estado.deals.find((d) => d.id === id);
  if (!negocio) return;

  const novoEstagio = coluna.dataset.estagio;
  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("deals").update({ estagio_id: novoEstagio }).eq("id", id);
    if (error) throw error;
  }, "Não foi possível mover o negócio");
  if (!ok) return;

  negocio.estagio = novoEstagio;
  renderizarNegocios();
  renderizarDashboard();
});

document.getElementById("btn-nova-tarefa").addEventListener("click", () => formularioTarefa(null));
document.getElementById("lista-tarefas").addEventListener("click", (evento) => {
  const editarId = evento.target.dataset.editarTarefa;
  const excluirId = evento.target.dataset.excluirTarefa;
  if (editarId) formularioTarefa(estado.tasks.find((t) => t.id === editarId));
  if (excluirId) excluirTarefa(excluirId);
});
document.getElementById("lista-tarefas").addEventListener("change", async (evento) => {
  const id = evento.target.dataset.alternarTarefa;
  if (!id) return;
  const tarefa = estado.tasks.find((t) => t.id === id);
  const novoValor = evento.target.checked;

  const ok = await comTratativaDeErro(async () => {
    const { error } = await db.from("tasks").update({ concluida: novoValor }).eq("id", id);
    if (error) throw error;
  }, "Não foi possível atualizar a tarefa");

  tarefa.concluida = ok ? novoValor : tarefa.concluida;
  renderizarTarefas();
  renderizarDashboard();
});

document.querySelectorAll(".filtro-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    filtroTarefaAtual = btn.dataset.filtro;
    document.querySelectorAll(".filtro-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderizarTarefas();
  });
});

const listaEstagiosEl = document.getElementById("lista-estagios");

listaEstagiosEl.addEventListener("click", (evento) => {
  const moverId = evento.target.dataset.moverEstagio;
  const excluirId = evento.target.dataset.excluirEstagio;
  if (moverId) moverEstagio(moverId, Number(evento.target.dataset.direcao));
  if (excluirId) excluirEstagio(excluirId);
});

listaEstagiosEl.addEventListener("change", (evento) => {
  const id = evento.target.dataset.renomearEstagio;
  if (!id) return;
  renomearEstagio(id, evento.target.value);
});

document.getElementById("form-novo-estagio").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const input = document.getElementById("novo-estagio-nome");
  adicionarEstagio(input.value);
  input.value = "";
});

// ---------- login ----------

async function mostrarApp(usuario) {
  const botaoEntrar = document.querySelector("#form-login button[type=submit]");
  const status = document.getElementById("login-status");
  botaoEntrar.disabled = true;
  status.hidden = false;
  status.textContent = "Carregando dados...";

  try {
    estado = await carregarDados();
  } catch (erro) {
    console.error(erro);
    status.hidden = true;
    botaoEntrar.disabled = false;
    alert("Não foi possível conectar ao banco de dados: " + erro.message);
    mostrarLogin();
    return;
  }

  botaoEntrar.disabled = false;
  status.hidden = true;
  document.getElementById("tela-login").hidden = true;
  document.getElementById("app-root").hidden = false;
  document.getElementById("usuario-logado").textContent = `Olá, ${usuario}`;
  renderizarDashboard();
}

function mostrarLogin() {
  document.getElementById("app-root").hidden = true;
  document.getElementById("tela-login").hidden = false;
  document.getElementById("login-usuario").value = "";
  document.getElementById("login-senha").value = "";
  document.getElementById("login-erro").hidden = true;
}

document.getElementById("form-login").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const usuario = document.getElementById("login-usuario").value.trim().toLowerCase();
  const senha = document.getElementById("login-senha").value;
  const hashDigitado = await sha256Hex(senha);
  const encontrado = USUARIOS.find((u) => u.usuario === usuario && u.hash === hashDigitado);
  if (!encontrado) {
    document.getElementById("login-erro").hidden = false;
    return;
  }
  document.getElementById("login-erro").hidden = true;
  localStorage.setItem(SESSAO_KEY, encontrado.usuario);
  await mostrarApp(encontrado.usuario);
});

document.getElementById("btn-logout").addEventListener("click", () => {
  localStorage.removeItem(SESSAO_KEY);
  mostrarLogin();
});

const sessaoAtual = localStorage.getItem(SESSAO_KEY);
if (sessaoAtual && USUARIOS.some((u) => u.usuario === sessaoAtual)) {
  mostrarApp(sessaoAtual);
} else {
  mostrarLogin();
}
