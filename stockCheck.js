// stockCheck.js
import { db, collection, getDocs } from "./firebase.js";
import { openInfoModal } from "./modal.js";

const LOW_STOCK_LIMIT = 4;

// Gender → Portuguese
const genderMap = {
    F: "senhora",
    M: "senhor",
    GIRL: "menina",
    BOY: "menino",
    BABY: "bebé",
    UNISEX: "unissexo"
};

// Type → Portuguese
const typeMap = {
    clothes: "roupa",
    shoes: "calçado",
    baby: "bebé",
    child: "criança"
};

async function checkLowStock() {
    const snap = await getDocs(collection(db, "sizes"));

    let alerts = [];

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const count = data.count || 0;

        if (count > LOW_STOCK_LIMIT) return;

        const key = docSnap.id;      // e.g. "BOY-4 MESES"
        const gender = data.gender;  // stored directly now
        const size = data.size;      // cleaner than splitting id
        const type = data.type || "clothes";

        alerts.push({
            gender,
            size,
            type,
            count
        });
    });

    if (alerts.length === 0) return;

    let html = "";

    for (const item of alerts) {

        const genderName = genderMap[item.gender] || item.gender.toLowerCase();
        const typeName = typeMap[item.type] || "roupa";
        const sizeLabel = item.size;

        html += `
            <div class="modal-box">
                <strong>${genderName} — ${typeName} — ${sizeLabel}</strong>: ${item.count} em stock
            </div>
        `;
    }

    openInfoModal("Stock baixo", html);
}

checkLowStock();
