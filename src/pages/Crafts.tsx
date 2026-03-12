import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/helpers';
import {
  Plus, Wrench, Building, Phone, Mail, Users, AlertTriangle,
  Trash2, X, ChevronDown, ChevronUp, UserPlus, FileText
} from 'lucide-react';
import type { Craft, Contractor, ContractorContact } from '../types';

const emptyContact = (): ContractorContact => ({ id: generateId(), name: '', phone: '', email: '' });

export default function Crafts() {
  const { crafts, contractors, tasks, conflicts } = useAppStore();
  const [activeTab, setActiveTab] = useState<'crafts' | 'contractors' | 'conflicts'>('crafts');
  const [showCraftModal, setShowCraftModal] = useState(false);
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [editingCraft, setEditingCraft] = useState<Craft | null>(null);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [deleteCraftConfirm, setDeleteCraftConfirm] = useState<Craft | null>(null);
  const [deleteContractorConfirm, setDeleteContractorConfirm] = useState<Contractor | null>(null);
  const [expandedContractor, setExpandedContractor] = useState<string | null>(null);

  const craftColors = ['#8B4513','#CD853F','#DEB887','#708090','#FFD700','#4169E1','#F5DEB3','#D2691E','#98FB98','#20B2AA'];
  const craftNames = [
    'Zemní práce','Zdění','Tesařství','Pokrývačství','Elektroinstalace',
    'Instalace (ZTI)','Omítky','Podlahy','Malba a tapety','Lešenářství'
  ];

  const [craftForm, setCraftForm] = useState({
    name: '', description: '', contractorId: '',
    contactPerson: '', phone: '', color: '#3b82f6'
  });

  const [contractorForm, setContractorForm] = useState({
    name: '', address: '', ico: '', contactPerson: '', email: '', phone: '',
    notes: '', contacts: [] as ContractorContact[],
  });

  // ─── Craft handlers ───
  const handleSaveCraft = () => {
    if (!craftForm.name) return;
    const store = useAppStore.getState();
    if (editingCraft) {
      useAppStore.setState({
        crafts: store.crafts.map((c: Craft) =>
          c.id === editingCraft.id ? { ...editingCraft, ...craftForm, availableTeams: editingCraft.availableTeams } : c
        ),
      });
    } else {
      useAppStore.setState({ crafts: [...store.crafts, { id: generateId(), availableTeams: 1, ...craftForm }] });
    }
    setShowCraftModal(false);
    setCraftForm({ name: '', description: '', contractorId: '', contactPerson: '', phone: '', color: '#3b82f6' });
    setEditingCraft(null);
  };

  const handleDeleteCraft = () => {
    if (!deleteCraftConfirm) return;
    const store = useAppStore.getState();
    useAppStore.setState({ crafts: store.crafts.filter((c: Craft) => c.id !== deleteCraftConfirm.id) });
    setDeleteCraftConfirm(null);
  };

  // ─── Contractor handlers ───
  const openAddContractor = () => {
    setEditingContractor(null);
    setContractorForm({ name: '', address: '', ico: '', contactPerson: '', email: '', phone: '', notes: '', contacts: [] });
    setShowContractorModal(true);
  };

  const openEditContractor = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setContractorForm({
      name: contractor.name,
      address: contractor.address,
      ico: contractor.ico,
      contactPerson: contractor.contactPerson,
      email: contractor.email,
      phone: contractor.phone,
      notes: contractor.notes ?? '',
      contacts: contractor.contacts ? [...contractor.contacts] : [],
    });
    setShowContractorModal(true);
  };

  const handleSaveContractor = () => {
    if (!contractorForm.name) return;
    const store = useAppStore.getState();
    // Filter out empty contacts
    const cleanContacts = contractorForm.contacts.filter(c => c.name.trim() || c.phone.trim() || c.email.trim());
    const payload = { ...contractorForm, contacts: cleanContacts };
    if (editingContractor) {
      useAppStore.setState({
        contractors: store.contractors.map((c: Contractor) =>
          c.id === editingContractor.id ? { ...editingContractor, ...payload } : c
        ),
      });
    } else {
      useAppStore.setState({ contractors: [...store.contractors, { id: generateId(), crafts: [], ...payload }] });
    }
    setShowContractorModal(false);
    setEditingContractor(null);
  };

  const handleDeleteContractor = () => {
    if (!deleteContractorConfirm) return;
    const store = useAppStore.getState();
    useAppStore.setState({ contractors: store.contractors.filter((c: Contractor) => c.id !== deleteContractorConfirm.id) });
    setDeleteContractorConfirm(null);
  };

  // ─── Contacts in modal ───
  const addContact = () =>
    setContractorForm(f => ({ ...f, contacts: [...f.contacts, emptyContact()] }));

  const updateContact = (idx: number, field: keyof ContractorContact, value: string) =>
    setContractorForm(f => ({
      ...f,
      contacts: f.contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }));

  const removeContact = (idx: number) =>
    setContractorForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }));

  // ─── Helpers ───
  const getCraftTaskCount = (craftId: string) =>
    tasks.filter(t => t.craftId === craftId && t.status !== 'completed').length;
  const getContractorCrafts = (contractorId: string) =>
    crafts.filter(c => c.contractorId === contractorId);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'crafts', label: 'Řemesla' },
          { id: 'contractors', label: 'Zhotovitelé' },
          { id: 'conflicts', label: `Konflikty (${conflicts.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── CRAFTS TAB ─── */}
      {activeTab === 'crafts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Řemesla & Profese ({crafts.length})</h3>
            <button
              onClick={() => {
                setEditingCraft(null);
                setCraftForm({ name: '', description: '', contractorId: '', contactPerson: '', phone: '', color: '#3b82f6' });
                setShowCraftModal(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={16} /> Přidat řemeslo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {crafts.map(craft => {
              const contractor = contractors.find(c => c.id === craft.contractorId);
              const taskCount = getCraftTaskCount(craft.id);
              const hasConflict = conflicts.some(conf => conf.craftId === craft.id);
              return (
                <div key={craft.id} className={`bg-white rounded-xl border p-5 ${hasConflict ? 'border-red-300' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: craft.color }}>
                        <Wrench size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{craft.name}</h4>
                        <p className="text-xs text-gray-400">{craft.description}</p>
                      </div>
                    </div>
                    {hasConflict && <AlertTriangle size={16} className="text-red-500" />}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Aktivní úkoly</span>
                      <span className="font-medium text-gray-700">{taskCount}</span>
                    </div>
                    {contractor && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-gray-600 font-medium">{contractor.name}</p>
                        <p className="text-gray-400 flex items-center gap-1 text-xs mt-1">
                          <Phone size={11} /> {craft.phone || contractor.phone}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setEditingCraft(craft);
                        setCraftForm({
                          name: craft.name, description: craft.description,
                          contractorId: craft.contractorId, contactPerson: craft.contactPerson,
                          phone: craft.phone, color: craft.color,
                        });
                        setShowCraftModal(true);
                      }}
                      className="flex-1 text-xs text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50"
                    >
                      Upravit
                    </button>
                    <button
                      onClick={() => setDeleteCraftConfirm(craft)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors"
                      title="Smazat řemeslo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── CONTRACTORS TAB ─── */}
      {activeTab === 'contractors' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Zhotovitelé ({contractors.length})</h3>
            <button
              onClick={openAddContractor}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={16} /> Přidat zhotovitele
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contractors.map(contractor => {
              const contractorCrafts = getContractorCrafts(contractor.id);
              const isExpanded = expandedContractor === contractor.id;
              const hasExtraContacts = (contractor.contacts?.length ?? 0) > 0;
              const hasNotes = !!contractor.notes?.trim();

              return (
                <div key={contractor.id} className="bg-white rounded-xl border border-gray-200">
                  {/* Card header */}
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <Building size={18} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800">{contractor.name}</h4>
                        <p className="text-xs text-gray-400">{contractor.address}</p>
                      </div>
                    </div>

                    {/* Primary contact */}
                    <div className="space-y-1 text-sm mb-3">
                      {contractor.contactPerson && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users size={13} className="shrink-0" /> <span>{contractor.contactPerson}</span>
                        </div>
                      )}
                      {contractor.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={13} className="shrink-0" /> <span>{contractor.phone}</span>
                        </div>
                      )}
                      {contractor.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail size={13} className="shrink-0" /> <span>{contractor.email}</span>
                        </div>
                      )}
                      {contractor.ico && (
                        <p className="text-gray-400 text-xs">IČO: {contractor.ico}</p>
                      )}
                    </div>

                    {/* Crafts */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Řemesla:</p>
                      <div className="flex flex-wrap gap-1">
                        {contractorCrafts.map(c => (
                          <span key={c.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: c.color }}>
                            {c.name}
                          </span>
                        ))}
                        {contractorCrafts.length === 0 && (
                          <span className="text-xs text-gray-400">Žádná přiřazená řemesla</span>
                        )}
                      </div>
                    </div>

                    {/* Indicators for notes/contacts */}
                    {(hasNotes || hasExtraContacts) && (
                      <div className="flex gap-2 mb-3">
                        {hasNotes && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <FileText size={10} /> Poznámka
                          </span>
                        )}
                        {hasExtraContacts && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            <Users size={10} /> +{contractor.contacts!.length} kontakt{contractor.contacts!.length === 1 ? '' : contractor.contacts!.length < 5 ? 'y' : 'ů'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditContractor(contractor)}
                        className="flex-1 text-xs text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50"
                      >
                        Upravit
                      </button>
                      {(hasNotes || hasExtraContacts) && (
                        <button
                          onClick={() => setExpandedContractor(isExpanded ? null : contractor.id)}
                          className="flex items-center gap-1 px-2.5 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                          title={isExpanded ? 'Skrýt detail' : 'Zobrazit detail'}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          Detail
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteContractorConfirm(contractor)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors"
                        title="Smazat zhotovitele"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expandable section: notes + extra contacts */}
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
        </div>
      )}

      {/* ─── CONFLICTS TAB ─── */}
      {activeTab === 'conflicts' && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Kapacitní konflikty & Překryvy</h3>
          {conflicts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <div className="text-green-500 text-4xl mb-2">✓</div>
              <p className="text-green-700 font-medium">Žádné konflikty řemesel</p>
              <p className="text-green-500 text-sm mt-1">Kapacity jsou v pořádku</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conflicts.map(conflict => {
                const craft = crafts.find(c => c.id === conflict.craftId);
                const conflictTasks = tasks.filter(t => conflict.taskIds.includes(t.id));
                return (
                  <div key={conflict.id} className="bg-red-50 border border-red-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-red-500 mt-0.5" size={20} />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-red-700">{conflict.description}</h4>
                            {craft && (
                              <span className="text-xs px-2 py-0.5 rounded-full text-white mt-1 inline-block" style={{ backgroundColor: craft.color }}>
                                {craft.name}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            conflict.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {conflict.severity === 'error' ? 'Kritické' : 'Varování'}
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="text-sm text-red-600 font-medium mb-2">Kolidující úkoly:</p>
                          <div className="space-y-1">
                            {conflictTasks.map(t => (
                              <div key={t.id} className="bg-white border border-red-100 rounded-lg px-3 py-2 text-sm">
                                <span className="font-medium text-gray-700">{t.name}</span>
                                <span className="text-gray-400 ml-2 text-xs">{t.plannedStart} – {t.plannedEnd}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-800 mb-4">Aktivní úkoly podle řemesla</h4>
            <div className="space-y-2">
              {crafts.map(craft => {
                const activeTasks = getCraftTaskCount(craft.id);
                return (
                  <div key={craft.id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: craft.color }} />
                    <div className="w-32 text-sm text-gray-600 truncate">{craft.name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: activeTasks > 0 ? `${Math.min(activeTasks * 20, 100)}%` : '0%' }} />
                    </div>
                    <div className="text-xs text-gray-500 w-16 text-right">{activeTasks} úkolů</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── CRAFT MODAL ─── */}
      {showCraftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingCraft ? 'Upravit řemeslo' : 'Přidat řemeslo'}</h3>
              <button onClick={() => setShowCraftModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název řemesla</label>
                <input type="text" list="craft-names-list" value={craftForm.name}
                  onChange={e => setCraftForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="např. Zdění, Tesařství..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <datalist id="craft-names-list">
                  {craftNames.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                <input type="text" value={craftForm.description}
                  onChange={e => setCraftForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zhotovitel</label>
                <select value={craftForm.contractorId}
                  onChange={e => setCraftForm(f => ({ ...f, contractorId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Vybrat zhotovitele...</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kontaktní osoba</label>
                <input type="text" value={craftForm.contactPerson}
                  onChange={e => setCraftForm(f => ({ ...f, contactPerson: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input type="text" value={craftForm.phone}
                  onChange={e => setCraftForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Barva</label>
                <div className="flex flex-wrap gap-2">
                  {craftColors.map(color => (
                    <button key={color} onClick={() => setCraftForm(f => ({ ...f, color }))}
                      className={`w-7 h-7 rounded-full border-2 ${craftForm.color === color ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowCraftModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSaveCraft}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">Uložit</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTRACTOR MODAL ─── */}
      {showContractorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">{editingContractor ? 'Upravit zhotovitele' : 'Přidat zhotovitele'}</h3>
              <button onClick={() => setShowContractorModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Název firmy *</label>
                  <input type="text" value={contractorForm.name}
                    onChange={e => setContractorForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="např. Stavby Novák s.r.o."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IČO</label>
                  <input type="text" value={contractorForm.ico}
                    onChange={e => setContractorForm(f => ({ ...f, ico: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
                  <input type="text" value={contractorForm.address}
                    onChange={e => setContractorForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              </div>

              {/* Primary contact */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primární kontakt</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kontaktní osoba</label>
                  <input type="text" value={contractorForm.contactPerson}
                    onChange={e => setContractorForm(f => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="Jméno a příjmení"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input type="tel" value={contractorForm.phone}
                      onChange={e => setContractorForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={contractorForm.email}
                      onChange={e => setContractorForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
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

                {contractorForm.contacts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">Žádné další kontakty – klikněte „Přidat osobu"</p>
                ) : (
                  <div className="space-y-3">
                    {contractorForm.contacts.map((contact, idx) => (
                      <div key={contact.id} className="bg-gray-50 rounded-lg p-3 space-y-2 relative">
                        <button
                          onClick={() => removeContact(idx)}
                          className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                          title="Odebrat kontakt"
                        >
                          <X size={14} />
                        </button>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Jméno</label>
                          <input type="text" value={contact.name}
                            onChange={e => updateContact(idx, 'name', e.target.value)}
                            placeholder="Jméno a příjmení"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                            <input type="tel" value={contact.phone}
                              onChange={e => updateContact(idx, 'phone', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                            <input type="email" value={contact.email}
                              onChange={e => updateContact(idx, 'email', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white" />
                          </div>
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
                  value={contractorForm.notes}
                  onChange={e => setContractorForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Libovolné poznámky k zhotoviteli — platební podmínky, zkušenosti, závazky, certifikáty..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowContractorModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSaveContractor}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm hover:bg-blue-700 font-medium">
                {editingContractor ? 'Uložit změny' : 'Přidat zhotovitele'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CRAFT CONFIRM ─── */}
      {deleteCraftConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Smazat řemeslo?</h3>
            <p className="text-sm text-gray-600">Opravdu chcete smazat řemeslo <strong>{deleteCraftConfirm.name}</strong>?</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteCraftConfirm(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleDeleteCraft}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 font-medium">Smazat</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONTRACTOR CONFIRM ─── */}
      {deleteContractorConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Smazat zhotovitele?</h3>
            <p className="text-sm text-gray-600">
              Opravdu chcete smazat zhotovitele <strong>{deleteContractorConfirm.name}</strong>?
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteContractorConfirm(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleDeleteContractor}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 font-medium">Smazat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
