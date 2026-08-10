(function () {
  "use strict";

  // data.js должен объявить глобальную переменную DATA = { skins: [...], weaponNames: [...], weaponColors: [...] }
  const data = (typeof DATA !== "undefined") ? DATA : { skins: [], weaponNames: [], weaponColors: [] };

  const CATEGORIES = ["skins", "weaponNames", "weaponColors"];
  const CATEGORY_LABELS = {
    skins: "Скин",
    weaponNames: "Оружие",
    weaponColors: "Цвет",
  };

  // текущий выбор по каждой категории: { skins: {name, image} | null, ... }
  const selection = {
    skins: null,
    weaponNames: null,
    weaponColors: null,
  };

  let activeCategory = "skins";
  let userEditedOutput = false; // если человек сам поправил текст — не перетираем это при новом выборе

  const galleryEl = document.getElementById("gallery");
  const emptyStateEl = document.getElementById("emptyState");
  const outputField = document.getElementById("outputField");
  const copyBtn = document.getElementById("copyBtn");
  const resetFormatBtn = document.getElementById("resetFormatBtn");
  const tabButtons = Array.from(document.querySelectorAll(".tab"));

  function renderGallery() {
    const category = data[activeCategory] || { referenceImage: null, items: [] };
    const items = category.items || [];
    galleryEl.innerHTML = "";

    // референс-скриншот сверху вкладки (если есть) — просто для наглядности,
    // не кликабельный и не влияет на выбор
    if (category.referenceImage) {
      const refWrap = document.createElement("div");
      refWrap.className = "reference-shot";
      const refImg = document.createElement("img");
      refImg.src = category.referenceImage;
      refImg.alt = "Скриншот-подсказка";
      refWrap.appendChild(refImg);
      galleryEl.appendChild(refWrap);
    }

    if (items.length === 0) {
      galleryEl.hidden = category.referenceImage ? false : true;
      emptyStateEl.hidden = !!category.referenceImage;
      return;
    }
    galleryEl.hidden = false;
    emptyStateEl.hidden = true;

    const grid = document.createElement("div");
    grid.className = "gallery__grid";

    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      if (!item.image) card.classList.add("card--text-only");
      card.setAttribute("role", "option");
      const isSelected = selection[activeCategory] && selection[activeCategory].name === item.name;
      if (isSelected) card.classList.add("is-selected");
      card.setAttribute("aria-selected", String(isSelected));

      if (item.image) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "card__image-wrap";
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.name;
        img.loading = "lazy";
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "card__name";
      nameEl.textContent = item.name;
      nameEl.title = item.name;
      card.appendChild(nameEl);

      card.addEventListener("click", () => selectItem(activeCategory, item));

      grid.appendChild(card);
    });
    galleryEl.appendChild(grid);
  }

  function selectItem(category, item) {
    // повторный клик по уже выбранному пункту снимает выбор
    if (selection[category] && selection[category].name === item.name) {
      selection[category] = null;
    } else {
      selection[category] = item;
    }
    userEditedOutput = false; // новый выбор — пересобираем текст автоматически
    renderGallery();
    renderSelectionBar();
  }

  function renderSelectionBar() {
    CATEGORIES.forEach((cat) => {
      const item = selection[cat];
      const thumbEl = document.getElementById(`thumb-${cat}`);
      const valueEl = document.getElementById(`value-${cat}`);

      thumbEl.innerHTML = "";
      if (item) {
        if (item.image) {
          const img = document.createElement("img");
          img.src = item.image;
          img.alt = "";
          thumbEl.appendChild(img);
          thumbEl.classList.remove("selection-slot__thumb--text");
        } else {
          thumbEl.classList.add("selection-slot__thumb--text");
        }
        valueEl.textContent = item.name;
      } else {
        thumbEl.classList.remove("selection-slot__thumb--text");
        valueEl.textContent = "—";
      }
    });

    if (!userEditedOutput) {
      outputField.value = composeOutputText();
    }
  }

  function composeOutputText() {
    // Формат по умолчанию: "Скин - Оружие (Цвет)".
    // Поле редактируемое — можно поправить вручную под свой формат,
    // а кнопка "Сбросить формат" вернёт именно этот шаблон.
    const parts = [];
    if (selection.skins) parts.push(selection.skins.name);
    if (selection.weaponNames) parts.push(selection.weaponNames.name);

    let text = parts.join(" - ");
    if (selection.weaponColors) {
      text = text ? `${text} (${selection.weaponColors.name})` : selection.weaponColors.name;
    }
    return text;
  }

  function switchTab(category) {
    activeCategory = category;
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.category === category;
      btn.setAttribute("aria-selected", String(isActive));
    });
    renderGallery();
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.category));
  });

  outputField.addEventListener("input", () => {
    userEditedOutput = true;
  });

  resetFormatBtn.addEventListener("click", () => {
    userEditedOutput = false;
    outputField.value = composeOutputText();
  });

  copyBtn.addEventListener("click", async () => {
    const text = outputField.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // запасной вариант для страниц без доступа к Clipboard API (например, http вместо https)
      outputField.select();
      document.execCommand("copy");
    }
    copyBtn.textContent = "Скопировано";
    copyBtn.classList.add("is-copied");
    setTimeout(() => {
      copyBtn.textContent = "Копировать";
      copyBtn.classList.remove("is-copied");
    }, 1200);
  });

  renderGallery();
  renderSelectionBar();
})();
