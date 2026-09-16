"use strict";

const STORAGE_KEY = "crm-simples:data";

const ESTAGIOS = [
  { id: "lead", label: "Lead" },
  { id: "proposta", label: "Proposta" },
  { id: "negociacao", label: "Negociação" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
];

function estagioLabel(id) {
  return (ESTAGIOS.find((e) => e.id === id) || {}).label || id;
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

function estadoInicial() {
  return { contacts: [], deals: [], tasks: [] };
}

function carregarEstado() {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return estadoInicial();
    const dados = JSON.parse(bruto);
    return {
      contacts: dados.contacts || [],
      deals: dados.deals || [],
      tasks: dados.tasks || [],
    };
  } catch (erro) {
    console.error("Falha ao ler dados salvos, iniciando vazio.", erro);
    return estadoInicial();
  }
}

let estado = carregarEstado();

function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
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
      raiz.querySelector("#form-contato").addEventListener("submit", (evento) => {
        evento.preventDefault();
        const dados = {
          nome: raiz.querySelector("#c-nome").value.trim(),
          empresa: raiz.querySelector("#c-empresa").value.trim(),
          email: raiz.querySelector("#c-email").value.trim(),
          telefone: raiz.querySelector("#c-telefone").value.trim(),
          notas: raiz.querySelector("#c-notas").value.trim(),
        };
        if (!dados.nome) return;

        if (editando) {
          Object.assign(contato, dados);
        } else {
          estado.contacts.push({ id: uid(), criadoEm: new Date().toISOString(), ...dados });
        }
        salvar();
        fecharModal();
        renderizarContatos(document.getElementById("search-contatos").value);
        renderizarTudo();
      });
    }
  );
}

function excluirContato(id) {
  const emUso = estado.deals.some((d) => d.contatoId === id) || estado.tasks.some((t) => t.contatoId === id);
  const mensagem = emUso
    ? "Este contato está vinculado a negócios e/ou tarefas, que perderão essa referência. Excluir mesmo assim?"
    : "Excluir este contato?";
  if (!confirm(mensagem)) return;

  estado.contacts = estado.contacts.filter((c) => c.id !== id);
  estado.deals.forEach((d) => {
    if (d.contatoId === id) d.contatoId = null;
  });
  estado.tasks.forEach((t) => {
    if (t.contatoId === id) t.contatoId = null;
  });
  salvar();
  renderizarContatos(document.getElementById("search-contatos").value);
  renderizarTudo();
}

// ---------- negócios (kanban) ----------

function renderizarNegocios() {
  const total = estado.deals
    .filter((d) => d.estagio !== "perdido")
    .reduce((soma, d) => soma + d.valor, 0);
  document.getElementById("pipeline-total").textContent = `Total (exceto perdidos): ${formatarMoeda(total)}`;

  document.getElementById("kanban").innerHTML = ESTAGIOS.map((estagio) => {
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
  negocio = negocio || { titulo: "", contatoId: "", valor: 0, estagio: "lead" };

  const opcoesContato = `<option value="">Sem contato vinculado</option>` +
    estado.contacts
      .map((c) => `<option value="${c.id}" ${c.id === negocio.contatoId ? "selected" : ""}>${c.nome}</option>`)
      .join("");

  const opcoesEstagio = ESTAGIOS
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
      raiz.querySelector("#form-negocio").addEventListener("submit", (evento) => {
        evento.preventDefault();
        const dados = {
          titulo: raiz.querySelector("#n-titulo").value.trim(),
          contatoId: raiz.querySelector("#n-contato").value || null,
          valor: Math.round(parseFloat(raiz.querySelector("#n-valor").value || "0") * 100),
          estagio: raiz.querySelector("#n-estagio").value,
        };
        if (!dados.titulo) return;

        if (editando) {
          Object.assign(negocio, dados);
        } else {
          estado.deals.push({ id: uid(), criadoEm: new Date().toISOString(), ...dados });
        }
        salvar();
        fecharModal();
        renderizarNegocios();
        renderizarDashboard();
      });
    }
  );
}

function excluirNegocio(id) {
  if (!confirm("Excluir este negócio?")) return;
  estado.deals = estado.deals.filter((d) => d.id !== id);
  estado.tasks.forEach((t) => {
    if (t.dealId === id) t.dealId = null;
  });
  salvar();
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
      raiz.querySelector("#form-tarefa").addEventListener("submit", (evento) => {
        evento.preventDefault();
        const dados = {
          titulo: raiz.querySelector("#t-titulo").value.trim(),
          vencimento: raiz.querySelector("#t-vencimento").value || null,
          contatoId: raiz.querySelector("#t-contato").value || null,
          dealId: raiz.querySelector("#t-negocio").value || null,
        };
        if (!dados.titulo) return;

        if (editando) {
          Object.assign(tarefa, dados);
        } else {
          estado.tasks.push({ id: uid(), concluida: false, criadoEm: new Date().toISOString(), ...dados });
        }
        salvar();
        fecharModal();
        renderizarTarefas();
        renderizarDashboard();
      });
    }
  );
}

function excluirTarefa(id) {
  if (!confirm("Excluir esta tarefa?")) return;
  estado.tasks = estado.tasks.filter((t) => t.id !== id);
  salvar();
  renderizarTarefas();
  renderizarDashboard();
}

// ---------- exportar / importar ----------

function exportarBackup() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `crm-simples-backup-${hojeISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importarBackup(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const dados = JSON.parse(leitor.result);
      if (!Array.isArray(dados.contacts) || !Array.isArray(dados.deals) || !Array.isArray(dados.tasks)) {
        throw new Error("Formato inválido");
      }
      if (!confirm("Importar irá substituir todos os dados atuais. Continuar?")) return;
      estado = { contacts: dados.contacts, deals: dados.deals, tasks: dados.tasks };
      salvar();
      renderizarTudo();
    } catch (erro) {
      alert("Não foi possível importar o arquivo: " + erro.message);
    }
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
document.getElementById("tabela-contatos").addEventListener("click", (evento) => {
  const editarId = evento.target.dataset.editarContato;
  const excluirId = evento.target.dataset.excluirContato;
  if (editarId) formularioContato(estado.contacts.find((c) => c.id === editarId));
  if (excluirId) excluirContato(excluirId);
});

document.getElementById("btn-novo-negocio").addEventListener("click", () => formularioNegocio(null));

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

kanbanEl.addEventListener("dragover", (evento) => {
  const coluna = evento.target.closest(".kanban-column");
  if (!coluna) return;
  evento.preventDefault();
  evento.dataTransfer.dropEffect = "move";
  kanbanEl.querySelectorAll(".kanban-column").forEach((c) => c.classList.toggle("drag-over", c === coluna));
});

kanbanEl.addEventListener("drop", (evento) => {
  const coluna = evento.target.closest(".kanban-column");
  if (!coluna) return;
  evento.preventDefault();
  const id = evento.dataTransfer.getData("text/plain");
  const negocio = estado.deals.find((d) => d.id === id);
  if (negocio) {
    negocio.estagio = coluna.dataset.estagio;
    salvar();
    renderizarNegocios();
    renderizarDashboard();
  }
});

document.getElementById("btn-nova-tarefa").addEventListener("click", () => formularioTarefa(null));
document.getElementById("lista-tarefas").addEventListener("click", (evento) => {
  const editarId = evento.target.dataset.editarTarefa;
  const excluirId = evento.target.dataset.excluirTarefa;
  if (editarId) formularioTarefa(estado.tasks.find((t) => t.id === editarId));
  if (excluirId) excluirTarefa(excluirId);
});
document.getElementById("lista-tarefas").addEventListener("change", (evento) => {
  const id = evento.target.dataset.alternarTarefa;
  if (!id) return;
  const tarefa = estado.tasks.find((t) => t.id === id);
  tarefa.concluida = evento.target.checked;
  salvar();
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

renderizarDashboard();
