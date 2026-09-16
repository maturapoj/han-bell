"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./page.module.css";

type Person = { id: string; name: string };
type Item = { id: string; name: string; price: number; shared: string[] };
type BillState = {
  title: string;
  people: Person[];
  items: Item[];
  discount: number;
  servicePct: number;
  vatPct: number;
  roundToBaht: boolean;
};

const STORAGE_KEY = "hanbil-state-v1";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function hue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string): string {
  const t = (name || "").trim();
  return t ? t.slice(0, 2) : "?";
}

function fmtBaht(n: number, roundToBaht: boolean): string {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", {
    minimumFractionDigits: roundToBaht ? 0 : 2,
    maximumFractionDigits: roundToBaht ? 0 : 2,
  });
}

function sampleState(): BillState {
  const palm = "sample-palm";
  const nan = "sample-nan";
  const ball = "sample-ball";
  return {
    title: "มื้อเย็นวันศุกร์กับเพื่อน",
    people: [
      { id: palm, name: "ปาล์ม" },
      { id: nan, name: "แนน" },
      { id: ball, name: "บอล" },
    ],
    items: [
      { id: "sample-item-1", name: "ข้าวผัดกะเพราหมูกรอบ", price: 120, shared: [palm] },
      { id: "sample-item-2", name: "ส้มตำไทย", price: 90, shared: [palm, nan, ball] },
      { id: "sample-item-3", name: "ไก่ทอดหาดใหญ่", price: 150, shared: [nan, ball] },
      { id: "sample-item-4", name: "น้ำอัดลม 3 ขวด", price: 60, shared: [palm, nan, ball] },
      { id: "sample-item-5", name: "ข้าวเหนียวมะม่วง", price: 80, shared: [palm, nan] },
    ],
    discount: 30,
    servicePct: 10,
    vatPct: 7,
    roundToBaht: false,
  };
}

type PersonTotal = { id: string; name: string; subShare: number; final: number };
type Totals = {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  serviceAmt: number;
  vatAmt: number;
  grandTotal: number;
  servicePct: number;
  vatPct: number;
  perPerson: PersonTotal[];
};

function computeTotals(state: BillState): Totals {
  const subtotal = state.items.reduce((s, it) => s + (Number(it.price) || 0), 0);

  const subShareMap = new Map<string, number>();
  state.people.forEach((p) => subShareMap.set(p.id, 0));
  state.items.forEach((item) => {
    const sharers = item.shared.length ? item.shared : state.people.map((p) => p.id);
    if (!sharers.length) return;
    const share = (Number(item.price) || 0) / sharers.length;
    sharers.forEach((pid) => {
      if (subShareMap.has(pid)) subShareMap.set(pid, (subShareMap.get(pid) || 0) + share);
    });
  });

  const discount = Math.min(Math.max(Number(state.discount) || 0, 0), subtotal);
  const discountedSubtotal = subtotal - discount;
  const servicePct = Math.max(Number(state.servicePct) || 0, 0);
  const vatPct = Math.max(Number(state.vatPct) || 0, 0);
  const serviceAmt = (discountedSubtotal * servicePct) / 100;
  const vatBase = discountedSubtotal + serviceAmt;
  const vatAmt = (vatBase * vatPct) / 100;
  const grandTotal = discountedSubtotal + serviceAmt + vatAmt;

  const precision = state.roundToBaht ? 0 : 2;
  const factor = Math.pow(10, precision);

  const people = state.people.map((p) => {
    const subShare = subShareMap.get(p.id) || 0;
    const raw = subtotal > 0 ? (subShare / subtotal) * grandTotal : state.people.length ? grandTotal / state.people.length : 0;
    return { id: p.id, name: p.name, subShare, raw };
  });

  const sorted = [...people].sort((a, b) => b.raw - a.raw);
  let running = 0;
  const roundedMap = new Map<string, number>();
  sorted.forEach((p, idx) => {
    if (idx < sorted.length - 1) {
      const r = Math.round(p.raw * factor) / factor;
      roundedMap.set(p.id, r);
      running += r;
    }
  });
  if (sorted.length) {
    const last = sorted[sorted.length - 1];
    roundedMap.set(last.id, Math.round((grandTotal - running) * factor) / factor);
  }

  const perPerson: PersonTotal[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    subShare: p.subShare,
    final: roundedMap.get(p.id) || 0,
  }));

  return { subtotal, discount, discountedSubtotal, serviceAmt, vatAmt, grandTotal, servicePct, vatPct, perPerson };
}

export default function Home() {
  const [state, setState] = useState<BillState>(() => sampleState());
  const [billMeta, setBillMeta] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [itemFieldError, setItemFieldError] = useState<"name" | "price" | null>(null);
  const [toast, setToast] = useState({ message: "", visible: false });
  const [resetConfirming, setResetConfirming] = useState(false);

  const isFirstSave = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const num = String(now.getTime()).slice(-6);
    setBillMeta(`${dateStr} ${timeStr} · เลขที่ #${num}`);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.people) && Array.isArray(parsed.items)) {
          setState(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const totals = useMemo(() => computeTotals(state), [state]);

  function showToast(message: string) {
    setToast({ message, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }

  function handleAddPerson(e: FormEvent) {
    e.preventDefault();
    const name = newPersonName.trim();
    if (!name) return;
    setState((s) => ({ ...s, people: [...s.people, { id: uid(), name }] }));
    setNewPersonName("");
  }

  function handleRemovePerson(id: string) {
    setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
      items: s.items.map((it) => ({ ...it, shared: it.shared.filter((pid) => pid !== id) })),
    }));
  }

  function handleRemoveItem(id: string) {
    setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }));
  }

  function handleToggleSharer(itemId: string, personId: string) {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => {
        if (it.id !== itemId) return it;
        const has = it.shared.includes(personId);
        return { ...it, shared: has ? it.shared.filter((pid) => pid !== personId) : [...it.shared, personId] };
      }),
    }));
  }

  function handleItemField(id: string, field: "name" | "price", value: string) {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => {
        if (it.id !== id) return it;
        if (field === "name") return { ...it, name: value };
        return { ...it, price: Number(value) || 0 };
      }),
    }));
  }

  function handleAddItem(e: FormEvent) {
    e.preventDefault();
    const name = newItemName.trim();
    const price = Number(newItemPrice);
    if (!name || !(price > 0)) {
      setItemFieldError(!name ? "name" : "price");
      setTimeout(() => setItemFieldError(null), 900);
      return;
    }
    setState((s) => ({
      ...s,
      items: [...s.items, { id: uid(), name, price, shared: s.people.map((p) => p.id) }],
    }));
    setNewItemName("");
    setNewItemPrice("");
  }

  function handleCopySummary() {
    const lines = [
      `🧾 ${state.title || "หารบิล"}`,
      `ยอดสุทธิ ฿${fmtBaht(totals.grandTotal, state.roundToBaht)}`,
      "",
      ...totals.perPerson.map((p) => `${p.name}: ฿${fmtBaht(p.final, state.roundToBaht)}`),
      "",
      "หารด้วยหารเบิ้ล 🧾",
    ];
    const text = lines.join("\n");

    const done = () => showToast("คัดลอกสรุปแล้ว!");
    const fallbackCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch {
        showToast("คัดลอกไม่สำเร็จ");
      }
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  }

  function handleReset() {
    if (!resetConfirming) {
      setResetConfirming(true);
      resetTimer.current = setTimeout(() => setResetConfirming(false), 4000);
      return;
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setResetConfirming(false);
    setState({ title: "", people: [], items: [], discount: 0, servicePct: 0, vatPct: 0, roundToBaht: false });
    showToast("ล้างข้อมูลแล้ว");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.receipt}>
        <div className={styles.eyebrow}>หารเบิ้ล</div>
        <input
          className={styles.billTitleInput}
          aria-label="ชื่อบิล"
          autoComplete="off"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
        />
        <div className={styles.metaLine}>{billMeta}</div>

        <div className={styles.divider} />

        <div className={styles.sectionLabel}>ใครร่วมบิลบ้าง</div>
        <div className={styles.peopleRow}>
          {state.people.map((p) => (
            <div className={styles.personChip} key={p.id}>
              <span className={styles.avatar} style={{ "--hue": hue(p.id) } as CSSProperties}>
                {initials(p.name)}
              </span>
              <span className={styles.personName}>{p.name}</span>
              <button
                type="button"
                className={styles.removePerson}
                aria-label={`ลบ ${p.name}`}
                onClick={() => handleRemovePerson(p.id)}
              >
                ✕
              </button>
            </div>
          ))}
          <form className={styles.addPersonForm} onSubmit={handleAddPerson}>
            <input
              className={styles.newPersonInput}
              placeholder="+ เพิ่มเพื่อน"
              aria-label="ชื่อเพื่อนใหม่"
              autoComplete="off"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
            />
          </form>
        </div>

        <div className={styles.divider} />

        <div className={styles.sectionLabel}>รายการอาหาร</div>
        <div className={styles.itemsList}>
          {state.items.length === 0 && <div className={styles.emptyHint}>ยังไม่มีรายการ ลองเพิ่มรายการแรกด้านล่าง</div>}
          {state.items.map((item) => (
            <div className={styles.itemRow} key={item.id}>
              <div className={styles.itemMain}>
                <input
                  className={styles.itemNameInput}
                  aria-label="ชื่อรายการ"
                  value={item.name}
                  onChange={(e) => handleItemField(item.id, "name", e.target.value)}
                />
                <div className={styles.itemPriceWrap}>
                  <span className={styles.bahtSign}>฿</span>
                  <input
                    className={styles.itemPriceInput}
                    type="number"
                    min={0}
                    step={0.01}
                    aria-label="ราคา"
                    value={item.price}
                    onChange={(e) => handleItemField(item.id, "price", e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={styles.removeItem}
                  aria-label="ลบรายการ"
                  onClick={() => handleRemoveItem(item.id)}
                >
                  ✕
                </button>
              </div>
              {state.people.length > 0 && (
                <div className={styles.itemSharers}>
                  <span className={styles.sharersLabel}>หารกับ</span>
                  <div className={styles.chipRow}>
                    {state.people.map((p) => {
                      const active = item.shared.includes(p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          className={`${styles.avatarChip} ${active ? styles.active : ""}`}
                          style={{ "--hue": hue(p.id) } as CSSProperties}
                          title={p.name}
                          onClick={() => handleToggleSharer(item.id, p.id)}
                        >
                          {initials(p.name)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <form className={styles.addItemForm} onSubmit={handleAddItem}>
          <input
            className={styles.itemNameField}
            placeholder="ชื่อรายการ"
            aria-label="ชื่อรายการใหม่"
            autoComplete="off"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            style={itemFieldError === "name" ? { outline: "2px solid var(--warn)" } : undefined}
          />
          <input
            className={styles.itemPriceField}
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            aria-label="ราคา"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
            style={itemFieldError === "price" ? { outline: "2px solid var(--warn)" } : undefined}
          />
          <button type="submit" className={styles.addItemBtn} aria-label="เพิ่มรายการ">
            +
          </button>
        </form>

        <div className={styles.divider} />

        <div className={styles.sectionLabel}>ค่าใช้จ่ายเพิ่มเติม</div>
        <div className={styles.chargesRow}>
          <div className={styles.chargeField}>
            <label htmlFor="discountInput">ส่วนลด</label>
            <div className={styles.chargeInputWrap}>
              <span className={styles.chargeUnit}>฿</span>
              <input
                id="discountInput"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={state.discount}
                onChange={(e) => setState((s) => ({ ...s, discount: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className={styles.chargeField}>
            <label htmlFor="servicePctInput">ค่าบริการ</label>
            <div className={styles.chargeInputWrap}>
              <input
                id="servicePctInput"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={state.servicePct}
                onChange={(e) => setState((s) => ({ ...s, servicePct: Number(e.target.value) || 0 }))}
              />
              <span className={styles.chargeUnit}>%</span>
            </div>
          </div>
          <div className={styles.chargeField}>
            <label htmlFor="vatPctInput">VAT</label>
            <div className={styles.chargeInputWrap}>
              <input
                id="vatPctInput"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={state.vatPct}
                onChange={(e) => setState((s) => ({ ...s, vatPct: Number(e.target.value) || 0 }))}
              />
              <span className={styles.chargeUnit}>%</span>
            </div>
          </div>
        </div>
        <label className={styles.roundToggle}>
          <input
            type="checkbox"
            checked={state.roundToBaht}
            onChange={(e) => setState((s) => ({ ...s, roundToBaht: e.target.checked }))}
          />
          ปัดเศษเป็นบาทเต็ม
        </label>

        <div className={`${styles.divider} ${styles.heavy}`} />

        <div className={styles.totalsBlock}>
          <div className={styles.totalRow}>
            <span className={styles.label}>ยอดรวมอาหาร</span>
            <span className={styles.val}>฿{fmtBaht(totals.subtotal, state.roundToBaht)}</span>
          </div>
          {totals.discount > 0 && (
            <div className={`${styles.totalRow} ${styles.discount}`}>
              <span className={styles.label}>ส่วนลด</span>
              <span className={styles.val}>-฿{fmtBaht(totals.discount, state.roundToBaht)}</span>
            </div>
          )}
          {totals.servicePct > 0 && (
            <div className={styles.totalRow}>
              <span className={styles.label}>ค่าบริการ ({totals.servicePct}%)</span>
              <span className={styles.val}>฿{fmtBaht(totals.serviceAmt, state.roundToBaht)}</span>
            </div>
          )}
          {totals.vatPct > 0 && (
            <div className={styles.totalRow}>
              <span className={styles.label}>ภาษีมูลค่าเพิ่ม ({totals.vatPct}%)</span>
              <span className={styles.val}>฿{fmtBaht(totals.vatAmt, state.roundToBaht)}</span>
            </div>
          )}
          <div className={`${styles.totalRow} ${styles.grand}`}>
            <span className={styles.label}>ยอดสุทธิ</span>
            <span className={styles.val}>฿{fmtBaht(totals.grandTotal, state.roundToBaht)}</span>
          </div>
          <div className={styles.stamp}>หารเรียบร้อย</div>
        </div>

        <div className={styles.divider} />

        <div className={styles.sectionLabel}>แต่ละคนจ่ายเท่าไหร่</div>
        <div className={styles.stubsList}>
          {state.people.length === 0 && <div className={styles.emptyHint}>เพิ่มเพื่อนอย่างน้อย 1 คนเพื่อดูยอดหาร</div>}
          {totals.perPerson.map((p) => (
            <div className={styles.stubRow} key={p.id}>
              <div className={styles.stubLeft}>
                <span className={styles.avatar} style={{ "--hue": hue(p.id) } as CSSProperties}>
                  {initials(p.name)}
                </span>
                <div className={styles.stubNameWrap}>
                  <span className={styles.stubName}>{p.name}</span>
                  <span className={styles.stubSub}>ค่าอาหารที่สั่ง ฿{fmtBaht(p.subShare, state.roundToBaht)}</span>
                </div>
              </div>
              <span className={styles.stubAmount}>฿{fmtBaht(p.final, state.roundToBaht)}</span>
            </div>
          ))}
        </div>

        <div className={styles.actionsRow}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCopySummary}>
            คัดลอกสรุป
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost} ${resetConfirming ? styles.confirming : ""}`}
            onClick={handleReset}
          >
            {resetConfirming ? "แตะอีกครั้งเพื่อล้าง" : "ล้างทั้งหมด"}
          </button>
        </div>

        <div className={styles.barcode} />
        <div className={styles.footerNote}>ขอบคุณที่มาหารกัน · หารเบิ้ล</div>
      </div>

      <div className={`${styles.toast} ${toast.visible ? styles.show : ""}`}>{toast.message}</div>
    </div>
  );
}
