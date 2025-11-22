// assign.js
import { db, collection, getDocs, doc, updateDoc, getDoc, setDoc } from "./firebase.js";

const clientSelect = document.getElementById("clientSelect");
const loteSelect = document.getElementById("loteSelect");
const assignedSelect = document.getElementById("assignedSelect");

/* ---------------------------------------------------
   UNIFIED SIZE + GENDER PARSER
   (matches lotes.js exactly)
--------------------------------------------------- */
// MASTER SIZE REGEX (handles most formats)
const SIZE_REGEX = new RegExp(
    "\\b(XXS|XS|S|M|L|XL|XXL|XXXL)\\b" + // letter sizes
    "|" +
    "\\b(\\d{1,2}\\s*[-/]\\s*\\d{1,2}\\s*(m|meses|mês|mes))\\b" + // 4-8 meses / 4/8m
    "|" +
    "\\b(\\d{1,2}\\s*(m|meses|mês|mes))\\b" + // 6 meses / 6m
    "|" +
    "\\b(\\d{1,2}\\s*[-/]\\s*\\d{1,2}\\s*(anos|a|y))\\b" + // 6-8 anos
    "|" +
    "\\b(\\d{1,2}\\s*(anos|a|y))\\b" + // 10 anos / 10y
    "|" +
    "\\b(3[4-9]|4[0-9]|5[0-6])\\b" + // adult numeric sizes 34–56
    "|" +
    "\\b(1[6-9]|2[0-9]|3[0-9]|4[0-6])\\b" + // shoe sizes 16–46
    "|" +
    "\\b(tam(anho)?\\.?)\\s*(\\d{1,2}|XXS|XS|S|M|L|XL|XXL|XXXL)\\b", // TAM / TAMANHO
    "i"
);

// Gender detector
function extractGender(desc) {
    desc = desc.toLowerCase();

    if (/senhora|mulher|feminino|\bf\b/.test(desc)) return "F";
    if (/senhor|homem|masculino|\bm\b/.test(desc)) return "M";
    if (/menina|rapariga/.test(desc)) return "GIRL";
    if (/menino|rapaz/.test(desc)) return "BOY";
    if (/bebé|bebe|baby|infantil/.test(desc)) return "BABY";

    return "UNISEX";
}

// Full extractor: size + gender + normalization
function extractSizeAndGender(description) {
    if (!description) return null;

    const text = description.toLowerCase();

    const match = text.match(SIZE_REGEX);
    if (!match) return null;

    let size = match[0].toUpperCase();

    // Normalize month ranges (4-8m → 4-8 MESES, 4/8m → 4-8 MESES)
    size = size.replace(
        /\b(\d{1,2})\s*[-/]\s*(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i,
        "$1-$2 MESES"
    );

    // Normalize single months (6m → 6 MESES)
    size = size.replace(
        /\b(\d{1,2})\s*(M|MESES|MÊS|MES)\b/i,
        "$1 MESES"
    );

    // Normalize year ranges (6-8a / 6-8y → 6-8 ANOS)
    size = size.replace(
        /\b(\d{1,2})\s*[-/]\s*(\d{1,2})\s*(ANOS|A|Y)\b/i,
        "$1-$2 ANOS"
    );

    // Normalize single years (10a / 10y → 10 ANOS)
    size = size.replace(
        /\b(\d{1,2})\s*(ANOS|A|Y)\b/i,
        "$1 ANOS"
    );

    const gender = extractGender(text);

    return { size: size.trim(), gender };
}


/* ---------------------------------------------------
   FIRESTORE STOCK OPERATIONS
--------------------------------------------------- */
async function decreaseSizeStock(gender, size) {
    const key = `${gender}-${size}`;
    const ref = doc(db, "sizes", key);

    const snap = await getDoc(ref);
    if (!snap.exists()) return; // nothing to decrease

    const current = snap.data().count || 0;
    const newValue = Math.max(0, current - 1);

    await updateDoc(ref, { count: newValue });
}

/* ---------------------------------------------------
   1. Load Clients into dropdown
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

        // Free lots (not assigned + has description)
        if (description !== "" && !data.assignedTo) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = `${id} — ${description}`;
            loteSelect.appendChild(opt);
        }

        // Assigned but not delivered yet
        if (data.assignedTo && !data.delivered) {
            const opt2 = document.createElement("option");
            opt2.value = id;

            // FIXED: show the actual lote description
            opt2.textContent = `lote ${id} — ${description}`;

            assignedSelect.appendChild(opt2);
        }
    });
}


// Initial load
loadClients();
loadLotes();

/* ---------------------------------------------------
   3. Assign lote to a client
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
        // 1️⃣ Extract size BEFORE deleting
        const info = extractSizeAndGender(data.description || "");
        if (info) {
            await decreaseSizeStock(info.gender, info.size);
        }

        // 2️⃣ Save to history
        const historyRef = doc(collection(db, "history"));
        await setDoc(historyRef, {
            lote: loteId,
            description: data.description || "",
            trade: data.trade || "",
            client: data.assignedTo || null,
            deliveredAt: new Date()
        });

        // 3️⃣ Delete lote instead of clearing it
        await deleteDoc(loteRef);

        alert("Entrega confirmada! Stock atualizado e lote movido para o histórico.");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Erro ao confirmar entrega.");
    }
});

