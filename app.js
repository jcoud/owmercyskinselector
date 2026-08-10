(function () {
  "use strict";

  // data.js должен объявить глобальную переменную DATA = {
  //   skins: {referenceImage, items: [...]},
  //   weaponNames: {...},
  //   weaponColors: {...}
  // }
  const data = (typeof DATA !== "undefined") ? DATA : {
    skins: { referenceImage: null, items: [] },
    weaponNames: { referenceImage: null, items: [] },
    weaponColors: { referenceImage: null, items: [] },
  };

  const CATEGORIES = ["skins", "weaponNames", "weaponColors"];

  // Фирменные цвета для конкретных названий цветов оружия (регистронезависимо).
  // Применяются и к карточкам выбора, и к итоговому блоку конфигурации.
  const COLOR_HEX_MAP = {
    "GOLDEN": "#b39700",
    "JADE": "#00A36C",
    "GALACTIC": "#472E97",
    "CRIMSON WOLF": "#5e091a",
  };

  function getColorHex(name) {
    if (!name) return null;
    return COLOR_HEX_MAP[name.trim().toUpperCase()] || null;
  }

  /** Белый или чёрный текст поверх заданного hex-цвета — по относительной яркости. */
  function contrastTextColor(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return luminance > 0.45 ? "#14161d" : "#f4f5f8";
  }

  // текущий выбор по каждой категории: { skins: {name, image} | null, ... }
  const selection = {
    skins: null,
    weaponNames: null,
    weaponColors: null,
  };

  let userEditedOutput = false; // если человек сам поправил текст — не перетираем это при новом выборе

  const outputField = document.getElementById("outputField");
  const copyBtn = document.getElementById("copyBtn");
  const resetFormatBtn = document.getElementById("resetFormatBtn");
  const navButtons = Array.from(document.querySelectorAll(".tab"));

  function renderSection(category) {
    const bodyEl = document.getElementById(`body-${category}`);
    const categoryData = data[category] || { referenceImage: null, items: [] };
    const items = categoryData.items || [];
    bodyEl.innerHTML = "";

    if (categoryData.referenceImage) {
      const refWrap = document.createElement("div");
      refWrap.className = "reference-shot";
      const refImg = document.createElement("img");
      refImg.src = categoryData.referenceImage;
      refImg.alt = "Скриншот-подсказка";
      refWrap.appendChild(refImg);
      bodyEl.appendChild(refWrap);
    }

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "В этом разделе пока нет картинок.";
      bodyEl.appendChild(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "gallery__grid";

    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.setAttribute("role", "option");

      const isSelected = selection[category] && selection[category].name === item.name;
      if (isSelected) card.classList.add("is-selected");
      card.setAttribute("aria-selected", String(isSelected));

      const colorHex = getColorHex(item.name);

      if (item.image) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "card__image-wrap";
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.name;
        img.loading = "lazy";
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);
      } else {
        card.classList.add("card--text-only");
      }

      const nameEl = document.createElement("div");
      nameEl.className = "card__name";
      nameEl.textContent = item.name;
      nameEl.title = item.name;

      if (!item.image && colorHex) {
        card.style.background = colorHex;
        const textColor = contrastTextColor(colorHex);
        card.style.color = textColor;
        nameEl.style.color = textColor;
      }

      card.appendChild(nameEl);

      card.addEventListener("click", () => selectItem(category, item));

      grid.appendChild(card);
    });
    bodyEl.appendChild(grid);
  }

  function renderAllSections() {
    CATEGORIES.forEach(renderSection);
  }

  function selectItem(category, item) {
    // повторный клик по уже выбранному пункту снимает выбор
    if (selection[category] && selection[category].name === item.name) {
      selection[category] = null;
    } else {
      selection[category] = item;
    }
    userEditedOutput = false; // новый выбор — пересобираем текст автоматически
    renderSection(category);
    renderSelectionBar();
  }

  function renderSelectionBar() {
    CATEGORIES.forEach((cat) => {
      const item = selection[cat];
      const thumbEl = document.getElementById(`thumb-${cat}`);
      const valueEl = document.getElementById(`value-${cat}`);

      thumbEl.innerHTML = "";
      thumbEl.style.background = "";
      valueEl.style.color = "";

      if (item) {
        const colorHex = getColorHex(item.name);
        if (item.image) {
          const img = document.createElement("img");
          img.src = item.image;
          img.alt = "";
          thumbEl.appendChild(img);
          thumbEl.classList.remove("selection-slot__thumb--text");
        } else if (colorHex) {
          thumbEl.classList.remove("selection-slot__thumb--text");
          thumbEl.style.background = colorHex;
        } else {
          thumbEl.classList.add("selection-slot__thumb--text");
        }
        valueEl.textContent = item.name;
        if (colorHex) valueEl.style.color = colorHex;
      } else {
        thumbEl.classList.remove("selection-slot__thumb--text");
        valueEl.textContent = "—";
      }
    });

    // итоговый блок конфигурации подсвечивается цветом выбранного варианта оружия
    const colorHex = selection.weaponColors ? getColorHex(selection.weaponColors.name) : null;
    outputField.style.borderColor = colorHex || "";
    outputField.style.boxShadow = colorHex ? `0 0 0 1px ${colorHex}` : "";

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

  // ---------- Навигация: клик -> плавный переход к разделу ----------

  function scrollToSection(category) {
    const section = document.getElementById(`section-${category}`);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => scrollToSection(btn.dataset.category));
  });

  // ---------- Навигация: скроллспай — подсвечиваем раздел, который сейчас на экране ----------

  function setActiveNav(category) {
    navButtons.forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.dataset.category === category));
    });
  }

  function setupScrollSpy() {
    if (typeof IntersectionObserver === "undefined") {
      return; // старые браузеры — просто без подсветки, работоспособность не страдает
    }
    const sections = CATEGORIES.map((cat) => document.getElementById(`section-${cat}`)).filter(Boolean);
    const topbar = document.querySelector(".topbar");
    const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;

    const observer = new IntersectionObserver(
      (entries) => {
        // среди пересекающих зону наблюдения выбираем ту, что ближе всего к верху
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topCategory = visible[0].target.dataset.category;
        setActiveNav(topCategory);
      },
      {
        // узкая полоса чуть ниже липкого хэдера — раздел считается "активным",
        // когда его начало проходит через эту полосу
        rootMargin: `-${topbarHeight + 4}px 0px -70% 0px`,
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

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

  renderAllSections();
  renderSelectionBar();
  setupScrollSpy();
})();
