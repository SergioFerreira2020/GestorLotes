// lotes.js
import { db, doc, setDoc, getDoc } from "./firebase.js";

const tbody = document.getElementById("itemsBody");

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
            count: snap.data().count + 1
        });
    }
}

/* -----------------------------------------------------
   1. Generate 400 rows in the HTML table
----------------------------------------------------- */
for (let i = 1; i <= 400; i++) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>${i}</td>
        <td><input data-id="${i}" data-field="description" type="text" placeholder="Descrição do lote ${i}"></td>
        <td><input data-id="${i}" data-field="trade" type="text" placeholder="O que a pessoa dá"></td>
    `;

    tbody.appendChild(tr);
}

/* -----------------------------------------------------
   2. Initialize lotes in Firestore
   - Creates lote1, lote2, ..., lote400 if they do NOT exist
   - Loads existing data into the table
----------------------------------------------------- */
async function initializeLotes() {
    for (let i = 1; i <= 400; i++) {
        const loteId = `${i}`;
        const loteRef = doc(db, "lotes", loteId);

        try {
            const snap = await getDoc(loteRef);

            if (!snap.exists()) {
                // Create empty lote
                await setDoc(loteRef, {
                    description: "",
                    trade: ""
                });
            } else {
                // Load existing data into the inputs
                const data = snap.data();

                document.querySelector(`input[data-id="${i}"][data-field="description"]`).value =
                    data.description ?? "";

                document.querySelector(`input[data-id="${i}"][data-field="trade"]`).value =
                    data.trade ?? "";
            }

        } catch (err) {
            console.error(`Erro ao carregar lote ${i}:`, err);
        }
    }

    console.log("Lotes carregados!");
}

initializeLotes();

/* -----------------------------------------------------
   3. Auto-save when:
      - user presses ENTER
      - user leaves the field (blur)
----------------------------------------------------- */

async function saveLote(input) {
    if (!input.dataset.id) return;

    const id = input.dataset.id;
    const field = input.dataset.field;
    const newValue = input.value.trim();

    const loteRef = doc(db, "lotes", `${id}`);
    const snap = await getDoc(loteRef);
    const oldData = snap.data() || {};

    const oldValue = oldData[field] || "";

    try {
        // Update lote in Firestore
        await setDoc(loteRef, { [field]: newValue }, { merge: true });

        // Only run stock logic for description
        if (field === "description") {

            const oldInfo = extractSizeAndGender(oldValue);
            const newInfo = extractSizeAndGender(newValue);

            const oldSize = oldInfo?.size || null;
            const oldGender = oldInfo?.gender || null;

            const newSize = newInfo?.size || null;
            const newGender = newInfo?.gender || null;

            // CASE 1: Removed description → subtract old size
            if (oldSize && !newSize) {
                await decreaseSizeStock(oldGender, oldSize);
            }

            // CASE 2: Changed size or gender
            if (oldSize && newSize && (oldSize !== newSize || oldGender !== newGender)) {
                await decreaseSizeStock(oldGender, oldSize);
                await increaseSizeStock(newGender, newSize);
            }

            // CASE 3: Added new size where there was none
            if (!oldSize && newSize) {
                await increaseSizeStock(newGender, newSize);
            }
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
    // Make sure the blurred element is one of our inputs
    if (e.target.tagName === "INPUT" && e.target.dataset.id) {
        saveLote(e.target);
    }
});



// ================================================
// SEARCHABLE TABLE HEADERS (with persistent filter)
// ================================================
document.addEventListener("DOMContentLoaded", () => {

    const activeFilters = { 0: "", 1: "", 2: "" };

    function enableHeaderSearch(thElement, placeholder, columnIndex, widthOverride = null) {
        if (!thElement) return;

        thElement.style.cursor = "pointer";

        thElement.addEventListener("click", () => {

            if (thElement.querySelector("input")) return;

            const original = thElement.textContent;
            thElement.dataset.original = original;
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

            // FILTERING PER COLUMN
            input.addEventListener("input", () => {
                activeFilters[columnIndex] = input.value.toLowerCase();
                filterTable();
            });

            function closeBox() {
                if (input.value.trim() !== "") return; // KEEP OPEN IF TYPED

                activeFilters[columnIndex] = "";
                thElement.textContent = original;
                thElement.style.fontSize = "";
                thElement.style.opacity = "";
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

    // APPLY ALL FILTERS
    function filterTable() {
        const rows = document.querySelectorAll("#itemsBody tr");

        rows.forEach(row => {
            let visible = true;

            // loop through the 3 columns
            for (let col = 0; col < 3; col++) {
                const filter = activeFilters[col];
                if (!filter) continue;

                const cell = row.children[col].innerText.toLowerCase();
                if (!cell.includes(filter)) {
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

    setTimeout(filterTable, 1000);
});
