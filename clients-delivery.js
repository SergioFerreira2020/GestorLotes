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

/* -----------------------------------------------------
   SIZE + GENDER + AGE TYPE + CATEGORY SYSTEM (FINAL)
----------------------------------------------------- */

const SIZE_REGEX = new RegExp(
    [
        // TAM / TAMANHO
        "\\b(?:tam(?:anho)?\\.?)[\\s:ºnº]*\\s*(?:\\d{1,2}|XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\\b",

        // LETTER SIZE RANGES (XS-M, L/XL, S a M, etc.)
        "\\b(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\\s*(?:[-/]|a)\\s*(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\\b",

        // MONTH RANGE MUST BE FIRST BEFORE NUMERIC MATCHES
        "\\b\\d{1,2}\\s*(?:[-/]|a)\\s*\\d{1,2}\\s*(?:m|meses|mês|mes)\\b",

        // SINGLE MONTH
        "\\b\\d{1,2}\\s*(?:m|meses|mês|mes)\\b",

        // YEAR RANGE
        "\\b\\d{1,2}\\s*(?:[-/]|a)\\s*\\d{1,2}\\s*(?:anos|a|y)\\b",

        // SINGLE YEAR
        "\\b\\d{1,2}\\s*(?:anos|a|y)\\b",

        // CM RANGE
        "\\b\\d{1,3}\\s*(?:[-/]|a)\\s*\\d{1,3}\\s*cm\\b",

        // CM SINGLE
        "\\b\\d{1,3}\\s*cm\\b",

        // LETTER SIZES (single)
        "\\b(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\\b",

        // NUMERIC (shoes or adult)
        "\\b(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])\\b"
    ].join("|"),
    "i"
);

/* ---------------- GENDER ---------------- */
function extractGender(desc) {
    desc = desc.toLowerCase();

    if (/senhora|mulher|feminino|\bf\b/.test(desc)) return "F";
    if (/senhor|homem|masculino|\bm\b/.test(desc)) return "M";

    if (/menina|rapariga/.test(desc)) return "GIRL";
    if (/menino|rapaz/.test(desc)) return "BOY";

    if (/bebé|bebe|baby|infantil/.test(desc)) return "BABY";

    return "UNISEX";
}

/* ---------------- CATEGORY ---------------- */
function extractCategory(text) {
    if (/camisola|suéter|sweater|pulôver/i.test(text)) return "sweater";
    if (/casaco|blusão|agasalho/i.test(text)) return "jacket";
    if (/calça|pants|trousers/i.test(text)) return "trousers";
    if (/t[- ]?shirt|camiseta/i.test(text)) return "tshirt";
    if (/vestido/i.test(text)) return "dress";
    if (/saia/i.test(text)) return "skirt";
    if (/body|babygrow/i.test(text)) return "babygrow";
    if (/meias|socks/i.test(text)) return "socks";

    // shoes
    if (/sapato|sapatilha|ténis|tenis|bota|sandália/i.test(text)) return "shoes";

    return "clothes"; // fallback
}

/* ---------------- SIZE + TYPE EXTRACTION ---------------- */
function extractSizeAndGender(description) {
    if (!description) return null;

    const text = description.toLowerCase();
    const match = text.match(SIZE_REGEX);

    if (!match) return null;

    let size = match[0].toUpperCase();   // <-- SIZE IS DEFINED HERE ✔

    /* ------------------------------------------
       NORMALIZE MONTHS
    ------------------------------------------ */
    size = size
        .replace(/\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i,
                 "$1-$2 MESES")
        .replace(/\b(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i,
                 "$1 MESES");

    /* ------------------------------------------
       NORMALIZE YEARS
    ------------------------------------------ */
    size = size
        .replace(/\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(ANOS|A|Y)\b/i,
                 "$1-$2 ANOS")
        .replace(/\b(\d{1,2})\s*(ANOS|A|Y)\b/i,
                 "$1 ANOS");

    /* ------------------------------------------
       NORMALIZE LETTER-SIZE RANGES  (NEW!)
       - XS/M    → XS-M
       - S a L   → S-L
       - L-XXL   → L-XXL  (unchanged)
    ------------------------------------------ */
    size = size
        .replace(/\b(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)\s*(?:[-/]|A)\s*(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)\b/gi,
                 (full, a, b) => `${a.toUpperCase()}-${b.toUpperCase()}`);

    const gender = extractGender(text);
    const category = extractCategory(text);

    /* ------------------------------------------
       AGE TYPE DETECTION
    ------------------------------------------ */
    let ageType = "clothes";

    if (/MESES/.test(size)) ageType = "baby";
    else if (/ANOS/.test(size)) ageType = "child";
    else if (/CM/.test(size)) ageType = "baby";
    else {
        const n = parseInt(size);
        if (!isNaN(n) && n >= 16 && n <= 59) ageType = "shoes";
    }

    return {
        size: size.trim(),
        gender,
        ageType,
        category
    };
}



/* ---------------------------------------------------
   Stock operations using TYPE-GENDER-SIZE
--------------------------------------------------- */
async function decreaseSizeStock(info) {
    if (!info) return;

    const key = `${info.gender}-${info.size}`;
    const ref = doc(db, "sizes", key);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const current = snap.data().count || 0;
    const newVal = Math.max(0, current - 1);

    await updateDoc(ref, { count: newVal });
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
            .map(l => `
                <div class="modal-box lote-line">
                    <span>Lote ${l.id} — ${l.description}</span>

                    <button
                        class="removeReservationBtn"
                        data-lote-id="${l.id}"
                    >
                        Remover reserva
                    </button>
                </div>
            `)
            .join("");

    document.getElementById("modalOverlay").classList.remove("hidden");

    bindRemoveReservationButtons();
}


function bindRemoveReservationButtons() {
    document.querySelectorAll(".removeReservationBtn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation(); // don’t close modal

            const loteId = btn.dataset.loteId;
            if (!loteId) return;

            openConfirmModal(
                "Remover reserva?",
                `<div class="modal-box">
                    Remover a reserva do lote <strong>${loteId}</strong>?
                </div>`,
                async () => {
                    await removeReservation(loteId);
                }
            );
        });
    });
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
            await decreaseSizeStock(info);

        }

        // Move to history
        const historyRef = doc(collection(db, "history"));
        await setDoc(historyRef, {
            lote: lote.id,
            description: data.description || "",
            trade: data.trade || "",
            client: clientId,
            deliveredAt: new Date(),
            category: info?.category || null,
            ageType: info?.ageType || null
        });


        // DELETE the lote (new logic)
        await deleteDoc(loteRef);
    }

    openInfoModal("Sucesso!", "Todos os lotes foram entregues!");
    loadPendingDeliveries();
}


async function removeReservation(loteId) {
    try {
        await updateDoc(doc(db, "lotes", loteId), {
            assignedTo: null,
            delivered: false
        });

        openInfoModal("Reserva removida", "O lote voltou a ficar disponível.");

        document.getElementById("modalOverlay").classList.add("hidden");
        loadPendingDeliveries();

    } catch (err) {
        console.error(err);
        openInfoModal("Erro", "Não foi possível remover a reserva.");
    }
}






/* ---------------------------------------------------
   INIT
--------------------------------------------------- */
loadPendingDeliveries();
