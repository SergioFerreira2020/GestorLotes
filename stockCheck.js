// stockCheck.js
import { db, collection, getDocs } from "./firebase.js";
import { openInfoModal } from "./modal.js";

const LOW_STOCK_LIMIT = 4;

/* -------------------------------
   TRANSLATION MAPS
--------------------------------*/

// Gender → Portuguese
const genderMap = {
    F: "senhora",
    M: "senhor",
    GIRL: "menina",
    BOY: "menino",
    BABY: "bebé",
    UNISEX: "unissexo"
};

// Age type → Portuguese
const ageTypeMap = {
    baby: "bebé",
    child: "criança",
    clothes: "adulto",
    shoes: "calçado"
};

// Category → Portuguese
const categoryMap = {
    sweater: "camisola",
    jacket: "casaco",
    trousers: "calças",
    tshirt: "t-shirt",
    dress: "vestido",
    skirt: "saia",
    babygrow: "babygrow",
    socks: "meias",
    shoes: "calçado",
    clothes: "roupa"
};

/* -------------------------------
   MAIN CHECKER
--------------------------------*/
async function checkLowStock() {
    const snap = await getDocs(collection(db, "sizes"));

    let alerts = [];

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const count = data.count || 0;

        if (count > LOW_STOCK_LIMIT) return;

        alerts.push({
            gender: data.gender,
            size: data.size,
            ageType: data.ageType || "clothes",
            category: data.category || "clothes",
            count
        });
    });

    if (alerts.length === 0) return;

    let itemsHtml = "";

    for (const item of alerts) {

        const genderName = genderMap[item.gender] || item.gender.toLowerCase();
        const ageName = ageTypeMap[item.ageType] || "adulto";
        const categoryName = categoryMap[item.category] || "roupa";
        const sizeLabel = item.size;

       itemsHtml += `
            <div class="modal-box">
                <strong>${genderName} — ${categoryName} (${ageName}) — ${sizeLabel}</strong>:
                ${item.count} em stock
            </div>
        `;
    }
    const html = `
        <div class="stock-scroll">
            ${itemsHtml}
        </div>
    `;

    openInfoModal("Tamanhos com stock baixo", html);
}

checkLowStock();
