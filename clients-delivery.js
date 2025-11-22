// clients-delivery.js
import { 
    db, 
    collection, 
    getDocs, 
    getDoc,
    doc,
    updateDoc,
    setDoc 
} from "./firebase.js";

import { openInfoModal, openConfirmModal } from "./modal.js";


/* ---------------------------------------------------
   UNIFIED SIZE + GENDER PARSER
   (matches lotes.js exactly)
--------------------------------------------------- */
// === MASTER SIZE REGEX (handles almost everything) ===
const SIZE_REGEX = new RegExp(
  "\\b(XXS|XS|S|M|L|XL|XXL|XXXL)\\b" +            // letter sizes
  "|" +
  "\\b(\\d{1,2}\\s?[-/]\\s?\\d{1,2}\\s?(m|meses|mês|mes))\\b" +  // month ranges 4-8 meses / 4/8m
  "|" +
  "\\b(\\d{1,2}\\s?(m|meses|mês|mes))\\b" +        // single months 6 meses / 6m
  "|" +
  "\\b(\\d{1,2}\\s?[-/]\\s?\\d{1,2}\\s?(anos|a))\\b" +  // age ranges 6-8 anos
  "|" +
  "\\b(\\d{1,2}\\s?(anos|a|y))\\b" +               // single age 10 anos / 10y
  "|" +
  "\\b(3[4-9]|4[0-9]|5[0-6])\\b" +                 // adult numeric sizes 34–56
  "|" +
  "\\b(1[6-9]|2[0-9]|3[0-9]|4[0-6])\\b" +          // shoe sizes 16–46
  "|" +
  "\\b(tam(anho)?\\.?)\\s?(\\d{1,2}|XXS|XS|S|M|L|XL|XXL|XXXL)\\b", // TAM / TAMANHO
  "i"
);


// === GENDER DETECTOR ===
function extractGender(desc) {
    desc = desc.toLowerCase();

    if (/senhora|mulher|feminino|\bf\b/.test(desc)) return "F";
    if (/senhor|homem|masculino|\bm\b/.test(desc)) return "M";
    if (/menina|rapariga/.test(desc)) return "GIRL";
    if (/menino|rapaz/.test(desc)) return "BOY";
    if (/bebé|bebe|baby|infantil/.test(desc)) return "BABY";

    return "UNISEX";
}



// === FULL EXTRACTOR (size + gender + normalization) ===
function extractSizeAndGender(description) {
    if (!description) return null;

    const text = description.toLowerCase();

    // 1️⃣ Try to match ANY size
    const match = text.match(SIZE_REGEX);
    if (!match) return null;

    let size = match[0].toUpperCase();

    // 2️⃣ Normalize months
    size = size
        .replace(/M\b/, " MESES")
        .replace(/\b(\d{1,2})\/(\d{1,2})\s?M/i, "$1-$2 MESES")
        .replace(/\b(\d{1,2})-(\d{1,2})\s?M/i, "$1-$2 MESES")
        .replace(/MES$/, " MESES")
        .replace(/MESES?$/, " MESES");

    // 3️⃣ Normalize years
    size = size
        .replace(/ANOS?/, " ANOS")
        .replace(/\bY\b/, " ANOS");

    // 4️⃣ Gender
    const gender = extractGender(text);

    return { size: size.trim(), gender };
}


// ===========================================
// 🔽 Decrease stock
// ===========================================
async function decreaseSizeStock(g, s) {
    const key = `${g}-${s}`;
    const ref = doc(db, "sizes", key);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const current = snap.data().count || 0;
    const newVal = Math.max(0, current - 1);

    await updateDoc(ref, { count: newVal });
}

// ===========================================
// 📥 Load ALL CLIENTS + THEIR PENDING LOTES
// ===========================================
async function loadPendingDeliveries() {
    const clientList = document.getElementById("clientList");
    clientList.innerHTML = "";

    // Fetch clients
    const clientSnap = await getDocs(collection(db, "clients"));
    const clients = {};
    clientSnap.forEach(c => {
        clients[c.id] = {
            name: c.data().name,
            phone: c.data().contact,
            lotes: []
        };
    });

    // Fetch lotes
    const lotesSnap = await getDocs(collection(db, "lotes"));

    lotesSnap.forEach(l => {
        const data = l.data();
        const id = l.id;

        if (data.assignedTo && !data.delivered) {
            const clientId = data.assignedTo;

            if (clients[clientId]) {
                clients[clientId].lotes.push({
                    id,
                    description: data.description || ""
                });
            }
        }
    });

    renderClientCards(clients);
}

// ===========================================
// 🖼 Render Cards on the Page
// ===========================================
function renderClientCards(clients) {
    const wrapper = document.getElementById("clientList");
    wrapper.innerHTML = "";

    for (const cid in clients) {
        const c = clients[cid];
        if (c.lotes.length === 0) continue;

        const div = document.createElement("div");
        div.className = "card";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.padding = "20px";

        div.innerHTML = `
            <div>
                <strong>${c.name}</strong> — <span style="color:#bbb">${c.phone}</span><br>
                ${c.lotes.length} lote(s) por entregar
            </div>

            <button class="deliverAllBtn" data-id="${cid}">
                Entregar Tudo
            </button>
        `;

        // Open modal on left area click
        div.children[0].style.cursor = "pointer";
        div.children[0].addEventListener("click", () => showClientModal(c));

        // Deliver button
        div.querySelector(".deliverAllBtn")
            .addEventListener("click", () => confirmDeliverAll(cid, c));

        wrapper.appendChild(div);
    }
}

// ===========================================
// 🔎 Search Bar Filtering
// ===========================================
document.getElementById("searchInput").addEventListener("input", (e) => {
    const text = e.target.value.toLowerCase();
    const cards = document.querySelectorAll("#clientList .card");

    cards.forEach(card => {
        const content = card.innerText.toLowerCase();
        card.style.display = content.includes(text) ? "flex" : "none";
    });
});

// ===========================================
// 📦 Modal with Client Lotes
// ===========================================
function showClientModal(client) {
    const modal = document.getElementById("modalOverlay");
    document.getElementById("modalTitle").textContent =
        `${client.name} (${client.phone})`;

    let html = "";
    client.lotes.forEach(l => {
        html += `<div class="modal-box"> Lote ${l.id} — ${l.description}</div>`;
    });

    document.getElementById("modalContent").innerHTML = html;
    modal.classList.remove("hidden");
}

document.getElementById("modalClose").onclick = () =>
    document.getElementById("modalOverlay").classList.add("hidden");

// ===========================================
// 🚚 Deliver ALL lots for the client
// ===========================================
async function confirmDeliverAll(clientId, client) {
    openConfirmModal(
        "Confirmar Entrega?",
        `<div class="modal-box">
            Entregar <strong>${client.lotes.length}</strong> lote(s) para <strong>${client.name}</strong>?
        </div>`,
        () => actuallyDeliverAll(clientId, client)
    );

}

async function actuallyDeliverAll(clientId, client) {
    for (const lote of client.lotes) {
        const loteRef = doc(db, "lotes", lote.id);
        const snap = await getDoc(loteRef);
        if (!snap.exists()) continue;

        const data = snap.data();

        const info = extractSizeAndGender(data.description || "");
        if (info) {
            await decreaseSizeStock(info.gender, info.size);
        }

        const historyRef = doc(collection(db, "history"));
        await setDoc(historyRef, {
            lote: lote.id,
            description: data.description || "",
            trade: data.trade || "",
            client: clientId,
            deliveredAt: new Date()
        });

        await updateDoc(loteRef, {
            description: "",
            trade: "",
            assignedTo: null,
            delivered: false
        });
    }

    openInfoModal("Sucesso!", "Todos os lotes foram entregues!");
    loadPendingDeliveries();
}


// ===========================================
// INIT
// ===========================================
loadPendingDeliveries();
