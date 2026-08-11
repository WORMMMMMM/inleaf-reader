//#region node_modules/pdfjs-dist/web/pdf_viewer.mjs
var e = {};
e.d = (t, n) => {
	for (var r in n) e.o(n, r) && !e.o(t, r) && Object.defineProperty(t, r, {
		enumerable: !0,
		get: n[r]
	});
}, e.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t);
var t = globalThis.pdfjsViewer = {};
e.d(t, {
	AnnotationLayerBuilder: () => wt,
	DownloadManager: () => Et,
	EventBus: () => kt,
	FindState: () => O,
	GenericL10n: () => X,
	LinkTarget: () => j,
	PDFFindController: () => Le,
	PDFHistory: () => Yn,
	PDFLinkService: () => ze,
	PDFPageView: () => fr,
	PDFScriptingManager: () => gr,
	PDFSinglePageViewer: () => Cr,
	PDFViewer: () => Sr,
	ProgressBar: () => se,
	RenderingStates: () => d,
	ScrollMode: () => m,
	SimpleLinkService: () => Be,
	SpreadMode: () => h,
	StructTreeLayerBuilder: () => ar,
	TextLayerBuilder: () => cr,
	XfaLayerBuilder: () => lr,
	parseQueryString: () => v
});
var n = "auto", r = 1, i = 1.1, a = .1, o = 10, s = 0, c = 1.25, l = 40, u = 5, d = {
	INITIAL: 0,
	RUNNING: 1,
	PAUSED: 2,
	FINISHED: 3
}, f = {
	UNKNOWN: 0,
	NORMAL: 1,
	CHANGING: 2,
	FULLSCREEN: 3
}, p = {
	DISABLE: 0,
	ENABLE: 1,
	ENABLE_PERMISSIONS: 2
}, m = {
	UNKNOWN: -1,
	VERTICAL: 0,
	HORIZONTAL: 1,
	WRAPPED: 2,
	PAGE: 3
}, h = {
	UNKNOWN: -1,
	NONE: 0,
	ODD: 1,
	EVEN: 2
};
function g(e, t, n = !1) {
	let r = e.offsetParent;
	if (!r) {
		console.error("offsetParent is not set -- cannot scroll");
		return;
	}
	let i = e.offsetTop + e.clientTop, a = e.offsetLeft + e.clientLeft;
	for (; r.clientHeight === r.scrollHeight && r.clientWidth === r.scrollWidth || n && (r.classList.contains("markedContent") || getComputedStyle(r).overflow === "hidden");) if (i += r.offsetTop, a += r.offsetLeft, r = r.offsetParent, !r) return;
	t && (t.top !== void 0 && (i += t.top), t.left !== void 0 && (a += t.left, r.scrollLeft = a)), r.scrollTop = i;
}
function _(e, t, n = void 0) {
	let r = function(n) {
		a ||= window.requestAnimationFrame(function() {
			a = null;
			let n = e.scrollLeft, r = i.lastX;
			n !== r && (i.right = n > r), i.lastX = n;
			let o = e.scrollTop, s = i.lastY;
			o !== s && (i.down = o > s), i.lastY = o, t(i);
		});
	}, i = {
		right: !0,
		down: !0,
		lastX: e.scrollLeft,
		lastY: e.scrollTop,
		_eventHandler: r
	}, a = null;
	return e.addEventListener("scroll", r, {
		useCapture: !0,
		signal: n
	}), n?.addEventListener("abort", () => window.cancelAnimationFrame(a), { once: !0 }), i;
}
function v(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of new URLSearchParams(e)) t.set(n.toLowerCase(), r);
	return t;
}
var y = /[\x00-\x1F]/g;
function b(e, t = !1) {
	return y.test(e) ? t ? e.replaceAll(y, (e) => e === "\0" ? "" : " ") : e.replaceAll("\0", "") : e;
}
function x(e, t, n = 0) {
	let r = n, i = e.length - 1;
	if (i < 0 || !t(e[i])) return e.length;
	if (t(e[r])) return r;
	for (; r < i;) {
		let n = r + i >> 1, a = e[n];
		t(a) ? i = n : r = n + 1;
	}
	return r;
}
function S(e) {
	if (Math.floor(e) === e) return [e, 1];
	let t = 1 / e;
	if (t > 8) return [1, 8];
	if (Math.floor(t) === t) return [1, t];
	let n = e > 1 ? t : e, r = 0, i = 1, a = 1, o = 1;
	for (;;) {
		let e = r + a, t = i + o;
		if (t > 8) break;
		n <= e / t ? (a = e, o = t) : (r = e, i = t);
	}
	let s;
	return s = n - r / i < a / o - n ? n === e ? [r, i] : [i, r] : n === e ? [a, o] : [o, a], s;
}
function C(e, t) {
	return e - e % t;
}
function ee(e, t, n) {
	if (e < 2) return e;
	let r = t[e].div, i = r.offsetTop + r.clientTop;
	i >= n && (r = t[e - 1].div, i = r.offsetTop + r.clientTop);
	for (let n = e - 2; n >= 0 && (r = t[n].div, !(r.offsetTop + r.clientTop + r.clientHeight <= i)); --n) e = n;
	return e;
}
function te({ scrollEl: e, views: t, sortByVisibility: n = !1, horizontal: r = !1, rtl: i = !1 }) {
	let a = e.scrollTop, o = a + e.clientHeight, s = e.scrollLeft, c = s + e.clientWidth;
	function l(e) {
		let t = e.div;
		return t.offsetTop + t.clientTop + t.clientHeight > a;
	}
	function u(e) {
		let t = e.div, n = t.offsetLeft + t.clientLeft, r = n + t.clientWidth;
		return i ? n < c : r > s;
	}
	let d = [], f = /* @__PURE__ */ new Set(), p = t.length, m = x(t, r ? u : l);
	m > 0 && m < p && !r && (m = ee(m, t, a));
	let h = r ? c : -1;
	for (let e = m; e < p; e++) {
		let n = t[e], i = n.div, l = i.offsetLeft + i.clientLeft, u = i.offsetTop + i.clientTop, p = i.clientWidth, m = i.clientHeight, g = l + p, _ = u + m;
		if (h === -1) _ >= o && (h = _);
		else if ((r ? l : u) > h) break;
		if (_ <= a || u >= o || g <= s || l >= c) continue;
		let v = Math.max(0, a - u) + Math.max(0, _ - o), y = Math.max(0, s - l) + Math.max(0, g - c), b = (m - v) / m, x = (p - y) / p, S = b * x * 100 | 0;
		d.push({
			id: n.id,
			x: l,
			y: u,
			view: n,
			percent: S,
			widthPercent: x * 100 | 0
		}), f.add(n.id);
	}
	let g = d[0], _ = d.at(-1);
	return n && d.sort(function(e, t) {
		let n = e.percent - t.percent;
		return Math.abs(n) > .001 ? -n : e.id - t.id;
	}), {
		first: g,
		last: _,
		views: d,
		ids: f
	};
}
function ne(e) {
	return Number.isInteger(e) && e % 90 == 0;
}
function w(e) {
	return Number.isInteger(e) && Object.values(m).includes(e) && e !== m.UNKNOWN;
}
function re(e) {
	return Number.isInteger(e) && Object.values(h).includes(e) && e !== h.UNKNOWN;
}
function ie(e) {
	return e.width <= e.height;
}
new Promise(function(e) {
	window.requestAnimationFrame(e);
});
var ae = document.documentElement.style;
function oe(e, t, n) {
	return Math.min(Math.max(e, t), n);
}
var se = class {
	#e = null;
	#t = null;
	#n = 0;
	#r = null;
	#i = !0;
	constructor(e) {
		this.#e = e.classList, this.#r = e.style;
	}
	get percent() {
		return this.#n;
	}
	set percent(e) {
		if (this.#n = oe(e, 0, 100), isNaN(e)) {
			this.#e.add("indeterminate");
			return;
		}
		this.#e.remove("indeterminate"), this.#r.setProperty("--progressBar-percent", `${this.#n}%`);
	}
	setWidth(e) {
		if (!e) return;
		let t = e.parentNode.offsetWidth - e.offsetWidth;
		t > 0 && this.#r.setProperty("--progressBar-end-offset", `${t}px`);
	}
	setDisableAutoFetch(e = 5e3) {
		this.#n === 100 || isNaN(this.#n) || (this.#t && clearTimeout(this.#t), this.show(), this.#t = setTimeout(() => {
			this.#t = null, this.hide();
		}, e));
	}
	hide() {
		this.#i && (this.#i = !1, this.#e.add("hidden"));
	}
	show() {
		this.#i || (this.#i = !0, this.#e.remove("hidden"));
	}
};
function ce(e) {
	let t = m.VERTICAL, n = h.NONE;
	switch (e) {
		case "SinglePage":
			t = m.PAGE;
			break;
		case "OneColumn": break;
		case "TwoPageLeft": t = m.PAGE;
		case "TwoColumnLeft":
			n = h.ODD;
			break;
		case "TwoPageRight": t = m.PAGE;
		case "TwoColumnRight":
			n = h.EVEN;
			break;
	}
	return {
		scrollMode: t,
		spreadMode: n
	};
}
var T = function() {
	let e = document.createElement("div");
	return e.style.width = "round(down, calc(1.6666666666666665 * 792px), 1px)", e.style.width === "calc(1320px)" ? Math.fround : (e) => e;
}(), E = {
	SPACE: 0,
	ALPHA_LETTER: 1,
	PUNCT: 2,
	HAN_LETTER: 3,
	KATAKANA_LETTER: 4,
	HIRAGANA_LETTER: 5,
	HALFWIDTH_KATAKANA_LETTER: 6,
	THAI_LETTER: 7
};
function le(e) {
	return e < 11904;
}
function ue(e) {
	return (e & 65408) == 0;
}
function de(e) {
	return e >= 97 && e <= 122 || e >= 65 && e <= 90;
}
function fe(e) {
	return e >= 48 && e <= 57;
}
function pe(e) {
	return e === 32 || e === 9 || e === 13 || e === 10;
}
function me(e) {
	return e >= 13312 && e <= 40959 || e >= 63744 && e <= 64255;
}
function he(e) {
	return e >= 12448 && e <= 12543;
}
function ge(e) {
	return e >= 12352 && e <= 12447;
}
function _e(e) {
	return e >= 65376 && e <= 65439;
}
function ve(e) {
	return (e & 65408) == 3584;
}
function D(e) {
	return le(e) ? ue(e) ? pe(e) ? E.SPACE : de(e) || fe(e) || e === 95 ? E.ALPHA_LETTER : E.PUNCT : ve(e) ? E.THAI_LETTER : e === 160 ? E.SPACE : E.ALPHA_LETTER : me(e) ? E.HAN_LETTER : he(e) ? E.KATAKANA_LETTER : ge(e) ? E.HIRAGANA_LETTER : _e(e) ? E.HALFWIDTH_KATAKANA_LETTER : E.ALPHA_LETTER;
}
var ye;
function be() {
	return ye ||= "\xA0¨ª¯²-µ¸-º¼-¾Ĳ-ĳĿ-ŀŉſǄ-ǌǱ-ǳʰ-ʸ˘-˝ˠ-ˤʹͺ;΄-΅·ϐ-ϖϰ-ϲϴ-ϵϹևٵ-ٸक़-य़ড়-ঢ়য়ਲ਼ਸ਼ਖ਼-ਜ਼ਫ਼ଡ଼-ଢ଼ำຳໜ-ໝ༌གྷཌྷདྷབྷཛྷཀྵჼᴬ-ᴮᴰ-ᴺᴼ-ᵍᵏ-ᵪᵸᶛ-ᶿẚ-ẛάέήίόύώΆ᾽-῁ΈΉ῍-῏ΐΊ῝-῟ΰΎ῭-`ΌΏ´-῾ - ‑‗․-… ″-‴‶-‷‼‾⁇-⁉⁗ ⁰-ⁱ⁴-₎ₐ-ₜ₨℀-℃℅-ℇ℉-ℓℕ-№ℙ-ℝ℠-™ℤΩℨK-ℭℯ-ℱℳ-ℹ℻-⅀ⅅ-ⅉ⅐-ⅿ↉∬-∭∯-∰〈-〉①-⓪⨌⩴-⩶⫝̸ⱼ-ⱽⵯ⺟⻳⼀-⿕　〶〸-〺゛-゜ゟヿㄱ-ㆎ㆒-㆟㈀-㈞㈠-㉇㉐-㉾㊀-㏿ꚜ-ꚝꝰꟲ-ꟴꟸ-ꟹꭜ-ꭟꭩ豈-嗀塚晴凞-羽蘒諸逸-都飯-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-﷼︐-︙︰-﹄﹇-﹒﹔-﹦﹨-﹫ﹰ-ﹲﹴﹶ-ﻼ！-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ￠-￦", ye;
}
var O = {
	FOUND: 0,
	NOT_FOUND: 1,
	WRAPPED: 2,
	PENDING: 3
}, xe = 250, Se = -50, Ce = -400, we = {
	"‐": "-",
	"‘": "'",
	"’": "'",
	"‚": "'",
	"‛": "'",
	"“": "\"",
	"”": "\"",
	"„": "\"",
	"‟": "\"",
	"¼": "1/4",
	"½": "1/2",
	"¾": "3/4"
}, Te = new Set([
	12441,
	12442,
	2381,
	2509,
	2637,
	2765,
	2893,
	3021,
	3149,
	3277,
	3387,
	3388,
	3405,
	3530,
	3642,
	3770,
	3972,
	4153,
	4154,
	5908,
	5940,
	6098,
	6752,
	6980,
	7082,
	7083,
	7154,
	7155,
	11647,
	43014,
	43052,
	43204,
	43347,
	43456,
	43766,
	44013,
	3158,
	3953,
	3954,
	3962,
	3963,
	3964,
	3965,
	3968,
	3956
]), Ee, De = /\p{M}+/gu, Oe = /([.*+?^${}()|[\]\\])|(\p{P})|(\s+)|(\p{M})|(\p{L})/gu, ke = /([^\p{M}])\p{M}*$/u, Ae = /^\p{M}*([^\p{M}])/u, je = /[\uAC00-\uD7AF\uFA6C\uFACF-\uFAD1\uFAD5-\uFAD7]+/g, Me = /* @__PURE__ */ new Map(), Ne = "[\\u1100-\\u1112\\ud7a4-\\ud7af\\ud84a\\ud84c\\ud850\\ud854\\ud857\\ud85f]", Pe = /* @__PURE__ */ new Map(), k = null, A = null;
function Fe(e) {
	let t = [], n;
	for (; (n = je.exec(e)) !== null;) {
		let { index: e } = n;
		for (let r of n[0]) {
			let n = Me.get(r);
			n || (n = r.normalize("NFD").length, Me.set(r, n)), t.push([n, e++]);
		}
	}
	let r;
	if (t.length === 0 && k) r = k;
	else if (t.length > 0 && A) r = A;
	else {
		let e = `([${Object.keys(we).join("")}])|([${be()}])|((?:゙|゚)\\n)|(\\p{M}+(?:-\\n)?)|(\\p{Ll}-\\n\\p{Lu})|(\\S-\\n)|((?:\\p{Ideographic}|[぀-ヿ])\\n)|(\\n)`;
		r = t.length === 0 ? k = RegExp(e + "|(\\u0000)", "gum") : A = RegExp(e + `|(${Ne})`, "gum");
	}
	let i = [];
	for (; (n = De.exec(e)) !== null;) i.push([n[0].length, n.index]);
	let a = e.normalize("NFD"), o = [0, 0], s = 0, c = 0, l = 0, u = 0, d = 0, f = !1;
	a = a.replace(r, (e, n, r, a, p, m, h, g, _, v, y) => {
		if (y -= u, n) {
			let e = we[n], t = e.length;
			for (let e = 1; e < t; e++) o.push(y - l + e, l - e);
			return l -= t - 1, e;
		}
		if (r) {
			let e = Pe.get(r);
			e || (e = r.normalize("NFKC"), Pe.set(r, e));
			let t = e.length;
			for (let e = 1; e < t; e++) o.push(y - l + e, l - e);
			return l -= t - 1, e;
		}
		if (a) return f = !0, y + d === i[s]?.[1] ? ++s : (o.push(y - 1 - l + 1, l - 1), --l, u += 1), o.push(y - l + 1, l), u += 1, d += 1, a.charAt(0);
		if (p) {
			let e = p.endsWith("\n"), t = e ? p.length - 2 : p.length;
			f = !0;
			let n = t;
			y + d === i[s]?.[1] && (n -= i[s][0], ++s);
			for (let e = 1; e <= n; e++) o.push(y - 1 - l + e, l - e);
			return l -= n, u += n, e ? (y += t - 1, o.push(y - l + 1, 1 + l), l += 1, u += 1, d += 1, p.slice(0, t)) : p;
		}
		if (m) return u += 1, d += 1, m.replace("\n", "");
		if (h) {
			let e = h.length - 2;
			return o.push(y - l + e, 1 + l), l += 1, u += 1, d += 1, h.slice(0, -2);
		}
		if (g) {
			let e = g.length - 1;
			return o.push(y - l + e, l), u += 1, d += 1, g.slice(0, -1);
		}
		if (_) return o.push(y - l + 1, l - 1), --l, u += 1, d += 1, " ";
		if (y + d === t[c]?.[1]) {
			let e = t[c][0] - 1;
			++c;
			for (let t = 1; t <= e; t++) o.push(y - (l - t), l - t);
			l -= e, u += e;
		}
		return v;
	}), o.push(a.length, l);
	let p = new Uint32Array(o.length >> 1), m = new Int32Array(o.length >> 1);
	for (let e = 0, t = o.length; e < t; e += 2) p[e >> 1] = o[e], m[e >> 1] = o[e + 1];
	return [
		a,
		[p, m],
		f
	];
}
function Ie(e, t, n) {
	if (!e) return [t, n];
	let [r, i] = e, a = t, o = t + n - 1, s = x(r, (e) => e >= a);
	r[s] > a && --s;
	let c = x(r, (e) => e >= o, s);
	r[c] > o && --c;
	let l = a + i[s];
	return [l, o + i[c] + 1 - l];
}
var Le = class {
	#e = null;
	#t = !0;
	#n = 0;
	constructor({ linkService: e, eventBus: t, updateMatchesCountOnProgress: n = !0 }) {
		this._linkService = e, this._eventBus = t, this.#t = n, this.onIsPageVisible = null, this.#i(), t._on("find", this.#r.bind(this)), t._on("findbarclose", this.#v.bind(this));
	}
	get highlightMatches() {
		return this._highlightMatches;
	}
	get pageMatches() {
		return this._pageMatches;
	}
	get pageMatchesLength() {
		return this._pageMatchesLength;
	}
	get selected() {
		return this._selected;
	}
	get state() {
		return this.#e;
	}
	setDocument(e) {
		this._pdfDocument && this.#i(), e && (this._pdfDocument = e, this._firstPageCapability.resolve());
	}
	#r(e) {
		if (!e) return;
		let t = this._pdfDocument, { type: n } = e;
		(this.#e === null || this.#o(e)) && (this._dirtyMatch = !0), this.#e = e, n !== "highlightallchange" && this.#x(O.PENDING), this._firstPageCapability.promise.then(() => {
			if (!this._pdfDocument || t && this._pdfDocument !== t) return;
			this.#u();
			let e = !this._highlightMatches, r = !!this._findTimeout;
			this._findTimeout &&= (clearTimeout(this._findTimeout), null), n ? this._dirtyMatch ? this.#p() : n === "again" ? (this.#p(), e && this.#e.highlightAll && this.#f()) : n === "highlightallchange" ? (r ? this.#p() : this._highlightMatches = !0, this.#f()) : this.#p() : this._findTimeout = setTimeout(() => {
				this.#p(), this._findTimeout = null;
			}, xe);
		});
	}
	scrollMatchIntoView({ element: e = null, selectedLeft: t = 0, pageIndex: n = -1, matchIndex: r = -1 }) {
		!this._scrollMatches || !e || r === -1 || r !== this._selected.matchIdx || n === -1 || n !== this._selected.pageIdx || (this._scrollMatches = !1, g(e, {
			top: Se,
			left: t + Ce
		}, !0));
	}
	#i() {
		this._highlightMatches = !1, this._scrollMatches = !1, this._pdfDocument = null, this._pageMatches = [], this._pageMatchesLength = [], this.#n = 0, this.#e = null, this._selected = {
			pageIdx: -1,
			matchIdx: -1
		}, this._offset = {
			pageIdx: null,
			matchIdx: null,
			wrapped: !1
		}, this._extractTextPromises = [], this._pageContents = [], this._pageDiffs = [], this._hasDiacritics = [], this._matchesCountTotal = 0, this._pagesToSearch = null, this._pendingFindMatches = /* @__PURE__ */ new Set(), this._resumePageIdx = null, this._dirtyMatch = !1, clearTimeout(this._findTimeout), this._findTimeout = null, this._firstPageCapability = Promise.withResolvers();
	}
	get #a() {
		let { query: e } = this.#e;
		return typeof e == "string" ? (e !== this._rawQuery && (this._rawQuery = e, [this._normalizedQuery] = Fe(e)), this._normalizedQuery) : (e || []).filter((e) => !!e).map((e) => Fe(e)[0]);
	}
	#o(e) {
		let t = e.query, n = this.#e.query, r = typeof t;
		if (r !== typeof n) return !0;
		if (r === "string") {
			if (t !== n) return !0;
		} else if (JSON.stringify(t) !== JSON.stringify(n)) return !0;
		switch (e.type) {
			case "again":
				let e = this._selected.pageIdx + 1, t = this._linkService;
				return e >= 1 && e <= t.pagesCount && e !== t.page && !(this.onIsPageVisible?.(e) ?? !0);
			case "highlightallchange": return !1;
		}
		return !0;
	}
	#s(e, t, n) {
		let r = e.slice(0, t).match(ke);
		if (r) {
			let n = e.charCodeAt(t), i = r[1].charCodeAt(0);
			if (D(n) === D(i)) return !1;
		}
		if (r = e.slice(t + n).match(Ae), r) {
			let i = e.charCodeAt(t + n - 1), a = r[1].charCodeAt(0);
			if (D(i) === D(a)) return !1;
		}
		return !0;
	}
	#c(e, t) {
		let { matchDiacritics: n } = this.#e, r = !1;
		return e = e.replaceAll(Oe, (e, i, a, o, s, c) => i ? `[ ]*\\${i}[ ]*` : a ? `[ ]*${a}[ ]*` : o ? "[ ]+" : n ? s || c : s ? Te.has(s.charCodeAt(0)) ? s : "" : t ? (r = !0, `${c}\\p{M}*`) : c), e.endsWith("[ ]*") && (e = e.slice(0, e.length - 4)), n && t && (Ee ||= String.fromCharCode(...Te), r = !0, e = `${e}(?=[${Ee}]|[^\\p{M}]|$)`), [r, e];
	}
	#l(e) {
		let t = this.#a;
		if (t.length === 0) return;
		let n = this._pageContents[e], r = this.match(t, n, e), i = this._pageMatches[e] = [], a = this._pageMatchesLength[e] = [], o = this._pageDiffs[e];
		r?.forEach(({ index: e, length: t }) => {
			let [n, r] = Ie(o, e, t);
			r && (i.push(n), a.push(r));
		}), this.#e.highlightAll && this.#d(e), this._resumePageIdx === e && (this._resumePageIdx = null, this.#h());
		let s = i.length;
		this._matchesCountTotal += s, this.#t ? s > 0 && this.#b() : ++this.#n === this._linkService.pagesCount && this.#b();
	}
	match(e, t, n) {
		let r = this._hasDiacritics[n], i = !1;
		if (typeof e == "string" ? [i, e] = this.#c(e, r) : e = e.sort().reverse().map((e) => {
			let [t, n] = this.#c(e, r);
			return i ||= t, `(${n})`;
		}).join("|"), !e) return;
		let { caseSensitive: a, entireWord: o } = this.#e;
		e = new RegExp(e, `g${i ? "u" : ""}${a ? "" : "i"}`);
		let s = [], c;
		for (; (c = e.exec(t)) !== null;) o && !this.#s(t, c.index, c[0].length) || s.push({
			index: c.index,
			length: c[0].length
		});
		return s;
	}
	#u() {
		if (this._extractTextPromises.length > 0) return;
		let e = Promise.resolve(), t = { disableNormalization: !0 };
		for (let n = 0, r = this._linkService.pagesCount; n < r; n++) {
			let { promise: r, resolve: i } = Promise.withResolvers();
			this._extractTextPromises[n] = r, e = e.then(() => this._pdfDocument.getPage(n + 1).then((e) => e.getTextContent(t)).then((e) => {
				let t = [];
				for (let n of e.items) t.push(n.str), n.hasEOL && t.push("\n");
				[this._pageContents[n], this._pageDiffs[n], this._hasDiacritics[n]] = Fe(t.join("")), i();
			}, (e) => {
				console.error(`Unable to get text content for page ${n + 1}`, e), this._pageContents[n] = "", this._pageDiffs[n] = null, this._hasDiacritics[n] = !1, i();
			}));
		}
	}
	#d(e) {
		this._scrollMatches && this._selected.pageIdx === e && (this._linkService.page = e + 1), this._eventBus.dispatch("updatetextlayermatches", {
			source: this,
			pageIndex: e
		});
	}
	#f() {
		this._eventBus.dispatch("updatetextlayermatches", {
			source: this,
			pageIndex: -1
		});
	}
	#p() {
		let e = this.#e.findPrevious, t = this._linkService.page - 1, n = this._linkService.pagesCount;
		if (this._highlightMatches = !0, this._dirtyMatch) {
			this._dirtyMatch = !1, this._selected.pageIdx = this._selected.matchIdx = -1, this._offset.pageIdx = t, this._offset.matchIdx = null, this._offset.wrapped = !1, this._resumePageIdx = null, this._pageMatches.length = 0, this._pageMatchesLength.length = 0, this.#n = 0, this._matchesCountTotal = 0, this.#f();
			for (let e = 0; e < n; e++) this._pendingFindMatches.has(e) || (this._pendingFindMatches.add(e), this._extractTextPromises[e].then(() => {
				this._pendingFindMatches.delete(e), this.#l(e);
			}));
		}
		if (this.#a.length === 0) {
			this.#x(O.FOUND);
			return;
		}
		if (this._resumePageIdx) return;
		let r = this._offset;
		if (this._pagesToSearch = n, r.matchIdx !== null) {
			let t = this._pageMatches[r.pageIdx].length;
			if (!e && r.matchIdx + 1 < t || e && r.matchIdx > 0) {
				r.matchIdx = e ? r.matchIdx - 1 : r.matchIdx + 1, this.#_(!0);
				return;
			}
			this.#g(e);
		}
		this.#h();
	}
	#m(e) {
		let t = this._offset, n = e.length, r = this.#e.findPrevious;
		return n ? (t.matchIdx = r ? n - 1 : 0, this.#_(!0), !0) : (this.#g(r), t.wrapped && (t.matchIdx = null, this._pagesToSearch < 0) ? (this.#_(!1), !0) : !1);
	}
	#h() {
		this._resumePageIdx !== null && console.error("There can only be one pending page.");
		let e = null;
		do {
			let t = this._offset.pageIdx;
			if (e = this._pageMatches[t], !e) {
				this._resumePageIdx = t;
				break;
			}
		} while (!this.#m(e));
	}
	#g(e) {
		let t = this._offset, n = this._linkService.pagesCount;
		t.pageIdx = e ? t.pageIdx - 1 : t.pageIdx + 1, t.matchIdx = null, this._pagesToSearch--, (t.pageIdx >= n || t.pageIdx < 0) && (t.pageIdx = e ? n - 1 : 0, t.wrapped = !0);
	}
	#_(e = !1) {
		let t = O.NOT_FOUND, n = this._offset.wrapped;
		if (this._offset.wrapped = !1, e) {
			let e = this._selected.pageIdx;
			this._selected.pageIdx = this._offset.pageIdx, this._selected.matchIdx = this._offset.matchIdx, t = n ? O.WRAPPED : O.FOUND, e !== -1 && e !== this._selected.pageIdx && this.#d(e);
		}
		this.#x(t, this.#e.findPrevious), this._selected.pageIdx !== -1 && (this._scrollMatches = !0, this.#d(this._selected.pageIdx));
	}
	#v(e) {
		let t = this._pdfDocument;
		this._firstPageCapability.promise.then(() => {
			!this._pdfDocument || t && this._pdfDocument !== t || (this._findTimeout &&= (clearTimeout(this._findTimeout), null), this._resumePageIdx && (this._resumePageIdx = null, this._dirtyMatch = !0), this.#x(O.FOUND), this._highlightMatches = !1, this.#f());
		});
	}
	#y() {
		let { pageIdx: e, matchIdx: t } = this._selected, n = 0, r = this._matchesCountTotal;
		if (t !== -1) {
			for (let t = 0; t < e; t++) n += this._pageMatches[t]?.length || 0;
			n += t + 1;
		}
		return (n < 1 || n > r) && (n = r = 0), {
			current: n,
			total: r
		};
	}
	#b() {
		this._eventBus.dispatch("updatefindmatchescount", {
			source: this,
			matchesCount: this.#y()
		});
	}
	#x(e, t = !1) {
		!this.#t && (this.#n !== this._linkService.pagesCount || e === O.PENDING) || this._eventBus.dispatch("updatefindcontrolstate", {
			source: this,
			state: e,
			previous: t,
			entireWord: this.#e?.entireWord ?? null,
			matchesCount: this.#y(),
			rawQuery: this.#e?.query ?? null
		});
	}
}, Re = "noopener noreferrer nofollow", j = {
	NONE: 0,
	SELF: 1,
	BLANK: 2,
	PARENT: 3,
	TOP: 4
}, ze = class e {
	externalLinkEnabled = !0;
	constructor({ eventBus: e, externalLinkTarget: t = null, externalLinkRel: n = null, ignoreDestinationZoom: r = !1 } = {}) {
		this.eventBus = e, this.externalLinkTarget = t, this.externalLinkRel = n, this._ignoreDestinationZoom = r, this.baseUrl = null, this.pdfDocument = null, this.pdfViewer = null, this.pdfHistory = null;
	}
	setDocument(e, t = null) {
		this.baseUrl = t, this.pdfDocument = e;
	}
	setViewer(e) {
		this.pdfViewer = e;
	}
	setHistory(e) {
		this.pdfHistory = e;
	}
	get pagesCount() {
		return this.pdfDocument ? this.pdfDocument.numPages : 0;
	}
	get page() {
		return this.pdfDocument ? this.pdfViewer.currentPageNumber : 1;
	}
	set page(e) {
		this.pdfDocument && (this.pdfViewer.currentPageNumber = e);
	}
	get rotation() {
		return this.pdfDocument ? this.pdfViewer.pagesRotation : 0;
	}
	set rotation(e) {
		this.pdfDocument && (this.pdfViewer.pagesRotation = e);
	}
	get isInPresentationMode() {
		return this.pdfDocument ? this.pdfViewer.isInPresentationMode : !1;
	}
	async goToDestination(e) {
		if (!this.pdfDocument) return;
		let t, n, r;
		if (typeof e == "string" ? (t = e, n = await this.pdfDocument.getDestination(e)) : (t = null, n = await e), !Array.isArray(n)) {
			console.error(`goToDestination: "${n}" is not a valid destination array, for dest="${e}".`);
			return;
		}
		let [i] = n;
		if (i && typeof i == "object") {
			if (r = this.pdfDocument.cachedPageNumber(i), !r) try {
				r = await this.pdfDocument.getPageIndex(i) + 1;
			} catch {
				console.error(`goToDestination: "${i}" is not a valid page reference, for dest="${e}".`);
				return;
			}
		} else Number.isInteger(i) && (r = i + 1);
		if (!r || r < 1 || r > this.pagesCount) {
			console.error(`goToDestination: "${r}" is not a valid page number, for dest="${e}".`);
			return;
		}
		this.pdfHistory && (this.pdfHistory.pushCurrentPosition(), this.pdfHistory.push({
			namedDest: t,
			explicitDest: n,
			pageNumber: r
		})), this.pdfViewer.scrollPageIntoView({
			pageNumber: r,
			destArray: n,
			ignoreDestinationZoom: this._ignoreDestinationZoom
		});
	}
	goToPage(e) {
		if (!this.pdfDocument) return;
		let t = typeof e == "string" && this.pdfViewer.pageLabelToPageNumber(e) || e | 0;
		if (!(Number.isInteger(t) && t > 0 && t <= this.pagesCount)) {
			console.error(`PDFLinkService.goToPage: "${e}" is not a valid page.`);
			return;
		}
		this.pdfHistory && (this.pdfHistory.pushCurrentPosition(), this.pdfHistory.pushPage(t)), this.pdfViewer.scrollPageIntoView({ pageNumber: t });
	}
	addLinkAttributes(e, t, n = !1) {
		if (!t || typeof t != "string") throw Error("A valid \"url\" parameter must provided.");
		let r = n ? j.BLANK : this.externalLinkTarget, i = this.externalLinkRel;
		this.externalLinkEnabled ? e.href = e.title = t : (e.href = "", e.title = `Disabled: ${t}`, e.onclick = () => !1);
		let a = "";
		switch (r) {
			case j.NONE: break;
			case j.SELF:
				a = "_self";
				break;
			case j.BLANK:
				a = "_blank";
				break;
			case j.PARENT:
				a = "_parent";
				break;
			case j.TOP:
				a = "_top";
				break;
		}
		e.target = a, e.rel = typeof i == "string" ? i : Re;
	}
	getDestinationHash(e) {
		if (typeof e == "string") {
			if (e.length > 0) return this.getAnchorUrl("#" + escape(e));
		} else if (Array.isArray(e)) {
			let t = JSON.stringify(e);
			if (t.length > 0) return this.getAnchorUrl("#" + escape(t));
		}
		return this.getAnchorUrl("");
	}
	getAnchorUrl(e) {
		return this.baseUrl ? this.baseUrl + e : e;
	}
	setHash(t) {
		if (!this.pdfDocument) return;
		let n, r;
		if (t.includes("=")) {
			let e = v(t);
			if (e.has("search")) {
				let t = e.get("search").replaceAll("\"", ""), n = e.get("phrase") === "true";
				this.eventBus.dispatch("findfromurlhash", {
					source: this,
					query: n ? t : t.match(/\S+/g)
				});
			}
			if (e.has("page") && (n = e.get("page") | 0 || 1), e.has("zoom")) {
				let t = e.get("zoom").split(","), n = t[0], i = parseFloat(n);
				n.includes("Fit") ? n === "Fit" || n === "FitB" ? r = [null, { name: n }] : n === "FitH" || n === "FitBH" || n === "FitV" || n === "FitBV" ? r = [
					null,
					{ name: n },
					t.length > 1 ? t[1] | 0 : null
				] : n === "FitR" ? t.length === 5 ? r = [
					null,
					{ name: n },
					t[1] | 0,
					t[2] | 0,
					t[3] | 0,
					t[4] | 0
				] : console.error("PDFLinkService.setHash: Not enough parameters for \"FitR\".") : console.error(`PDFLinkService.setHash: "${n}" is not a valid zoom value.`) : r = [
					null,
					{ name: "XYZ" },
					t.length > 1 ? t[1] | 0 : null,
					t.length > 2 ? t[2] | 0 : null,
					i ? i / 100 : n
				];
			}
			r ? this.pdfViewer.scrollPageIntoView({
				pageNumber: n || this.page,
				destArray: r,
				allowNegativeOffset: !0
			}) : n && (this.page = n), e.has("pagemode") && this.eventBus.dispatch("pagemode", {
				source: this,
				mode: e.get("pagemode")
			}), e.has("nameddest") && this.goToDestination(e.get("nameddest"));
			return;
		}
		r = unescape(t);
		try {
			r = JSON.parse(r), Array.isArray(r) || (r = r.toString());
		} catch {}
		if (typeof r == "string" || e.#e(r)) {
			this.goToDestination(r);
			return;
		}
		console.error(`PDFLinkService.setHash: "${unescape(t)}" is not a valid destination.`);
	}
	executeNamedAction(e) {
		if (this.pdfDocument) {
			switch (e) {
				case "GoBack":
					this.pdfHistory?.back();
					break;
				case "GoForward":
					this.pdfHistory?.forward();
					break;
				case "NextPage":
					this.pdfViewer.nextPage();
					break;
				case "PrevPage":
					this.pdfViewer.previousPage();
					break;
				case "LastPage":
					this.page = this.pagesCount;
					break;
				case "FirstPage":
					this.page = 1;
					break;
				default: break;
			}
			this.eventBus.dispatch("namedaction", {
				source: this,
				action: e
			});
		}
	}
	async executeSetOCGState(e) {
		if (!this.pdfDocument) return;
		let t = this.pdfDocument, n = await this.pdfViewer.optionalContentConfigPromise;
		t === this.pdfDocument && (n.setOCGState(e), this.pdfViewer.optionalContentConfigPromise = Promise.resolve(n));
	}
	static #e(e) {
		if (!Array.isArray(e) || e.length < 2) return !1;
		let [t, n, ...r] = e;
		if (!(typeof t == "object" && Number.isInteger(t?.num) && Number.isInteger(t?.gen)) && !Number.isInteger(t) || !(typeof n == "object" && typeof n?.name == "string")) return !1;
		let i = r.length, a = !0;
		switch (n.name) {
			case "XYZ":
				if (i < 2 || i > 3) return !1;
				break;
			case "Fit":
			case "FitB": return i === 0;
			case "FitH":
			case "FitBH":
			case "FitV":
			case "FitBV":
				if (i > 1) return !1;
				break;
			case "FitR":
				if (i !== 4) return !1;
				a = !1;
				break;
			default: return !1;
		}
		for (let e of r) if (!(typeof e == "number" || a && e === null)) return !1;
		return !0;
	}
}, Be = class extends ze {
	setDocument(e, t = null) {}
}, { AbortException: Ve, AnnotationEditorLayer: He, AnnotationEditorParamsType: Ue, AnnotationEditorType: M, AnnotationEditorUIManager: We, AnnotationLayer: Ge, AnnotationMode: N, build: Ke, ColorPicker: qe, createValidAbsoluteUrl: Je, DOMSVGFactory: Ye, DrawLayer: Xe, FeatureTest: Ze, fetchData: Qe, getDocument: $e, getFilenameFromUrl: et, getPdfFilenameFromUrl: tt, getXfaPageViewport: nt, GlobalWorkerOptions: rt, ImageKind: it, InvalidPDFException: at, isDataScheme: ot, isPdfFile: st, MissingPDFException: ct, noContextMenu: lt, normalizeUnicode: ut, OPS: dt, OutputScale: ft, PasswordResponses: pt, PDFDataRangeTransport: mt, PDFDateString: ht, PDFWorker: gt, PermissionFlag: P, PixelsPerInch: F, RenderingCancelledException: I, setLayerDimensions: _t, shadow: L, stopEvent: R, TextLayer: vt, TouchManager: yt, UnexpectedResponseException: bt, Util: xt, VerbosityLevel: St, version: Ct, XfaLayer: z } = globalThis.pdfjsLib, wt = class {
	#e = null;
	#t = null;
	constructor({ pdfPage: e, linkService: t, downloadManager: n, annotationStorage: r = null, imageResourcesPath: i = "", renderForms: a = !0, enableScripting: o = !1, hasJSActionsPromise: s = null, fieldObjectsPromise: c = null, annotationCanvasMap: l = null, accessibilityManager: u = null, annotationEditorUIManager: d = null, onAppend: f = null }) {
		this.pdfPage = e, this.linkService = t, this.downloadManager = n, this.imageResourcesPath = i, this.renderForms = a, this.annotationStorage = r, this.enableScripting = o, this._hasJSActionsPromise = s || Promise.resolve(!1), this._fieldObjectsPromise = c || Promise.resolve(null), this._annotationCanvasMap = l, this._accessibilityManager = u, this._annotationEditorUIManager = d, this.#e = f, this.annotationLayer = null, this.div = null, this._cancelled = !1, this._eventBus = t.eventBus;
	}
	async render(e, t, n = "display") {
		if (this.div) {
			if (this._cancelled || !this.annotationLayer) return;
			this.annotationLayer.update({ viewport: e.clone({ dontFlip: !0 }) });
			return;
		}
		let [r, i, a] = await Promise.all([
			this.pdfPage.getAnnotations({ intent: n }),
			this._hasJSActionsPromise,
			this._fieldObjectsPromise
		]);
		if (this._cancelled) return;
		let o = this.div = document.createElement("div");
		if (o.className = "annotationLayer", this.#e?.(o), r.length === 0) {
			this.hide();
			return;
		}
		this.annotationLayer = new Ge({
			div: o,
			accessibilityManager: this._accessibilityManager,
			annotationCanvasMap: this._annotationCanvasMap,
			annotationEditorUIManager: this._annotationEditorUIManager,
			page: this.pdfPage,
			viewport: e.clone({ dontFlip: !0 }),
			structTreeLayer: t?.structTreeLayer || null
		}), await this.annotationLayer.render({
			annotations: r,
			imageResourcesPath: this.imageResourcesPath,
			renderForms: this.renderForms,
			linkService: this.linkService,
			downloadManager: this.downloadManager,
			annotationStorage: this.annotationStorage,
			enableScripting: this.enableScripting,
			hasJSActions: i,
			fieldObjects: a
		}), this.linkService.isInPresentationMode && this.#n(f.FULLSCREEN), this.#t || (this.#t = new AbortController(), this._eventBus?._on("presentationmodechanged", (e) => {
			this.#n(e.state);
		}, { signal: this.#t.signal }));
	}
	cancel() {
		this._cancelled = !0, this.#t?.abort(), this.#t = null;
	}
	hide() {
		this.div && (this.div.hidden = !0);
	}
	hasEditableAnnotations() {
		return !!this.annotationLayer?.hasEditableAnnotations();
	}
	#n(e) {
		if (!this.div) return;
		let t = !1;
		switch (e) {
			case f.FULLSCREEN:
				t = !0;
				break;
			case f.NORMAL: break;
			default: return;
		}
		for (let e of this.div.childNodes) e.hasAttribute("data-internal-link") || (e.inert = t);
	}
};
function Tt(e, t) {
	let n = document.createElement("a");
	if (!n.click) throw Error("DownloadManager: \"a.click()\" is not supported.");
	n.href = e, n.target = "_parent", "download" in n && (n.download = t), (document.body || document.documentElement).append(n), n.click(), n.remove();
}
var Et = class {
	downloadData(e, t, n) {
		Tt(URL.createObjectURL(new Blob([e], { type: n })), t);
	}
	openOrDownloadData(e, t, n = null) {
		let r = st(t) ? "application/pdf" : "";
		return this.downloadData(e, t, r), !1;
	}
	download(e, t, n) {
		let r;
		if (e) r = URL.createObjectURL(new Blob([e], { type: "application/pdf" }));
		else {
			if (!Je(t, "http://example.com")) {
				console.error(`download - not a valid URL: ${t}`);
				return;
			}
			r = t + "#pdfjs.action=download";
		}
		Tt(r, n);
	}
}, Dt = {
	EVENT: "event",
	TIMEOUT: "timeout"
};
async function Ot({ target: e, name: t, delay: n = 0 }) {
	if (typeof e != "object" || !(t && typeof t == "string") || !(Number.isInteger(n) && n >= 0)) throw Error("waitOnEventOrTimeout - invalid parameters.");
	let { promise: r, resolve: i } = Promise.withResolvers(), a = new AbortController();
	function o(e) {
		a.abort(), clearTimeout(s), i(e);
	}
	e[e instanceof kt ? "_on" : "addEventListener"](t, o.bind(null, Dt.EVENT), { signal: a.signal });
	let s = setTimeout(o.bind(null, Dt.TIMEOUT), n);
	return r;
}
var kt = class {
	#e = Object.create(null);
	on(e, t, n = null) {
		this._on(e, t, {
			external: !0,
			once: n?.once,
			signal: n?.signal
		});
	}
	off(e, t, n = null) {
		this._off(e, t);
	}
	dispatch(e, t) {
		let n = this.#e[e];
		if (!n || n.length === 0) return;
		let r;
		for (let { listener: i, external: a, once: o } of n.slice(0)) {
			if (o && this._off(e, i), a) {
				(r ||= []).push(i);
				continue;
			}
			i(t);
		}
		if (r) {
			for (let e of r) e(t);
			r = null;
		}
	}
	_on(e, t, n = null) {
		let r = null;
		if (n?.signal instanceof AbortSignal) {
			let { signal: i } = n;
			if (i.aborted) {
				console.error("Cannot use an `aborted` signal.");
				return;
			}
			let a = () => this._off(e, t);
			r = () => i.removeEventListener("abort", a), i.addEventListener("abort", a);
		}
		(this.#e[e] ||= []).push({
			listener: t,
			external: n?.external === !0,
			once: n?.once === !0,
			rmAbort: r
		});
	}
	_off(e, t, n = null) {
		let r = this.#e[e];
		if (r) for (let e = 0, n = r.length; e < n; e++) {
			let n = r[e];
			if (n.listener === t) {
				n.rmAbort?.(), r.splice(e, 1);
				return;
			}
		}
	}
}, B = class {
	constructor(e) {
		this.value = e;
	}
	valueOf() {
		return this.value;
	}
}, V = class extends B {
	constructor(e = "???") {
		super(e);
	}
	toString(e) {
		return `{${this.value}}`;
	}
}, H = class extends B {
	constructor(e, t = {}) {
		super(e), this.opts = t;
	}
	toString(e) {
		try {
			return e.memoizeIntlObject(Intl.NumberFormat, this.opts).format(this.value);
		} catch (t) {
			return e.reportError(t), this.value.toString(10);
		}
	}
}, U = class extends B {
	constructor(e, t = {}) {
		super(e), this.opts = t;
	}
	toString(e) {
		try {
			return e.memoizeIntlObject(Intl.DateTimeFormat, this.opts).format(this.value);
		} catch (t) {
			return e.reportError(t), new Date(this.value).toISOString();
		}
	}
}, At = 100, jt = "⁨", Mt = "⁩";
function Nt(e, t, n) {
	return n === t || n instanceof H && t instanceof H && n.value === t.value || t instanceof H && typeof n == "string" && n === e.memoizeIntlObject(Intl.PluralRules, t.opts).select(t.value);
}
function Pt(e, t, n) {
	return t[n] ? G(e, t[n].value) : (e.reportError(/* @__PURE__ */ RangeError("No default")), new V());
}
function Ft(e, t) {
	let n = [], r = Object.create(null);
	for (let i of t) i.type === "narg" ? r[i.name] = W(e, i.value) : n.push(W(e, i));
	return {
		positional: n,
		named: r
	};
}
function W(e, t) {
	switch (t.type) {
		case "str": return t.value;
		case "num": return new H(t.value, { minimumFractionDigits: t.precision });
		case "var": return It(e, t);
		case "mesg": return Lt(e, t);
		case "term": return Rt(e, t);
		case "func": return zt(e, t);
		case "select": return Bt(e, t);
		default: return new V();
	}
}
function It(e, { name: t }) {
	let n;
	if (e.params) if (Object.prototype.hasOwnProperty.call(e.params, t)) n = e.params[t];
	else return new V(`$${t}`);
	else if (e.args && Object.prototype.hasOwnProperty.call(e.args, t)) n = e.args[t];
	else return e.reportError(/* @__PURE__ */ ReferenceError(`Unknown variable: $${t}`)), new V(`$${t}`);
	if (n instanceof B) return n;
	switch (typeof n) {
		case "string": return n;
		case "number": return new H(n);
		case "object": if (n instanceof Date) return new U(n.getTime());
		default: return e.reportError(/* @__PURE__ */ TypeError(`Variable type not supported: $${t}, ${typeof n}`)), new V(`$${t}`);
	}
}
function Lt(e, { name: t, attr: n }) {
	let r = e.bundle._messages.get(t);
	if (!r) return e.reportError(/* @__PURE__ */ ReferenceError(`Unknown message: ${t}`)), new V(t);
	if (n) {
		let i = r.attributes[n];
		return i ? G(e, i) : (e.reportError(/* @__PURE__ */ ReferenceError(`Unknown attribute: ${n}`)), new V(`${t}.${n}`));
	}
	return r.value ? G(e, r.value) : (e.reportError(/* @__PURE__ */ ReferenceError(`No value: ${t}`)), new V(t));
}
function Rt(e, { name: t, attr: n, args: r }) {
	let i = `-${t}`, a = e.bundle._terms.get(i);
	if (!a) return e.reportError(/* @__PURE__ */ ReferenceError(`Unknown term: ${i}`)), new V(i);
	if (n) {
		let t = a.attributes[n];
		if (t) {
			e.params = Ft(e, r).named;
			let n = G(e, t);
			return e.params = null, n;
		}
		return e.reportError(/* @__PURE__ */ ReferenceError(`Unknown attribute: ${n}`)), new V(`${i}.${n}`);
	}
	e.params = Ft(e, r).named;
	let o = G(e, a.value);
	return e.params = null, o;
}
function zt(e, { name: t, args: n }) {
	let r = e.bundle._functions[t];
	if (!r) return e.reportError(/* @__PURE__ */ ReferenceError(`Unknown function: ${t}()`)), new V(`${t}()`);
	if (typeof r != "function") return e.reportError(/* @__PURE__ */ TypeError(`Function ${t}() is not callable`)), new V(`${t}()`);
	try {
		let t = Ft(e, n);
		return r(t.positional, t.named);
	} catch (n) {
		return e.reportError(n), new V(`${t}()`);
	}
}
function Bt(e, { selector: t, variants: n, star: r }) {
	let i = W(e, t);
	if (i instanceof V) return Pt(e, n, r);
	for (let t of n) if (Nt(e, i, W(e, t.key))) return G(e, t.value);
	return Pt(e, n, r);
}
function Vt(e, t) {
	if (e.dirty.has(t)) return e.reportError(/* @__PURE__ */ RangeError("Cyclic reference")), new V();
	e.dirty.add(t);
	let n = [], r = e.bundle._useIsolating && t.length > 1;
	for (let i of t) {
		if (typeof i == "string") {
			n.push(e.bundle._transform(i));
			continue;
		}
		if (e.placeables++, e.placeables > At) throw e.dirty.delete(t), RangeError(`Too many placeables expanded: ${e.placeables}, max allowed is ${At}`);
		r && n.push(jt), n.push(W(e, i).toString(e)), r && n.push(Mt);
	}
	return e.dirty.delete(t), n.join("");
}
function G(e, t) {
	return typeof t == "string" ? e.bundle._transform(t) : Vt(e, t);
}
var Ht = class {
	constructor(e, t, n) {
		this.dirty = /* @__PURE__ */ new WeakSet(), this.params = null, this.placeables = 0, this.bundle = e, this.errors = t, this.args = n;
	}
	reportError(e) {
		if (!this.errors || !(e instanceof Error)) throw e;
		this.errors.push(e);
	}
	memoizeIntlObject(e, t) {
		let n = this.bundle._intls.get(e);
		n || (n = {}, this.bundle._intls.set(e, n));
		let r = JSON.stringify(t);
		return n[r] || (n[r] = new e(this.bundle.locales, t)), n[r];
	}
};
function K(e, t) {
	let n = Object.create(null);
	for (let [r, i] of Object.entries(e)) t.includes(r) && (n[r] = i.valueOf());
	return n;
}
var Ut = [
	"unitDisplay",
	"currencyDisplay",
	"useGrouping",
	"minimumIntegerDigits",
	"minimumFractionDigits",
	"maximumFractionDigits",
	"minimumSignificantDigits",
	"maximumSignificantDigits"
];
function Wt(e, t) {
	let n = e[0];
	if (n instanceof V) return new V(`NUMBER(${n.valueOf()})`);
	if (n instanceof H) return new H(n.valueOf(), {
		...n.opts,
		...K(t, Ut)
	});
	if (n instanceof U) return new H(n.valueOf(), { ...K(t, Ut) });
	throw TypeError("Invalid argument to NUMBER");
}
var Gt = [
	"dateStyle",
	"timeStyle",
	"fractionalSecondDigits",
	"dayPeriod",
	"hour12",
	"weekday",
	"era",
	"year",
	"month",
	"day",
	"hour",
	"minute",
	"second",
	"timeZoneName"
];
function Kt(e, t) {
	let n = e[0];
	if (n instanceof V) return new V(`DATETIME(${n.valueOf()})`);
	if (n instanceof U) return new U(n.valueOf(), {
		...n.opts,
		...K(t, Gt)
	});
	if (n instanceof H) return new U(n.valueOf(), { ...K(t, Gt) });
	throw TypeError("Invalid argument to DATETIME");
}
var qt = /* @__PURE__ */ new Map();
function Jt(e) {
	let t = Array.isArray(e) ? e.join(" ") : e, n = qt.get(t);
	return n === void 0 && (n = /* @__PURE__ */ new Map(), qt.set(t, n)), n;
}
var Yt = class {
	constructor(e, { functions: t, useIsolating: n = !0, transform: r = (e) => e } = {}) {
		this._terms = /* @__PURE__ */ new Map(), this._messages = /* @__PURE__ */ new Map(), this.locales = Array.isArray(e) ? e : [e], this._functions = {
			NUMBER: Wt,
			DATETIME: Kt,
			...t
		}, this._useIsolating = n, this._transform = r, this._intls = Jt(e);
	}
	hasMessage(e) {
		return this._messages.has(e);
	}
	getMessage(e) {
		return this._messages.get(e);
	}
	addResource(e, { allowOverrides: t = !1 } = {}) {
		let n = [];
		for (let r = 0; r < e.body.length; r++) {
			let i = e.body[r];
			if (i.id.startsWith("-")) {
				if (t === !1 && this._terms.has(i.id)) {
					n.push(/* @__PURE__ */ Error(`Attempt to override an existing term: "${i.id}"`));
					continue;
				}
				this._terms.set(i.id, i);
			} else {
				if (t === !1 && this._messages.has(i.id)) {
					n.push(/* @__PURE__ */ Error(`Attempt to override an existing message: "${i.id}"`));
					continue;
				}
				this._messages.set(i.id, i);
			}
		}
		return n;
	}
	formatPattern(e, t = null, n = null) {
		if (typeof e == "string") return this._transform(e);
		let r = new Ht(this, n, t);
		try {
			return Vt(r, e).toString(r);
		} catch (e) {
			if (r.errors && e instanceof Error) return r.errors.push(e), new V().toString(r);
			throw e;
		}
	}
}, Xt = /^(-?[a-zA-Z][\w-]*) *= */gm, Zt = /\.([a-zA-Z][\w-]*) *= */y, Qt = /\*?\[/y, $t = /(-?[0-9]+(?:\.([0-9]+))?)/y, en = /([a-zA-Z][\w-]*)/y, tn = /([$-])?([a-zA-Z][\w-]*)(?:\.([a-zA-Z][\w-]*))?/y, nn = /^[A-Z][A-Z0-9_-]*$/, q = /([^{}\n\r]+)/y, rn = /([^\\"\n\r]*)/y, an = /\\([\\"])/y, on = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{6})/y, sn = /^\n+/, cn = / +$/, ln = / *\r?\n/g, un = /( *)$/, dn = /{\s*/y, fn = /\s*}/y, pn = /\[\s*/y, mn = /\s*] */y, hn = /\s*\(\s*/y, gn = /\s*->\s*/y, _n = /\s*:\s*/y, vn = /\s*,?\s*/y, yn = /\s+/y, bn = class {
	constructor(e) {
		this.body = [], Xt.lastIndex = 0;
		let t = 0;
		for (;;) {
			let n = Xt.exec(e);
			if (n === null) break;
			t = Xt.lastIndex;
			try {
				this.body.push(s(n[1]));
			} catch (e) {
				if (e instanceof SyntaxError) continue;
				throw e;
			}
		}
		function n(n) {
			return n.lastIndex = t, n.test(e);
		}
		function r(n, r) {
			if (e[t] === n) return t++, !0;
			if (r) throw new r(`Expected ${n}`);
			return !1;
		}
		function i(e, r) {
			if (n(e)) return t = e.lastIndex, !0;
			if (r) throw new r(`Expected ${e.toString()}`);
			return !1;
		}
		function a(n) {
			n.lastIndex = t;
			let r = n.exec(e);
			if (r === null) throw SyntaxError(`Expected ${n.toString()}`);
			return t = n.lastIndex, r;
		}
		function o(e) {
			return a(e)[1];
		}
		function s(e) {
			let t = l(), n = c();
			if (t === null && Object.keys(n).length === 0) throw SyntaxError("Expected message value or attributes");
			return {
				id: e,
				value: t,
				attributes: n
			};
		}
		function c() {
			let e = Object.create(null);
			for (; n(Zt);) {
				let t = o(Zt), n = l();
				if (n === null) throw SyntaxError("Expected attribute value");
				e[t] = n;
			}
			return e;
		}
		function l() {
			let r;
			if (n(q) && (r = o(q)), e[t] === "{" || e[t] === "}") return u(r ? [r] : [], Infinity);
			let i = x();
			return i ? r ? u([r, i], i.length) : (i.value = S(i.value, sn), u([i], i.length)) : r ? S(r, cn) : null;
		}
		function u(r = [], i) {
			for (;;) {
				if (n(q)) {
					r.push(o(q));
					continue;
				}
				if (e[t] === "{") {
					r.push(d());
					continue;
				}
				if (e[t] === "}") throw SyntaxError("Unbalanced closing brace");
				let a = x();
				if (a) {
					r.push(a), i = Math.min(i, a.length);
					continue;
				}
				break;
			}
			let a = r.length - 1, s = r[a];
			typeof s == "string" && (r[a] = S(s, cn));
			let c = [];
			for (let e of r) e instanceof xn && (e = e.value.slice(0, e.value.length - i)), e && c.push(e);
			return c;
		}
		function d() {
			i(dn, SyntaxError);
			let e = f();
			if (i(fn)) return e;
			if (i(gn)) {
				let t = h();
				return i(fn, SyntaxError), {
					type: "select",
					selector: e,
					...t
				};
			}
			throw SyntaxError("Unclosed placeable");
		}
		function f() {
			if (e[t] === "{") return d();
			if (n(tn)) {
				let [, e, t, n = null] = a(tn);
				if (e === "$") return {
					type: "var",
					name: t
				};
				if (i(hn)) {
					let r = p();
					if (e === "-") return {
						type: "term",
						name: t,
						attr: n,
						args: r
					};
					if (nn.test(t)) return {
						type: "func",
						name: t,
						args: r
					};
					throw SyntaxError("Function names must be all upper-case");
				}
				return e === "-" ? {
					type: "term",
					name: t,
					attr: n,
					args: []
				} : {
					type: "mesg",
					name: t,
					attr: n
				};
			}
			return _();
		}
		function p() {
			let n = [];
			for (;;) {
				switch (e[t]) {
					case ")": return t++, n;
					case void 0: throw SyntaxError("Unclosed argument list");
				}
				n.push(m()), i(vn);
			}
		}
		function m() {
			let e = f();
			return e.type === "mesg" && i(_n) ? {
				type: "narg",
				name: e.name,
				value: _()
			} : e;
		}
		function h() {
			let e = [], t = 0, i;
			for (; n(Qt);) {
				r("*") && (i = t);
				let n = g(), a = l();
				if (a === null) throw SyntaxError("Expected variant value");
				e[t++] = {
					key: n,
					value: a
				};
			}
			if (t === 0) return null;
			if (i === void 0) throw SyntaxError("Expected default variant");
			return {
				variants: e,
				star: i
			};
		}
		function g() {
			i(pn, SyntaxError);
			let e;
			return e = n($t) ? v() : {
				type: "str",
				value: o(en)
			}, i(mn, SyntaxError), e;
		}
		function _() {
			if (n($t)) return v();
			if (e[t] === "\"") return y();
			throw SyntaxError("Invalid expression");
		}
		function v() {
			let [, e, t = ""] = a($t), n = t.length;
			return {
				type: "num",
				value: parseFloat(e),
				precision: n
			};
		}
		function y() {
			r("\"", SyntaxError);
			let n = "";
			for (;;) {
				if (n += o(rn), e[t] === "\\") {
					n += b();
					continue;
				}
				if (r("\"")) return {
					type: "str",
					value: n
				};
				throw SyntaxError("Unclosed string literal");
			}
		}
		function b() {
			if (n(an)) return o(an);
			if (n(on)) {
				let [, e, t] = a(on), n = parseInt(e || t, 16);
				return n <= 55295 || 57344 <= n ? String.fromCodePoint(n) : "�";
			}
			throw SyntaxError("Unknown escape sequence");
		}
		function x() {
			let n = t;
			switch (i(yn), e[t]) {
				case ".":
				case "[":
				case "*":
				case "}":
				case void 0: return !1;
				case "{": return C(e.slice(n, t));
			}
			return e[t - 1] === " " ? C(e.slice(n, t)) : !1;
		}
		function S(e, t) {
			return e.replace(t, "");
		}
		function C(e) {
			let t = e.replace(ln, "\n"), n = un.exec(e)[1].length;
			return new xn(t, n);
		}
	}
}, xn = class {
	constructor(e, t) {
		this.value = e, this.length = t;
	}
}, Sn = /<|&#?\w+;/, Cn = { "http://www.w3.org/1999/xhtml": [
	"em",
	"strong",
	"small",
	"s",
	"cite",
	"q",
	"dfn",
	"abbr",
	"data",
	"time",
	"code",
	"var",
	"samp",
	"kbd",
	"sub",
	"sup",
	"i",
	"b",
	"u",
	"mark",
	"bdi",
	"bdo",
	"span",
	"br",
	"wbr"
] }, wn = {
	"http://www.w3.org/1999/xhtml": {
		global: [
			"title",
			"aria-label",
			"aria-valuetext"
		],
		a: ["download"],
		area: ["download", "alt"],
		input: ["alt", "placeholder"],
		menuitem: ["label"],
		menu: ["label"],
		optgroup: ["label"],
		option: ["label"],
		track: ["label"],
		img: ["alt"],
		textarea: ["placeholder"],
		th: ["abbr"]
	},
	"http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul": {
		global: [
			"accesskey",
			"aria-label",
			"aria-valuetext",
			"label",
			"title",
			"tooltiptext"
		],
		description: ["value"],
		key: ["key", "keycode"],
		label: ["value"],
		textbox: ["placeholder", "value"]
	}
};
function Tn(e, t) {
	let { value: n } = t;
	if (typeof n == "string") if (e.localName === "title" && e.namespaceURI === "http://www.w3.org/1999/xhtml") e.textContent = n;
	else if (!Sn.test(n)) e.textContent = n;
	else {
		let t = e.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "template");
		t.innerHTML = n, En(t.content, e);
	}
	On(t, e);
}
function En(e, t) {
	for (let n of e.childNodes) if (n.nodeType !== n.TEXT_NODE) {
		if (n.hasAttribute("data-l10n-name")) {
			let r = kn(t, n);
			e.replaceChild(r, n);
			continue;
		}
		if (Mn(n)) {
			let t = An(n);
			e.replaceChild(t, n);
			continue;
		}
		console.warn(`An element of forbidden type "${n.localName}" was found in the translation. Only safe text-level elements and elements with data-l10n-name are allowed.`), e.replaceChild(jn(n), n);
	}
	t.textContent = "", t.appendChild(e);
}
function Dn(e, t) {
	if (!e) return !1;
	for (let n of e) if (n.name === t) return !0;
	return !1;
}
function On(e, t) {
	let n = t.hasAttribute("data-l10n-attrs") ? t.getAttribute("data-l10n-attrs").split(",").map((e) => e.trim()) : null;
	for (let r of Array.from(t.attributes)) Nn(r.name, t, n) && !Dn(e.attributes, r.name) && t.removeAttribute(r.name);
	if (e.attributes) for (let r of Array.from(e.attributes)) Nn(r.name, t, n) && t.getAttribute(r.name) !== r.value && t.setAttribute(r.name, r.value);
}
function kn(e, t) {
	let n = t.getAttribute("data-l10n-name"), r = e.querySelector(`[data-l10n-name="${n}"]`);
	return r ? r.localName === t.localName ? (e.removeChild(r), Pn(t, r.cloneNode(!1))) : (console.warn(`An element named "${n}" was found in the translation but its type ${t.localName} didn't match the element found in the source (${r.localName}).`), jn(t)) : (console.warn(`An element named "${n}" wasn't found in the source.`), jn(t));
}
function An(e) {
	return Pn(e, e.ownerDocument.createElement(e.localName));
}
function jn(e) {
	return e.ownerDocument.createTextNode(e.textContent);
}
function Mn(e) {
	let t = Cn[e.namespaceURI];
	return t && t.includes(e.localName);
}
function Nn(e, t, n = null) {
	if (n && n.includes(e)) return !0;
	let r = wn[t.namespaceURI];
	if (!r) return !1;
	let i = e.toLowerCase(), a = t.localName;
	if (r.global.includes(i)) return !0;
	if (!r[a]) return !1;
	if (r[a].includes(i)) return !0;
	if (t.namespaceURI === "http://www.w3.org/1999/xhtml" && a === "input" && i === "value") {
		let e = t.type.toLowerCase();
		if (e === "submit" || e === "button" || e === "reset") return !0;
	}
	return !1;
}
function Pn(e, t) {
	return t.textContent = e.textContent, On(e, t), t;
}
var Fn = class extends Array {
	static from(e) {
		return e instanceof this ? e : new this(e);
	}
}, In = class extends Fn {
	constructor(e) {
		if (super(), Symbol.asyncIterator in Object(e)) this.iterator = e[Symbol.asyncIterator]();
		else if (Symbol.iterator in Object(e)) this.iterator = e[Symbol.iterator]();
		else throw TypeError("Argument must implement the iteration protocol.");
	}
	[Symbol.asyncIterator]() {
		let e = this, t = 0;
		return { async next() {
			return e.length <= t && e.push(e.iterator.next()), e[t++];
		} };
	}
	async touchNext(e = 1) {
		let t = 0;
		for (; t++ < e;) {
			let e = this[this.length - 1];
			if (e && (await e).done) break;
			this.push(this.iterator.next());
		}
		return this[this.length - 1];
	}
}, Ln = class {
	constructor(e = [], t) {
		this.resourceIds = e, this.generateBundles = t, this.onChange(!0);
	}
	addResourceIds(e, t = !1) {
		return this.resourceIds.push(...e), this.onChange(t), this.resourceIds.length;
	}
	removeResourceIds(e) {
		return this.resourceIds = this.resourceIds.filter((t) => !e.includes(t)), this.onChange(), this.resourceIds.length;
	}
	async formatWithFallback(e, t) {
		let n = [], r = !1;
		for await (let i of this.bundles) {
			r = !0;
			let a = Bn(t, i, e, n);
			if (a.size === 0) break;
			if (typeof console < "u") {
				let e = i.locales[0], t = Array.from(a).join(", ");
				console.warn(`[fluent] Missing translations in ${e}: ${t}`);
			}
		}
		return !r && typeof console < "u" && console.warn(`[fluent] Request for keys failed because no resource bundles got generated.
  keys: ${JSON.stringify(e)}.
  resourceIds: ${JSON.stringify(this.resourceIds)}.`), n;
	}
	formatMessages(e) {
		return this.formatWithFallback(e, zn);
	}
	formatValues(e) {
		return this.formatWithFallback(e, Rn);
	}
	async formatValue(e, t) {
		let [n] = await this.formatValues([{
			id: e,
			args: t
		}]);
		return n;
	}
	handleEvent() {
		this.onChange();
	}
	onChange(e = !1) {
		this.bundles = In.from(this.generateBundles(this.resourceIds)), e && this.bundles.touchNext(2);
	}
};
function Rn(e, t, n, r) {
	return n.value ? e.formatPattern(n.value, r, t) : null;
}
function zn(e, t, n, r) {
	let i = {
		value: null,
		attributes: null
	};
	n.value && (i.value = e.formatPattern(n.value, r, t));
	let a = Object.keys(n.attributes);
	if (a.length > 0) {
		i.attributes = Array(a.length);
		for (let [o, s] of a.entries()) {
			let a = e.formatPattern(n.attributes[s], r, t);
			i.attributes[o] = {
				name: s,
				value: a
			};
		}
	}
	return i;
}
function Bn(e, t, n, r) {
	let i = [], a = /* @__PURE__ */ new Set();
	return n.forEach(({ id: n, args: o }, s) => {
		if (r[s] !== void 0) return;
		let c = t.getMessage(n);
		if (c) {
			if (i.length = 0, r[s] = e(t, i, c, o), i.length > 0 && typeof console < "u") {
				let e = t.locales[0], r = i.join(", ");
				console.warn(`[fluent][resolver] errors in ${e}/${n}: ${r}.`);
			}
		} else a.add(n);
	}), a;
}
var J = "data-l10n-id", Y = "data-l10n-args", Vn = `[${J}]`, Hn = class extends Ln {
	constructor(e, t) {
		super(e, t), this.roots = /* @__PURE__ */ new Set(), this.pendingrAF = null, this.pendingElements = /* @__PURE__ */ new Set(), this.windowElement = null, this.mutationObserver = null, this.observerConfig = {
			attributes: !0,
			characterData: !1,
			childList: !0,
			subtree: !0,
			attributeFilter: [J, Y]
		};
	}
	onChange(e = !1) {
		super.onChange(e), this.roots && this.translateRoots();
	}
	setAttributes(e, t, n) {
		return e.setAttribute(J, t), n ? e.setAttribute(Y, JSON.stringify(n)) : e.removeAttribute(Y), e;
	}
	getAttributes(e) {
		return {
			id: e.getAttribute(J),
			args: JSON.parse(e.getAttribute(Y) || null)
		};
	}
	connectRoot(e) {
		for (let t of this.roots) if (t === e || t.contains(e) || e.contains(t)) throw Error("Cannot add a root that overlaps with existing root.");
		if (this.windowElement) {
			if (this.windowElement !== e.ownerDocument.defaultView) throw Error("Cannot connect a root:\n          DOMLocalization already has a root from a different window.");
		} else this.windowElement = e.ownerDocument.defaultView, this.mutationObserver = new this.windowElement.MutationObserver((e) => this.translateMutations(e));
		this.roots.add(e), this.mutationObserver.observe(e, this.observerConfig);
	}
	disconnectRoot(e) {
		return this.roots.delete(e), this.pauseObserving(), this.roots.size === 0 ? (this.mutationObserver = null, this.windowElement && this.pendingrAF && this.windowElement.cancelAnimationFrame(this.pendingrAF), this.windowElement = null, this.pendingrAF = null, this.pendingElements.clear(), !0) : (this.resumeObserving(), !1);
	}
	translateRoots() {
		let e = Array.from(this.roots);
		return Promise.all(e.map((e) => this.translateFragment(e)));
	}
	pauseObserving() {
		this.mutationObserver && (this.translateMutations(this.mutationObserver.takeRecords()), this.mutationObserver.disconnect());
	}
	resumeObserving() {
		if (this.mutationObserver) for (let e of this.roots) this.mutationObserver.observe(e, this.observerConfig);
	}
	translateMutations(e) {
		for (let t of e) switch (t.type) {
			case "attributes":
				t.target.hasAttribute("data-l10n-id") && this.pendingElements.add(t.target);
				break;
			case "childList":
				for (let e of t.addedNodes) if (e.nodeType === e.ELEMENT_NODE) if (e.childElementCount) for (let t of this.getTranslatables(e)) this.pendingElements.add(t);
				else e.hasAttribute(J) && this.pendingElements.add(e);
				break;
		}
		this.pendingElements.size > 0 && this.pendingrAF === null && (this.pendingrAF = this.windowElement.requestAnimationFrame(() => {
			this.translateElements(Array.from(this.pendingElements)), this.pendingElements.clear(), this.pendingrAF = null;
		}));
	}
	translateFragment(e) {
		return this.translateElements(this.getTranslatables(e));
	}
	async translateElements(e) {
		if (!e.length) return;
		let t = e.map(this.getKeysForElement), n = await this.formatMessages(t);
		return this.applyTranslations(e, n);
	}
	applyTranslations(e, t) {
		this.pauseObserving();
		for (let n = 0; n < e.length; n++) t[n] !== void 0 && Tn(e[n], t[n]);
		this.resumeObserving();
	}
	getTranslatables(e) {
		let t = Array.from(e.querySelectorAll(Vn));
		return typeof e.hasAttribute == "function" && e.hasAttribute(J) && t.push(e), t;
	}
	getKeysForElement(e) {
		return {
			id: e.getAttribute(J),
			args: JSON.parse(e.getAttribute(Y) || null)
		};
	}
}, Un = class e {
	#e;
	#t;
	#n;
	#r;
	constructor({ lang: t, isRTL: n }, r = null) {
		this.#n = e.#i(t), this.#r = r, this.#e = n ?? e.#a(this.#n) ? "rtl" : "ltr";
	}
	_setL10n(e) {
		this.#r = e;
	}
	getLanguage() {
		return this.#n;
	}
	getDirection() {
		return this.#e;
	}
	async get(e, t = null, n) {
		return Array.isArray(e) ? (e = e.map((e) => ({ id: e })), (await this.#r.formatMessages(e)).map((e) => e.value)) : (await this.#r.formatMessages([{
			id: e,
			args: t
		}]))[0]?.value || n;
	}
	async translate(e) {
		(this.#t ||= /* @__PURE__ */ new Set()).add(e);
		try {
			this.#r.connectRoot(e), await this.#r.translateRoots();
		} catch {}
	}
	async translateOnce(e) {
		try {
			await this.#r.translateElements([e]);
		} catch (e) {
			console.error("translateOnce:", e);
		}
	}
	async destroy() {
		if (this.#t) {
			for (let e of this.#t) this.#r.disconnectRoot(e);
			this.#t.clear(), this.#t = null;
		}
		this.#r.pauseObserving();
	}
	pause() {
		this.#r.pauseObserving();
	}
	resume() {
		this.#r.resumeObserving();
	}
	static #i(e) {
		return e = e?.toLowerCase() || "en-us", {
			en: "en-us",
			es: "es-es",
			fy: "fy-nl",
			ga: "ga-ie",
			gu: "gu-in",
			hi: "hi-in",
			hy: "hy-am",
			nb: "nb-no",
			ne: "ne-np",
			nn: "nn-no",
			pa: "pa-in",
			pt: "pt-pt",
			sv: "sv-se",
			zh: "zh-cn"
		}[e] || e;
	}
	static #a(e) {
		let t = e.split("-", 1)[0];
		return [
			"ar",
			"he",
			"fa",
			"ps",
			"ur"
		].includes(t);
	}
};
function Wn(e, t) {
	let n = new bn(t), r = new Yt(e), i = r.addResource(n);
	return i.length && console.error("L10n errors", i), r;
}
var X = class e extends Un {
	constructor(t) {
		super({ lang: t });
		let n = t ? e.#e.bind(e, "en-us", this.getLanguage()) : e.#r.bind(e, this.getLanguage());
		this._setL10n(new Hn([], n));
	}
	static async *#e(e, t) {
		let { baseURL: n, paths: r } = await this.#n(), i = [t];
		if (e !== t) {
			let n = t.split("-", 1)[0];
			n !== t && i.push(n), i.push(e);
		}
		for (let e of i) {
			let t = await this.#t(e, n, r);
			t ? yield t : e === "en-us" && (yield this.#i(e));
		}
	}
	static async #t(e, t, n) {
		let r = n[e];
		return r ? Wn(e, await Qe(new URL(r, t), "text")) : null;
	}
	static async #n() {
		try {
			let { href: e } = document.querySelector("link[type=\"application/l10n\"]"), t = await Qe(e, "json");
			return {
				baseURL: e.replace(/[^/]*$/, "") || "./",
				paths: t
			};
		} catch {}
		return {
			baseURL: "./",
			paths: Object.create(null)
		};
	}
	static async *#r(e) {
		yield this.#i(e);
	}
	static async #i(e) {
		return Wn(e, "pdfjs-previous-button =\n    .title = Previous Page\npdfjs-previous-button-label = Previous\npdfjs-next-button =\n    .title = Next Page\npdfjs-next-button-label = Next\npdfjs-page-input =\n    .title = Page\npdfjs-of-pages = of { $pagesCount }\npdfjs-page-of-pages = ({ $pageNumber } of { $pagesCount })\npdfjs-zoom-out-button =\n    .title = Zoom Out\npdfjs-zoom-out-button-label = Zoom Out\npdfjs-zoom-in-button =\n    .title = Zoom In\npdfjs-zoom-in-button-label = Zoom In\npdfjs-zoom-select =\n    .title = Zoom\npdfjs-presentation-mode-button =\n    .title = Switch to Presentation Mode\npdfjs-presentation-mode-button-label = Presentation Mode\npdfjs-open-file-button =\n    .title = Open File\npdfjs-open-file-button-label = Open\npdfjs-print-button =\n    .title = Print\npdfjs-print-button-label = Print\npdfjs-save-button =\n    .title = Save\npdfjs-save-button-label = Save\npdfjs-download-button =\n    .title = Download\npdfjs-download-button-label = Download\npdfjs-bookmark-button =\n    .title = Current Page (View URL from Current Page)\npdfjs-bookmark-button-label = Current Page\npdfjs-tools-button =\n    .title = Tools\npdfjs-tools-button-label = Tools\npdfjs-first-page-button =\n    .title = Go to First Page\npdfjs-first-page-button-label = Go to First Page\npdfjs-last-page-button =\n    .title = Go to Last Page\npdfjs-last-page-button-label = Go to Last Page\npdfjs-page-rotate-cw-button =\n    .title = Rotate Clockwise\npdfjs-page-rotate-cw-button-label = Rotate Clockwise\npdfjs-page-rotate-ccw-button =\n    .title = Rotate Counterclockwise\npdfjs-page-rotate-ccw-button-label = Rotate Counterclockwise\npdfjs-cursor-text-select-tool-button =\n    .title = Enable Text Selection Tool\npdfjs-cursor-text-select-tool-button-label = Text Selection Tool\npdfjs-cursor-hand-tool-button =\n    .title = Enable Hand Tool\npdfjs-cursor-hand-tool-button-label = Hand Tool\npdfjs-scroll-page-button =\n    .title = Use Page Scrolling\npdfjs-scroll-page-button-label = Page Scrolling\npdfjs-scroll-vertical-button =\n    .title = Use Vertical Scrolling\npdfjs-scroll-vertical-button-label = Vertical Scrolling\npdfjs-scroll-horizontal-button =\n    .title = Use Horizontal Scrolling\npdfjs-scroll-horizontal-button-label = Horizontal Scrolling\npdfjs-scroll-wrapped-button =\n    .title = Use Wrapped Scrolling\npdfjs-scroll-wrapped-button-label = Wrapped Scrolling\npdfjs-spread-none-button =\n    .title = Do not join page spreads\npdfjs-spread-none-button-label = No Spreads\npdfjs-spread-odd-button =\n    .title = Join page spreads starting with odd-numbered pages\npdfjs-spread-odd-button-label = Odd Spreads\npdfjs-spread-even-button =\n    .title = Join page spreads starting with even-numbered pages\npdfjs-spread-even-button-label = Even Spreads\npdfjs-document-properties-button =\n    .title = Document Properties…\npdfjs-document-properties-button-label = Document Properties…\npdfjs-document-properties-file-name = File name:\npdfjs-document-properties-file-size = File size:\npdfjs-document-properties-size-kb = { NUMBER($kb, maximumSignificantDigits: 3) } KB ({ $b } bytes)\npdfjs-document-properties-size-mb = { NUMBER($mb, maximumSignificantDigits: 3) } MB ({ $b } bytes)\npdfjs-document-properties-title = Title:\npdfjs-document-properties-author = Author:\npdfjs-document-properties-subject = Subject:\npdfjs-document-properties-keywords = Keywords:\npdfjs-document-properties-creation-date = Creation Date:\npdfjs-document-properties-modification-date = Modification Date:\npdfjs-document-properties-date-time-string = { DATETIME($dateObj, dateStyle: \"short\", timeStyle: \"medium\") }\npdfjs-document-properties-creator = Creator:\npdfjs-document-properties-producer = PDF Producer:\npdfjs-document-properties-version = PDF Version:\npdfjs-document-properties-page-count = Page Count:\npdfjs-document-properties-page-size = Page Size:\npdfjs-document-properties-page-size-unit-inches = in\npdfjs-document-properties-page-size-unit-millimeters = mm\npdfjs-document-properties-page-size-orientation-portrait = portrait\npdfjs-document-properties-page-size-orientation-landscape = landscape\npdfjs-document-properties-page-size-name-a-three = A3\npdfjs-document-properties-page-size-name-a-four = A4\npdfjs-document-properties-page-size-name-letter = Letter\npdfjs-document-properties-page-size-name-legal = Legal\npdfjs-document-properties-page-size-dimension-string = { $width } × { $height } { $unit } ({ $orientation })\npdfjs-document-properties-page-size-dimension-name-string = { $width } × { $height } { $unit } ({ $name }, { $orientation })\npdfjs-document-properties-linearized = Fast Web View:\npdfjs-document-properties-linearized-yes = Yes\npdfjs-document-properties-linearized-no = No\npdfjs-document-properties-close-button = Close\npdfjs-print-progress-message = Preparing document for printing…\npdfjs-print-progress-percent = { $progress }%\npdfjs-print-progress-close-button = Cancel\npdfjs-printing-not-supported = Warning: Printing is not fully supported by this browser.\npdfjs-printing-not-ready = Warning: The PDF is not fully loaded for printing.\npdfjs-toggle-sidebar-button =\n    .title = Toggle Sidebar\npdfjs-toggle-sidebar-notification-button =\n    .title = Toggle Sidebar (document contains outline/attachments/layers)\npdfjs-toggle-sidebar-button-label = Toggle Sidebar\npdfjs-document-outline-button =\n    .title = Show Document Outline (double-click to expand/collapse all items)\npdfjs-document-outline-button-label = Document Outline\npdfjs-attachments-button =\n    .title = Show Attachments\npdfjs-attachments-button-label = Attachments\npdfjs-layers-button =\n    .title = Show Layers (double-click to reset all layers to the default state)\npdfjs-layers-button-label = Layers\npdfjs-thumbs-button =\n    .title = Show Thumbnails\npdfjs-thumbs-button-label = Thumbnails\npdfjs-current-outline-item-button =\n    .title = Find Current Outline Item\npdfjs-current-outline-item-button-label = Current Outline Item\npdfjs-findbar-button =\n    .title = Find in Document\npdfjs-findbar-button-label = Find\npdfjs-additional-layers = Additional Layers\npdfjs-thumb-page-title =\n    .title = Page { $page }\npdfjs-thumb-page-canvas =\n    .aria-label = Thumbnail of Page { $page }\npdfjs-find-input =\n    .title = Find\n    .placeholder = Find in document…\npdfjs-find-previous-button =\n    .title = Find the previous occurrence of the phrase\npdfjs-find-previous-button-label = Previous\npdfjs-find-next-button =\n    .title = Find the next occurrence of the phrase\npdfjs-find-next-button-label = Next\npdfjs-find-highlight-checkbox = Highlight All\npdfjs-find-match-case-checkbox-label = Match Case\npdfjs-find-match-diacritics-checkbox-label = Match Diacritics\npdfjs-find-entire-word-checkbox-label = Whole Words\npdfjs-find-reached-top = Reached top of document, continued from bottom\npdfjs-find-reached-bottom = Reached end of document, continued from top\npdfjs-find-match-count =\n    { $total ->\n        [one] { $current } of { $total } match\n       *[other] { $current } of { $total } matches\n    }\npdfjs-find-match-count-limit =\n    { $limit ->\n        [one] More than { $limit } match\n       *[other] More than { $limit } matches\n    }\npdfjs-find-not-found = Phrase not found\npdfjs-page-scale-width = Page Width\npdfjs-page-scale-fit = Page Fit\npdfjs-page-scale-auto = Automatic Zoom\npdfjs-page-scale-actual = Actual Size\npdfjs-page-scale-percent = { $scale }%\npdfjs-page-landmark =\n    .aria-label = Page { $page }\npdfjs-loading-error = An error occurred while loading the PDF.\npdfjs-invalid-file-error = Invalid or corrupted PDF file.\npdfjs-missing-file-error = Missing PDF file.\npdfjs-unexpected-response-error = Unexpected server response.\npdfjs-rendering-error = An error occurred while rendering the page.\npdfjs-annotation-date-time-string = { DATETIME($dateObj, dateStyle: \"short\", timeStyle: \"medium\") }\npdfjs-text-annotation-type =\n    .alt = [{ $type } Annotation]\npdfjs-password-label = Enter the password to open this PDF file.\npdfjs-password-invalid = Invalid password. Please try again.\npdfjs-password-ok-button = OK\npdfjs-password-cancel-button = Cancel\npdfjs-web-fonts-disabled = Web fonts are disabled: unable to use embedded PDF fonts.\npdfjs-editor-free-text-button =\n    .title = Text\npdfjs-editor-free-text-button-label = Text\npdfjs-editor-ink-button =\n    .title = Draw\npdfjs-editor-ink-button-label = Draw\npdfjs-editor-stamp-button =\n    .title = Add or edit images\npdfjs-editor-stamp-button-label = Add or edit images\npdfjs-editor-highlight-button =\n    .title = Highlight\npdfjs-editor-highlight-button-label = Highlight\npdfjs-highlight-floating-button1 =\n    .title = Highlight\n    .aria-label = Highlight\npdfjs-highlight-floating-button-label = Highlight\npdfjs-editor-remove-ink-button =\n    .title = Remove drawing\npdfjs-editor-remove-freetext-button =\n    .title = Remove text\npdfjs-editor-remove-stamp-button =\n    .title = Remove image\npdfjs-editor-remove-highlight-button =\n    .title = Remove highlight\npdfjs-editor-free-text-color-input = Color\npdfjs-editor-free-text-size-input = Size\npdfjs-editor-ink-color-input = Color\npdfjs-editor-ink-thickness-input = Thickness\npdfjs-editor-ink-opacity-input = Opacity\npdfjs-editor-stamp-add-image-button =\n    .title = Add image\npdfjs-editor-stamp-add-image-button-label = Add image\npdfjs-editor-free-highlight-thickness-input = Thickness\npdfjs-editor-free-highlight-thickness-title =\n    .title = Change thickness when highlighting items other than text\npdfjs-free-text2 =\n    .aria-label = Text Editor\n    .default-content = Start typing…\npdfjs-ink =\n    .aria-label = Draw Editor\npdfjs-ink-canvas =\n    .aria-label = User-created image\npdfjs-editor-alt-text-button =\n    .aria-label = Alt text\npdfjs-editor-alt-text-button-label = Alt text\npdfjs-editor-alt-text-edit-button =\n    .aria-label = Edit alt text\npdfjs-editor-alt-text-dialog-label = Choose an option\npdfjs-editor-alt-text-dialog-description = Alt text (alternative text) helps when people can’t see the image or when it doesn’t load.\npdfjs-editor-alt-text-add-description-label = Add a description\npdfjs-editor-alt-text-add-description-description = Aim for 1-2 sentences that describe the subject, setting, or actions.\npdfjs-editor-alt-text-mark-decorative-label = Mark as decorative\npdfjs-editor-alt-text-mark-decorative-description = This is used for ornamental images, like borders or watermarks.\npdfjs-editor-alt-text-cancel-button = Cancel\npdfjs-editor-alt-text-save-button = Save\npdfjs-editor-alt-text-decorative-tooltip = Marked as decorative\npdfjs-editor-alt-text-textarea =\n    .placeholder = For example, “A young man sits down at a table to eat a meal”\npdfjs-editor-resizer-top-left =\n    .aria-label = Top left corner — resize\npdfjs-editor-resizer-top-middle =\n    .aria-label = Top middle — resize\npdfjs-editor-resizer-top-right =\n    .aria-label = Top right corner — resize\npdfjs-editor-resizer-middle-right =\n    .aria-label = Middle right — resize\npdfjs-editor-resizer-bottom-right =\n    .aria-label = Bottom right corner — resize\npdfjs-editor-resizer-bottom-middle =\n    .aria-label = Bottom middle — resize\npdfjs-editor-resizer-bottom-left =\n    .aria-label = Bottom left corner — resize\npdfjs-editor-resizer-middle-left =\n    .aria-label = Middle left — resize\npdfjs-editor-highlight-colorpicker-label = Highlight color\npdfjs-editor-colorpicker-button =\n    .title = Change color\npdfjs-editor-colorpicker-dropdown =\n    .aria-label = Color choices\npdfjs-editor-colorpicker-yellow =\n    .title = Yellow\npdfjs-editor-colorpicker-green =\n    .title = Green\npdfjs-editor-colorpicker-blue =\n    .title = Blue\npdfjs-editor-colorpicker-pink =\n    .title = Pink\npdfjs-editor-colorpicker-red =\n    .title = Red\npdfjs-editor-highlight-show-all-button-label = Show all\npdfjs-editor-highlight-show-all-button =\n    .title = Show all\npdfjs-editor-new-alt-text-dialog-edit-label = Edit alt text (image description)\npdfjs-editor-new-alt-text-dialog-add-label = Add alt text (image description)\npdfjs-editor-new-alt-text-textarea =\n    .placeholder = Write your description here…\npdfjs-editor-new-alt-text-description = Short description for people who can’t see the image or when the image doesn’t load.\npdfjs-editor-new-alt-text-disclaimer1 = This alt text was created automatically and may be inaccurate.\npdfjs-editor-new-alt-text-disclaimer-learn-more-url = Learn more\npdfjs-editor-new-alt-text-create-automatically-button-label = Create alt text automatically\npdfjs-editor-new-alt-text-not-now-button = Not now\npdfjs-editor-new-alt-text-error-title = Couldn’t create alt text automatically\npdfjs-editor-new-alt-text-error-description = Please write your own alt text or try again later.\npdfjs-editor-new-alt-text-error-close-button = Close\npdfjs-editor-new-alt-text-ai-model-downloading-progress = Downloading alt text AI model ({ $downloadedSize } of { $totalSize } MB)\n    .aria-valuetext = Downloading alt text AI model ({ $downloadedSize } of { $totalSize } MB)\npdfjs-editor-new-alt-text-added-button =\n    .aria-label = Alt text added\npdfjs-editor-new-alt-text-added-button-label = Alt text added\npdfjs-editor-new-alt-text-missing-button =\n    .aria-label = Missing alt text\npdfjs-editor-new-alt-text-missing-button-label = Missing alt text\npdfjs-editor-new-alt-text-to-review-button =\n    .aria-label = Review alt text\npdfjs-editor-new-alt-text-to-review-button-label = Review alt text\npdfjs-editor-new-alt-text-generated-alt-text-with-disclaimer = Created automatically: { $generatedAltText }\npdfjs-image-alt-text-settings-button =\n    .title = Image alt text settings\npdfjs-image-alt-text-settings-button-label = Image alt text settings\npdfjs-editor-alt-text-settings-dialog-label = Image alt text settings\npdfjs-editor-alt-text-settings-automatic-title = Automatic alt text\npdfjs-editor-alt-text-settings-create-model-button-label = Create alt text automatically\npdfjs-editor-alt-text-settings-create-model-description = Suggests descriptions to help people who can’t see the image or when the image doesn’t load.\npdfjs-editor-alt-text-settings-download-model-label = Alt text AI model ({ $totalSize } MB)\npdfjs-editor-alt-text-settings-ai-model-description = Runs locally on your device so your data stays private. Required for automatic alt text.\npdfjs-editor-alt-text-settings-delete-model-button = Delete\npdfjs-editor-alt-text-settings-download-model-button = Download\npdfjs-editor-alt-text-settings-downloading-model-button = Downloading…\npdfjs-editor-alt-text-settings-editor-title = Alt text editor\npdfjs-editor-alt-text-settings-show-dialog-button-label = Show alt text editor right away when adding an image\npdfjs-editor-alt-text-settings-show-dialog-description = Helps you make sure all your images have alt text.\npdfjs-editor-alt-text-settings-close-button = Close\npdfjs-editor-undo-bar-message-highlight = Highlight removed\npdfjs-editor-undo-bar-message-freetext = Text removed\npdfjs-editor-undo-bar-message-ink = Drawing removed\npdfjs-editor-undo-bar-message-stamp = Image removed\npdfjs-editor-undo-bar-message-multiple =\n    { $count ->\n        [one] { $count } annotation removed\n       *[other] { $count } annotations removed\n    }\npdfjs-editor-undo-bar-undo-button =\n    .title = Undo\npdfjs-editor-undo-bar-undo-button-label = Undo\npdfjs-editor-undo-bar-close-button =\n    .title = Close\npdfjs-editor-undo-bar-close-button-label = Close");
	}
}, Gn = 1e3, Kn = 50, qn = 1e3;
function Jn() {
	return document.location.hash;
}
var Yn = class {
	#e = null;
	constructor({ linkService: e, eventBus: t }) {
		this.linkService = e, this.eventBus = t, this._initialized = !1, this._fingerprint = "", this.reset(), this.eventBus._on("pagesinit", () => {
			this._isPagesLoaded = !1, this.eventBus._on("pagesloaded", (e) => {
				this._isPagesLoaded = !!e.pagesCount;
			}, { once: !0 });
		});
	}
	initialize({ fingerprint: e, resetHistory: t = !1, updateUrl: n = !1 }) {
		if (!e || typeof e != "string") {
			console.error("PDFHistory.initialize: The \"fingerprint\" must be a non-empty string.");
			return;
		}
		this._initialized && this.reset();
		let r = this._fingerprint !== "" && this._fingerprint !== e;
		this._fingerprint = e, this._updateUrl = n === !0, this._initialized = !0, this.#u();
		let i = window.history.state;
		if (this._popStateInProgress = !1, this._blockHashChange = 0, this._currentHash = Jn(), this._numPositionUpdates = 0, this._uid = this._maxUid = 0, this._destination = null, this._position = null, !this.#i(i, !0) || t) {
			let { hash: e, page: n, rotation: i } = this.#o(!0);
			if (!e || r || t) {
				this.#t(null, !0);
				return;
			}
			this.#t({
				hash: e,
				page: n,
				rotation: i
			}, !0);
			return;
		}
		let a = i.destination;
		this.#a(a, i.uid, !0), a.rotation !== void 0 && (this._initialRotation = a.rotation), a.dest ? (this._initialBookmark = JSON.stringify(a.dest), this._destination.page = null) : a.hash ? this._initialBookmark = a.hash : a.page && (this._initialBookmark = `page=${a.page}`);
	}
	reset() {
		this._initialized && (this.#l(), this._initialized = !1, this.#d()), this._updateViewareaTimeout &&= (clearTimeout(this._updateViewareaTimeout), null), this._initialBookmark = null, this._initialRotation = null;
	}
	push({ namedDest: e = null, explicitDest: t, pageNumber: n }) {
		if (!this._initialized) return;
		if (e && typeof e != "string") {
			console.error(`PDFHistory.push: "${e}" is not a valid namedDest parameter.`);
			return;
		} else if (!Array.isArray(t)) {
			console.error(`PDFHistory.push: "${t}" is not a valid explicitDest parameter.`);
			return;
		} else if (!this.#r(n) && (n !== null || this._destination)) {
			console.error(`PDFHistory.push: "${n}" is not a valid pageNumber parameter.`);
			return;
		}
		let r = e || JSON.stringify(t);
		if (!r) return;
		let i = !1;
		if (this._destination && (Xn(this._destination.hash, r) || Zn(this._destination.dest, t))) {
			if (this._destination.page) return;
			i = !0;
		}
		this._popStateInProgress && !i || (this.#t({
			dest: t,
			hash: r,
			page: n,
			rotation: this.linkService.rotation
		}, i), this._popStateInProgress || (this._popStateInProgress = !0, Promise.resolve().then(() => {
			this._popStateInProgress = !1;
		})));
	}
	pushPage(e) {
		if (this._initialized) {
			if (!this.#r(e)) {
				console.error(`PDFHistory.pushPage: "${e}" is not a valid page number.`);
				return;
			}
			this._destination?.page !== e && (this._popStateInProgress || (this.#t({
				dest: null,
				hash: `page=${e}`,
				page: e,
				rotation: this.linkService.rotation
			}), this._popStateInProgress || (this._popStateInProgress = !0, Promise.resolve().then(() => {
				this._popStateInProgress = !1;
			}))));
		}
	}
	pushCurrentPosition() {
		!this._initialized || this._popStateInProgress || this.#n();
	}
	back() {
		if (!this._initialized || this._popStateInProgress) return;
		let e = window.history.state;
		this.#i(e) && e.uid > 0 && window.history.back();
	}
	forward() {
		if (!this._initialized || this._popStateInProgress) return;
		let e = window.history.state;
		this.#i(e) && e.uid < this._maxUid && window.history.forward();
	}
	get popStateInProgress() {
		return this._initialized && (this._popStateInProgress || this._blockHashChange > 0);
	}
	get initialBookmark() {
		return this._initialized ? this._initialBookmark : null;
	}
	get initialRotation() {
		return this._initialized ? this._initialRotation : null;
	}
	#t(e, t = !1) {
		let n = t || !this._destination, r = {
			fingerprint: this._fingerprint,
			uid: n ? this._uid : this._uid + 1,
			destination: e
		};
		this.#a(e, r.uid);
		let i;
		if (this._updateUrl && e?.hash) {
			let t = document.location.href.split("#", 1)[0];
			t.startsWith("file://") || (i = `${t}#${e.hash}`);
		}
		n ? window.history.replaceState(r, "", i) : window.history.pushState(r, "", i);
	}
	#n(e = !1) {
		if (!this._position) return;
		let t = this._position;
		if (e && (t = Object.assign(Object.create(null), this._position), t.temporary = !0), !this._destination) {
			this.#t(t);
			return;
		}
		if (this._destination.temporary) {
			this.#t(t, !0);
			return;
		}
		if (this._destination.hash === t.hash || !this._destination.page && this._numPositionUpdates <= Kn) return;
		let n = !1;
		if (this._destination.page >= t.first && this._destination.page <= t.page) {
			if (this._destination.dest !== void 0 || !this._destination.first) return;
			n = !0;
		}
		this.#t(t, n);
	}
	#r(e) {
		return Number.isInteger(e) && e > 0 && e <= this.linkService.pagesCount;
	}
	#i(e, t = !1) {
		if (!e) return !1;
		if (e.fingerprint !== this._fingerprint) if (t) {
			if (typeof e.fingerprint != "string" || e.fingerprint.length !== this._fingerprint.length) return !1;
			let [t] = performance.getEntriesByType("navigation");
			if (t?.type !== "reload") return !1;
		} else return !1;
		return !(!Number.isInteger(e.uid) || e.uid < 0 || e.destination === null || typeof e.destination != "object");
	}
	#a(e, t, n = !1) {
		this._updateViewareaTimeout &&= (clearTimeout(this._updateViewareaTimeout), null), n && e?.temporary && delete e.temporary, this._destination = e, this._uid = t, this._maxUid = Math.max(this._maxUid, t), this._numPositionUpdates = 0;
	}
	#o(e = !1) {
		let t = unescape(Jn()).substring(1), n = v(t), r = n.get("nameddest") || "", i = n.get("page") | 0;
		return (!this.#r(i) || e && r.length > 0) && (i = null), {
			hash: t,
			page: i,
			rotation: this.linkService.rotation
		};
	}
	#s({ location: e }) {
		this._updateViewareaTimeout &&= (clearTimeout(this._updateViewareaTimeout), null), this._position = {
			hash: e.pdfOpenParams.substring(1),
			page: this.linkService.page,
			first: e.pageNumber,
			rotation: e.rotation
		}, !this._popStateInProgress && (this._isPagesLoaded && this._destination && !this._destination.page && this._numPositionUpdates++, this._updateViewareaTimeout = setTimeout(() => {
			this._popStateInProgress || this.#n(!0), this._updateViewareaTimeout = null;
		}, qn));
	}
	#c({ state: e }) {
		let t = Jn(), n = this._currentHash !== t;
		if (this._currentHash = t, !e) {
			this._uid++;
			let { hash: e, page: t, rotation: n } = this.#o();
			this.#t({
				hash: e,
				page: t,
				rotation: n
			}, !0);
			return;
		}
		if (!this.#i(e)) return;
		this._popStateInProgress = !0, n && (this._blockHashChange++, Ot({
			target: window,
			name: "hashchange",
			delay: Gn
		}).then(() => {
			this._blockHashChange--;
		}));
		let r = e.destination;
		this.#a(r, e.uid, !0), ne(r.rotation) && (this.linkService.rotation = r.rotation), r.dest ? this.linkService.goToDestination(r.dest) : r.hash ? this.linkService.setHash(r.hash) : r.page && (this.linkService.page = r.page), Promise.resolve().then(() => {
			this._popStateInProgress = !1;
		});
	}
	#l() {
		(!this._destination || this._destination.temporary) && this.#n();
	}
	#u() {
		if (this.#e) return;
		this.#e = new AbortController();
		let { signal: e } = this.#e;
		this.eventBus._on("updateviewarea", this.#s.bind(this), { signal: e }), window.addEventListener("popstate", this.#c.bind(this), { signal: e }), window.addEventListener("pagehide", this.#l.bind(this), { signal: e });
	}
	#d() {
		this.#e?.abort(), this.#e = null;
	}
};
function Xn(e, t) {
	return typeof e != "string" || typeof t != "string" ? !1 : e === t || v(e).get("nameddest") === t;
}
function Zn(e, t) {
	function n(e, t) {
		if (typeof e != typeof t || Array.isArray(e) || Array.isArray(t)) return !1;
		if (typeof e == "object" && e && t !== null) {
			if (Object.keys(e).length !== Object.keys(t).length) return !1;
			for (let r in e) if (!n(e[r], t[r])) return !1;
			return !0;
		}
		return e === t || Number.isNaN(e) && Number.isNaN(t);
	}
	if (!(Array.isArray(e) && Array.isArray(t)) || e.length !== t.length) return !1;
	for (let r = 0, i = e.length; r < i; r++) if (!n(e[r], t[r])) return !1;
	return !0;
}
var Qn = class {
	#e = null;
	#t = null;
	#n = null;
	#r = null;
	#i = null;
	#a;
	constructor(e) {
		this.pdfPage = e.pdfPage, this.accessibilityManager = e.accessibilityManager, this.l10n = e.l10n, this.l10n ||= new X(), this.annotationEditorLayer = null, this.div = null, this._cancelled = !1, this.#a = e.uiManager, this.#e = e.annotationLayer || null, this.#i = e.textLayer || null, this.#t = e.drawLayer || null, this.#n = e.onAppend || null, this.#r = e.structTreeLayer || null;
	}
	async render(e, t = "display") {
		if (t !== "display" || this._cancelled) return;
		let n = e.clone({ dontFlip: !0 });
		if (this.div) {
			this.annotationEditorLayer.update({ viewport: n }), this.show();
			return;
		}
		let r = this.div = document.createElement("div");
		r.className = "annotationEditorLayer", r.hidden = !0, r.dir = this.#a.direction, this.#n?.(r), this.annotationEditorLayer = new He({
			uiManager: this.#a,
			div: r,
			structTreeLayer: this.#r,
			accessibilityManager: this.accessibilityManager,
			pageIndex: this.pdfPage.pageNumber - 1,
			l10n: this.l10n,
			viewport: n,
			annotationLayer: this.#e,
			textLayer: this.#i,
			drawLayer: this.#t
		});
		let i = {
			viewport: n,
			div: r,
			annotations: null,
			intent: t
		};
		this.annotationEditorLayer.render(i), this.show();
	}
	cancel() {
		this._cancelled = !0, this.div && this.annotationEditorLayer.destroy();
	}
	hide() {
		this.div && (this.annotationEditorLayer.pause(!0), this.div.hidden = !0);
	}
	show() {
		!this.div || this.annotationEditorLayer.isInvisible || (this.div.hidden = !1, this.annotationEditorLayer.pause(!1));
	}
};
{
	var $n = /* @__PURE__ */ new Map();
	let e = navigator.userAgent || "", t = navigator.platform || "", n = navigator.maxTouchPoints || 1, r = /Android/.test(e), i = /\b(iPad|iPhone|iPod)(?=;)/.test(e) || t === "MacIntel" && n > 1;
	(function() {
		(i || r) && $n.set("maxCanvasPixels", 5242880);
	})(), (function() {
		r && $n.set("useSystemFonts", !1);
	})();
}
var Z = {
	BROWSER: 1,
	VIEWER: 2,
	API: 4,
	WORKER: 8,
	EVENT_DISPATCH: 16,
	PREFERENCE: 128
}, er = {
	BOOLEAN: 1,
	NUMBER: 2,
	OBJECT: 4,
	STRING: 8,
	UNDEFINED: 16
}, Q = {
	allowedGlobalEvents: {
		value: null,
		kind: Z.BROWSER
	},
	canvasMaxAreaInBytes: {
		value: -1,
		kind: Z.BROWSER + Z.API
	},
	isInAutomation: {
		value: !1,
		kind: Z.BROWSER
	},
	localeProperties: {
		value: { lang: navigator.language || "en-US" },
		kind: Z.BROWSER
	},
	nimbusDataStr: {
		value: "",
		kind: Z.BROWSER
	},
	supportsCaretBrowsingMode: {
		value: !1,
		kind: Z.BROWSER
	},
	supportsDocumentFonts: {
		value: !0,
		kind: Z.BROWSER
	},
	supportsIntegratedFind: {
		value: !1,
		kind: Z.BROWSER
	},
	supportsMouseWheelZoomCtrlKey: {
		value: !0,
		kind: Z.BROWSER
	},
	supportsMouseWheelZoomMetaKey: {
		value: !0,
		kind: Z.BROWSER
	},
	supportsPinchToZoom: {
		value: !0,
		kind: Z.BROWSER
	},
	toolbarDensity: {
		value: 0,
		kind: Z.BROWSER + Z.EVENT_DISPATCH
	},
	altTextLearnMoreUrl: {
		value: "",
		kind: Z.VIEWER + Z.PREFERENCE
	},
	annotationEditorMode: {
		value: 0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	annotationMode: {
		value: 2,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	cursorToolOnLoad: {
		value: 0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	debuggerSrc: {
		value: "./debugger.mjs",
		kind: Z.VIEWER
	},
	defaultZoomDelay: {
		value: 400,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	defaultZoomValue: {
		value: "",
		kind: Z.VIEWER + Z.PREFERENCE
	},
	disableHistory: {
		value: !1,
		kind: Z.VIEWER
	},
	disablePageLabels: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enableAltText: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enableAltTextModelDownload: {
		value: !0,
		kind: Z.VIEWER + Z.PREFERENCE + Z.EVENT_DISPATCH
	},
	enableGuessAltText: {
		value: !0,
		kind: Z.VIEWER + Z.PREFERENCE + Z.EVENT_DISPATCH
	},
	enableHighlightFloatingButton: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enableNewAltTextWhenAddingImage: {
		value: !0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enablePermissions: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enablePrintAutoRotate: {
		value: !0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enableScripting: {
		value: !0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	enableUpdatedAddImage: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	externalLinkRel: {
		value: "noopener noreferrer nofollow",
		kind: Z.VIEWER
	},
	externalLinkTarget: {
		value: 0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	highlightEditorColors: {
		value: "yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F",
		kind: Z.VIEWER + Z.PREFERENCE
	},
	historyUpdateUrl: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	ignoreDestinationZoom: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	imageResourcesPath: {
		value: "./images/",
		kind: Z.VIEWER
	},
	maxCanvasPixels: {
		value: 2 ** 25,
		kind: Z.VIEWER
	},
	forcePageColors: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	pageColorsBackground: {
		value: "Canvas",
		kind: Z.VIEWER + Z.PREFERENCE
	},
	pageColorsForeground: {
		value: "CanvasText",
		kind: Z.VIEWER + Z.PREFERENCE
	},
	pdfBugEnabled: {
		value: !1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	printResolution: {
		value: 150,
		kind: Z.VIEWER
	},
	sidebarViewOnLoad: {
		value: -1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	scrollModeOnLoad: {
		value: -1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	spreadModeOnLoad: {
		value: -1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	textLayerMode: {
		value: 1,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	viewOnLoad: {
		value: 0,
		kind: Z.VIEWER + Z.PREFERENCE
	},
	cMapPacked: {
		value: !0,
		kind: Z.API
	},
	cMapUrl: {
		value: "../web/cmaps/",
		kind: Z.API
	},
	disableAutoFetch: {
		value: !1,
		kind: Z.API + Z.PREFERENCE
	},
	disableFontFace: {
		value: !1,
		kind: Z.API + Z.PREFERENCE
	},
	disableRange: {
		value: !1,
		kind: Z.API + Z.PREFERENCE
	},
	disableStream: {
		value: !1,
		kind: Z.API + Z.PREFERENCE
	},
	docBaseUrl: {
		value: "",
		kind: Z.API
	},
	enableHWA: {
		value: !0,
		kind: Z.API + Z.VIEWER + Z.PREFERENCE
	},
	enableXfa: {
		value: !0,
		kind: Z.API + Z.PREFERENCE
	},
	fontExtraProperties: {
		value: !1,
		kind: Z.API
	},
	isEvalSupported: {
		value: !0,
		kind: Z.API
	},
	isOffscreenCanvasSupported: {
		value: !0,
		kind: Z.API
	},
	maxImageSize: {
		value: -1,
		kind: Z.API
	},
	pdfBug: {
		value: !1,
		kind: Z.API
	},
	standardFontDataUrl: {
		value: "../web/standard_fonts/",
		kind: Z.API
	},
	useSystemFonts: {
		value: void 0,
		kind: Z.API,
		type: er.BOOLEAN + er.UNDEFINED
	},
	verbosity: {
		value: 1,
		kind: Z.API
	},
	workerPort: {
		value: null,
		kind: Z.WORKER
	},
	workerSrc: {
		value: "../build/pdf.worker.mjs",
		kind: Z.WORKER
	}
};
Q.defaultUrl = {
	value: "compressed.tracemonkey-pldi-09.pdf",
	kind: Z.VIEWER
}, Q.sandboxBundleSrc = {
	value: "../build/pdf.sandbox.mjs",
	kind: Z.VIEWER
}, Q.viewerCssTheme = {
	value: 0,
	kind: Z.VIEWER + Z.PREFERENCE
}, Q.enableFakeMLManager = {
	value: !0,
	kind: Z.VIEWER
}, Q.disablePreferences = {
	value: !1,
	kind: Z.VIEWER
};
var tr = class {
	static eventBus;
	static #e = /* @__PURE__ */ new Map();
	static {
		for (let e in Q) this.#e.set(e, Q[e].value);
		for (let [e, t] of $n) this.#e.set(e, t);
		this._hasInvokedSet = !1, this._checkDisablePreferences = () => this.get("disablePreferences") ? !0 : (this._hasInvokedSet && console.warn("The Preferences may override manually set AppOptions; please use the \"disablePreferences\"-option to prevent that."), !1);
	}
	static get(e) {
		return this.#e.get(e);
	}
	static getAll(e = null, t = !1) {
		let n = Object.create(null);
		for (let r in Q) {
			let i = Q[r];
			e && !(e & i.kind) || (n[r] = t ? i.value : this.#e.get(r));
		}
		return n;
	}
	static set(e, t) {
		this.setAll({ [e]: t });
	}
	static setAll(e, t = !1) {
		this._hasInvokedSet ||= !0;
		let n;
		for (let r in e) {
			let i = Q[r], a = e[r];
			if (!i || !(typeof a == typeof i.value || er[(typeof a).toUpperCase()] & i.type)) continue;
			let { kind: o } = i;
			t && !(o & Z.BROWSER || o & Z.PREFERENCE) || (this.eventBus && o & Z.EVENT_DISPATCH && (n ||= /* @__PURE__ */ new Map()).set(r, a), this.#e.set(r, a));
		}
		if (n) for (let [e, t] of n) this.eventBus.dispatch(e.toLowerCase(), {
			source: this,
			value: t
		});
	}
}, nr = class {
	#e = null;
	constructor(e) {
		this.pageIndex = e.pageIndex;
	}
	async render(e = "display") {
		e !== "display" || this.#e || this._cancelled || (this.#e = new Xe({ pageIndex: this.pageIndex }));
	}
	cancel() {
		this._cancelled = !0, this.#e &&= (this.#e.destroy(), null);
	}
	setParent(e) {
		this.#e?.setParent(e);
	}
	getDrawLayer() {
		return this.#e;
	}
}, rr = {
	Document: null,
	DocumentFragment: null,
	Part: "group",
	Sect: "group",
	Div: "group",
	Aside: "note",
	NonStruct: "none",
	P: null,
	H: "heading",
	Title: null,
	FENote: "note",
	Sub: "group",
	Lbl: null,
	Span: null,
	Em: null,
	Strong: null,
	Link: "link",
	Annot: "note",
	Form: "form",
	Ruby: null,
	RB: null,
	RT: null,
	RP: null,
	Warichu: null,
	WT: null,
	WP: null,
	L: "list",
	LI: "listitem",
	LBody: null,
	Table: "table",
	TR: "row",
	TH: "columnheader",
	TD: "cell",
	THead: "columnheader",
	TBody: null,
	TFoot: null,
	Caption: null,
	Figure: "figure",
	Formula: null,
	Artifact: null
}, ir = /^H(\d+)$/, ar = class {
	#e;
	#t = null;
	#n;
	#r = /* @__PURE__ */ new Map();
	#i;
	#a = null;
	constructor(e, t) {
		this.#e = e.getStructTree(), this.#i = t;
	}
	async render() {
		if (this.#n) return this.#n;
		let { promise: e, resolve: t, reject: n } = Promise.withResolvers();
		this.#n = e;
		try {
			this.#t = this.#c(await this.#e);
		} catch (e) {
			n(e);
		}
		return this.#e = null, this.#t?.classList.add("structTree"), t(this.#t), e;
	}
	async getAriaAttributes(e) {
		try {
			return await this.render(), this.#r.get(e);
		} catch {}
		return null;
	}
	hide() {
		this.#t && !this.#t.hidden && (this.#t.hidden = !0);
	}
	show() {
		this.#t?.hidden && (this.#t.hidden = !1);
	}
	#o(e, t) {
		let { alt: n, id: r, lang: i } = e;
		if (n !== void 0) {
			let r = !1, i = b(n);
			for (let t of e.children) if (t.type === "annotation") {
				let e = this.#r.get(t.id);
				e || (e = /* @__PURE__ */ new Map(), this.#r.set(t.id, e)), e.set("aria-label", i), r = !0;
			}
			r || t.setAttribute("aria-label", i);
		}
		r !== void 0 && t.setAttribute("aria-owns", r), i !== void 0 && t.setAttribute("lang", b(i, !0));
	}
	#s(e, t) {
		let { alt: n, bbox: r, children: i } = e, a = i?.[0];
		if (!this.#i || !n || !r || a?.type !== "content") return !1;
		let { id: o } = a;
		if (!o) return !1;
		t.setAttribute("aria-owns", o);
		let s = document.createElement("span");
		(this.#a ||= /* @__PURE__ */ new Map()).set(o, s), s.setAttribute("role", "img"), s.setAttribute("aria-label", b(n));
		let { pageHeight: c, pageX: l, pageY: u } = this.#i, d = "calc(var(--scale-factor)*", { style: f } = s;
		return f.width = `${d}${r[2] - r[0]}px)`, f.height = `${d}${r[3] - r[1]}px)`, f.left = `${d}${r[0] - l}px)`, f.top = `${d}${c - r[3] + u}px)`, !0;
	}
	addElementsToTextLayer() {
		if (this.#a) {
			for (let [e, t] of this.#a) document.getElementById(e)?.append(t);
			this.#a.clear(), this.#a = null;
		}
	}
	#c(e) {
		if (!e) return null;
		let t = document.createElement("span");
		if ("role" in e) {
			let { role: n } = e, r = n.match(ir);
			if (r ? (t.setAttribute("role", "heading"), t.setAttribute("aria-level", r[1])) : rr[n] && t.setAttribute("role", rr[n]), n === "Figure" && this.#s(e, t)) return t;
		}
		if (this.#o(e, t), e.children) if (e.children.length === 1 && "id" in e.children[0]) this.#o(e.children[0], t);
		else for (let n of e.children) t.append(this.#c(n));
		return t;
	}
}, or = class e {
	#e = !1;
	#t = null;
	#n = /* @__PURE__ */ new Map();
	#r = /* @__PURE__ */ new Map();
	setTextMapping(e) {
		this.#t = e;
	}
	static #i(e, t) {
		let n = e.getBoundingClientRect(), r = t.getBoundingClientRect();
		if (n.width === 0 && n.height === 0) return 1;
		if (r.width === 0 && r.height === 0) return -1;
		let i = n.y, a = n.y + n.height, o = n.y + n.height / 2, s = r.y, c = r.y + r.height, l = r.y + r.height / 2;
		return o <= s && l >= a ? -1 : l <= i && o >= c ? 1 : n.x + n.width / 2 - (r.x + r.width / 2);
	}
	enable() {
		if (this.#e) throw Error("TextAccessibilityManager is already enabled.");
		if (!this.#t) throw Error("Text divs and strings have not been set.");
		if (this.#e = !0, this.#t = this.#t.slice(), this.#t.sort(e.#i), this.#n.size > 0) {
			let e = this.#t;
			for (let [t, n] of this.#n) {
				if (!document.getElementById(t)) {
					this.#n.delete(t);
					continue;
				}
				this.#a(t, e[n]);
			}
		}
		for (let [e, t] of this.#r) this.addPointerInTextLayer(e, t);
		this.#r.clear();
	}
	disable() {
		this.#e &&= (this.#r.clear(), this.#t = null, !1);
	}
	removePointerInTextLayer(e) {
		if (!this.#e) {
			this.#r.delete(e);
			return;
		}
		let t = this.#t;
		if (!t || t.length === 0) return;
		let { id: n } = e, r = this.#n.get(n);
		if (r === void 0) return;
		let i = t[r];
		this.#n.delete(n);
		let a = i.getAttribute("aria-owns");
		a?.includes(n) && (a = a.split(" ").filter((e) => e !== n).join(" "), a ? i.setAttribute("aria-owns", a) : (i.removeAttribute("aria-owns"), i.setAttribute("role", "presentation")));
	}
	#a(e, t) {
		let n = t.getAttribute("aria-owns");
		n?.includes(e) || t.setAttribute("aria-owns", n ? `${n} ${e}` : e), t.removeAttribute("role");
	}
	addPointerInTextLayer(t, n) {
		let { id: r } = t;
		if (!r) return null;
		if (!this.#e) return this.#r.set(t, n), null;
		n && this.removePointerInTextLayer(t);
		let i = this.#t;
		if (!i || i.length === 0) return null;
		let a = x(i, (n) => e.#i(t, n) < 0), o = Math.max(0, a - 1), s = i[o];
		this.#a(r, s), this.#n.set(r, o);
		let c = s.parentNode;
		return c?.classList.contains("markedContent") ? c.id : null;
	}
	moveElementInDOM(t, n, r, i) {
		let a = this.addPointerInTextLayer(r, i);
		if (!t.hasChildNodes()) return t.append(n), a;
		let o = Array.from(t.childNodes).filter((e) => e !== n);
		if (o.length === 0) return a;
		let s = r || n, c = x(o, (t) => e.#i(s, t) < 0);
		return c === 0 ? o[0].before(n) : o[c - 1].after(n), a;
	}
}, sr = class {
	#e = null;
	constructor({ findController: e, eventBus: t, pageIndex: n }) {
		this.findController = e, this.matches = [], this.eventBus = t, this.pageIdx = n, this.textDivs = null, this.textContentItemsStr = null, this.enabled = !1;
	}
	setTextMapping(e, t) {
		this.textDivs = e, this.textContentItemsStr = t;
	}
	enable() {
		if (!this.textDivs || !this.textContentItemsStr) throw Error("Text divs and strings have not been set.");
		if (this.enabled) throw Error("TextHighlighter is already enabled.");
		this.enabled = !0, this.#e || (this.#e = new AbortController(), this.eventBus._on("updatetextlayermatches", (e) => {
			(e.pageIndex === this.pageIdx || e.pageIndex === -1) && this._updateMatches();
		}, { signal: this.#e.signal })), this._updateMatches();
	}
	disable() {
		this.enabled && (this.enabled = !1, this.#e?.abort(), this.#e = null, this._updateMatches(!0));
	}
	_convertMatches(e, t) {
		if (!e) return [];
		let { textContentItemsStr: n } = this, r = 0, i = 0, a = n.length - 1, o = [];
		for (let s = 0, c = e.length; s < c; s++) {
			let c = e[s];
			for (; r !== a && c >= i + n[r].length;) i += n[r].length, r++;
			r === n.length && console.error("Could not find a matching mapping");
			let l = { begin: {
				divIdx: r,
				offset: c - i
			} };
			for (c += t[s]; r !== a && c > i + n[r].length;) i += n[r].length, r++;
			l.end = {
				divIdx: r,
				offset: c - i
			}, o.push(l);
		}
		return o;
	}
	_renderMatches(e) {
		if (e.length === 0) return;
		let { findController: t, pageIdx: n } = this, { textContentItemsStr: r, textDivs: i } = this, a = n === t.selected.pageIdx, o = t.selected.matchIdx, s = t.state.highlightAll, c = null, l = {
			divIdx: -1,
			offset: void 0
		};
		function u(e, t) {
			let n = e.divIdx;
			return i[n].textContent = "", d(n, 0, e.offset, t);
		}
		function d(e, t, n, a) {
			let o = i[e];
			if (o.nodeType === Node.TEXT_NODE) {
				let t = document.createElement("span");
				o.before(t), t.append(o), i[e] = t, o = t;
			}
			let s = r[e].substring(t, n), c = document.createTextNode(s);
			if (a) {
				let e = document.createElement("span");
				if (e.className = `${a} appended`, e.append(c), o.append(e), a.includes("selected")) {
					let { left: t } = e.getClientRects()[0];
					return t - o.getBoundingClientRect().left;
				}
				return 0;
			}
			return o.append(c), 0;
		}
		let f = o, p = f + 1;
		if (s) f = 0, p = e.length;
		else if (!a) return;
		let m = -1, h = -1;
		for (let r = f; r < p; r++) {
			let s = e[r], f = s.begin;
			if (f.divIdx === m && f.offset === h) continue;
			m = f.divIdx, h = f.offset;
			let p = s.end, g = a && r === o, _ = g ? " selected" : "", v = 0;
			if (!c || f.divIdx !== c.divIdx ? (c !== null && d(c.divIdx, c.offset, l.offset), u(f)) : d(c.divIdx, c.offset, f.offset), f.divIdx === p.divIdx) v = d(f.divIdx, f.offset, p.offset, "highlight" + _);
			else {
				v = d(f.divIdx, f.offset, l.offset, "highlight begin" + _);
				for (let e = f.divIdx + 1, t = p.divIdx; e < t; e++) i[e].className = "highlight middle" + _;
				u(p, "highlight end" + _);
			}
			c = p, g && t.scrollMatchIntoView({
				element: i[f.divIdx],
				selectedLeft: v,
				pageIndex: n,
				matchIndex: o
			});
		}
		c && d(c.divIdx, c.offset, l.offset);
	}
	_updateMatches(e = !1) {
		if (!this.enabled && !e) return;
		let { findController: t, matches: n, pageIdx: r } = this, { textContentItemsStr: i, textDivs: a } = this, o = -1;
		for (let e of n) {
			let t = Math.max(o, e.begin.divIdx);
			for (let n = t, r = e.end.divIdx; n <= r; n++) {
				let e = a[n];
				e.textContent = i[n], e.className = "";
			}
			o = e.end.divIdx + 1;
		}
		if (!t?.highlightMatches || e) return;
		let s = t.pageMatches[r] || null, c = t.pageMatchesLength[r] || null;
		this.matches = this._convertMatches(s, c), this._renderMatches(this.matches);
	}
}, cr = class e {
	#e = !1;
	#t = null;
	#n = !1;
	#r = null;
	static #i = /* @__PURE__ */ new Map();
	static #a = null;
	constructor({ pdfPage: e, highlighter: t = null, accessibilityManager: n = null, enablePermissions: r = !1, onAppend: i = null }) {
		this.pdfPage = e, this.highlighter = t, this.accessibilityManager = n, this.#e = r === !0, this.#t = i, this.div = document.createElement("div"), this.div.tabIndex = 0, this.div.className = "textLayer";
	}
	async render(e, t = null) {
		if (this.#n && this.#r) {
			this.#r.update({
				viewport: e,
				onBefore: this.hide.bind(this)
			}), this.show();
			return;
		}
		this.cancel(), this.#r = new vt({
			textContentSource: this.pdfPage.streamTextContent(t || {
				includeMarkedContent: !0,
				disableNormalization: !0
			}),
			container: this.div,
			viewport: e
		});
		let { textDivs: n, textContentItemsStr: r } = this.#r;
		this.highlighter?.setTextMapping(n, r), this.accessibilityManager?.setTextMapping(n), await this.#r.render(), this.#n = !0;
		let i = document.createElement("div");
		i.className = "endOfContent", this.div.append(i), this.#o(i), this.#t?.(this.div), this.highlighter?.enable(), this.accessibilityManager?.enable();
	}
	hide() {
		!this.div.hidden && this.#n && (this.highlighter?.disable(), this.div.hidden = !0);
	}
	show() {
		this.div.hidden && this.#n && (this.div.hidden = !1, this.highlighter?.enable());
	}
	cancel() {
		this.#r?.cancel(), this.#r = null, this.highlighter?.disable(), this.accessibilityManager?.disable(), e.#s(this.div);
	}
	#o(t) {
		let { div: n } = this;
		n.addEventListener("mousedown", () => {
			n.classList.add("selecting");
		}), n.addEventListener("copy", (e) => {
			if (!this.#e) {
				let t = document.getSelection();
				e.clipboardData.setData("text/plain", b(ut(t.toString())));
			}
			R(e);
		}), e.#i.set(n, t), e.#c();
	}
	static #s(e) {
		this.#i.delete(e), this.#i.size === 0 && (this.#a?.abort(), this.#a = null);
	}
	static #c() {
		if (this.#a) return;
		this.#a = new AbortController();
		let { signal: e } = this.#a, t = (e, t) => {
			t.append(e), e.style.width = "", e.style.height = "", t.classList.remove("selecting");
		}, n = !1;
		document.addEventListener("pointerdown", () => {
			n = !0;
		}, { signal: e }), document.addEventListener("pointerup", () => {
			n = !1, this.#i.forEach(t);
		}, { signal: e }), window.addEventListener("blur", () => {
			n = !1, this.#i.forEach(t);
		}, { signal: e }), document.addEventListener("keyup", () => {
			n || this.#i.forEach(t);
		}, { signal: e });
		var r, i;
		document.addEventListener("selectionchange", () => {
			let e = document.getSelection();
			if (e.rangeCount === 0) {
				this.#i.forEach(t);
				return;
			}
			let n = /* @__PURE__ */ new Set();
			for (let t = 0; t < e.rangeCount; t++) {
				let r = e.getRangeAt(t);
				for (let e of this.#i.keys()) !n.has(e) && r.intersectsNode(e) && n.add(e);
			}
			for (let [e, r] of this.#i) n.has(e) ? e.classList.add("selecting") : t(r, e);
			if (r ??= getComputedStyle(this.#i.values().next().value).getPropertyValue("-moz-user-select") === "none", r) return;
			let a = e.getRangeAt(0), o = i && (a.compareBoundaryPoints(Range.END_TO_END, i) === 0 || a.compareBoundaryPoints(Range.START_TO_END, i) === 0), s = o ? a.startContainer : a.endContainer;
			s.nodeType === Node.TEXT_NODE && (s = s.parentNode);
			let c = s.parentElement?.closest(".textLayer"), l = this.#i.get(c);
			l && (l.style.width = c.style.width, l.style.height = c.style.height, s.parentElement.insertBefore(l, o ? s : s.nextSibling)), i = a.cloneRange();
		}, { signal: e });
	}
}, lr = class {
	constructor({ pdfPage: e, annotationStorage: t = null, linkService: n, xfaHtml: r = null }) {
		this.pdfPage = e, this.annotationStorage = t, this.linkService = n, this.xfaHtml = r, this.div = null, this._cancelled = !1;
	}
	async render(e, t = "display") {
		if (t === "print") {
			let n = {
				viewport: e.clone({ dontFlip: !0 }),
				div: this.div,
				xfaHtml: this.xfaHtml,
				annotationStorage: this.annotationStorage,
				linkService: this.linkService,
				intent: t
			};
			return this.div = document.createElement("div"), n.div = this.div, z.render(n);
		}
		let n = await this.pdfPage.getXfa();
		if (this._cancelled || !n) return { textDivs: [] };
		let r = {
			viewport: e.clone({ dontFlip: !0 }),
			div: this.div,
			xfaHtml: n,
			annotationStorage: this.annotationStorage,
			linkService: this.linkService,
			intent: t
		};
		return this.div ? z.update(r) : (this.div = document.createElement("div"), r.div = this.div, z.render(r));
	}
	cancel() {
		this._cancelled = !0;
	}
	hide() {
		this.div && (this.div.hidden = !0);
	}
}, ur = {
	annotationEditorUIManager: null,
	annotationStorage: null,
	downloadManager: null,
	enableScripting: !1,
	fieldObjectsPromise: null,
	findController: null,
	hasJSActionsPromise: null,
	get linkService() {
		return new Be();
	}
}, dr = new Map([
	["canvasWrapper", 0],
	["textLayer", 1],
	["annotationLayer", 2],
	["annotationEditorLayer", 3],
	["xfaLayer", 3]
]), fr = class {
	#e = N.ENABLE_FORMS;
	#t = null;
	#n = !1;
	#r = !1;
	#i = !1;
	#a = null;
	#o = null;
	#s = null;
	#c = null;
	#l = 1;
	#u = 1;
	#d = null;
	#f = d.INITIAL;
	#p = p.ENABLE;
	#m = {
		directDrawing: !0,
		initialOptionalContent: !0,
		regularAnnotations: !0
	};
	#h = [
		null,
		null,
		null,
		null
	];
	constructor(e) {
		let t = e.container, n = e.defaultViewport;
		this.id = e.id, this.renderingId = "page" + this.id, this.#a = e.layerProperties || ur, this.pdfPage = null, this.pageLabel = null, this.rotation = 0, this.scale = e.scale || r, this.viewport = n, this.pdfPageRotate = n.rotation, this._optionalContentConfigPromise = e.optionalContentConfigPromise || null, this.#p = e.textLayerMode ?? p.ENABLE, this.#e = e.annotationMode ?? N.ENABLE_FORMS, this.imageResourcesPath = e.imageResourcesPath || "", this.maxCanvasPixels = e.maxCanvasPixels ?? tr.get("maxCanvasPixels"), this.pageColors = e.pageColors || null, this.#n = e.enableHWA || !1, this.eventBus = e.eventBus, this.renderingQueue = e.renderingQueue, this.l10n = e.l10n, this.l10n ||= new X(), this.renderTask = null, this.resume = null, this._isStandalone = !this.renderingQueue?.hasViewer(), this._container = t, this._annotationCanvasMap = null, this.annotationLayer = null, this.annotationEditorLayer = null, this.textLayer = null, this.xfaLayer = null, this.structTreeLayer = null, this.drawLayer = null;
		let i = document.createElement("div");
		if (i.className = "page", i.setAttribute("data-page-number", this.id), i.setAttribute("role", "region"), i.setAttribute("data-l10n-id", "pdfjs-page-landmark"), i.setAttribute("data-l10n-args", JSON.stringify({ page: this.id })), this.div = i, this.#_(), t?.append(i), this._isStandalone) {
			t?.style.setProperty("--scale-factor", this.scale * F.PDF_TO_CSS_UNITS), this.pageColors?.background && t?.style.setProperty("--page-bg-color", this.pageColors.background);
			let { optionalContentConfigPromise: n } = e;
			n && n.then((e) => {
				n === this._optionalContentConfigPromise && (this.#m.initialOptionalContent = e.hasInitialVisibility);
			}), e.l10n || this.l10n.translate(this.div);
		}
	}
	#g(e, t) {
		let n = dr.get(t), r = this.#h[n];
		if (this.#h[n] = e, r) {
			r.replaceWith(e);
			return;
		}
		for (let t = n - 1; t >= 0; t--) {
			let n = this.#h[t];
			if (n) {
				n.after(e);
				return;
			}
		}
		this.div.prepend(e);
	}
	get renderingState() {
		return this.#f;
	}
	set renderingState(e) {
		if (e !== this.#f) switch (this.#f = e, this.#o &&= (clearTimeout(this.#o), null), e) {
			case d.PAUSED:
				this.div.classList.remove("loading");
				break;
			case d.RUNNING:
				this.div.classList.add("loadingIcon"), this.#o = setTimeout(() => {
					this.div.classList.add("loading"), this.#o = null;
				}, 0);
				break;
			case d.INITIAL:
			case d.FINISHED:
				this.div.classList.remove("loadingIcon", "loading");
				break;
		}
	}
	#_() {
		let { viewport: e } = this;
		if (this.pdfPage) {
			if (this.#c === e.rotation) return;
			this.#c = e.rotation;
		}
		_t(this.div, e, !0, !1);
	}
	setPdfPage(e) {
		this._isStandalone && (this.pageColors?.foreground === "CanvasText" || this.pageColors?.background === "Canvas") && (this._container?.style.setProperty("--hcm-highlight-filter", e.filterFactory.addHighlightHCMFilter("highlight", "CanvasText", "Canvas", "HighlightText", "Highlight")), this._container?.style.setProperty("--hcm-highlight-selected-filter", e.filterFactory.addHighlightHCMFilter("highlight_selected", "CanvasText", "Canvas", "HighlightText", "Highlight"))), this.pdfPage = e, this.pdfPageRotate = e.rotate;
		let t = (this.rotation + this.pdfPageRotate) % 360;
		this.viewport = e.getViewport({
			scale: this.scale * F.PDF_TO_CSS_UNITS,
			rotation: t
		}), this.#_(), this.reset();
	}
	destroy() {
		this.reset(), this.pdfPage?.cleanup();
	}
	hasEditableAnnotations() {
		return !!this.annotationLayer?.hasEditableAnnotations();
	}
	get _textHighlighter() {
		return L(this, "_textHighlighter", new sr({
			pageIndex: this.id - 1,
			eventBus: this.eventBus,
			findController: this.#a.findController
		}));
	}
	#v(e, t) {
		this.eventBus.dispatch(e, {
			source: this,
			pageNumber: this.id,
			error: t
		});
	}
	async #y() {
		let e = null;
		try {
			await this.annotationLayer.render(this.viewport, { structTreeLayer: this.structTreeLayer }, "display");
		} catch (t) {
			console.error("#renderAnnotationLayer:", t), e = t;
		} finally {
			this.#v("annotationlayerrendered", e);
		}
	}
	async #b() {
		let e = null;
		try {
			await this.annotationEditorLayer.render(this.viewport, "display");
		} catch (t) {
			console.error("#renderAnnotationEditorLayer:", t), e = t;
		} finally {
			this.#v("annotationeditorlayerrendered", e);
		}
	}
	async #x() {
		try {
			await this.drawLayer.render("display");
		} catch (e) {
			console.error("#renderDrawLayer:", e);
		}
	}
	async #S() {
		let e = null;
		try {
			let e = await this.xfaLayer.render(this.viewport, "display");
			e?.textDivs && this._textHighlighter && this.#T(e.textDivs);
		} catch (t) {
			console.error("#renderXfaLayer:", t), e = t;
		} finally {
			this.xfaLayer?.div && (this.l10n.pause(), this.#g(this.xfaLayer.div, "xfaLayer"), this.l10n.resume()), this.#v("xfalayerrendered", e);
		}
	}
	async #C() {
		if (!this.textLayer) return;
		let e = null;
		try {
			await this.textLayer.render(this.viewport);
		} catch (t) {
			if (t instanceof Ve) return;
			console.error("#renderTextLayer:", t), e = t;
		}
		this.#v("textlayerrendered", e), this.#w();
	}
	async #w() {
		if (!this.textLayer) return;
		let e = await this.structTreeLayer?.render();
		e && (this.l10n.pause(), this.structTreeLayer?.addElementsToTextLayer(), this.canvas && e.parentNode !== this.canvas && this.canvas.append(e), this.l10n.resume()), this.structTreeLayer?.show();
	}
	async #T(e) {
		let t = await this.pdfPage.getTextContent(), n = [];
		for (let e of t.items) n.push(e.str);
		this._textHighlighter.setTextMapping(e, n), this._textHighlighter.enable();
	}
	#E() {
		let { canvas: e } = this;
		e && (e.remove(), e.width = e.height = 0, this.canvas = null, this.#s = null);
	}
	reset({ keepAnnotationLayer: e = !1, keepAnnotationEditorLayer: t = !1, keepXfaLayer: n = !1, keepTextLayer: r = !1, keepCanvasWrapper: i = !1 } = {}) {
		this.cancelRendering({
			keepAnnotationLayer: e,
			keepAnnotationEditorLayer: t,
			keepXfaLayer: n,
			keepTextLayer: r
		}), this.renderingState = d.INITIAL;
		let a = this.div, o = a.childNodes, s = e && this.annotationLayer?.div || null, c = t && this.annotationEditorLayer?.div || null, l = n && this.xfaLayer?.div || null, u = r && this.textLayer?.div || null, f = i && this.#t || null;
		for (let e = o.length - 1; e >= 0; e--) {
			let t = o[e];
			switch (t) {
				case s:
				case c:
				case l:
				case u:
				case f: continue;
			}
			t.remove();
			let n = this.#h.indexOf(t);
			n >= 0 && (this.#h[n] = null);
		}
		a.removeAttribute("data-loaded"), s && this.annotationLayer.hide(), c && this.annotationEditorLayer.hide(), l && this.xfaLayer.hide(), u && this.textLayer.hide(), this.structTreeLayer?.hide(), !i && this.#t && (this.#t = null, this.#E());
	}
	toggleEditingMode(e) {
		this.hasEditableAnnotations() && (this.#i = e, this.reset({
			keepAnnotationLayer: !0,
			keepAnnotationEditorLayer: !0,
			keepXfaLayer: !0,
			keepTextLayer: !0,
			keepCanvasWrapper: !0
		}));
	}
	update({ scale: e = 0, rotation: t = null, optionalContentConfigPromise: n = null, drawingDelay: r = -1 }) {
		this.scale = e || this.scale, typeof t == "number" && (this.rotation = t), n instanceof Promise && (this._optionalContentConfigPromise = n, n.then((e) => {
			n === this._optionalContentConfigPromise && (this.#m.initialOptionalContent = e.hasInitialVisibility);
		})), this.#m.directDrawing = !0;
		let i = (this.rotation + this.pdfPageRotate) % 360;
		if (this.viewport = this.viewport.clone({
			scale: this.scale * F.PDF_TO_CSS_UNITS,
			rotation: i
		}), this.#_(), this._isStandalone && this._container?.style.setProperty("--scale-factor", this.viewport.scale), this.canvas) {
			let e = !1;
			if (this.#r) {
				if (this.maxCanvasPixels === 0) e = !0;
				else if (this.maxCanvasPixels > 0) {
					let { width: t, height: n } = this.viewport, { sx: r, sy: i } = this.outputScale;
					e = (Math.floor(t) * r | 0) * (Math.floor(n) * i | 0) > this.maxCanvasPixels;
				}
			}
			let t = r >= 0 && r < 1e3;
			if (t || e) {
				if (t && !e && this.renderingState !== d.FINISHED && (this.cancelRendering({
					keepAnnotationLayer: !0,
					keepAnnotationEditorLayer: !0,
					keepXfaLayer: !0,
					keepTextLayer: !0,
					cancelExtraDelay: r
				}), this.renderingState = d.FINISHED, this.#m.directDrawing = !1), this.cssTransform({
					redrawAnnotationLayer: !0,
					redrawAnnotationEditorLayer: !0,
					redrawXfaLayer: !0,
					redrawTextLayer: !t,
					hideTextLayer: t
				}), t) return;
				this.eventBus.dispatch("pagerendered", {
					source: this,
					pageNumber: this.id,
					cssTransform: !0,
					timestamp: performance.now(),
					error: this.#d
				});
				return;
			}
		}
		this.cssTransform({}), this.reset({
			keepAnnotationLayer: !0,
			keepAnnotationEditorLayer: !0,
			keepXfaLayer: !0,
			keepTextLayer: !0,
			keepCanvasWrapper: !0
		});
	}
	cancelRendering({ keepAnnotationLayer: e = !1, keepAnnotationEditorLayer: t = !1, keepXfaLayer: n = !1, keepTextLayer: r = !1, cancelExtraDelay: i = 0 } = {}) {
		this.renderTask &&= (this.renderTask.cancel(i), null), this.resume = null, this.textLayer && (!r || !this.textLayer.div) && (this.textLayer.cancel(), this.textLayer = null), this.annotationLayer && (!e || !this.annotationLayer.div) && (this.annotationLayer.cancel(), this.annotationLayer = null, this._annotationCanvasMap = null), this.structTreeLayer && !this.textLayer && (this.structTreeLayer = null), this.annotationEditorLayer && (!t || !this.annotationEditorLayer.div) && (this.drawLayer &&= (this.drawLayer.cancel(), null), this.annotationEditorLayer.cancel(), this.annotationEditorLayer = null), this.xfaLayer && (!n || !this.xfaLayer.div) && (this.xfaLayer.cancel(), this.xfaLayer = null, this._textHighlighter?.disable());
	}
	cssTransform({ redrawAnnotationLayer: e = !1, redrawAnnotationEditorLayer: t = !1, redrawXfaLayer: n = !1, redrawTextLayer: r = !1, hideTextLayer: i = !1 }) {
		let { canvas: a } = this;
		if (!a) return;
		let o = this.#s;
		if (this.viewport !== o) {
			let e = (360 + this.viewport.rotation - o.rotation) % 360;
			if (e === 90 || e === 270) {
				let { width: t, height: n } = this.viewport, r = n / t, i = t / n;
				a.style.transform = `rotate(${e}deg) scale(${r},${i})`;
			} else a.style.transform = e === 0 ? "" : `rotate(${e}deg)`;
		}
		e && this.annotationLayer && this.#y(), t && this.annotationEditorLayer && (this.drawLayer && this.#x(), this.#b()), n && this.xfaLayer && this.#S(), this.textLayer && (i ? (this.textLayer.hide(), this.structTreeLayer?.hide()) : r && this.#C());
	}
	get width() {
		return this.viewport.width;
	}
	get height() {
		return this.viewport.height;
	}
	getPagePoint(e, t) {
		return this.viewport.convertToPdfPoint(e, t);
	}
	async #D(e, t = null) {
		if (e === this.renderTask && (this.renderTask = null), t instanceof I) {
			this.#d = null;
			return;
		}
		if (this.#d = t, this.renderingState = d.FINISHED, this.#m.regularAnnotations = !e.separateAnnots, this.eventBus.dispatch("pagerendered", {
			source: this,
			pageNumber: this.id,
			cssTransform: !1,
			timestamp: performance.now(),
			error: this.#d
		}), t) throw t;
	}
	async draw() {
		this.renderingState !== d.INITIAL && (console.error("Must be in new state before drawing"), this.reset());
		let { div: e, l10n: t, pageColors: n, pdfPage: r, viewport: i } = this;
		if (!r) throw this.renderingState = d.FINISHED, Error("pdfPage is not loaded");
		this.renderingState = d.RUNNING;
		let a = this.#t;
		if (a || (a = this.#t = document.createElement("div"), a.classList.add("canvasWrapper"), this.#g(a, "canvasWrapper")), !this.textLayer && this.#p !== p.DISABLE && !r.isPureXfa && (this._accessibilityManager ||= new or(), this.textLayer = new cr({
			pdfPage: r,
			highlighter: this._textHighlighter,
			accessibilityManager: this._accessibilityManager,
			enablePermissions: this.#p === p.ENABLE_PERMISSIONS,
			onAppend: (e) => {
				this.l10n.pause(), this.#g(e, "textLayer"), this.l10n.resume();
			}
		})), !this.annotationLayer && this.#e !== N.DISABLE) {
			let { annotationStorage: e, annotationEditorUIManager: t, downloadManager: n, enableScripting: i, fieldObjectsPromise: a, hasJSActionsPromise: o, linkService: s } = this.#a;
			this._annotationCanvasMap ||= /* @__PURE__ */ new Map(), this.annotationLayer = new wt({
				pdfPage: r,
				annotationStorage: e,
				imageResourcesPath: this.imageResourcesPath,
				renderForms: this.#e === N.ENABLE_FORMS,
				linkService: s,
				downloadManager: n,
				enableScripting: i,
				hasJSActionsPromise: o,
				fieldObjectsPromise: a,
				annotationCanvasMap: this._annotationCanvasMap,
				accessibilityManager: this._accessibilityManager,
				annotationEditorUIManager: t,
				onAppend: (e) => {
					this.#g(e, "annotationLayer");
				}
			});
		}
		let o = (e) => {
			if (h?.(!1), this.renderingQueue && !this.renderingQueue.isHighestPriority(this)) {
				this.renderingState = d.PAUSED, this.resume = () => {
					this.renderingState = d.RUNNING, e();
				};
				return;
			}
			e();
		}, { width: s, height: c } = i, l = document.createElement("canvas");
		l.setAttribute("role", "presentation");
		let u = !!(n?.background && n?.foreground), f = this.canvas, m = !f && !u;
		this.canvas = l, this.#s = i;
		let h = (e) => {
			if (m) {
				a.prepend(l), h = null;
				return;
			}
			e && (f ? (f.replaceWith(l), f.width = f.height = 0) : a.prepend(l), h = null);
		}, g = l.getContext("2d", {
			alpha: !1,
			willReadFrequently: !this.#n
		}), _ = this.outputScale = new ft();
		if (this.maxCanvasPixels === 0) {
			let e = 1 / this.scale;
			_.sx *= e, _.sy *= e, this.#r = !0;
		} else if (this.maxCanvasPixels > 0) {
			let e = s * c, t = Math.sqrt(this.maxCanvasPixels / e);
			_.sx > t || _.sy > t ? (_.sx = t, _.sy = t, this.#r = !0) : this.#r = !1;
		}
		let v = S(_.sx), y = S(_.sy), b = l.width = C(T(s * _.sx), v[0]), x = l.height = C(T(c * _.sy), y[0]), ee = C(T(s), v[1]), te = C(T(c), y[1]);
		_.sx = b / ee, _.sy = x / te, this.#l !== v[1] && (e.style.setProperty("--scale-round-x", `${v[1]}px`), this.#l = v[1]), this.#u !== y[1] && (e.style.setProperty("--scale-round-y", `${y[1]}px`), this.#u = y[1]);
		let ne = {
			canvasContext: g,
			transform: _.scaled ? [
				_.sx,
				0,
				0,
				_.sy,
				0,
				0
			] : null,
			viewport: i,
			annotationMode: this.#e,
			optionalContentConfigPromise: this._optionalContentConfigPromise,
			annotationCanvasMap: this._annotationCanvasMap,
			pageColors: n,
			isEditing: this.#i
		}, w = this.renderTask = r.render(ne);
		w.onContinue = o;
		let re = w.promise.then(async () => {
			h?.(!0), await this.#D(w), this.structTreeLayer ||= new ar(r, i.rawDims), this.#C(), this.annotationLayer && await this.#y();
			let { annotationEditorUIManager: e } = this.#a;
			e && (this.drawLayer ||= new nr({ pageIndex: this.id }), await this.#x(), this.drawLayer.setParent(a), this.annotationEditorLayer ||= new Qn({
				uiManager: e,
				pdfPage: r,
				l10n: t,
				structTreeLayer: this.structTreeLayer,
				accessibilityManager: this._accessibilityManager,
				annotationLayer: this.annotationLayer?.annotationLayer,
				textLayer: this.textLayer,
				drawLayer: this.drawLayer.getDrawLayer(),
				onAppend: (e) => {
					this.#g(e, "annotationEditorLayer");
				}
			}), this.#b());
		}, (e) => (e instanceof I ? (f?.remove(), this.#E()) : h?.(!0), this.#D(w, e)));
		if (r.isPureXfa) {
			if (!this.xfaLayer) {
				let { annotationStorage: e, linkService: t } = this.#a;
				this.xfaLayer = new lr({
					pdfPage: r,
					annotationStorage: e,
					linkService: t
				});
			}
			this.#S();
		}
		return e.setAttribute("data-loaded", !0), this.eventBus.dispatch("pagerender", {
			source: this,
			pageNumber: this.id
		}), re;
	}
	setPageLabel(e) {
		this.pageLabel = typeof e == "string" ? e : null, this.div.setAttribute("data-l10n-args", JSON.stringify({ page: this.pageLabel ?? this.id })), this.pageLabel === null ? this.div.removeAttribute("data-page-label") : this.div.setAttribute("data-page-label", this.pageLabel);
	}
	get thumbnailCanvas() {
		let { directDrawing: e, initialOptionalContent: t, regularAnnotations: n } = this.#m;
		return e && t && n ? this.canvas : null;
	}
};
async function pr(e) {
	let t = "".split("#", 1)[0], { info: n, metadata: r, contentDispositionFilename: i, contentLength: a } = await e.getMetadata();
	if (!a) {
		let { length: t } = await e.getDownloadInfo();
		a = t;
	}
	return {
		...n,
		baseURL: t,
		filesize: a,
		filename: i || tt(""),
		metadata: r?.getRaw(),
		authors: r?.get("dc:creator"),
		numPages: e.numPages,
		URL: ""
	};
}
var mr = class {
	constructor(e) {
		this._ready = new Promise((t, n) => {
			import(
				/*webpackIgnore: true*/
				e
).then((e) => {
				t(e.QuickJSSandbox());
			}).catch(n);
		});
	}
	async createSandbox(e) {
		(await this._ready).create(e);
	}
	async dispatchEventInSandbox(e) {
		let t = await this._ready;
		setTimeout(() => t.dispatchEvent(e), 0);
	}
	async destroySandbox() {
		(await this._ready).nukeSandbox();
	}
}, hr = class {
	#e = null;
	#t = null;
	#n = null;
	#r = null;
	#i = null;
	#a = null;
	#o = null;
	#s = null;
	#c = !1;
	#l = null;
	#u = null;
	constructor({ eventBus: e, externalServices: t = null, docProperties: n = null }) {
		this.#i = e, this.#a = t, this.#n = n;
	}
	setViewer(e) {
		this.#s = e;
	}
	async setDocument(e) {
		if (this.#o && await this.#h(), this.#o = e, !e) return;
		let [t, n, r] = await Promise.all([
			e.getFieldObjects(),
			e.getCalculationOrderIds(),
			e.getJSActions()
		]);
		if (!t && !r) {
			await this.#h();
			return;
		}
		if (e !== this.#o) return;
		try {
			this.#l = this.#m();
		} catch (e) {
			console.error("setDocument:", e), await this.#h();
			return;
		}
		let i = this.#i;
		this.#r = new AbortController();
		let { signal: a } = this.#r;
		i._on("updatefromsandbox", (e) => {
			e?.source === window && this.#d(e.detail);
		}, { signal: a }), i._on("dispatcheventinsandbox", (e) => {
			this.#l?.dispatchEventInSandbox(e.detail);
		}, { signal: a }), i._on("pagechanging", ({ pageNumber: e, previous: t }) => {
			e !== t && (this.#p(t), this.#f(e));
		}, { signal: a }), i._on("pagerendered", ({ pageNumber: e }) => {
			this._pageOpenPending.has(e) && e === this.#s.currentPageNumber && this.#f(e);
		}, { signal: a }), i._on("pagesdestroy", async () => {
			await this.#p(this.#s.currentPageNumber), await this.#l?.dispatchEventInSandbox({
				id: "doc",
				name: "WillClose"
			}), this.#e?.resolve();
		}, { signal: a });
		try {
			let a = await this.#n(e);
			if (e !== this.#o) return;
			await this.#l.createSandbox({
				objects: t,
				calculationOrder: n,
				appInfo: {
					platform: navigator.platform,
					language: navigator.language
				},
				docInfo: {
					...a,
					actions: r
				}
			}), i.dispatch("sandboxcreated", { source: this });
		} catch (e) {
			console.error("setDocument:", e), await this.#h();
			return;
		}
		await this.#l?.dispatchEventInSandbox({
			id: "doc",
			name: "Open"
		}), await this.#f(this.#s.currentPageNumber, !0), Promise.resolve().then(() => {
			e === this.#o && (this.#c = !0);
		});
	}
	async dispatchWillSave() {
		return this.#l?.dispatchEventInSandbox({
			id: "doc",
			name: "WillSave"
		});
	}
	async dispatchDidSave() {
		return this.#l?.dispatchEventInSandbox({
			id: "doc",
			name: "DidSave"
		});
	}
	async dispatchWillPrint() {
		if (this.#l) {
			await this.#u?.promise, this.#u = Promise.withResolvers();
			try {
				await this.#l.dispatchEventInSandbox({
					id: "doc",
					name: "WillPrint"
				});
			} catch (e) {
				throw this.#u.resolve(), this.#u = null, e;
			}
			await this.#u.promise;
		}
	}
	async dispatchDidPrint() {
		return this.#l?.dispatchEventInSandbox({
			id: "doc",
			name: "DidPrint"
		});
	}
	get destroyPromise() {
		return this.#t?.promise || null;
	}
	get ready() {
		return this.#c;
	}
	get _pageOpenPending() {
		return L(this, "_pageOpenPending", /* @__PURE__ */ new Set());
	}
	get _visitedPages() {
		return L(this, "_visitedPages", /* @__PURE__ */ new Map());
	}
	async #d(e) {
		let t = this.#s, n = t.isInPresentationMode || t.isChangingPresentationMode, { id: r, siblings: i, command: a, value: o } = e;
		if (!r) {
			switch (a) {
				case "clear":
					console.clear();
					break;
				case "error":
					console.error(o);
					break;
				case "layout":
					n || (t.spreadMode = ce(o).spreadMode);
					break;
				case "page-num":
					t.currentPageNumber = o + 1;
					break;
				case "print":
					await t.pagesPromise, this.#i.dispatch("print", { source: this });
					break;
				case "println":
					console.log(o);
					break;
				case "zoom":
					n || (t.currentScaleValue = o);
					break;
				case "SaveAs":
					this.#i.dispatch("download", { source: this });
					break;
				case "FirstPage":
					t.currentPageNumber = 1;
					break;
				case "LastPage":
					t.currentPageNumber = t.pagesCount;
					break;
				case "NextPage":
					t.nextPage();
					break;
				case "PrevPage":
					t.previousPage();
					break;
				case "ZoomViewIn":
					n || t.increaseScale();
					break;
				case "ZoomViewOut":
					n || t.decreaseScale();
					break;
				case "WillPrintFinished":
					this.#u?.resolve(), this.#u = null;
					break;
			}
			return;
		}
		if (n && e.focus) return;
		delete e.id, delete e.siblings;
		let s = i ? [r, ...i] : [r];
		for (let t of s) {
			let n = document.querySelector(`[data-element-id="${t}"]`);
			n ? n.dispatchEvent(new CustomEvent("updatefromsandbox", { detail: e })) : this.#o?.annotationStorage.setValue(t, e);
		}
	}
	async #f(e, t = !1) {
		let n = this.#o, r = this._visitedPages;
		if (t && (this.#e = Promise.withResolvers()), !this.#e) return;
		let i = this.#s.getPageView(e - 1);
		if (i?.renderingState !== d.FINISHED) {
			this._pageOpenPending.add(e);
			return;
		}
		this._pageOpenPending.delete(e);
		let a = (async () => {
			let t = await (r.has(e) ? null : i.pdfPage?.getJSActions());
			n === this.#o && await this.#l?.dispatchEventInSandbox({
				id: "page",
				name: "PageOpen",
				pageNumber: e,
				actions: t
			});
		})();
		r.set(e, a);
	}
	async #p(e) {
		let t = this.#o, n = this._visitedPages;
		if (!this.#e || this._pageOpenPending.has(e)) return;
		let r = n.get(e);
		r && (n.set(e, null), await r, t === this.#o && await this.#l?.dispatchEventInSandbox({
			id: "page",
			name: "PageClose",
			pageNumber: e
		}));
	}
	#m() {
		if (this.#t = Promise.withResolvers(), this.#l) throw Error("#initScripting: Scripting already exists.");
		return this.#a.createScripting();
	}
	async #h() {
		if (!this.#l) {
			this.#o = null, this.#t?.resolve();
			return;
		}
		this.#e &&= (await Promise.race([this.#e.promise, new Promise((e) => {
			setTimeout(e, 1e3);
		})]).catch(() => {}), null), this.#o = null;
		try {
			await this.#l.destroySandbox();
		} catch {}
		this.#u?.reject(/* @__PURE__ */ Error("Scripting destroyed.")), this.#u = null, this.#r?.abort(), this.#r = null, this._pageOpenPending.clear(), this._visitedPages.clear(), this.#l = null, this.#c = !1, this.#t?.resolve();
	}
}, gr = class extends hr {
	constructor(e) {
		e.externalServices || window.addEventListener("updatefromsandbox", (t) => {
			e.eventBus.dispatch("updatefromsandbox", {
				source: window,
				detail: t.detail
			});
		}), e.externalServices ||= { createScripting: () => new mr(e.sandboxBundleSrc) }, e.docProperties ||= (e) => pr(e), super(e);
	}
}, _r = 3e4, vr = class {
	constructor() {
		this.pdfViewer = null, this.pdfThumbnailViewer = null, this.onIdle = null, this.highestPriorityPage = null, this.idleTimeout = null, this.printing = !1, this.isThumbnailViewEnabled = !1, Object.defineProperty(this, "hasViewer", { value: () => !!this.pdfViewer });
	}
	setViewer(e) {
		this.pdfViewer = e;
	}
	setThumbnailViewer(e) {
		this.pdfThumbnailViewer = e;
	}
	isHighestPriority(e) {
		return this.highestPriorityPage === e.renderingId;
	}
	renderHighestPriority(e) {
		this.idleTimeout &&= (clearTimeout(this.idleTimeout), null), !this.pdfViewer.forceRendering(e) && (this.isThumbnailViewEnabled && this.pdfThumbnailViewer?.forceRendering() || this.printing || this.onIdle && (this.idleTimeout = setTimeout(this.onIdle.bind(this), _r)));
	}
	getHighestPriority(e, t, n, r = !1) {
		let i = e.views, a = i.length;
		if (a === 0) return null;
		for (let e = 0; e < a; e++) {
			let t = i[e].view;
			if (!this.isViewFinished(t)) return t;
		}
		let o = e.first.id, s = e.last.id;
		if (s - o + 1 > a) {
			let r = e.ids;
			for (let e = 1, i = s - o; e < i; e++) {
				let i = n ? o + e : s - e;
				if (r.has(i)) continue;
				let a = t[i - 1];
				if (!this.isViewFinished(a)) return a;
			}
		}
		let c = n ? s : o - 2, l = t[c];
		return l && !this.isViewFinished(l) || r && (c += n ? 1 : -1, l = t[c], l && !this.isViewFinished(l)) ? l : null;
	}
	isViewFinished(e) {
		return e.renderingState === d.FINISHED;
	}
	renderView(e) {
		switch (e.renderingState) {
			case d.FINISHED: return !1;
			case d.PAUSED:
				this.highestPriorityPage = e.renderingId, e.resume();
				break;
			case d.RUNNING:
				this.highestPriorityPage = e.renderingId;
				break;
			case d.INITIAL:
				this.highestPriorityPage = e.renderingId, e.draw().finally(() => {
					this.renderHighestPriority();
				}).catch((e) => {
					e instanceof I || console.error("renderView:", e);
				});
				break;
		}
		return !0;
	}
}, yr = 10, $ = {
	FORCE_SCROLL_MODE_PAGE: 1e4,
	FORCE_LAZY_PAGE_INIT: 5e3,
	PAUSE_EAGER_PAGE_INIT: 250
};
function br(e) {
	return Object.values(M).includes(e) && e !== M.DISABLE;
}
var xr = class {
	#e = /* @__PURE__ */ new Set();
	#t = 0;
	constructor(e) {
		this.#t = e;
	}
	push(e) {
		let t = this.#e;
		t.has(e) && t.delete(e), t.add(e), t.size > this.#t && this.#n();
	}
	resize(e, t = null) {
		this.#t = e;
		let n = this.#e;
		if (t) {
			let e = n.size, r = 1;
			for (let i of n) if (t.has(i.id) && (n.delete(i), n.add(i)), ++r > e) break;
		}
		for (; n.size > this.#t;) this.#n();
	}
	has(e) {
		return this.#e.has(e);
	}
	[Symbol.iterator]() {
		return this.#e.keys();
	}
	#n() {
		let e = this.#e.keys().next().value;
		e?.destroy(), this.#e.delete(e);
	}
}, Sr = class {
	#e = null;
	#t = null;
	#n = null;
	#r = M.NONE;
	#i = null;
	#a = N.ENABLE_FORMS;
	#o = null;
	#s = null;
	#c = !1;
	#l = !1;
	#u = !1;
	#d = !1;
	#f = !1;
	#p = null;
	#m = null;
	#h = null;
	#g = null;
	#_ = !1;
	#v = null;
	#y = !1;
	#b = 0;
	#x = new ResizeObserver(this.#B.bind(this));
	#S = null;
	#C = null;
	#w = !0;
	#T = p.ENABLE;
	constructor(e) {
		let t = "4.10.38";
		if (Ct !== t) throw Error(`The API version "${Ct}" does not match the Viewer version "${t}".`);
		if (this.container = e.container, this.viewer = e.viewer || e.container.firstElementChild, this.container?.tagName !== "DIV" || this.viewer?.tagName !== "DIV") throw Error("Invalid `container` and/or `viewer` option.");
		if (this.container.offsetParent && getComputedStyle(this.container).position !== "absolute") throw Error("The `container` must be absolutely positioned.");
		this.#x.observe(this.container), this.eventBus = e.eventBus, this.linkService = e.linkService || new Be(), this.downloadManager = e.downloadManager || null, this.findController = e.findController || null, this.#t = e.altTextManager || null, this.#s = e.editorUndoBar || null, this.findController && (this.findController.onIsPageVisible = (e) => this._getVisiblePages().ids.has(e)), this._scriptingManager = e.scriptingManager || null, this.#T = e.textLayerMode ?? p.ENABLE, this.#a = e.annotationMode ?? N.ENABLE_FORMS, this.#r = e.annotationEditorMode ?? M.NONE, this.#n = e.annotationEditorHighlightColors || null, this.#l = e.enableHighlightFloatingButton === !0, this.#d = e.enableUpdatedAddImage === !0, this.#f = e.enableNewAltTextWhenAddingImage === !0, this.imageResourcesPath = e.imageResourcesPath || "", this.enablePrintAutoRotate = e.enablePrintAutoRotate || !1, this.removePageBorders = e.removePageBorders || !1, this.maxCanvasPixels = e.maxCanvasPixels, this.l10n = e.l10n, this.l10n ||= new X(), this.#u = e.enablePermissions || !1, this.pageColors = e.pageColors || null, this.#m = e.mlManager || null, this.#c = e.enableHWA || !1, this.#w = e.supportsPinchToZoom !== !1, this.defaultRenderingQueue = !e.renderingQueue, this.defaultRenderingQueue ? (this.renderingQueue = new vr(), this.renderingQueue.setViewer(this)) : this.renderingQueue = e.renderingQueue;
		let { abortSignal: n } = e;
		n?.addEventListener("abort", () => {
			this.#x.disconnect(), this.#x = null;
		}, { once: !0 }), this.scroll = _(this.container, this._scrollUpdate.bind(this), n), this.presentationModeState = f.UNKNOWN, this._resetView(), this.removePageBorders && this.viewer.classList.add("removePageBorders"), this.#z(), this.eventBus._on("thumbnailrendered", ({ pageNumber: e, pdfPage: t }) => {
			let n = this._pages[e - 1];
			this.#e.has(n) || t?.cleanup();
		}), e.l10n || this.l10n.translate(this.container);
	}
	get pagesCount() {
		return this._pages.length;
	}
	getPageView(e) {
		return this._pages[e];
	}
	getCachedPageViews() {
		return new Set(this.#e);
	}
	get pageViewsReady() {
		return this._pages.every((e) => e?.pdfPage);
	}
	get renderForms() {
		return this.#a === N.ENABLE_FORMS;
	}
	get enableScripting() {
		return !!this._scriptingManager;
	}
	get currentPageNumber() {
		return this._currentPageNumber;
	}
	set currentPageNumber(e) {
		if (!Number.isInteger(e)) throw Error("Invalid page number.");
		this.pdfDocument && (this._setCurrentPageNumber(e, !0) || console.error(`currentPageNumber: "${e}" is not a valid page.`));
	}
	_setCurrentPageNumber(e, t = !1) {
		if (this._currentPageNumber === e) return t && this.#F(), !0;
		if (!(0 < e && e <= this.pagesCount)) return !1;
		let n = this._currentPageNumber;
		return this._currentPageNumber = e, this.eventBus.dispatch("pagechanging", {
			source: this,
			pageNumber: e,
			pageLabel: this._pageLabels?.[e - 1] ?? null,
			previous: n
		}), t && this.#F(), !0;
	}
	get currentPageLabel() {
		return this._pageLabels?.[this._currentPageNumber - 1] ?? null;
	}
	set currentPageLabel(e) {
		if (!this.pdfDocument) return;
		let t = e | 0;
		if (this._pageLabels) {
			let n = this._pageLabels.indexOf(e);
			n >= 0 && (t = n + 1);
		}
		this._setCurrentPageNumber(t, !0) || console.error(`currentPageLabel: "${e}" is not a valid page.`);
	}
	get currentScale() {
		return this._currentScale === s ? r : this._currentScale;
	}
	set currentScale(e) {
		if (isNaN(e)) throw Error("Invalid numeric scale.");
		this.pdfDocument && this.#P(e, { noScroll: !1 });
	}
	get currentScaleValue() {
		return this._currentScaleValue;
	}
	set currentScaleValue(e) {
		this.pdfDocument && this.#P(e, { noScroll: !1 });
	}
	get pagesRotation() {
		return this._pagesRotation;
	}
	set pagesRotation(e) {
		if (!ne(e)) throw Error("Invalid pages rotation angle.");
		if (!this.pdfDocument || (e %= 360, e < 0 && (e += 360), this._pagesRotation === e)) return;
		this._pagesRotation = e;
		let t = this._currentPageNumber;
		this.refresh(!0, { rotation: e }), this._currentScaleValue && this.#P(this._currentScaleValue, { noScroll: !0 }), this.eventBus.dispatch("rotationchanging", {
			source: this,
			pagesRotation: e,
			pageNumber: t
		}), this.defaultRenderingQueue && this.update();
	}
	get firstPagePromise() {
		return this.pdfDocument ? this._firstPageCapability.promise : null;
	}
	get onePageRendered() {
		return this.pdfDocument ? this._onePageRenderedCapability.promise : null;
	}
	get pagesPromise() {
		return this.pdfDocument ? this._pagesCapability.promise : null;
	}
	get _layerProperties() {
		let e = this;
		return L(this, "_layerProperties", {
			get annotationEditorUIManager() {
				return e.#i;
			},
			get annotationStorage() {
				return e.pdfDocument?.annotationStorage;
			},
			get downloadManager() {
				return e.downloadManager;
			},
			get enableScripting() {
				return !!e._scriptingManager;
			},
			get fieldObjectsPromise() {
				return e.pdfDocument?.getFieldObjects();
			},
			get findController() {
				return e.findController;
			},
			get hasJSActionsPromise() {
				return e.pdfDocument?.hasJSActions();
			},
			get linkService() {
				return e.linkService;
			}
		});
	}
	#E(e) {
		let t = {
			annotationEditorMode: this.#r,
			annotationMode: this.#a,
			textLayerMode: this.#T
		};
		return e ? (!e.includes(P.COPY) && this.#T === p.ENABLE && (t.textLayerMode = p.ENABLE_PERMISSIONS), e.includes(P.MODIFY_CONTENTS) || (t.annotationEditorMode = M.DISABLE), !e.includes(P.MODIFY_ANNOTATIONS) && !e.includes(P.FILL_INTERACTIVE_FORMS) && this.#a === N.ENABLE_FORMS && (t.annotationMode = N.ENABLE), t) : t;
	}
	async #D(e) {
		if (document.visibilityState === "hidden" || !this.container.offsetParent || this._getVisiblePages().views.length === 0) return;
		let t = Promise.withResolvers(), n = new AbortController();
		document.addEventListener("visibilitychange", () => {
			document.visibilityState === "hidden" && t.resolve();
		}, { signal: typeof AbortSignal.any == "function" ? AbortSignal.any([e, n.signal]) : e }), await Promise.race([this._onePageRenderedCapability.promise, t.promise]), n.abort();
	}
	async getAllText() {
		let e = [], t = [];
		for (let n = 1, r = this.pdfDocument.numPages; n <= r; ++n) {
			if (this.#y) return null;
			t.length = 0;
			let { items: r } = await (await this.pdfDocument.getPage(n)).getTextContent();
			for (let e of r) e.str && t.push(e.str), e.hasEOL && t.push("\n");
			e.push(b(t.join("")));
		}
		return e.join("\n");
	}
	#O(e, t) {
		let n = document.getSelection(), { focusNode: r, anchorNode: i } = n;
		if (i && r && n.containsNode(this.#v)) {
			if (this.#_ || e === p.ENABLE_PERMISSIONS) {
				R(t);
				return;
			}
			this.#_ = !0;
			let { classList: n } = this.viewer;
			n.add("copyAll");
			let r = new AbortController();
			window.addEventListener("keydown", (e) => this.#y = e.key === "Escape", { signal: r.signal }), this.getAllText().then(async (e) => {
				e !== null && await navigator.clipboard.writeText(e);
			}).catch((e) => {
				console.warn(`Something goes wrong when extracting the text: ${e.message}`);
			}).finally(() => {
				this.#_ = !1, this.#y = !1, r.abort(), n.remove("copyAll");
			}), R(t);
		}
	}
	setDocument(e) {
		if (this.pdfDocument && (this.eventBus.dispatch("pagesdestroy", { source: this }), this._cancelRendering(), this._resetView(), this.findController?.setDocument(null), this._scriptingManager?.setDocument(null), this.#i?.destroy(), this.#i = null), this.pdfDocument = e, !e) return;
		let t = e.numPages, n = e.getPage(1), r = e.getOptionalContentConfig({ intent: "display" }), i = this.#u ? e.getPermissions() : Promise.resolve(), { eventBus: a, pageColors: o, viewer: s } = this;
		this.#p = new AbortController();
		let { signal: c } = this.#p;
		if (t > $.FORCE_SCROLL_MODE_PAGE) {
			console.warn("Forcing PAGE-scrolling for performance reasons, given the length of the document.");
			let e = this._scrollMode = m.PAGE;
			a.dispatch("scrollmodechanged", {
				source: this,
				mode: e
			});
		}
		this._pagesCapability.promise.then(() => {
			a.dispatch("pagesloaded", {
				source: this,
				pagesCount: t
			});
		}, () => {}), a._on("pagerender", (e) => {
			let t = this._pages[e.pageNumber - 1];
			t && this.#e.push(t);
		}, { signal: c });
		let l = (e) => {
			e.cssTransform || (this._onePageRenderedCapability.resolve({ timestamp: e.timestamp }), a._off("pagerendered", l));
		};
		a._on("pagerendered", l, { signal: c }), Promise.all([n, i]).then(([n, i]) => {
			if (e !== this.pdfDocument) return;
			this._firstPageCapability.resolve(n), this._optionalContentConfigPromise = r;
			let { annotationEditorMode: l, annotationMode: u, textLayerMode: d } = this.#E(i);
			if (d !== p.DISABLE) {
				let e = this.#v = document.createElement("div");
				e.id = "hiddenCopyElement", s.before(e);
			}
			if (typeof AbortSignal.any == "function" && l !== M.DISABLE) {
				let t = l;
				e.isPureXfa ? console.warn("Warning: XFA-editing is not implemented.") : br(t) ? (this.#i = new We(this.container, s, this.#t, a, e, o, this.#n, this.#l, this.#d, this.#f, this.#m, this.#s, this.#w), a.dispatch("annotationeditoruimanager", {
					source: this,
					uiManager: this.#i
				}), t !== M.NONE && (t === M.STAMP && this.#m?.loadModel("altText"), this.#i.updateMode(t))) : console.error(`Invalid AnnotationEditor mode: ${t}`);
			}
			let f = this._scrollMode === m.PAGE ? null : s, g = this.currentScale, _ = n.getViewport({ scale: g * F.PDF_TO_CSS_UNITS });
			s.style.setProperty("--scale-factor", _.scale), o?.background && s.style.setProperty("--page-bg-color", o.background), (o?.foreground === "CanvasText" || o?.background === "Canvas") && (s.style.setProperty("--hcm-highlight-filter", e.filterFactory.addHighlightHCMFilter("highlight", "CanvasText", "Canvas", "HighlightText", "Highlight")), s.style.setProperty("--hcm-highlight-selected-filter", e.filterFactory.addHighlightHCMFilter("highlight_selected", "CanvasText", "Canvas", "HighlightText", "ButtonText")));
			for (let e = 1; e <= t; ++e) {
				let t = new fr({
					container: f,
					eventBus: a,
					id: e,
					scale: g,
					defaultViewport: _.clone(),
					optionalContentConfigPromise: r,
					renderingQueue: this.renderingQueue,
					textLayerMode: d,
					annotationMode: u,
					imageResourcesPath: this.imageResourcesPath,
					maxCanvasPixels: this.maxCanvasPixels,
					pageColors: o,
					l10n: this.l10n,
					layerProperties: this._layerProperties,
					enableHWA: this.#c
				});
				this._pages.push(t);
			}
			this._pages[0]?.setPdfPage(n), this._scrollMode === m.PAGE ? this.#k() : this._spreadMode !== h.NONE && this._updateSpreadMode(), this.#D(c).then(async () => {
				if (e !== this.pdfDocument) return;
				if (this.findController?.setDocument(e), this._scriptingManager?.setDocument(e), this.#v && document.addEventListener("copy", this.#O.bind(this, d), { signal: c }), this.#i && a.dispatch("annotationeditormodechanged", {
					source: this,
					mode: this.#r
				}), e.loadingParams.disableAutoFetch || t > $.FORCE_LAZY_PAGE_INIT) {
					this._pagesCapability.resolve();
					return;
				}
				let n = t - 1;
				if (n <= 0) {
					this._pagesCapability.resolve();
					return;
				}
				for (let r = 2; r <= t; ++r) {
					let t = e.getPage(r).then((e) => {
						let t = this._pages[r - 1];
						t.pdfPage || t.setPdfPage(e), --n === 0 && this._pagesCapability.resolve();
					}, (e) => {
						console.error(`Unable to get page ${r} to initialize viewer`, e), --n === 0 && this._pagesCapability.resolve();
					});
					r % $.PAUSE_EAGER_PAGE_INIT === 0 && await t;
				}
			}), a.dispatch("pagesinit", { source: this }), e.getMetadata().then(({ info: t }) => {
				e === this.pdfDocument && t.Language && (s.lang = t.Language);
			}), this.defaultRenderingQueue && this.update();
		}).catch((e) => {
			console.error("Unable to initialize viewer", e), this._pagesCapability.reject(e);
		});
	}
	setPageLabels(e) {
		if (this.pdfDocument) {
			e ? Array.isArray(e) && this.pdfDocument.numPages === e.length ? this._pageLabels = e : (this._pageLabels = null, console.error("setPageLabels: Invalid page labels.")) : this._pageLabels = null;
			for (let e = 0, t = this._pages.length; e < t; e++) this._pages[e].setPageLabel(this._pageLabels?.[e] ?? null);
		}
	}
	_resetView() {
		this._pages = [], this._currentPageNumber = 1, this._currentScale = s, this._currentScaleValue = null, this._pageLabels = null, this.#e = new xr(yr), this._location = null, this._pagesRotation = 0, this._optionalContentConfigPromise = null, this._firstPageCapability = Promise.withResolvers(), this._onePageRenderedCapability = Promise.withResolvers(), this._pagesCapability = Promise.withResolvers(), this._scrollMode = m.VERTICAL, this._previousScrollMode = m.UNKNOWN, this._spreadMode = h.NONE, this.#S = {
			previousPageNumber: 1,
			scrollDown: !0,
			pages: []
		}, this.#p?.abort(), this.#p = null, this.viewer.textContent = "", this._updateScrollMode(), this.viewer.removeAttribute("lang"), this.#v?.remove(), this.#v = null, this.#V();
	}
	#k() {
		if (this._scrollMode !== m.PAGE) throw Error("#ensurePageViewVisible: Invalid scrollMode value.");
		let e = this._currentPageNumber, t = this.#S, n = this.viewer;
		if (n.textContent = "", t.pages.length = 0, this._spreadMode === h.NONE && !this.isInPresentationMode) {
			let r = this._pages[e - 1];
			n.append(r.div), t.pages.push(r);
		} else {
			let r = /* @__PURE__ */ new Set(), i = this._spreadMode - 1;
			i === -1 ? r.add(e - 1) : e % 2 === i ? (r.add(e - 2), r.add(e - 1)) : (r.add(e - 1), r.add(e));
			let a = document.createElement("div");
			if (a.className = "spread", this.isInPresentationMode) {
				let e = document.createElement("div");
				e.className = "dummyPage", a.append(e);
			}
			for (let e of r) {
				let n = this._pages[e];
				n && (a.append(n.div), t.pages.push(n));
			}
			n.append(a);
		}
		t.scrollDown = e >= t.previousPageNumber, t.previousPageNumber = e;
	}
	_scrollUpdate() {
		this.pagesCount !== 0 && this.update();
	}
	#A(e, t = null) {
		let { div: n, id: r } = e;
		if (this._currentPageNumber !== r && this._setCurrentPageNumber(r), this._scrollMode === m.PAGE && (this.#k(), this.update()), !t && !this.isInPresentationMode) {
			let e = n.offsetLeft + n.clientLeft, r = e + n.clientWidth, { scrollLeft: i, clientWidth: a } = this.container;
			(this._scrollMode === m.HORIZONTAL || e < i || r > i + a) && (t = {
				left: 0,
				top: 0
			});
		}
		g(n, t), !this._currentScaleValue && this._location && (this._location = null);
	}
	#j(e) {
		return e === this._currentScale || Math.abs(e - this._currentScale) < 1e-15;
	}
	#M(e, t, { noScroll: n = !1, preset: r = !1, drawingDelay: i = -1, origin: a = null }) {
		if (this._currentScaleValue = t.toString(), this.#j(e)) {
			r && this.eventBus.dispatch("scalechanging", {
				source: this,
				scale: e,
				presetValue: t
			});
			return;
		}
		this.viewer.style.setProperty("--scale-factor", e * F.PDF_TO_CSS_UNITS);
		let o = i >= 0 && i < 1e3;
		this.refresh(!0, {
			scale: e,
			drawingDelay: o ? i : -1
		}), o && (this.#C = setTimeout(() => {
			this.#C = null, this.refresh();
		}, i));
		let s = this._currentScale;
		if (this._currentScale = e, !n) {
			let t = this._currentPageNumber, n;
			if (this._location && !(this.isInPresentationMode || this.isChangingPresentationMode) && (t = this._location.pageNumber, n = [
				null,
				{ name: "XYZ" },
				this._location.left,
				this._location.top,
				null
			]), this.scrollPageIntoView({
				pageNumber: t,
				destArray: n,
				allowNegativeOffset: !0
			}), Array.isArray(a)) {
				let t = e / s - 1, [n, r] = this.containerTopLeft;
				this.container.scrollLeft += (a[0] - r) * t, this.container.scrollTop += (a[1] - n) * t;
			}
		}
		this.eventBus.dispatch("scalechanging", {
			source: this,
			scale: e,
			presetValue: r ? t : void 0
		}), this.defaultRenderingQueue && this.update();
	}
	get #N() {
		return this._spreadMode !== h.NONE && this._scrollMode !== m.HORIZONTAL ? 2 : 1;
	}
	#P(e, t) {
		let n = parseFloat(e);
		if (n > 0) t.preset = !1, this.#M(n, e, t);
		else {
			let r = this._pages[this._currentPageNumber - 1];
			if (!r) return;
			let i = l, a = u;
			this.isInPresentationMode ? (i = a = 4, this._spreadMode !== h.NONE && (i *= 2)) : this.removePageBorders ? i = a = 0 : this._scrollMode === m.HORIZONTAL && ([i, a] = [a, i]);
			let o = (this.container.clientWidth - i) / r.width * r.scale / this.#N, s = (this.container.clientHeight - a) / r.height * r.scale;
			switch (e) {
				case "page-actual":
					n = 1;
					break;
				case "page-width":
					n = o;
					break;
				case "page-height":
					n = s;
					break;
				case "page-fit":
					n = Math.min(o, s);
					break;
				case "auto":
					let t = ie(r) ? o : Math.min(s, o);
					n = Math.min(c, t);
					break;
				default:
					console.error(`#setScale: "${e}" is an unknown zoom value.`);
					return;
			}
			t.preset = !0, this.#M(n, e, t);
		}
	}
	#F() {
		let e = this._pages[this._currentPageNumber - 1];
		this.isInPresentationMode && this.#P(this._currentScaleValue, { noScroll: !0 }), this.#A(e);
	}
	pageLabelToPageNumber(e) {
		if (!this._pageLabels) return null;
		let t = this._pageLabels.indexOf(e);
		return t < 0 ? null : t + 1;
	}
	scrollPageIntoView({ pageNumber: e, destArray: t = null, allowNegativeOffset: r = !1, ignoreDestinationZoom: i = !1 }) {
		if (!this.pdfDocument) return;
		let a = Number.isInteger(e) && this._pages[e - 1];
		if (!a) {
			console.error(`scrollPageIntoView: "${e}" is not a valid pageNumber parameter.`);
			return;
		}
		if (this.isInPresentationMode || !t) {
			this._setCurrentPageNumber(e, !0);
			return;
		}
		let o = 0, c = 0, d = 0, f = 0, p, m, h = a.rotation % 180 != 0, g = (h ? a.height : a.width) / a.scale / F.PDF_TO_CSS_UNITS, _ = (h ? a.width : a.height) / a.scale / F.PDF_TO_CSS_UNITS, v = 0;
		switch (t[1].name) {
			case "XYZ":
				o = t[2], c = t[3], v = t[4], o = o === null ? 0 : o, c = c === null ? _ : c;
				break;
			case "Fit":
			case "FitB":
				v = "page-fit";
				break;
			case "FitH":
			case "FitBH":
				c = t[2], v = "page-width", c === null && this._location ? (o = this._location.left, c = this._location.top) : (typeof c != "number" || c < 0) && (c = _);
				break;
			case "FitV":
			case "FitBV":
				o = t[2], d = g, f = _, v = "page-height";
				break;
			case "FitR":
				o = t[2], c = t[3], d = t[4] - o, f = t[5] - c;
				let e = l, n = u;
				this.removePageBorders && (e = n = 0), p = (this.container.clientWidth - e) / d / F.PDF_TO_CSS_UNITS, m = (this.container.clientHeight - n) / f / F.PDF_TO_CSS_UNITS, v = Math.min(Math.abs(p), Math.abs(m));
				break;
			default:
				console.error(`scrollPageIntoView: "${t[1].name}" is not a valid destination type.`);
				return;
		}
		if (i || (v && v !== this._currentScale ? this.currentScaleValue = v : this._currentScale === s && (this.currentScaleValue = n)), v === "page-fit" && !t[4]) {
			this.#A(a);
			return;
		}
		let y = [a.viewport.convertToViewportPoint(o, c), a.viewport.convertToViewportPoint(o + d, c + f)], b = Math.min(y[0][0], y[1][0]), x = Math.min(y[0][1], y[1][1]);
		r || (b = Math.max(b, 0), x = Math.max(x, 0)), this.#A(a, {
			left: b,
			top: x
		});
	}
	_updateLocation(e) {
		let t = this._currentScale, n = this._currentScaleValue, r = parseFloat(n) === t ? Math.round(t * 1e4) / 100 : n, i = e.id, a = this._pages[i - 1], o = this.container, s = a.getPagePoint(o.scrollLeft - e.x, o.scrollTop - e.y), c = Math.round(s[0]), l = Math.round(s[1]), u = `#page=${i}`;
		this.isInPresentationMode || (u += `&zoom=${r},${c},${l}`), this._location = {
			pageNumber: i,
			scale: r,
			top: l,
			left: c,
			rotation: this._pagesRotation,
			pdfOpenParams: u
		};
	}
	update() {
		let e = this._getVisiblePages(), t = e.views, n = t.length;
		if (n === 0) return;
		let r = Math.max(yr, 2 * n + 1);
		this.#e.resize(r, e.ids), this.renderingQueue.renderHighestPriority(e);
		let i = this._spreadMode === h.NONE && (this._scrollMode === m.PAGE || this._scrollMode === m.VERTICAL), a = this._currentPageNumber, o = !1;
		for (let e of t) {
			if (e.percent < 100) break;
			if (e.id === a && i) {
				o = !0;
				break;
			}
		}
		this._setCurrentPageNumber(o ? a : t[0].id), this._updateLocation(e.first), this.eventBus.dispatch("updateviewarea", {
			source: this,
			location: this._location
		});
	}
	#I() {
		let e = this._getVisiblePages(), t = [], { ids: n, views: r } = e;
		for (let e of r) {
			let { view: r } = e;
			if (!r.hasEditableAnnotations()) {
				n.delete(r.id);
				continue;
			}
			t.push(e);
		}
		return t.length === 0 ? null : (this.renderingQueue.renderHighestPriority({
			first: t[0],
			last: t.at(-1),
			views: t,
			ids: n
		}), n);
	}
	containsElement(e) {
		return this.container.contains(e);
	}
	focus() {
		this.container.focus();
	}
	get _isContainerRtl() {
		return getComputedStyle(this.container).direction === "rtl";
	}
	get isInPresentationMode() {
		return this.presentationModeState === f.FULLSCREEN;
	}
	get isChangingPresentationMode() {
		return this.presentationModeState === f.CHANGING;
	}
	get isHorizontalScrollbarEnabled() {
		return this.isInPresentationMode ? !1 : this.container.scrollWidth > this.container.clientWidth;
	}
	get isVerticalScrollbarEnabled() {
		return this.isInPresentationMode ? !1 : this.container.scrollHeight > this.container.clientHeight;
	}
	_getVisiblePages() {
		let e = this._scrollMode === m.PAGE ? this.#S.pages : this._pages, t = this._scrollMode === m.HORIZONTAL, n = t && this._isContainerRtl;
		return te({
			scrollEl: this.container,
			views: e,
			sortByVisibility: !0,
			horizontal: t,
			rtl: n
		});
	}
	cleanup() {
		for (let e of this._pages) e.renderingState !== d.FINISHED && e.reset();
	}
	_cancelRendering() {
		for (let e of this._pages) e.cancelRendering();
	}
	async #L(e) {
		if (e.pdfPage) return e.pdfPage;
		try {
			let t = await this.pdfDocument.getPage(e.id);
			return e.pdfPage || e.setPdfPage(t), t;
		} catch (e) {
			return console.error("Unable to get page for page view", e), null;
		}
	}
	#R(e) {
		if (e.first?.id === 1) return !0;
		if (e.last?.id === this.pagesCount) return !1;
		switch (this._scrollMode) {
			case m.PAGE: return this.#S.scrollDown;
			case m.HORIZONTAL: return this.scroll.right;
		}
		return this.scroll.down;
	}
	forceRendering(e) {
		let t = e || this._getVisiblePages(), n = this.#R(t), r = this._spreadMode !== h.NONE && this._scrollMode !== m.HORIZONTAL, i = this.renderingQueue.getHighestPriority(t, this._pages, n, r);
		return i ? (this.#L(i).then(() => {
			this.renderingQueue.renderView(i);
		}), !0) : !1;
	}
	get hasEqualPageSizes() {
		let e = this._pages[0];
		for (let t = 1, n = this._pages.length; t < n; ++t) {
			let n = this._pages[t];
			if (n.width !== e.width || n.height !== e.height) return !1;
		}
		return !0;
	}
	getPagesOverview() {
		let e;
		return this._pages.map((t) => {
			let n = t.pdfPage.getViewport({ scale: 1 }), r = ie(n);
			if (e === void 0) e = r;
			else if (this.enablePrintAutoRotate && r !== e) return {
				width: n.height,
				height: n.width,
				rotation: (n.rotation - 90) % 360
			};
			return {
				width: n.width,
				height: n.height,
				rotation: n.rotation
			};
		});
	}
	get optionalContentConfigPromise() {
		return this.pdfDocument ? this._optionalContentConfigPromise ? this._optionalContentConfigPromise : (console.error("optionalContentConfigPromise: Not initialized yet."), this.pdfDocument.getOptionalContentConfig({ intent: "display" })) : Promise.resolve(null);
	}
	set optionalContentConfigPromise(e) {
		if (!(e instanceof Promise)) throw Error(`Invalid optionalContentConfigPromise: ${e}`);
		this.pdfDocument && this._optionalContentConfigPromise && (this._optionalContentConfigPromise = e, this.refresh(!1, { optionalContentConfigPromise: e }), this.eventBus.dispatch("optionalcontentconfigchanged", {
			source: this,
			promise: e
		}));
	}
	get scrollMode() {
		return this._scrollMode;
	}
	set scrollMode(e) {
		if (this._scrollMode !== e) {
			if (!w(e)) throw Error(`Invalid scroll mode: ${e}`);
			this.pagesCount > $.FORCE_SCROLL_MODE_PAGE || (this._previousScrollMode = this._scrollMode, this._scrollMode = e, this.eventBus.dispatch("scrollmodechanged", {
				source: this,
				mode: e
			}), this._updateScrollMode(this._currentPageNumber));
		}
	}
	_updateScrollMode(e = null) {
		let t = this._scrollMode, n = this.viewer;
		n.classList.toggle("scrollHorizontal", t === m.HORIZONTAL), n.classList.toggle("scrollWrapped", t === m.WRAPPED), !(!this.pdfDocument || !e) && (t === m.PAGE ? this.#k() : this._previousScrollMode === m.PAGE && this._updateSpreadMode(), this._currentScaleValue && isNaN(this._currentScaleValue) && this.#P(this._currentScaleValue, { noScroll: !0 }), this._setCurrentPageNumber(e, !0), this.update());
	}
	get spreadMode() {
		return this._spreadMode;
	}
	set spreadMode(e) {
		if (this._spreadMode !== e) {
			if (!re(e)) throw Error(`Invalid spread mode: ${e}`);
			this._spreadMode = e, this.eventBus.dispatch("spreadmodechanged", {
				source: this,
				mode: e
			}), this._updateSpreadMode(this._currentPageNumber);
		}
	}
	_updateSpreadMode(e = null) {
		if (!this.pdfDocument) return;
		let t = this.viewer, n = this._pages;
		if (this._scrollMode === m.PAGE) this.#k();
		else if (t.textContent = "", this._spreadMode === h.NONE) for (let e of this._pages) t.append(e.div);
		else {
			let e = this._spreadMode - 1, r = null;
			for (let i = 0, a = n.length; i < a; ++i) r === null ? (r = document.createElement("div"), r.className = "spread", t.append(r)) : i % 2 === e && (r = r.cloneNode(!1), t.append(r)), r.append(n[i].div);
		}
		e && (this._currentScaleValue && isNaN(this._currentScaleValue) && this.#P(this._currentScaleValue, { noScroll: !0 }), this._setCurrentPageNumber(e, !0), this.update());
	}
	_getPageAdvance(e, t = !1) {
		switch (this._scrollMode) {
			case m.WRAPPED: {
				let { views: n } = this._getVisiblePages(), r = /* @__PURE__ */ new Map();
				for (let { id: e, y: t, percent: i, widthPercent: a } of n) {
					if (i === 0 || a < 100) continue;
					let n = r.get(t);
					n || r.set(t, n ||= []), n.push(e);
				}
				for (let n of r.values()) {
					let r = n.indexOf(e);
					if (r === -1) continue;
					let i = n.length;
					if (i === 1) break;
					if (t) for (let t = r - 1, i = 0; t >= 0; t--) {
						let r = n[t], i = n[t + 1] - 1;
						if (r < i) return e - i;
					}
					else for (let t = r + 1, a = i; t < a; t++) {
						let r = n[t], i = n[t - 1] + 1;
						if (r > i) return i - e;
					}
					if (t) {
						let t = n[0];
						if (t < e) return e - t + 1;
					} else {
						let t = n[i - 1];
						if (t > e) return t - e + 1;
					}
					break;
				}
				break;
			}
			case m.HORIZONTAL: break;
			case m.PAGE:
			case m.VERTICAL: {
				if (this._spreadMode === h.NONE) break;
				let n = this._spreadMode - 1;
				if (t && e % 2 !== n || !t && e % 2 === n) break;
				let { views: r } = this._getVisiblePages(), i = t ? e - 1 : e + 1;
				for (let { id: e, percent: t, widthPercent: n } of r) if (e === i) {
					if (t > 0 && n === 100) return 2;
					break;
				}
				break;
			}
		}
		return 1;
	}
	nextPage() {
		let e = this._currentPageNumber, t = this.pagesCount;
		if (e >= t) return !1;
		let n = this._getPageAdvance(e, !1) || 1;
		return this.currentPageNumber = Math.min(e + n, t), !0;
	}
	previousPage() {
		let e = this._currentPageNumber;
		if (e <= 1) return !1;
		let t = this._getPageAdvance(e, !0) || 1;
		return this.currentPageNumber = Math.max(e - t, 1), !0;
	}
	updateScale({ drawingDelay: e, scaleFactor: t = null, steps: n = null, origin: r }) {
		if (n === null && t === null) throw Error("Invalid updateScale options: either `steps` or `scaleFactor` must be provided.");
		if (!this.pdfDocument) return;
		let s = this._currentScale;
		if (t > 0 && t !== 1) s = Math.round(s * t * 100) / 100;
		else if (n) {
			let e = n > 0 ? i : 1 / i, t = n > 0 ? Math.ceil : Math.floor;
			n = Math.abs(n);
			do
				s = t((s * e).toFixed(2) * 10) / 10;
			while (--n > 0);
		}
		s = Math.max(a, Math.min(o, s)), this.#P(s, {
			noScroll: !1,
			drawingDelay: e,
			origin: r
		});
	}
	increaseScale(e = {}) {
		this.updateScale({
			...e,
			steps: e.steps ?? 1
		});
	}
	decreaseScale(e = {}) {
		this.updateScale({
			...e,
			steps: -(e.steps ?? 1)
		});
	}
	#z(e = this.container.clientHeight) {
		e !== this.#b && (this.#b = e, ae.setProperty("--viewer-container-height", `${e}px`));
	}
	#B(e) {
		for (let t of e) if (t.target === this.container) {
			this.#z(Math.floor(t.borderBoxSize[0].blockSize)), this.#o = null;
			break;
		}
	}
	get containerTopLeft() {
		return this.#o ||= [this.container.offsetTop, this.container.offsetLeft];
	}
	#V() {
		this.#h?.abort(), this.#h = null, this.#g !== null && (clearTimeout(this.#g), this.#g = null);
	}
	get annotationEditorMode() {
		return this.#i ? this.#r : M.DISABLE;
	}
	set annotationEditorMode({ mode: e, editId: t = null, isFromKeyboard: n = !1 }) {
		if (!this.#i) throw Error("The AnnotationEditor is not enabled.");
		if (this.#r === e) return;
		if (!br(e)) throw Error(`Invalid AnnotationEditor mode: ${e}`);
		if (!this.pdfDocument) return;
		e === M.STAMP && this.#m?.loadModel("altText");
		let { eventBus: r } = this, i = () => {
			this.#V(), this.#r = e, this.#i.updateMode(e, t, n), r.dispatch("annotationeditormodechanged", {
				source: this,
				mode: e
			});
		};
		if (e === M.NONE || this.#r === M.NONE) {
			let t = e !== M.NONE;
			t || this.pdfDocument.annotationStorage.resetModifiedIds();
			for (let e of this._pages) e.toggleEditingMode(t);
			let n = this.#I();
			if (t && n) {
				this.#V(), this.#h = new AbortController();
				let e = AbortSignal.any([this.#p.signal, this.#h.signal]);
				r._on("pagerendered", ({ pageNumber: e }) => {
					n.delete(e), n.size === 0 && (this.#g = setTimeout(i, 0));
				}, { signal: e });
				return;
			}
		}
		i();
	}
	refresh(e = !1, t = Object.create(null)) {
		if (this.pdfDocument) {
			for (let e of this._pages) e.update(t);
			this.#C !== null && (clearTimeout(this.#C), this.#C = null), e || this.update();
		}
	}
}, Cr = class extends Sr {
	_resetView() {
		super._resetView(), this._scrollMode = m.PAGE, this._spreadMode = h.NONE;
	}
	set scrollMode(e) {}
	_updateScrollMode() {}
	set spreadMode(e) {}
	_updateSpreadMode() {}
};
t.AnnotationLayerBuilder, t.DownloadManager;
var wr = t.EventBus;
t.FindState, t.GenericL10n, t.LinkTarget;
var Tr = t.PDFFindController;
t.PDFHistory;
var Er = t.PDFLinkService;
t.PDFPageView, t.PDFScriptingManager, t.PDFSinglePageViewer;
var Dr = t.PDFViewer;
t.ProgressBar, t.RenderingStates, t.ScrollMode, t.SimpleLinkService, t.SpreadMode, t.StructTreeLayerBuilder, t.TextLayerBuilder, t.XfaLayerBuilder, t.parseQueryString;
//#endregion
export { wr as EventBus, Tr as PDFFindController, Er as PDFLinkService, Dr as PDFViewer };
