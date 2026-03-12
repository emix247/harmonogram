import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/helpers';
import {
  Plus, Building, Phone, Mail, Users, Trash2, X,
  ChevronDown, ChevronUp, UserPlus, FileText, Tag, Search
} from 'lucide-react';
import type { Contractor, ContractorContact } from '../types';

// ─── Predefined tag suggestions ───
const COMMON_TAGS = [
  'Zemní práce', 'Výkopové práce', 'Terénní úpravy',
  'Zdění', 'Beton', 'Železobeton',
  'Tesařství', 'Bednění', 'Pokrývačství', 'Lešenářství',
  'Elektroinstalace', 'Slaboproud', 'Revize elektro',
  'Instalace (ZTI)', 'Vodo-topo', 'Kanalizace', 'Plyn',
  'Omítky', 'Fasáda', 'Zateplení',
  'Sádrokarton', 'Podhledy',
  'Podlahy', 'Potěry', 'Hydroizolace',
  'Obklady a dlažby', 'Malba a tapety',
  'Okna a dveře', 'Zámečnické práce',
  'Bourací práce', 'Odvoz sutě',
];

// ─── Tag colour – consistent hash → Tailwind classes ───
const TAG_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-lime-100 text-lime-700',
];

function tagColor(tag: string): string {
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

const emptyContact = (): ContractorContact => ({ id: generateId(), name: '', phone: '', email: '' });

export default function Contractors() {
  const { contractors, tasks } = useAppStore();

  const [searchText, setSearchText] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Contractor | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ─── All unique tags across all contractors (for filter chips) ───
  const allTags = Array.from(
    new Set(contractors.flatMap(c => c.tags ?? []))
  ).sort();

  // ─── Form state ───
  const [form, setForm] = useState({
    name: '', address: '', ico: '', contactPerson: '',
    email: '', phone: '', notes: '',
    tags: [] as string[],
    contacts: [] as ContractorContact[],
  });
  const [tagInput, setTagInput] = useState('');

  // ─── Filtered list ───
  const visibleContractors = contractors.filter(c => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const textMatch =
        c.name.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        (c.tags ?? []).some(t => t.toLowerCase().includes(q));
      if (!textMatch) return false;
    }
    if (filterTags.length > 0) {
      const cTags = c.tags ?? [];
      if (!filterTags.every(ft => cTags.includes(ft))) return false;
    }
    return true;
  });

  const toggleFilterTag = (tag: string) =>
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // ─── Active task count per contractor ───
  const activeTaskCount = (contractorId: string) =>
    tasks.filter(t => t.contractorId === contractorId && t.status !== 'completed').length;

  // ─── Open modal ───
  const openAdd = () => {
    setEditingContractor(null);
    setForm({ name: '', address: '', ico: '', contactPerson: '', email: '', phone: '', notes: '', tags: [], contacts: [] });
    setTagInput('');
    setShowModal(true);
  };

  const openEdit = (c: Contractor) => {
    setEditingContractor(c);
    setForm({
      name: c.name, address: c.address, ico: c.ico,
      contactPerson: c.contactPerson, email: c.email, phone: c.phone,
      notes: c.notes ?? '',
      tags: [...(c.tags ?? [])],
      contacts: c.contacts ? c.contacts.map(x => ({ ...x })) : [],
    });
    setTagInput('');
    setShowModal(true);
  };

  // ─── Save contractor ───
  const handleSave = () => {
    if (!form.name.trim()) return;
    const store = useAppStore.getState();
    const cleanContacts = form.contacts.filter(c => c.name.trim() || c.phone.trim() || c.email.trim());
    const payload = { ...form, contacts: cleanContacts };

    if (editingContractor) {
      useAppStore.setState({
        contractors: store.contractors.map((c: Contractor) =>
          c.id === editingContractor.id ? { ...editingContractor, ...payload } : c
        ),
      });
    } else {
      useAppStore.setState({
        contractors: [...store.contractors, { id: generateId(), crafts: [], ...payload }],
      });
    }
    setShowModal(false);
    setEditingContractor(null);
  };

  // ─── Delete contractor ───
  const handleDelete = () => {
    if (!deleteConfirm) return;
    const store = useAppStore.getState();
    useAppStore.setState({ contractors: store.contractors.filter((c: Contractor) => c.id !== deleteConfirm.id) });
    setDeleteConfirm(null);
  };

  // ─── Tag management (modal) ───
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || form.tags.includes(t)) return;
    setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };

  const removeTag = (tag: string) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

  // ─── Contacts in modal ───
  const addContact = () => setForm(f => ({ ...f, contacts: [...f.contacts, emptyContact()] }));
  const updateContact = (idx: number, field: keyof ContractorContact, value: string) =>
    setForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c) }));
  const removeContact = (idx: number) =>
    setForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }));

  // Suggestions for tag input
  const tagSuggestions = COMMON_TAGS.filter(t =>
    !form.tags.includes(t) &&
    (tagInput.trim() === '' || t.toLowerCase().includes(tagInput.toLowerCase()))
  );

  return (
    <div className="space-y-5">

      {/* ─── Header bar ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Top row: search + count + add button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-xs">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Hledat zhotovitele nebo štítek..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="text-sm outline-none bg-transparent w-full"
            />
            {searchText && <button onClick={() => setSearchText('')} className="text-gray-300 hover:text-gray-500 text-xs">×</button>}
          </div>
          <span className="text-sm text-gray-400">{visibleContractors.length} zhotovitelů</span>
          {(filterTags.length > 0 || searchText) && (
            <button
              onClick={() => { setFilterTags([]); setSearchText(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X size={12} /> Zrušit filtry
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium shrink-0"
          >
            <Plus size={16} /> Přidat zhotovitele
          </button>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-400 font-medium mr-1 flex items-center gap-1">
              <Tag size={11} /> Filtr štítků:
            </span>
            {allTags.map(tag => {
              const active = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleFilterTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                    active
                      ? tagColor(tag) + ' border-transparent shadow-sm scale-105'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Contractor cards grid ─── */}
      {visibleContractors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Building size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Žádní zhotovitelé</p>
          <p className="text-sm mt-1">Přidejte prvního zhotovitele tlačítkem výše</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleContractors.map(contractor => {
            const isExpanded = expandedId === contractor.id;
            const hasExtraContacts = (contractor.contacts?.length ?? 0) > 0;
            const hasNotes = !!contractor.notes?.trim();
            const hasTags = (contractor.tags?.length ?? 0) > 0;
            const activeTasks = activeTaskCount(contractor.id);

            return (
              <div key={contractor.id} className="bg-white rounded-xl border border-gray-200 flex flex-col">
                {/* ── Card body ── */}
                <div className="p-5 flex-1">
                  {/* Company + active tasks badge */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                      <Building size={20} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-gray-800 truncate">{contractor.name}</h4>
                        {activeTasks > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0 font-medium">
                            {activeTasks} úkolů
                          </span>
                        )}
                      </div>
                      {contractor.address && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{contractor.address}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1 text-sm mb-3">
                    {contractor.contactPerson && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users size={13} className="shrink-0 text-gray-400" />
                        <span>{contractor.contactPerson}</span>
                      </div>
                    )}
                    {contractor.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone size={13} className="shrink-0 text-gray-400" />
                        <a href={`tel:${contractor.phone}`} className="hover:text-blue-600">{contractor.phone}</a>
                      </div>
                    )}
                    {contractor.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail size={13} className="shrink-0 text-gray-400" />
                        <a href={`mailto:${contractor.email}`} className="hover:text-blue-600 truncate">{contractor.email}</a>
                      </div>
                    )}
                    {contractor.ico && (
                      <p className="text-gray-400 text-xs pl-5">IČO: {contractor.ico}</p>
                    )}
                  </div>

                  {/* Tags */}
                  {hasTags && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Tag size={11} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-400">Specializace</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(contractor.tags ?? []).map(tag => (
                          <span key={tag} className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mini indicators */}
                  {(hasNotes || hasExtraContacts) && (
                    <div className="flex gap-2 mb-3">
                      {hasNotes && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <FileText size={10} /> Poznámka
                        </span>
                      )}
                      {hasExtraContacts && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          <Users size={10} /> +{contractor.contacts!.length} {contractor.contacts!.length === 1 ? 'kontakt' : contractor.contacts!.length < 5 ? 'kontakty' : 'kontaktů'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Action buttons ── */}
                <div className="px-5 pb-4 flex gap-2">
                  <button
                    onClick={() => openEdit(contractor)}
                    className="flex-1 text-xs text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 font-medium"
                  >
                    Upravit
                  </button>
                  {(hasNotes || hasExtraContacts) && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : contractor.id)}
                      className="flex items-center gap-1 px-2.5 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                      title={isExpanded ? 'Skrýt' : 'Zobrazit detail'}
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(contractor)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors"
                    title="Smazat zhotovitele"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* ── Expandable notes + extra contacts ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4 bg-gray-50 rounded-b-xl">
                    {hasNotes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <FileText size={12} /> Poznámka
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                          {contractor.notes}
                        </p>
                      </div>
                    )}
                    {hasExtraContacts && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Users size={12} /> Další kontaktní osoby
                        </p>
                        <div className="space-y-2">
                          {contractor.contacts!.map(contact => (
                            <div key={contact.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                              <p className="font-medium text-gray-800">{contact.name}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                {contact.phone && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Phone size={10} /> {contact.phone}
                                  </span>
                                )}
                                {contact.email && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Mail size={10} /> {contact.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CONTRACTOR MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">
                {editingContractor ? 'Upravit zhotovitele' : 'Přidat zhotovitele'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">

              {/* Basic info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Název firmy *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="např. Stavby Novák s.r.o."
                    autoFocus
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IČO</label>
                    <input
                      type="text"
                      value={form.ico}
                      onChange={e => setForm(f => ({ ...f, ico: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Tag size={14} className="text-blue-500" />
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Specializace (štítky)</p>
                </div>

                {/* Existing tags */}
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.tags.map(tag => (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${tagColor(tag)}`}
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="ml-0.5 opacity-60 hover:opacity-100">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      list="tag-suggestions"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                        if (e.key === ',') { e.preventDefault(); addTag(tagInput); }
                      }}
                      placeholder="Přidat štítek..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                    <datalist id="tag-suggestions">
                      {tagSuggestions.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <button
                    onClick={() => addTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Quick-add common tags */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Rychlé přidání:</p>
                  <div className="flex flex-wrap gap-1">
                    {COMMON_TAGS.filter(t => !form.tags.includes(t)).slice(0, 12).map(tag => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 rounded-full transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary contact */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primární kontakt</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kontaktní osoba</label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="Jméno a příjmení"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Additional contacts */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Další kontaktní osoby</p>
                  <button
                    onClick={addContact}
                    className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50"
                  >
                    <UserPlus size={12} /> Přidat osobu
                  </button>
                </div>
                {form.contacts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-1">Žádné další kontakty</p>
                ) : (
                  <div className="space-y-3">
                    {form.contacts.map((contact, idx) => (
                      <div key={contact.id} className="bg-gray-50 rounded-xl p-3 space-y-2 relative">
                        <button
                          onClick={() => removeContact(idx)}
                          className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={e => updateContact(idx, 'name', e.target.value)}
                          placeholder="Jméno a příjmení"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="tel"
                            value={contact.phone}
                            onChange={e => updateContact(idx, 'phone', e.target.value)}
                            placeholder="Telefon"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white"
                          />
                          <input
                            type="email"
                            value={contact.email}
                            onChange={e => updateContact(idx, 'email', e.target.value)}
                            placeholder="Email"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <FileText size={14} className="text-gray-400" /> Poznámky
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Platební podmínky, zkušenosti, certifikáty, závazky..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm hover:bg-blue-700 font-medium disabled:opacity-40"
              >
                {editingContractor ? 'Uložit změny' : 'Přidat zhotovitele'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM ─── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="font-bold text-lg mb-1">Smazat zhotovitele?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Opravdu chcete smazat <strong className="text-gray-700">{deleteConfirm.name}</strong>?
              <br />Tato akce je nevratná.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm hover:bg-red-700 font-medium"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
