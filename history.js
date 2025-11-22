// history.js
import { db, collection, getDocs, doc, getDoc } from "./firebase.js";

import { openInfoModal } from "./modal.js";

const tbody = document.getElementById("historyBody");
const searchInput = document.getElementById("searchClient");

/* ---------------------------------------------------
   1. Modal Functions (NEW)
--------------------------------------------------- */

function showHistoryDetails(lote, description, trade) {
    const html = `
        <strong>Lote:</strong> ${lote}<br><br>

        <strong>Descrição:</strong><br>
        ${description || "Sem descrição"}<br><br>

        <strong>O que recebeu em troca:</strong><br>
        ${trade || "Sem troca"}
    `;

    openInfoModal("Detalhes do Lote", html);
}


// CLOSE MODAL
document.getElementById("modalClose").addEventListener("click", () => {
    document.getElementById("modalOverlay").classList.add("hidden");
});

// CLOSE MODAL on outside click
document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target.id === "modalOverlay") {
        document.getElementById("modalOverlay").classList.add("hidden");
    }
});


/* ---------------------------------------------------
   2. Load History from Firestore
--------------------------------------------------- */
async function loadHistory() {
    const historySnap = await getDocs(collection(db, "history"));

    for (let docSnap of historySnap.docs) {
        const data = docSnap.data();

        // Get client name from clients collection
        let clientName = "Desconhecido";

        if (data.client) {
            const clientRef = doc(db, "clients", data.client);
            const clientSnap = await getDoc(clientRef);

            if (clientSnap.exists()) {
                clientName = clientSnap.data().name;
            }
        }

        addHistoryRow(
            clientName,
            data.lote,
            formatDate(data.deliveredAt?.toDate()),
            { description: data.description, trade: data.trade }
        );
    }
}


/* ---------------------------------------------------
   3. Add row to table
--------------------------------------------------- */
function addHistoryRow(client, lote, dateStr, details) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>${client}</td>
        <td>${lote}</td>
        <td>${dateStr}</td>
        <td><button class="detailsBtn">Ver</button></td>
    `;


    tr.querySelector(".detailsBtn").addEventListener("click", () => {
        showHistoryDetails(
            lote,
            details.description,
            details.trade
        );
    });


    tbody.appendChild(tr);
}


/* ---------------------------------------------------
   4. Format Firestore Date
--------------------------------------------------- */
function formatDate(date) {
    if (!date) return "—";
    return date.toLocaleDateString("pt-PT") + " " + date.toLocaleTimeString("pt-PT");
}


/* ---------------------------------------------------
   5. Live Search
--------------------------------------------------- */
searchInput.addEventListener("input", () => {
    const filter = searchInput.value.toLowerCase();
    const rows = tbody.getElementsByTagName("tr");

    for (let row of rows) {
        const clientCell = row.cells[0]?.textContent.toLowerCase() || "";
        row.style.display = clientCell.includes(filter) ? "" : "none";
    }
});


/* ---------------------------------------------------
   LOAD EVERYTHING
--------------------------------------------------- */
loadHistory();
