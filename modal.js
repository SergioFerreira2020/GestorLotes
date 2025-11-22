export function openInfoModal(title, htmlContent) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalContent").innerHTML = htmlContent;

    document.getElementById("modalClose").classList.remove("hidden");
    document.getElementById("modalConfirm").classList.add("hidden");
    document.getElementById("modalCancel").classList.add("hidden");

    document.getElementById("modalOverlay").classList.remove("hidden");
}

export function openConfirmModal(title, htmlContent, onConfirm) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalContent").innerHTML = htmlContent;

    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");

    confirmBtn.classList.remove("hidden");
    cancelBtn.classList.remove("hidden");
    document.getElementById("modalClose").classList.add("hidden");

    // Remove old listeners
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));

    // Re-select
    const newConfirmBtn = document.getElementById("modalConfirm");
    const newCancelBtn = document.getElementById("modalCancel");

    newConfirmBtn.addEventListener("click", () => {
        closeModal();
        onConfirm();
    });

    newCancelBtn.addEventListener("click", closeModal);

    document.getElementById("modalOverlay").classList.remove("hidden");
}

export function closeModal() {
    document.getElementById("modalOverlay").classList.add("hidden");
}

document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target.id === "modalOverlay") closeModal();
});

document.getElementById("modalClose").addEventListener("click", closeModal);


