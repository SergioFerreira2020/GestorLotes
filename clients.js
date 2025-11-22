import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    updateDoc,
    deleteDoc,
    doc 
} from "./firebase.js";

import { openInfoModal, openConfirmModal } from "./modal.js";

const form = document.getElementById("clientForm");
const tableBody = document.getElementById("clientsBody");
const contactInput = form.querySelector('input[placeholder="Contacto"]');

/* -------------------------------------------------
   🔥 REALTIME VALIDATION (only digits, max 9)
---------------------------------------------------*/
contactInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");

    if (e.target.value.length > 9) {
        e.target.value = e.target.value.slice(0, 9);
    }
});

/* -------------------------------------------------
   🔥 LOAD CLIENT LIST
---------------------------------------------------*/
async function loadClients() {
    tableBody.innerHTML = "";

    const snap = await getDocs(collection(db, "clients"));

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${data.name}</td>
            <td>${data.contact}</td>
            <td>${data.address}</td>
            <td>${data.notes || ""}</td>

            <td class="actions-col">
                <button class="editBtn" data-id="${id}">Editar</button>
                <button class="deleteBtn" data-id="${id}">Apagar</button>
            </td>
        `;


        tableBody.appendChild(tr);
    });

    attachRowEvents();
}

/* -------------------------------------------------
   🔥 ATTACH EVENTS TO EDIT/DELETE BUTTONS
---------------------------------------------------*/
function attachRowEvents() {
    document.querySelectorAll(".editBtn").forEach(btn => {
        btn.addEventListener("click", () => editClient(btn.dataset.id));
    });

    document.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.addEventListener("click", () => deleteClient(btn.dataset.id));
    });
}

/* -------------------------------------------------
   🔥 ADD NEW CLIENT
---------------------------------------------------*/
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.querySelector('input[placeholder="Nome"]').value.trim();
    const contact = form.querySelector('input[placeholder="Contacto"]').value.trim();
    const address = form.querySelector('input[placeholder="Morada"]').value.trim();
    const notes = form.querySelector("textarea").value.trim();

    if (!name || !contact || !address) {
        openInfoModal("Erro", "Preencha todos os campos obrigatórios.");
        return;
    }

    const confirmHTML = `
        <div class="modal-box"><strong>Nome:</strong> ${name}</div>
        <div class="modal-box"><strong>Contacto:</strong> ${contact}</div>
        <div class="modal-box"><strong>Morada:</strong> ${address}</div>
        ${notes ? `<div class="modal-box"><strong>Notas:</strong> ${notes}</div>` : ""}
    `;

    openConfirmModal("Confirmar Cliente?", confirmHTML, async () => {
        try {
            await addDoc(collection(db, "clients"), {
                name,
                contact,
                address,
                notes,
                createdAt: new Date()
            });

            openInfoModal("Sucesso", "Cliente guardado com sucesso!");
            form.reset();
            loadClients();

        } catch (err) {
            console.error(err);
            openInfoModal("Erro", "Ocorreu um erro ao guardar o cliente.");
        }
    });
});

/* -------------------------------------------------
   🔥 EDIT CLIENT
---------------------------------------------------*/
async function editClient(clientId) {
    const snap = await getDoc(doc(db, "clients", clientId));

    if (!snap.exists()) {
        openInfoModal("Erro", "Cliente não encontrado.");
        return;
    }

    const data = snap.data();

    const formHTML = `
        <div class="modal-box">
            <strong>Nome:</strong><br>
            <input id="editName" value="${data.name}">
        </div>

        <div class="modal-box">
            <strong>Contacto:</strong><br>
            <input id="editContact" maxlength="9" value="${data.contact}">
        </div>

        <div class="modal-box">
            <strong>Morada:</strong><br>
            <input id="editAddress" value="${data.address}">
        </div>

        <div class="modal-box">
            <strong>Notas:</strong><br>
            <textarea id="editNotes">${data.notes || ""}</textarea>
        </div>
    `;

    openConfirmModal("Editar Cliente", formHTML, async () => {
        const updated = {
            name: document.getElementById("editName").value.trim(),
            contact: document.getElementById("editContact").value.trim(),
            address: document.getElementById("editAddress").value.trim(),
            notes: document.getElementById("editNotes").value.trim()
        };

        await updateDoc(doc(db, "clients", clientId), updated);

        openInfoModal("Sucesso", "Cliente atualizado com sucesso!");
        loadClients();
    });
}

/* -------------------------------------------------
   🔥 DELETE CLIENT
---------------------------------------------------*/
function deleteClient(clientId) {
    openConfirmModal("Apagar Cliente", `
        <div class="modal-box">Tem a certeza que deseja apagar este cliente?</div>
    `, async () => {
        await deleteDoc(doc(db, "clients", clientId));
        openInfoModal("Sucesso", "Cliente apagado.");
        loadClients();
    });
}

/* -------------------------------------------------
   🔥 INITIAL TABLE LOAD
---------------------------------------------------*/
loadClients();
