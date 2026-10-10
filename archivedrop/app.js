import { Archive } from "./libarchive.js";

const i18n = {
  it: {
    title: "Estrai ZIP, RAR e 7z",
    subtitle: "Estrai e condividi file in modo privato, direttamente dal browser.",
    dropText: "Scegli un archivio o trascinalo qui",
    dropSubtext: "Supporta ZIP / RAR / 7Z (anche con password)",
    password: "Password (se richiesta)",
    start: "Avvia estrazione",
    waiting: "In attesa...",
    extracting: "Estrazione in corso...",
    files: "File estratti",
    download: "Scarica",
    share: "Condividi",
    downloadAll: "Scarica tutti",
    shareAll: "Condividi tutti",
    reset: "Apri un altro archivio",
    search: "Cerca file..."
  },
  en: {
    title: "Extract ZIP, RAR and 7z",
    subtitle: "Archives are opened on this device. Nothing is uploaded.",
    dropText: "Choose an archive or drag it here",
    dropSubtext: "Supports ZIP / RAR / 7Z (with password)",
    password: "Password (if required)",
    start: "Start extraction",
    waiting: "Waiting...",
    extracting: "Extracting...",
    files: "Extracted files",
    download: "Download",
    share: "Share",
    downloadAll: "Download all",
    shareAll: "Share all",
    reset: "Open another archive",
    search: "Search files..."
  }
};

const isItalian = navigator.language?.toLowerCase().startsWith("it");
const t = isItalian ? i18n.it : i18n.en;

document.getElementById("title").textContent = t.title;
document.getElementById("subtitle").textContent = t.subtitle;
document.getElementById("drop-text").textContent = t.dropText;
document.getElementById("drop-subtext").textContent = t.dropSubtext;
document.getElementById("password-label").textContent = t.password;
document.getElementById("start-btn").textContent = t.start;
document.getElementById("progress-text").textContent = t.waiting;
document.getElementById("files-title").textContent = t.files;
document.getElementById("download-all").textContent = t.downloadAll;
document.getElementById("share-all").textContent = t.shareAll;
document.getElementById("reset-btn").textContent = t.reset;
document.getElementById("search-input").placeholder = t.search;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const progressSection = document.getElementById("progress-section");
const uploadSection = document.getElementById("upload-section");
const tableSection = document.getElementById("table-section");
const startBtn = document.getElementById("start-btn");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const passwordInput = document.getElementById("password-input");
const fileTable = document.getElementById("file-table");
const filesCount = document.getElementById("files-count");
const searchInput = document.getElementById("search-input");
const treeView = document.getElementById("tree-view");

const modal = document.getElementById("image-modal");
const modalImage = document.getElementById("modal-image");
const modalCaption = document.getElementById("modal-caption");
document.getElementById("modal-close").onclick = () => modal.classList.add("hidden");
modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };

let selectedFile = null;
let extractedFiles = [];
let filteredFiles = [];

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  selectedFile = file;
  uploadSection.classList.add("hidden");
  progressSection.classList.remove("hidden");
  progressText.textContent = t.waiting;
}

const passwordForm = document.getElementById("password-form");

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedFile) return;
  progressText.textContent = t.extracting;
  progressBar.style.width = "20%";

  try {
    const password = passwordInput.value || undefined;
    const arrayBuffer = await selectedFile.arrayBuffer();

    progressBar.style.width = "40%";

    await Archive.init({
      wasmUrl: "./libarchive.wasm",
      workerUrl: "./worker-bundle.js"
    });
    progressBar.style.width = "60%";

    const archive = await Archive.open(selectedFile, { password });

    let files = [];

    if (typeof archive.extractFiles === "function") {
      const extracted = await archive.extractFiles();

      // Caso A: array di entry
      if (Array.isArray(extracted)) {
        for (const item of extracted) {
          const data = item.file || item.data || item.content || item;
          const name = item.path || item.name || item.filename || "file";
          if (data) {
            files.push({ name, blob: new Blob([data]) });
          }
        }
      }

      // Caso B: object { "path/file": Uint8Array }
      if (!files.length && extracted && typeof extracted === "object") {
        for (const [name, data] of Object.entries(extracted)) {
          if (data) {
            files.push({ name, blob: new Blob([data]) });
          }
        }
      }
    } else if (typeof archive.getFilesArray === "function") {
      const entries = await archive.getFilesArray();
      for (const entry of entries) {
        if (typeof entry.readData !== "function") continue;
        const content = await entry.readData();
        files.push({
          name: entry.pathname || entry.path || entry.filename || "file",
          blob: new Blob([content]),
        });
      }
    }

    if (!files.length) {
      progressText.textContent = "Nessun file trovato: formato non supportato o libreria non compatibile.";
      return;
    }

    extractedFiles = files;
    filteredFiles = files;

    renderTree(files);
    renderTable(files);

    progressBar.style.width = "100%";
    progressSection.classList.add("hidden");
    tableSection.classList.remove("hidden");
  } catch (err) {
    progressText.textContent = "Errore: " + err.message;
  }
});

searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();
  filteredFiles = extractedFiles.filter(f => f.name.toLowerCase().includes(q));
  renderTree(filteredFiles);
  renderTable(filteredFiles);
});

async function normalizeEntries(archiveOrEntries) {
  if (Array.isArray(archiveOrEntries)) return archiveOrEntries;

  if (archiveOrEntries?.getFilesArray) {
    const entries = await archiveOrEntries.getFilesArray();
    if (entries?.length) return entries;
  }

  if (Array.isArray(archiveOrEntries?.files)) return archiveOrEntries.files;
  if (Array.isArray(archiveOrEntries?.entries)) return archiveOrEntries.entries;

  return [];
}

function renderTree(files) {
  treeView.innerHTML = "";
  const tree = buildTree(files);

  for (const node of Object.values(tree)) {
    if (!node.isFile) {
      treeView.appendChild(renderNode(node));
    }
  }
}

function buildTree(files) {
  const root = {};
  for (const file of files) {
    const parts = file.name.split("/");
    let current = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      current[part] = current[part] || { name: part, children: {}, files: [], isFile };
      if (isFile) current[part].files.push(file);
      current = current[part].children;
    });
  }
  return root;
}

function renderNode(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";

  const label = document.createElement("div");
  label.className = "label";
  label.innerHTML = `<i class="fa-solid fa-folder"></i><span>${node.name}</span>`;
  wrapper.appendChild(label);

  const children = document.createElement("div");
  children.className = "tree-children";

  for (const child of Object.values(node.children)) {
    if (!child.isFile) {
      children.appendChild(renderNode(child));
    }
  }

  if (children.childElementCount) {
    wrapper.appendChild(children);
    label.onclick = () => wrapper.classList.toggle("collapsed");
  }

  return wrapper;
}

function renderTable(files) {
  fileTable.innerHTML = "";
  filesCount.textContent = files.length.toString();

  for (const file of files) {
    const row = document.createElement("div");
    row.className = "file-row";

    const left = document.createElement("div");
    left.className = "file-name";

    const icon = document.createElement("i");
    icon.className = getIconByExt(file.name);

    const info = document.createElement("div");
    const main = document.createElement("span");
    main.className = "main";
    main.textContent = file.name.split("/").pop();

    const path = document.createElement("span");
    path.className = "path";
    const folderPath = file.name.includes("/") ? file.name.split("/").slice(0, -1).join("/") : "";
    path.textContent = folderPath ? `/${folderPath}/` : "";

    info.appendChild(main);
    info.appendChild(path);

    left.appendChild(icon);
    if (isImage(file.name)) {
      const img = document.createElement("img");
      img.className = "file-preview";
      img.src = URL.createObjectURL(file.blob);
      img.onclick = () => openModal(img.src, file.name);
      left.appendChild(img);
    }
    left.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "btn primary";
    downloadBtn.textContent = t.download;
    downloadBtn.onclick = () => downloadFile(file);

    const shareBtn = document.createElement("button");
    shareBtn.className = "btn warn";
    shareBtn.textContent = t.share;
    shareBtn.onclick = () => shareFile(file);

    actions.appendChild(downloadBtn);
    actions.appendChild(shareBtn);

    row.appendChild(left);
    row.appendChild(actions);
    fileTable.appendChild(row);
  }
}

function openModal(src, name) {
  modalImage.src = src;
  modalCaption.textContent = name;
  modal.classList.remove("hidden");
}

function isImage(filename) {
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(filename);
}

function getIconByExt(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const map = {
    pdf: "fa-solid fa-file-pdf",
    doc: "fa-solid fa-file-word",
    docx: "fa-solid fa-file-word",
    ppt: "fa-solid fa-file-powerpoint",
    pptx: "fa-solid fa-file-powerpoint",
    xls: "fa-solid fa-file-excel",
    xlsx: "fa-solid fa-file-excel",
    mp3: "fa-solid fa-file-audio",
    wav: "fa-solid fa-file-audio",
    mp4: "fa-solid fa-file-video",
    jpg: "fa-solid fa-file-image",
    jpeg: "fa-solid fa-file-image",
    png: "fa-solid fa-file-image",
    txt: "fa-solid fa-file-lines"
  };
  return map[ext] || "fa-solid fa-file";
}

function downloadFile(file) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name.split("/").pop();
  a.click();
  URL.revokeObjectURL(url);
}

async function shareFile(file) {
  if (!navigator.share) {
    alert("Condivisione non supportata su questo browser.");
    return;
  }
  const shareFile = new File([file.blob], file.name.split("/").pop(), { type: file.blob.type || "application/octet-stream" });
  await navigator.share({
    files: [shareFile],
    title: file.name
  });
}

document.getElementById("download-all").addEventListener("click", async () => {
  for (const file of extractedFiles) {
    downloadFile(file);
    await waitForUser(400);
  }
});

document.getElementById("share-all").addEventListener("click", async () => {
  if (!navigator.share) {
    alert("Condivisione non supportata su questo browser.");
    return;
  }
  for (const file of extractedFiles) {
    await shareFile(file);
    await waitForUser(400);
  }
});

document.getElementById("reset-btn").addEventListener("click", () => {
  selectedFile = null;
  extractedFiles = [];
  filteredFiles = [];
  fileInput.value = "";
  uploadSection.classList.remove("hidden");
  progressSection.classList.add("hidden");
  tableSection.classList.add("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = t.waiting;
});

function waitForUser(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}