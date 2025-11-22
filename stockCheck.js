// stockCheck.js
import { db, collection, getDocs } from "./firebase.js";
import { openInfoModal } from "./modal.js";

const LOW_STOCK_LIMIT = 4;

// Map gender code to Portuguese words
const genderMap = {
    F: "senhora",
    M: "senhor",
    GIRL: "menina",
    BOY: "menino",
    BABY: "bebé",
    UNISEX: "unissexo"
};

async function checkLowStock() {
    const snap = await getDocs(collection(db, "sizes"));

    let alerts = [];

    snap.forEach(docSnap => {
        const count = docSnap.data().count;
        const sizeKey = docSnap.id; // e.g. "GIRL-4-8 MESES"

        if (count <= LOW_STOCK_LIMIT) {
            alerts.push({ sizeKey, count });
        }
    });

    if (alerts.length === 0) return;

    let html = "";

    for (const alert of alerts) {

        const key = alert.sizeKey;

        // SAFE SPLIT
        const dashIndex = key.indexOf("-");
        let genderCode = key.substring(0, dashIndex);
        let size = key.substring(dashIndex + 1);

        // Map gender to Portuguese
        let genderName = genderMap[genderCode] || genderCode.toLowerCase();

        html += `
            <div class="modal-box">
                <strong>${genderName} — ${size}:</strong> ${alert.count} em stock
            </div>
        `;
    }

    openInfoModal("Tamanhos com Stock Baixo", html);
}

checkLowStock();
