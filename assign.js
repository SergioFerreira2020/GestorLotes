// assign.js
import { db, collection, getDocs, doc, updateDoc, getDoc, setDoc } from "./firebase.js";

const clientSelect = document.getElementById("clientSelect");
const loteSelect = document.getElementById("loteSelect");
const assignedSelect = document.getElementById("assignedSelect");

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
      - reset lote
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
        /* -----------------------------------------
           1️⃣ Extract size + gender BEFORE clearing
        ------------------------------------------ */
        const info = extractSizeAndGender(data.description || "");
        if (info) {
            await decreaseSizeStock(info.gender, info.size);
        }

        /* -----------------------------------------
           2️⃣ Save this lote in HISTORY
        ------------------------------------------ */
        const historyRef = doc(collection(db, "history"));
        await setDoc(historyRef, {
            lote: loteId,
            description: data.description || "",
            trade: data.trade || "",
            client: data.assignedTo || null,
            deliveredAt: new Date()
        });

        /* -----------------------------------------
           3️⃣ Reset Lote
        ------------------------------------------ */
        await updateDoc(loteRef, {
            description: "",
            trade: "",
            assignedTo: null,
            delivered: false
        });

        alert("Entrega confirmada! Stock atualizado e lote movido para o histórico.");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Erro ao confirmar entrega.");
    }
});
