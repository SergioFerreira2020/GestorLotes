// assign.js
import {
    db,
    collection,
    getDocs,
    doc,
    updateDoc,
    getDoc,
    setDoc,
    deleteDoc
} from "./firebase.js";

/* ---------------------------------------------------
   DOM elements
--------------------------------------------------- */
const clientSelect = document.getElementById("clientSelect");
const loteSelect = document.getElementById("loteSelect");
const assignedSelect = document.getElementById("assignedSelect");

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

      // ----------------------------------------------------
    // 🔹 1) NORMALIZE LETTER SIZE RANGES (new feature)
    // ----------------------------------------------------
    size = size.replace(
        /\b(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\s*(?:[-/]|A)\s*(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL|8XL)\b/i,
        (m, a, b) => `${a.toUpperCase()}-${b.toUpperCase()}`
    );

    // ----------------------------------------------------
    // 🔹 2) NORMALIZE MONTH RANGES & SINGLE MONTHS
    // ----------------------------------------------------
    size = size.replace(
        /\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i,
        "$1-$2 MESES"
    ).replace(
        /\b(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i,
        "$1 MESES"
    );

    // ----------------------------------------------------
    // 🔹 3) NORMALIZE YEAR RANGES & SINGLE YEARS
    // ----------------------------------------------------
    size = size.replace(
        /\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(ANOS|A|Y)\b/i,
        "$1-$2 ANOS"
    ).replace(
        /\b(\d{1,2})\s*(ANOS|A|Y)\b/i,
        "$1 ANOS"
    );

    const gender = extractGender(text);
    const category = extractCategory(text);

    // Age type detection
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
   1. Load Clients
--------------------------------------------------- */
async function loadClients() {
    const snap = await getDocs(collection(db, "clients"));

    snap.forEach(docSnap => {
        const data = docSnap.data();

        const opt = document.createElement("option");
        opt.value = docSnap.id;
        opt.textContent = `${data.name} (${data.contact})`;
        clientSelect.appendChild(opt);
    });
}

/* ---------------------------------------------------
   2. Load LOTES (free + assigned)
--------------------------------------------------- */
async function loadLotes() {
    const snap = await getDocs(collection(db, "lotes"));

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const description = (data.description || "").trim();

        // Free lots
        if (description && !data.assignedTo) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = `Lote ${id} — ${description}`;
            loteSelect.appendChild(opt);
        }

        // Assigned lots
        if (data.assignedTo && !data.delivered) {
            const opt2 = document.createElement("option");
            opt2.value = id;
            opt2.textContent = `Lote ${id} — ${description}`;
            assignedSelect.appendChild(opt2);
        }
    });
}


// Initial load
loadClients();
loadLotes();

/* ---------------------------------------------------
   3. Assign lote to client
--------------------------------------------------- */
document.getElementById("assignForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const client = clientSelect.value;
    const lote = loteSelect.value;

    if (!client || !lote) return;

    try {
        await updateDoc(doc(db, "lotes", lote), {
            assignedTo: client,
            delivered: false
        });

        alert("Lote atribuído com sucesso!");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Erro ao atribuir lote.");
    }
});

/* ---------------------------------------------------
   4. Confirm lote delivery
      - subtract size stock
      - move record to history
      - delete lote
--------------------------------------------------- */
document.getElementById("deliverForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const loteId = assignedSelect.value;
    if (!loteId) return;

    const loteRef = doc(db, "lotes", loteId);
    const snap = await getDoc(loteRef);

    if (!snap.exists()) {
        alert("Erro: lote não encontrado.");
        return;
    }

    const data = snap.data();

    try {
        // Extract size for stock correction
        const info = extractSizeAndGender(data.description || "");
        if (info) {
            await decreaseSizeStock(info);
        }

        // 2️⃣ Save to history
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


        // Delete lote (no empty rows anymore)
        await deleteDoc(loteRef);

        alert("Entrega confirmada! Stock atualizado e lote movido para o histórico.");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Erro ao confirmar entrega.");
    }
});
