;(function () {
	'use strict'

	// data.js должен объявить глобальную переменную DATA = {
	//   skins: {referenceImage, items: [...]},  // items: {name, image, rarity, type, aspects?}
	//   weaponNames: {...},
	//   weaponColors: {...}
	// }

	// ---------- Бан-лист ----------
	//
	// Пункты отсюда ПОКАЗЫВАЮТСЯ на сайте, но выбрать их нельзя: карточка
	// приглушена, ховера нет, в правом верхнем углу — знак запрета.
	//
	// Названия пишем так же, как они называются в данных:
	//   skins        — ключ из data.json                  ("FANCY FANGS")
	//   weaponNames  — имя файла картинки без расширения   ("HARD LIGHT")
	//   weaponColors — строка из TEXT_CATEGORY_ITEMS в build_data.py ("GOLDEN")
	//
	// Списки раздельные по категориям намеренно: названия пересекаются
	// (например "ROSE GOLD" есть и среди скинов, и среди оружия), иначе бан
	// одного молча забанил бы и другое. Можно написать и одним плоским
	// списком (const BAN_LIST = ['FANCY FANGS']) — тогда бан действует сразу
	// во всех категориях.
	// Регистр и лишние пробелы по краям не важны. Если название не найдено
	// в данных — в консоли будет предупреждение (чтобы опечатка не молчала).
	const BAN_LIST = {
		skins: ['HONEY BEE', 'BLACK CAT'],
		weaponNames: ['HARD LIGHT'],
		weaponColors: [],
	}

	const data =
		typeof DATA !== 'undefined' ? DATA : (
			{
				skins: {referenceImage: null, items: []},
				weaponNames: {referenceImage: null, items: []},
				weaponColors: {referenceImage: null, items: []},
			}
		)

	const CATEGORIES = ['skins', 'weaponNames', 'weaponColors']

	function normalizeName(name) {
		return String(name == null ? '' : name)
			.trim()
			.toUpperCase()
	}

	// разворачиваем BAN_LIST в Set нормализованных названий на каждую категорию
	const bannedNames = new Map(
		CATEGORIES.map(category => {
			const names = Array.isArray(BAN_LIST) ? BAN_LIST : BAN_LIST[category] || []
			return [category, new Set(names.map(normalizeName).filter(Boolean))]
		}),
	)

	function isBanned(category, name) {
		const set = bannedNames.get(category)
		return Boolean(set && set.has(normalizeName(name)))
	}

	/** Предупреждает в консоли о названиях из BAN_LIST, которых нет в данных (чтобы опечатка не молчала). */
	function warnUnknownBans() {
		bannedNames.forEach((names, category) => {
			const present = new Set(((data[category] && data[category].items) || []).map(i => normalizeName(i.name)))
			names.forEach(name => {
				if (!present.has(name)) {
					console.warn(`BAN_LIST.${category}: пункт "${name}" не найден в данных — проверьте название`)
				}
			})
		})
	}

	// Фирменные цвета для конкретных названий цветов оружия (регистронезависимо).
	// Применяются и к карточкам выбора, и к итоговому блоку конфигурации.
	const COLOR_HEX_MAP = {
		GOLDEN: '#b39700',
		JADE: '#00A36C',
		GALACTIC: '#472E97',
		'CRIMSON WOLF': '#5e091a',
	}

	function getColorHex(name) {
		if (!name) return null
		return COLOR_HEX_MAP[name.trim().toUpperCase()] || null
	}

	/** Белый или чёрный текст поверх заданного hex-цвета — по относительной яркости. */
	function contrastTextColor(hex) {
		const c = hex.replace('#', '')
		const r = parseInt(c.substring(0, 2), 16) / 255
		const g = parseInt(c.substring(2, 4), 16) / 255
		const b = parseInt(c.substring(4, 6), 16) / 255
		const lin = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
		const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
		return luminance > 0.45 ? '#14161d' : '#f4f5f8'
	}

	// Цвета редкости для НАЗВАНИЙ скинов (не фона карточки — только текст).
	// item.rarity приходит из data.json через build_data.py как "c"/"e"/"r"/"l"/"u"/"m".
	// mythic задаётся отдельным CSS-классом (градиентный текст), остальные —
	// обычным цветом.
	const RARITY_STYLES = {
		c: {color: '#ffffff'},
		r: {color: '#0b9ccf'},
		e: {color: '#ed3cef'},
		l: {color: '#ff9c00'},
		u: {color: '#CF2018'},
		m: {className: 'rarity-mythic'},
	}

	const RARITY_LABELS = {
		c: 'Common',
		r: 'Rare',
		e: 'Epic',
		l: 'Legendary',
		u: 'Ultra',
		m: 'Mythic',
	}

	// Порядок редкости от низшей к высшей — используется для сортировки "по раритетности".
	const RARITY_ORDER = {c: 0, r: 1, e: 2, l: 3, u: 4, m: 5}

	// Отображаемое название для type — то, что реально хранится в data.json
	// (например "mythic-configurable"), используется для фильтрации как есть,
	// а здесь просто красивая подпись для показа на сайте. Значения, которых
	// нет в этом списке, показываются как есть (без перевода).
	const TYPE_LABELS = {
		'mythic-configurable': 'Mythic',
	}

	function getTypeLabel(type) {
		if (!type) return ''
		return TYPE_LABELS[type] || type
	}

	/** Применяет (или сбрасывает, если rarity нет/неизвестна) стиль редкости к элементу с текстом названия. */
	function applyRarityStyle(el, rarity) {
		el.classList.remove('rarity-mythic')
		el.style.color = ''
		const style = rarity ? RARITY_STYLES[rarity] : null
		if (!style) return
		if (style.className) {
			el.classList.add(style.className)
		} else if (style.color) {
			el.style.color = style.color
		}
	}

	// текущий выбор по каждой категории: { skins: {name, image, ..., aspect?} | null, ... }
	const selection = {
		skins: null,
		weaponNames: null,
		weaponColors: null,
	}

	// фильтры/сортировка раздела "Скин"
	const skinsFilter = {
		search: '',
		rarity: '',
		type: '',
		sort: 'name-asc',
	}

	let userEditedOutput = false // если человек сам поправил текст — не перетираем это при новом выборе

	const outputField = document.getElementById('outputField')
	const copyBtn = document.getElementById('copyBtn')
	const resetFormatBtn = document.getElementById('resetFormatBtn')
	const navButtons = Array.from(document.querySelectorAll('.tab'))

	// ---------- Фильтрация/сортировка раздела "Скин" ----------

	function getFilteredSortedSkins() {
		const items = (data.skins && data.skins.items) || []
		const search = skinsFilter.search.trim().toLowerCase()

		let filtered = items.filter(item => {
			if (search && !item.name.toLowerCase().includes(search)) return false
			if (skinsFilter.rarity && item.rarity !== skinsFilter.rarity) return false
			if (skinsFilter.type && item.type !== skinsFilter.type) return false
			return true
		})

		filtered = filtered.slice().sort((a, b) => {
			if (skinsFilter.sort === 'name-desc') {
				return b.name.localeCompare(a.name)
			}
			if (skinsFilter.sort === 'rarity') {
				const ra = a.rarity ? RARITY_ORDER[a.rarity] : -1
				const rb = b.rarity ? RARITY_ORDER[b.rarity] : -1
				if (rb !== ra) return rb - ra // от высокой редкости к низкой
				return a.name.localeCompare(b.name)
			}
			return a.name.localeCompare(b.name) // name-asc по умолчанию
		})

		return filtered
	}

	function populateSkinsFilterOptions() {
		const items = (data.skins && data.skins.items) || []

		const raritySelect = document.getElementById('skinsRarityFilter')
		const presentRarities = Array.from(new Set(items.map(i => i.rarity).filter(Boolean)))
		presentRarities.sort((a, b) => RARITY_ORDER[a] - RARITY_ORDER[b])
		presentRarities.forEach(code => {
			const opt = document.createElement('option')
			opt.value = code
			opt.textContent = RARITY_LABELS[code] || code
			raritySelect.appendChild(opt)
		})

		const typeSelect = document.getElementById('skinsTypeFilter')
		const presentTypes = Array.from(new Set(items.map(i => i.type).filter(Boolean)))
		presentTypes.sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b)))
		presentTypes.forEach(type => {
			const opt = document.createElement('option')
			opt.value = type // фильтрация — по реальному значению из data.json
			opt.textContent = getTypeLabel(type) // а показываем — человекочитаемое название
			typeSelect.appendChild(opt)
		})
	}

	function updateSkinsFilterCount(shown, total) {
		const countEl = document.getElementById('skinsFilterCount')
		if (!countEl) return
		countEl.textContent = shown === total ? `${total}` : `${shown} из ${total}`
	}

	// ---------- Рендер разделов ----------

	function renderSection(category) {
		const bodyEl = document.getElementById(`body-${category}`)
		const categoryData = data[category] || {referenceImage: null, items: []}
		bodyEl.innerHTML = ''

		if (categoryData.referenceImage) {
			const refWrap = document.createElement('div')
			refWrap.className = 'reference-shot'
			const refImg = document.createElement('img')
			refImg.src = categoryData.referenceImage
			refImg.alt = 'Скриншот-подсказка'
			refWrap.appendChild(refImg)
			bodyEl.appendChild(refWrap)
		}

		const totalItems = (categoryData.items || []).length
		const items = category === 'skins' ? getFilteredSortedSkins() : categoryData.items || []

		if (category === 'skins') {
			updateSkinsFilterCount(items.length, totalItems)
		}

		if (totalItems === 0) {
			const empty = document.createElement('p')
			empty.className = 'empty-state'
			empty.textContent = 'В этом разделе пока нет картинок.'
			bodyEl.appendChild(empty)
			return
		}

		if (items.length === 0) {
			const empty = document.createElement('p')
			empty.className = 'empty-state'
			empty.textContent = 'Ничего не найдено по текущим фильтрам.'
			bodyEl.appendChild(empty)
			return
		}

		const grid = document.createElement('div')
		grid.className = 'gallery__grid'

		items.forEach(item => {
			const card = document.createElement('button')
			card.type = 'button'
			card.className = 'card'
			card.setAttribute('role', 'option')

			const isMythic = Array.isArray(item.aspects) && item.aspects.length > 0
			if (isMythic) card.classList.add('card--mythic')

			const isBannedItem = isBanned(category, item.name)
			if (isBannedItem) {
				card.classList.add('card--banned')
				card.setAttribute('aria-disabled', 'true')
				card.tabIndex = -1 // из обхода по Tab исключаем, но карточка остаётся видимой
				card.title = 'Недоступно для выбора'
			}

			const isSelected = !isBannedItem && selection[category] && selection[category].name === item.name
			if (isSelected) card.classList.add('is-selected')
			card.setAttribute('aria-selected', String(isSelected))

			const colorHex = getColorHex(item.name)

			if (item.image) {
				const imgWrap = document.createElement('div')
				imgWrap.className = 'card__image-wrap'
				const img = document.createElement('img')
				img.src = item.image
				img.alt = item.name
				img.loading = 'lazy'
				imgWrap.appendChild(img)
				card.appendChild(imgWrap)
			} else {
				card.classList.add('card--text-only')
			}

			const nameEl = document.createElement('div')
			nameEl.className = 'card__name'
			nameEl.textContent = item.name
			nameEl.title = item.name

			if (!item.image && colorHex) {
				if (isBannedItem) {
					// забаненный цвет не заливаем целиком — иначе яркая плашка
					// читается как активная; фирменный цвет оставляем в тексте
					nameEl.style.color = colorHex
				} else {
					card.style.background = colorHex
					const textColor = contrastTextColor(colorHex)
					card.style.color = textColor
					nameEl.style.color = textColor
				}
			}

			if (item.rarity) {
				applyRarityStyle(nameEl, item.rarity)
			}

			if (item.type) {
				const typeEl = document.createElement('div')
				typeEl.className = 'card__type'
				if (item.typeIcon) {
					const typeIcon = document.createElement('img')
					typeIcon.className = 'card__type-icon'
					typeIcon.src = item.typeIcon
					typeIcon.alt = ''
					typeIcon.loading = 'lazy'
					typeEl.appendChild(typeIcon)
				}
				const typeLabel = document.createElement('span')
				typeLabel.className = 'card__type-label'
				typeLabel.textContent = getTypeLabel(item.type)
				typeEl.appendChild(typeLabel)
				card.appendChild(typeEl)
			}

			card.appendChild(nameEl)

			if (isBannedItem) {
				// значок запрета поверх карточки; сам обработчик клика не вешаем
				const banBadge = document.createElement('span')
				banBadge.className = 'card__ban'
				banBadge.setAttribute('aria-hidden', 'true')
				card.appendChild(banBadge)
			} else if (isMythic) {
				card.addEventListener('click', evt => openMythicPopover(evt.currentTarget, category, item))
			} else {
				card.addEventListener('click', () => selectItem(category, item))
			}

			grid.appendChild(card)
		})
		bodyEl.appendChild(grid)
	}

	function renderAllSections() {
		CATEGORIES.forEach(renderSection)
	}

	/** Уникальный ключ аспекта для сравнения "тот же самый или другой" (был "number", теперь пара координат). */
	function aspectKey(aspect) {
		return aspect ? `${aspect.category}.${aspect.variant}` : null
	}

	function selectItem(category, item) {
		if (isBanned(category, item.name)) return // страховка: забаненный пункт не выбирается никогда
		// повторный клик по уже выбранному пункту снимает выбор
		const alreadySelected = selection[category] && selection[category].name === item.name
		selection[category] = alreadySelected ? null : item
		userEditedOutput = false // новый выбор — пересобираем текст автоматически
		renderSection(category)
		renderSelectionBar()
	}

	// ---------- Попап выбора mythic-эффектов ----------
	//
	// Правила:
	// - выбор в самом попапе НЕ закрывает его и НЕ применяется сразу —
	//   только по кнопке "Применить" или крестику в шапке;
	// - в каждой строке (категории) можно выбрать максимум 1 вариант,
	//   но выбор можно сделать НЕЗАВИСИМО в нескольких разных строках сразу
	//   (то есть по итогу может быть выбрано до одного варианта на каждую
	//   категорию одновременно).

	let openPopover = null // { el, itemName, staged: Map<category, aspect> }

	function closeMythicPopover() {
		if (!openPopover) return
		if (openPopover.el.parentNode) openPopover.el.parentNode.removeChild(openPopover.el)
		openPopover = null
	}

	function openMythicPopover(cardEl, category, item) {
		if (isBanned(category, item.name)) return // страховка: у забаненного скина попап не открываем
		if (openPopover && openPopover.itemName === item.name) return // уже открыт для этой же карточки
		closeMythicPopover()

		// предзаполняем текущим выбором (если уже что-то выбрано для этого скина раньше)
		const staged = new Map()
		if (selection[category] && selection[category].name === item.name && selection[category].aspects) {
			selection[category].aspects.forEach(a => staged.set(a.category, a))
		}

		const popover = document.createElement('div')
		popover.className = 'mythic-popover'

		// ---- шапка: заголовок + крестик закрытия ----
		const header = document.createElement('div')
		header.className = 'mythic-popover__header'
		const title = document.createElement('p')
		title.className = 'mythic-popover__title'
		title.textContent = `${item.name} — эффекты`
		header.appendChild(title)
		const closeBtn = document.createElement('button')
		closeBtn.type = 'button'
		closeBtn.className = 'mythic-popover__close'
		closeBtn.setAttribute('aria-label', 'Закрыть без применения')
		closeBtn.textContent = '✕'
		closeBtn.addEventListener('click', evt => {
			evt.stopPropagation()
			closeMythicPopover()
		})
		header.appendChild(closeBtn)
		popover.appendChild(header)

		// ---- содержимое: строки по категориям, каждая — своя горизонтальная полоса ----
		const content = document.createElement('div')
		content.className = 'mythic-popover__content'

		const byCategory = new Map()
		item.aspects.forEach(aspect => {
			if (!byCategory.has(aspect.category)) byCategory.set(aspect.category, [])
			byCategory.get(aspect.category).push(aspect)
		})

		function renderRows() {
			content.innerHTML = ''
			Array.from(byCategory.keys())
				.sort((a, b) => a - b)
				.forEach(categoryNum => {
					const rowGroup = document.createElement('div')
					rowGroup.className = 'mythic-popover__row-group'

					const rowHeader = document.createElement('div')
					rowHeader.className = 'mythic-popover__row-header'
					const rowNumber = document.createElement('span')
					rowNumber.className = 'mythic-popover__row-number'
					rowNumber.textContent = categoryNum
					const rowDivider = document.createElement('span')
					rowDivider.className = 'mythic-popover__row-divider'
					rowHeader.appendChild(rowNumber)
					rowHeader.appendChild(rowDivider)
					rowGroup.appendChild(rowHeader)

					const row = document.createElement('div')
					row.className = 'mythic-popover__row'

					byCategory.get(categoryNum).forEach(aspect => {
						const option = document.createElement('button')
						option.type = 'button'
						option.className = 'mythic-popover__option'
						const isStaged = staged.get(aspect.category) && aspectKey(staged.get(aspect.category)) === aspectKey(aspect)
						if (isStaged) option.classList.add('is-selected')

						const imgWrap = document.createElement('div')
						imgWrap.className = 'mythic-popover__option-image'
						const img = document.createElement('img')
						img.src = aspect.image
						img.alt = aspect.name
						img.loading = 'lazy'
						imgWrap.appendChild(img)
						option.appendChild(imgWrap)

						const nameEl = document.createElement('div')
						nameEl.className = 'mythic-popover__option-name'
						nameEl.textContent = aspect.name
						option.appendChild(nameEl)

						option.addEventListener('click', evt => {
							evt.stopPropagation()
							// клик по уже выбранному в этой строке варианту — снимает выбор
							// именно в этой строке; клик по другому — заменяет выбор строки.
							// Другие строки не трогаются — можно выбирать по одной в каждой.
							if (isStaged) {
								staged.delete(aspect.category)
							} else {
								staged.set(aspect.category, aspect)
							}
							renderRows() // локальный перерендер попапа — сам попап не закрывается
						})

						row.appendChild(option)
					})

					rowGroup.appendChild(row)
					content.appendChild(rowGroup)
				})
		}
		renderRows()
		popover.appendChild(content)

		// ---- футер: кнопка "Применить" ----
		const footer = document.createElement('div')
		footer.className = 'mythic-popover__footer'
		const applyBtn = document.createElement('button')
		applyBtn.type = 'button'
		applyBtn.className = 'btn btn--primary'
		applyBtn.textContent = 'Применить'
		applyBtn.addEventListener('click', evt => {
			evt.stopPropagation()
			const chosenAspects = Array.from(staged.values()).sort((a, b) => a.category - b.category)
			selection[category] = Object.assign({}, item, {aspects: chosenAspects})
			userEditedOutput = false
			closeMythicPopover()
			renderSection(category)
			renderSelectionBar()
		})
		footer.appendChild(applyBtn)
		popover.appendChild(footer)

		document.body.appendChild(popover)
		positionPopover(popover, cardEl)

		openPopover = {el: popover, itemName: item.name}
	}

	function positionPopover(popover, anchorEl) {
		const rect = anchorEl.getBoundingClientRect()
		const scrollX = window.scrollX || window.pageXOffset
		const scrollY = window.scrollY || window.pageYOffset
		const popoverWidth = popover.offsetWidth || 280

		let left = rect.left + scrollX
		// не даём попапу вылезти за правый край окна
		const maxLeft = scrollX + document.documentElement.clientWidth - popoverWidth - 12
		if (left > maxLeft) left = Math.max(scrollX + 12, maxLeft)

		const top = rect.bottom + scrollY + 8

		popover.style.left = `${left}px`
		popover.style.top = `${top}px`
	}

	// ---------- Нижняя закреплённая панель ----------

	function displayNameFor(item) {
		if (!item) return '—'
		if (item.aspects && item.aspects.length) {
			return `${item.name} (${item.aspects.map(a => a.name).join(', ')})`
		}
		return item.name
	}

	function renderSelectionBar() {
		CATEGORIES.forEach(cat => {
			const item = selection[cat]
			const thumbEl = document.getElementById(`thumb-${cat}`)
			const valueEl = document.getElementById(`value-${cat}`)

			thumbEl.innerHTML = ''
			thumbEl.classList.remove('selection-slot__thumb--text')
			applyRarityStyle(valueEl, null) // сброс перед новым рендером

			if (item) {
				if (item.image) {
					const img = document.createElement('img')
					img.src = item.image
					img.alt = ''
					thumbEl.appendChild(img)
				} else {
					// текстовые пункты (сейчас — цвета оружия): миниатюра нейтральная,
					// цвет показывается ТОЛЬКО в тексте названия ниже — без заливки
					// миниатюры и без рамки на итоговом блоке
					thumbEl.classList.add('selection-slot__thumb--text')
				}
				valueEl.textContent = displayNameFor(item)

				if (item.rarity) {
					applyRarityStyle(valueEl, item.rarity)
				} else {
					const colorHex = getColorHex(item.name)
					if (colorHex) valueEl.style.color = colorHex
				}
			} else {
				valueEl.textContent = '—'
			}
		})

		if (!userEditedOutput) {
			outputField.value = composeOutputText()
		}
	}

	function composeOutputText() {
		// Формат по умолчанию: "Скин (Эффект) - Оружие (Цвет)".
		// Поле редактируемое — можно поправить вручную под свой формат,
		// а кнопка "Сбросить формат" вернёт именно этот шаблон.
		const parts = []
		if (selection.skins) parts.push(displayNameFor(selection.skins))
		if (selection.weaponNames) parts.push(selection.weaponNames.name)

		let text = parts.join(' - ')
		if (selection.weaponColors) {
			text = text ? `${text} (${selection.weaponColors.name})` : selection.weaponColors.name
		}
		return text
	}

	// ---------- Навигация: клик -> плавный переход к разделу ----------

	function scrollToSection(category) {
		const section = document.getElementById(`section-${category}`)
		if (section) section.scrollIntoView({behavior: 'smooth', block: 'start'})
	}

	navButtons.forEach(btn => {
		btn.addEventListener('click', () => scrollToSection(btn.dataset.category))
	})

	// ---------- Навигация: скроллспай — подсвечиваем раздел, который сейчас на экране ----------

	function setActiveNav(category) {
		navButtons.forEach(btn => {
			btn.setAttribute('aria-selected', String(btn.dataset.category === category))
		})
	}

	function setupScrollSpy() {
		const sections = CATEGORIES.map(cat => document.getElementById(`section-${cat}`)).filter(Boolean)
		if (sections.length === 0) return

		function computeActive() {
			const topbar = document.querySelector('.topbar')
			const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0
			// линия чуть ниже липкого хэдера — раздел считается активным, когда
			// его начало уже прошло выше этой линии (то есть мы "внутри" него)
			const activationLine = topbarHeight + 40

			// секции идут в том же порядке, что и на странице — берём ПОСЛЕДНЮЮ,
			// чья верхняя граница уже выше линии активации.
			let activeCategory = sections[0].dataset.category
			for (const section of sections) {
				if (section.getBoundingClientRect().top <= activationLine) {
					activeCategory = section.dataset.category
				} else {
					break
				}
			}

			// Особый случай: если последний раздел короче, чем остаток видимой
			// области на момент, когда до него доскроллили, его верхняя граница
			// физически не может пересечь линию активации — дальше просто некуда
			// скроллить. Посекционный расчёт выше в этом случае "застревает" на
			// предыдущем разделе. Проверяем отдельно: если страница прокручена
			// до самого конца — принудительно подсвечиваем последнюю категорию.
			const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
			if (scrolledToBottom) {
				activeCategory = CATEGORIES[CATEGORIES.length - 1]
			}

			setActiveNav(activeCategory)
		}

		let ticking = false
		window.addEventListener(
			'scroll',
			() => {
				if (!ticking) {
					requestAnimationFrame(() => {
						computeActive()
						ticking = false
					})
					ticking = true
				}
			},
			{passive: true},
		)
		window.addEventListener('resize', computeActive)
		computeActive()
	}

	// ---------- Обработчики панели фильтров/сортировки ----------

	function setupSkinsFilterBar() {
		const searchEl = document.getElementById('skinsSearch')
		const rarityEl = document.getElementById('skinsRarityFilter')
		const typeEl = document.getElementById('skinsTypeFilter')
		const sortEl = document.getElementById('skinsSort')
		const resetBtn = document.getElementById('skinsFilterReset')

		populateSkinsFilterOptions()

		searchEl.addEventListener('input', () => {
			skinsFilter.search = searchEl.value
			renderSection('skins')
		})
		rarityEl.addEventListener('change', () => {
			skinsFilter.rarity = rarityEl.value
			renderSection('skins')
		})
		typeEl.addEventListener('change', () => {
			skinsFilter.type = typeEl.value
			renderSection('skins')
		})
		sortEl.addEventListener('change', () => {
			skinsFilter.sort = sortEl.value
			renderSection('skins')
		})
		resetBtn.addEventListener('click', () => {
			skinsFilter.search = ''
			skinsFilter.rarity = ''
			skinsFilter.type = ''
			skinsFilter.sort = 'name-asc'
			searchEl.value = ''
			rarityEl.value = ''
			typeEl.value = ''
			sortEl.value = 'name-asc'
			renderSection('skins')
		})
	}

	outputField.addEventListener('input', () => {
		userEditedOutput = true
	})

	resetFormatBtn.addEventListener('click', () => {
		userEditedOutput = false
		outputField.value = composeOutputText()
	})

	copyBtn.addEventListener('click', async () => {
		const text = outputField.value
		if (!text) return
		try {
			await navigator.clipboard.writeText(text)
		} catch (err) {
			// запасной вариант для страниц без доступа к Clipboard API (например, http вместо https)
			outputField.select()
			document.execCommand('copy')
		}
		copyBtn.textContent = 'Скопировано'
		copyBtn.classList.add('is-copied')
		setTimeout(() => {
			copyBtn.textContent = 'Копировать'
			copyBtn.classList.remove('is-copied')
		}, 1200)
	})

	// Escape закрывает попап mythic-эффектов без применения (наравне с крестиком)
	document.addEventListener('keydown', evt => {
		if (evt.key === 'Escape') closeMythicPopover()
	})

	warnUnknownBans()
	setupSkinsFilterBar()
	renderAllSections()
	renderSelectionBar()
	setupScrollSpy()
})()
