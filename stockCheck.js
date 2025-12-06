// stockCheck.js
import { db, collection, getDocs } from "./firebase.js";
import { openInfoModal } from "./modal.js";

const LOW_STOCK_LIMIT = 4;

const genderMap = {
    F: "senhora",
    M: "senhor",
    GIRL: "menina",
    BOY: "menino",
    BABY: "bebé",
    UNISEX: "unissexo"
};

const typeMap = {
    baby: "bebé",
    child: "criança",
    clothes: "roupa",
    shoes: "calçado",
    cm: "centímetros",
    other: "outros"
};

async function checkLowStock() {
    const snap = await getDocs(collection(db, "sizes"));

    let alerts = [];

    snap.forEach(docSnap => {
        const count = docSnap.data().count;

        if (count <= LOW_STOCK_LIMIT) {
            alerts.push({
                key: docSnap.id,
                count
            });
        }
    });

    if (alerts.length === 0) return;

    let html = "";

    for (const alert of alerts) {
        const parts = alert.key.split("-");
        const type = parts[0];
        const genderCode = parts[1];
        const size = parts.slice(2).join("-");

        const genderName = genderMap[genderCode] || genderCode.toLowerCase();
        const typeName = typeMap[type] || type;

        html += `
            <div class="modal-box">
                <strong>${typeName} (${genderName}) — ${size}:</strong> ${alert.count} em stock
            </div>
        `;
    }

    openInfoModal("Tamanhos com Stock Baixo", html);
}

checkLowStock();
