(function () {
  "use strict";

  const PREFECTURES = [
    "北海道",
    "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県", "三重県",
    "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
    "沖縄県"
  ];
  const OVERSEAS_LABEL = "海外";

  function extractPrefecture(hq) {
    if (!hq) return OVERSEAS_LABEL;
    for (const pref of PREFECTURES) {
      if (hq.startsWith(pref)) return pref;
    }
    // 「仙台市...」のように都道府県名を省略している住所を市名から補完
    const cityToPref = {
      "仙台市": "宮城県",
      "盛岡市": "岩手県"
    };
    for (const city in cityToPref) {
      if (hq.startsWith(city)) return cityToPref[city];
    }
    return OVERSEAS_LABEL;
  }

  // 英語表記の社名（"JRE Ventures Pte. Ltd." 等）から頭字語を生成する。
  // 全て大文字の単語（JRE, GATES等）はそのまま残し、それ以外の単語は先頭1文字だけ取る。
  // 例: "JRE Ventures Pte. Ltd." → "JREVPL"（"JREV"で部分一致検索できる）
  function buildAcronym(name) {
    const tokens = name.split(/\s+/).map((t) => t.replace(/[.,]/g, ""));
    let acronym = "";
    for (const token of tokens) {
      if (!/^[A-Za-z]+$/.test(token)) continue;
      acronym += token === token.toUpperCase() && token.length > 1 ? token : token[0].toUpperCase();
    }
    return acronym;
  }

  const state = {
    companies: [],
    segments: [],
    selectedSegments: new Set(),
    selectedPref: "",
    query: ""
  };

  let syncAbbrChips = () => {};

  const els = {
    searchInput: document.getElementById("search-input"),
    prefSelect: document.getElementById("pref-select"),
    segmentFilters: document.getElementById("segment-filters"),
    cardGrid: document.getElementById("card-grid"),
    resultCount: document.getElementById("result-count"),
    emptyState: document.getElementById("empty-state"),
    footer: document.getElementById("app-footer"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalClose: document.getElementById("modal-close"),
    modalTitle: document.getElementById("modal-title"),
    modalSegment: document.getElementById("modal-segment"),
    modalHq: document.getElementById("modal-hq"),
    modalFacts: document.getElementById("modal-facts"),
    modalDescription: document.getElementById("modal-description"),
    modalLink: document.getElementById("modal-link"),
    abbrToggle: document.getElementById("abbr-toggle"),
    abbrToggleCount: document.getElementById("abbr-toggle-count"),
    abbrPanel: document.getElementById("abbr-panel")
  };

  function loadData() {
    return fetch("data/group_companies.json")
      .then((res) => {
        if (!res.ok) throw new Error("データの読み込みに失敗しました");
        return res.json();
      })
      .then((data) => {
        state.segments = data.segments;
        state.meta = data.meta;
        state.companies = data.segments.flatMap((segment) =>
          segment.companies.map((company) => ({
            ...company,
            segmentId: segment.id,
            segmentName: segment.name,
            prefecture: extractPrefecture(company.hq),
            acronym: buildAcronym(company.name)
          }))
        );
        state.selectedSegments = new Set(data.segments.map((s) => s.id));
      });
  }

  function renderSegmentFilters() {
    els.segmentFilters.innerHTML = "";
    const buttons = [];

    const syncButtons = () => {
      buttons.forEach((btn) => {
        btn.setAttribute("aria-pressed", state.selectedSegments.has(btn.dataset.segmentId) ? "true" : "false");
      });
    };

    state.segments.forEach((segment) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "segment-btn";
      btn.textContent = segment.name;
      btn.dataset.segmentId = segment.id;
      btn.setAttribute("aria-pressed", state.selectedSegments.has(segment.id) ? "true" : "false");
      btn.addEventListener("click", () => {
        const isOnlySelected =
          state.selectedSegments.size === 1 && state.selectedSegments.has(segment.id);
        if (isOnlySelected) {
          // 既にこのセグメントだけに絞り込まれている場合はすべて表示に戻す
          state.selectedSegments = new Set(state.segments.map((s) => s.id));
        } else {
          // このセグメントだけに絞り込む
          state.selectedSegments = new Set([segment.id]);
        }
        syncButtons();
        render();
      });
      buttons.push(btn);
      els.segmentFilters.appendChild(btn);
    });
  }

  function renderPrefectureOptions() {
    const prefsInUse = new Set(state.companies.map((c) => c.prefecture));
    const orderedPrefs = PREFECTURES.filter((p) => prefsInUse.has(p));
    if (prefsInUse.has(OVERSEAS_LABEL)) orderedPrefs.push(OVERSEAS_LABEL);

    orderedPrefs.forEach((pref) => {
      const opt = document.createElement("option");
      opt.value = pref;
      opt.textContent = pref;
      els.prefSelect.appendChild(opt);
    });

    els.prefSelect.addEventListener("change", () => {
      state.selectedPref = els.prefSelect.value;
      render();
    });
  }

  function renderAbbrPanel() {
    const withAbbr = state.companies
      .filter((c) => c.abbreviation)
      .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation, "en", { sensitivity: "base" }));

    if (withAbbr.length === 0) {
      els.abbrToggle.hidden = true;
      return;
    }

    els.abbrToggleCount.textContent = `(${withAbbr.length}社)`;
    els.abbrPanel.innerHTML = "";
    const chips = [];

    const syncChips = () => {
      chips.forEach((chip) => {
        chip.classList.toggle("abbr-chip--active", chip.dataset.abbr === state.query);
      });
    };

    withAbbr.forEach((company) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "abbr-chip";
      chip.textContent = company.abbreviation;
      chip.title = company.name;
      chip.dataset.abbr = company.abbreviation;
      chip.addEventListener("click", () => {
        if (state.query === company.abbreviation) {
          // 選択済みの略称をもう一度押したらリセット
          state.query = "";
          els.searchInput.value = "";
        } else {
          state.query = company.abbreviation;
          els.searchInput.value = company.abbreviation;
        }
        syncChips();
        render();
      });
      chips.push(chip);
      els.abbrPanel.appendChild(chip);
    });

    syncAbbrChips = syncChips;

    els.abbrToggle.addEventListener("click", () => {
      const expanded = els.abbrToggle.getAttribute("aria-expanded") === "true";
      els.abbrToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      els.abbrPanel.hidden = expanded;
    });
  }

  function renderFooter() {
    if (!state.meta) return;
    els.footer.innerHTML = `
      <p>${state.meta.note}</p>
      <p>出典: <a href="https://www.jreast.co.jp/company/about/group/" target="_blank" rel="noopener noreferrer">JR東日本公式サイト「グループ会社一覧」</a>（最終確認日: ${state.meta.last_checked}）</p>
    `;
  }

  function matchesQuery(company, query) {
    if (!query) return true;
    const target = `${company.name} ${company.abbreviation || ""} ${company.acronym || ""} ${company.description} ${company.hq}`.toLowerCase();
    return target.includes(query.toLowerCase());
  }

  function getFilteredCompanies() {
    return state.companies.filter((company) => {
      if (!state.selectedSegments.has(company.segmentId)) return false;
      if (state.selectedPref && company.prefecture !== state.selectedPref) return false;
      if (!matchesQuery(company, state.query)) return false;
      return true;
    });
  }

  function createCard(company) {
    const card = document.createElement("article");
    card.className = "company-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${company.name}の詳細を開く`);

    const top = document.createElement("div");
    top.className = "company-card__top";

    const name = document.createElement("h3");
    name.className = "company-card__name";
    name.textContent = company.name;
    if (company.abbreviation) {
      const abbr = document.createElement("span");
      abbr.className = "company-card__abbr";
      abbr.textContent = company.abbreviation;
      name.appendChild(document.createTextNode(" "));
      name.appendChild(abbr);
    }

    const segmentBadge = document.createElement("span");
    segmentBadge.className = "company-card__segment";
    segmentBadge.textContent = company.segmentName;

    top.appendChild(name);
    top.appendChild(segmentBadge);

    const pref = document.createElement("p");
    pref.className = "company-card__pref";
    pref.textContent = company.prefecture;

    const address = document.createElement("p");
    address.className = "company-card__address";
    address.textContent = company.hq;

    const desc = document.createElement("p");
    desc.className = "company-card__desc";
    desc.textContent = company.description;

    card.appendChild(top);
    card.appendChild(pref);
    card.appendChild(address);
    card.appendChild(desc);

    if (company.url) {
      const link = document.createElement("a");
      link.className = "company-card__link";
      link.href = company.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "公式サイトを見る ↗";
      link.addEventListener("click", (e) => e.stopPropagation());
      card.appendChild(link);
    }

    const openModal = () => showModal(company);
    card.addEventListener("click", openModal);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal();
      }
    });

    return card;
  }

  function render() {
    const filtered = getFilteredCompanies();
    els.cardGrid.innerHTML = "";
    filtered.forEach((company) => els.cardGrid.appendChild(createCard(company)));

    els.resultCount.textContent = `全${state.companies.length}社中 ${filtered.length}社を表示`;
    els.emptyState.hidden = filtered.length !== 0;
  }

  function showModal(company) {
    els.modalSegment.textContent = company.segmentName;
    els.modalTitle.textContent = company.name;
    if (company.abbreviation) {
      const abbr = document.createElement("span");
      abbr.className = "modal-abbr";
      abbr.textContent = company.abbreviation;
      els.modalTitle.appendChild(document.createTextNode(" "));
      els.modalTitle.appendChild(abbr);
    }
    els.modalHq.textContent = company.hq;

    const facts = [
      ["設立", company.founded],
      ["資本金", company.capital],
      ["社員数", company.employees]
    ].filter(([, value]) => Boolean(value));

    els.modalFacts.innerHTML = "";
    facts.forEach(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      els.modalFacts.appendChild(dt);
      els.modalFacts.appendChild(dd);
    });
    els.modalFacts.hidden = facts.length === 0;

    els.modalDescription.textContent = company.description;
    if (company.url) {
      els.modalLink.href = company.url;
      els.modalLink.hidden = false;
    } else {
      els.modalLink.hidden = true;
    }
    els.modalOverlay.hidden = false;
    els.modalClose.focus();
  }

  function hideModal() {
    els.modalOverlay.hidden = true;
  }

  function bindGlobalEvents() {
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      syncAbbrChips();
      render();
    });

    els.modalClose.addEventListener("click", hideModal);
    els.modalOverlay.addEventListener("click", (e) => {
      if (e.target === els.modalOverlay) hideModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.modalOverlay.hidden) hideModal();
    });
  }

  loadData()
    .then(() => {
      renderSegmentFilters();
      renderPrefectureOptions();
      renderAbbrPanel();
      renderFooter();
      bindGlobalEvents();
      render();
    })
    .catch((err) => {
      els.cardGrid.innerHTML = `<p class="empty-state">${err.message}</p>`;
    });
})();
