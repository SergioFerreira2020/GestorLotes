// clients-delivery.js
import { 
    db, 
    collection, 
    getDocs, 
    getDoc,
    doc,
    updateDoc,
    setDoc,
    deleteDoc
} from "./firebase.js";

import { openInfoModal, openConfirmModal } from "./modal.js";

/* ---------------------------------------------------
   UNIFIED SIZE REGEX (matches lotes.js + assign.js)
--------------------------------------------------- */
const SIZE_REGEX = new RegExp(
    [
        // TAM / TAMANHO formats
        "\\b(?:tam(?:anho)?\\.?)[\\s:ºnº]*\\s*(?:\\d{1,2}|XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\\b",

        // CM RANGE
        "\\b\\d{1,3}\\s*(?:[-/]|a)\\s*\\d{1,3}\\s*cm\\b",

        // CM SINGLE
        "\\b\\d{1,3}\\s*cm\\b",

        // LETTER SIZES
        "\\b(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\\b",

        // MONTH RANGE
        "\\b\\d{1,2}\\s*(?:[-/]|a)\\s*\\d{1,2}\\s*(?:m|meses|mês|mes)\\b",

        // MONTH SINGLE
        "\\b\\d{1,2}\\s*(?:m|meses|mês|mes)\\b",

        // YEAR RANGE
        "\\b\\d{1,2}\\s*(?:[-/]|a)\\s*\\d{1,2}\\s*(?:anos|a|y)\\b",

        // YEAR SINGLE
        "\\b\\d{1,2}\\s*(?:anos|a|y)\\b",

        // ADULT NUMERIC (30–56)
        "\\b(?:3[0-9]|4[0-9]|5[0-6])\\b",

        // SHOES (10–59)
        "\\b(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])\\b"
    ].join("|"),
    "i"
);

/* ---------------------------------------------------
   Gender detector
--------------------------------------------------- */
function extractGender(desc) {
    desc = desc.toLowerCase();

    if (/senhora|mulher|feminino|\bf\b/.test(desc)) return "F";
    if (/senhor|homem|masculino|\bm\b/.test(desc)) return "M";
    if (/menina|rapariga/.test(desc)) return "GIRL";
    if (/menino|rapaz/.test(desc)) return "BOY";
    if (/bebé|bebe|baby|infantil/.test(desc)) return "BABY";

    return "UNISEX";
}

/* ---------------------------------------------------
   FULL EXTRACTOR (size, gender, type)
--------------------------------------------------- */
function extractSizeAndGender(description) {
    if (!description) return null;

    const text = description.toLowerCase();
    const match = text.match(SIZE_REGEX);
    if (!match) return null;

    let size = match[0].toUpperCase();

    // Normalization
    size = size
        .replace(/\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i, "$1-$2 MESES")
        .replace(/\b(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i, "$1 MESES")
        .replace(/\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(ANOS|A|Y)\b/i, "$1-$2 ANOS")
        .replace(/\b(\d{1,2})\s*(ANOS|A|Y)\b/i, "$1 ANOS");

    const gender = extractGender(text);

    // TYPE detection
    let type = "clothes";

    if (/(sapato|sapatilha|ténis|tenis|botas|chinelos)/i.test(text))
        type = "shoes";
    else if (/MESES/.test(size))
        type = "baby";
    else if (/ANOS/.test(size))
        type = "child";
    else if (/CM/.test(size))
        type = "cm";
    else {
        const num = parseInt(size);
        if (!isNaN(num) && num >= 10 && num <= 59) type = "shoes";
    }

    return { size: size.trim(), gender, type };
}

/* ---------------------------------------------------
   STOCK: Decrease TYPE–GENDER–SIZE
--------------------------------------------------- */
async function decreaseSizeStock(gender, size, type) {
    const key = `${type}-${gender}-${size}`;
    const ref = doc(db, "sizes", key);

    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const current = snap.data().count || 0;
    await updateDoc(ref, { count: Math.max(0, current - 1) });
}

/* ---------------------------------------------------
   LOAD pending lots grouped by clients
--------------------------------------------------- */
async function loadPendingDeliveries() {
    const clientList = document.getElementById("clientList");
    clientList.innerHTML = "";

    const clientSnap = await getDocs(collection(db, "clients"));
    const clients = {};

    clientSnap.forEach(c => {
        clients[c.id] = {
            name: c.data().name,
            phone: c.data().contact,
            lotes: []
        };
    });

    const lotesSnap = await getDocs(collection(db, "lotes"));

    lotesSnap.forEach(l => {
        const data = l.data();
        const id = l.id;

        if (data.assignedTo && !data.delivered) {
            clients[data.assignedTo]?.lotes.push({
                id,
                description: data.description || ""
            });
        }
    });

    renderClientCards(clients);
}

/* ---------------------------------------------------
   Render client cards
--------------------------------------------------- */
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
            <div style="cursor:pointer">
                <strong>${c.name}</strong> — <span style="color:#bbb">${c.phone}</span><br>
                ${c.lotes.length} lote(s) por entregar
            </div>

            <button class="deliverAllBtn" data-id="${cid}">
                Entregar Tudo
            </button>
        `;

        div.children[0].addEventListener("click", () => showClientModal(c));
        div.querySelector(".deliverAllBtn").addEventListener("click", () =>
            confirmDeliverAll(cid, c)
        );

        wrapper.appendChild(div);
    }
}

/* ---------------------------------------------------
   Search bar filter
--------------------------------------------------- */
document.getElementById("searchInput").addEventListener("input", (e) => {
    const text = e.target.value.toLowerCase();
    const cards = document.querySelectorAll("#clientList .card");

    cards.forEach(card => {
        const content = card.innerText.toLowerCase();
        card.style.display = content.includes(text) ? "flex" : "none";
    });
});

/* ---------------------------------------------------
   Modal with lotes for that client
--------------------------------------------------- */
function showClientModal(client) {
    document.getElementById("modalTitle").textContent =
        `${client.name} (${client.phone})`;

    document.getElementById("modalContent").innerHTML =
        client.lotes
            .map(l => `<div class="modal-box">Lote ${l.id} — ${l.description}</div>`)
            .join("");

    document.getElementById("modalOverlay").classList.remove("hidden");
}

document.getElementById("modalClose").onclick = () =>
    document.getElementById("modalOverlay").classList.add("hidden");

/* ---------------------------------------------------
   Confirm "Deliver ALL" modal
--------------------------------------------------- */
async function confirmDeliverAll(clientId, client) {
    openConfirmModal(
        "Confirmar Entrega?",
        `<div class="modal-box">
            Entregar <strong>${client.lotes.length}</strong> lote(s) para <strong>${client.name}</strong>?
        </div>`,
        () => actuallyDeliverAll(clientId, client)
    );
}

/* ---------------------------------------------------
   Deliver all lots from that client
--------------------------------------------------- */
async function actuallyDeliverAll(clientId, client) {

    for (const lote of client.lotes) {
        const loteRef = doc(db, "lotes", lote.id);
        const snap = await getDoc(loteRef);
        if (!snap.exists()) continue;

        const data = snap.data();

        // Extract size for stock update
        const info = extractSizeAndGender(data.description || "");
        if (info) {
            await decreaseSizeStock(info.gender, info.size, info.type);
        }

        // Move to history
        const historyRef = doc(collection(db, "history"));
        await setDoc(historyRef, {
            lote: lote.id,
            description: data.description || "",
            trade: data.trade || "",
            client: clientId,
            deliveredAt: new Date()
        });

        // DELETE the lote (new logic)
        await deleteDoc(loteRef);
    }

    openInfoModal("Sucesso!", "Todos os lotes foram entregues!");
    loadPendingDeliveries();
}

/* ---------------------------------------------------
   INIT
--------------------------------------------------- */
loadPendingDeliveries();
