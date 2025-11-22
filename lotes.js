// lotes.js
import {
    db,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    collection
} from "./firebase.js";

const tbody = document.getElementById("itemsBody");

// How many lotes we support (easy to change later)
const MAX_LOTES = 400;

/* -----------------------------------------------------
   SIZE + GENDER DETECTION (same logic used everywhere)
----------------------------------------------------- */

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

// Increase size stock
async function increaseSizeStock(gender, size) {
    const key = `${gender}-${size}`;
    const ref = doc(db, "sizes", key);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        await setDoc(ref, {
            gender,
            size,
            count: 1
        });
    } else {
        await updateDoc(ref, {
            count: (snap.data().count || 0) + 1
        });
    }
}

// Decrease size stock
async function decreaseSizeStock(gender, size) {
    const key = `${gender}-${size}`;
    const ref = doc(db, "sizes", key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const current = snap.data().count || 0;
    const newVal = Math.max(0, current - 1);
    await updateDoc(ref, { count: newVal });
}

/* -----------------------------------------------------
   1. Generate 1..MAX_LOTES rows in the table
----------------------------------------------------- */
for (let i = 1; i <= MAX_LOTES; i++) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>${i}</td>
        <td><input data-id="${i}" data-field="description" type="text" placeholder="Descrição do lote ${i}"></td>
        <td><input data-id="${i}" data-field="trade" type="text" placeholder="O que a pessoa dá"></td>
    `;

    tbody.appendChild(tr);
}

/* -----------------------------------------------------
   2. Initialize lotes from Firestore
      - NO creation of empty docs
      - Fills only existing docs
      - Optional cleanup: delete docs with both fields empty
----------------------------------------------------- */
async function initializeLotes() {
    const snap = await getDocs(collection(db, "lotes"));

    snap.forEach(docSnap => {
        const idStr = docSnap.id;
        const data = docSnap.data() || {};

        const desc = (data.description || "").trim();
        const trade = (data.trade || "").trim();

        // Optional cleanup: if both empty, delete it and skip
        if (!desc && !trade) {
            deleteDoc(doc(db, "lotes", idStr)).catch(() => {});
            return;
        }

        const idNum = parseInt(idStr, 10);
        if (Number.isNaN(idNum) || idNum < 1 || idNum > MAX_LOTES) return;

        const descInput = document.querySelector(`input[data-id="${idNum}"][data-field="description"]`);
        const tradeInput = document.querySelector(`input[data-id="${idNum}"][data-field="trade"]`);

        if (!descInput || !tradeInput) return;

        descInput.value = data.description ?? "";
        tradeInput.value = data.trade ?? "";
    });

    console.log("Lotes carregados (somente existentes)!");
}

initializeLotes();

/* -----------------------------------------------------
   3. Save logic:
      - ENTER or blur
      - Updates/creates doc when something filled
      - Deletes doc when both description & trade empty
      - Handles stock only on description changes
----------------------------------------------------- */

async function saveLote(input) {
    if (!input.dataset.id) return;

    const id = input.dataset.id;
    const field = input.dataset.field;
    const newValue = input.value.trim();

    const loteRef = doc(db, "lotes", id);
    const snap = await getDoc(loteRef);
    const oldData = snap.exists() ? snap.data() : {};

    const prevDesc = oldData.description || "";
    const prevTrade = oldData.trade || "";

    // For stock logic: previous and new descriptions
    const oldDescription = prevDesc;
    const newDescription = field === "description" ? newValue : prevDesc;

    try {
        // --- STOCK LOGIC (only if description changed) ---
        if (field === "description") {
            const oldInfo = extractSizeAndGender(oldDescription);
            const newInfo = extractSizeAndGender(newDescription);

            const oldSize = oldInfo?.size || null;
            const oldGender = oldInfo?.gender || null;

            const newSize = newInfo?.size || null;
            const newGender = newInfo?.gender || null;

            // 1) Removed description → subtract old stock
            if (oldSize && !newSize) {
                await decreaseSizeStock(oldGender, oldSize);
            }

            // 2) Changed description (size and/or gender changed)
            if (oldSize && newSize && (oldSize !== newSize || oldGender !== newGender)) {
                await decreaseSizeStock(oldGender, oldSize);
                await increaseSizeStock(newGender, newSize);
            }

            // 3) Added a size where there was none
            if (!oldSize && newSize) {
                await increaseSizeStock(newGender, newSize);
            }
        }

        // --- Now decide if we keep or delete the doc ---

        // Calculate new final state of both fields
        const newDesc = field === "description" ? newValue : prevDesc;
        const newTrade = field === "trade" ? newValue : prevTrade;

        const bothEmpty = newDesc.trim() === "" && newTrade.trim() === "";

        if (bothEmpty) {
            // If both empty → delete the document (cleanup)
            if (snap.exists()) {
                await deleteDoc(loteRef);
            }
        } else {
            // Otherwise, upsert with merged fields
            await setDoc(
                loteRef,
                {
                    description: newDesc,
                    trade: newTrade
                },
                { merge: true }
            );
        }

        // Visual feedback
        input.style.borderColor = "#00ff62";
        setTimeout(() => (input.style.borderColor = ""), 350);

    } catch (err) {
        console.error("Erro ao guardar o lote:", err);
        alert("Erro ao guardar este lote.");
    }
}

/* Save on ENTER */
document.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        saveLote(e.target);
    }
});

/* Save on losing focus (blur) */
document.addEventListener("focusout", async (e) => {
    if (e.target.tagName === "INPUT" && e.target.dataset.id) {
        saveLote(e.target);
    }
});

/* -----------------------------------------------------
   4. SEARCHABLE HEADERS (#, Descrição, Troca)
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {

    const activeFilters = { 0: "", 1: "", 2: "" };

    function enableHeaderSearch(thElement, placeholder, columnIndex, widthOverride = null) {
        if (!thElement) return;

        thElement.style.cursor = "pointer";

        thElement.addEventListener("click", () => {

            if (thElement.querySelector("input")) return;

            const original = thElement.textContent;
            thElement.textContent = "";

            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = placeholder;
            input.value = activeFilters[columnIndex];

            input.style.width = widthOverride || "100%";
            input.style.padding = "4px 6px";
            input.style.background = "#222";
            input.style.border = "1px solid #444";
            input.style.color = "#fff";
            input.style.borderRadius = "4px";

            thElement.appendChild(input);
            input.focus();

            input.addEventListener("input", () => {
                activeFilters[columnIndex] = input.value.toLowerCase();
                filterTable();
            });

            function closeBox() {
                if (input.value.trim() !== "") return; // Keep open if there is text
                activeFilters[columnIndex] = "";
                thElement.textContent = original;
                filterTable();
            }

            input.addEventListener("blur", closeBox);

            input.addEventListener("keydown", e => {
                if (e.key === "Escape") {
                    input.value = "";
                    closeBox();
                }
            });
        });
    }

    function filterTable() {
        const rows = document.querySelectorAll("#itemsBody tr");

        rows.forEach(row => {
            let visible = true;

            for (let col = 0; col < 3; col++) {
                const filter = activeFilters[col];
                if (!filter) continue;

                const cell = row.children[col];
                if (!cell) continue;

                let content;

                // col 1 & 2 are inputs
                if (col === 1 || col === 2) {
                    const input = cell.querySelector("input");
                    content = input ? input.value.toLowerCase() : "";
                } else {
                    content = cell.innerText.toLowerCase();
                }

                if (!content.includes(filter)) {
                    visible = false;
                    break;
                }
            }

            row.style.display = visible ? "" : "none";
        });
    }

    enableHeaderSearch(document.getElementById("th-number"), "Nº...", 0, "80px");
    enableHeaderSearch(document.getElementById("th-desc"), "Descrição...", 1);
    enableHeaderSearch(document.getElementById("th-trade"), "Troca...", 2);

    // In case data arrives slightly later
    setTimeout(filterTable, 1000);
});
