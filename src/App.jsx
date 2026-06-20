import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  Wallet, Receipt, Users, Settings, Plus, ArrowLeft, Trash2, Edit2, 
  Check, X, ChevronDown, Download, Calendar, DollarSign, ArrowRightLeft,
  Share, DownloadCloud
} from 'lucide-react';

// ==========================================
// Firebase 初始化與全域常數
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBH4ez8u4skkyTsUTXPtBMHT0afVlXvsMM",
  authDomain: "rats-split-bill.firebaseapp.com",
  projectId: "rats-split-bill",
  storageBucket: "rats-split-bill.firebasestorage.app",
  messagingSenderId: "252272732529",
  appId: "1:252272732529:web:8065d868ca19e0b2732ed0",
  measurementId: "G-7BDYQYSC8P"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'split-bill-app';

const DEFAULT_MEMBERS = ['惟', '彭', '江', '洞', 'ㄇㄘ', 'ㄒㄌ', '雨柔', '姿苓'];
const CURRENCY_OPTIONS = ['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'GBP', 'THB', 'VND', 'PHP', 'MYR', 'SGD'];

// ==========================================
// 輔助函式
// ==========================================
const calculateEqualSplits = (total, memberIds) => {
  if (!memberIds || memberIds.length === 0) return {};
  const amount = Math.round(Number(total));
  if (isNaN(amount)) return {};
  
  const count = memberIds.length;
  const base = Math.floor(amount / count);
  let remainder = amount - (base * count);
  
  const splits = {};
  memberIds.forEach((id) => {
    if (remainder > 0) {
      splits[id] = base + 1;
      remainder--;
    } else {
      splits[id] = base;
    }
  });
  return splits;
};

const formatMoney = (amount, showDecimals = false) => {
  return new Intl.NumberFormat('zh-TW', { 
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0 
  }).format(amount);
};

// ==========================================
// 主應用程式元件
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [globalMembers, setGlobalMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  const [currentView, setCurrentView] = useState('home'); 
  const [currentProjectId, setCurrentProjectId] = useState(null);

  // PWA 安裝狀態
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsStandalone(true);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setIsIOS(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const membersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'members');
    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGlobalMembers(data);
      if (data.length === 0 && snapshot.metadata.fromCache === false) {
        DEFAULT_MEMBERS.forEach(async (name) => {
          await addDoc(membersRef, { name, createdAt: Date.now() });
        });
      }
    });

    const projectsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
    const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(data.sort((a, b) => b.createdAt - a.createdAt));
    });

    const expensesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return () => {
      unsubMembers();
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#FCFCFC] font-bold text-[#52B4CC]">載入中...</div>;

  const currentProject = projects.find(p => p.id === currentProjectId);
  const projectExpenses = expenses.filter(e => e.projectId === currentProjectId);

  return (
    <div className="max-w-md mx-auto bg-[#FCFCFC] min-h-screen shadow-xl relative font-sans text-gray-800 pb-20 overflow-x-hidden">
      {currentView === 'home' && (
        <HomeView 
          projects={projects} 
          onOpenProject={(id) => { setCurrentProjectId(id); setCurrentView('project'); }}
          onManageMembers={() => setCurrentView('members')}
          deferredPrompt={deferredPrompt}
          setDeferredPrompt={setDeferredPrompt}
          isIOS={isIOS}
          isStandalone={isStandalone}
        />
      )}
      {currentView === 'members' && (
        <MembersView members={globalMembers} onBack={() => setCurrentView('home')} />
      )}
      {currentView === 'project' && currentProject && (
        <ProjectView 
          project={currentProject} 
          expenses={projectExpenses}
          globalMembers={globalMembers}
          onBack={() => { setCurrentView('home'); setCurrentProjectId(null); }}
        />
      )}
    </div>
  );
}

// ==========================================
// 首頁：專案列表
// ==========================================
function HomeView({ projects, onOpenProject, onManageMembers, deferredPrompt, setDeferredPrompt, isIOS, isStandalone }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const projectsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
      const docRef = await addDoc(projectsRef, {
        name: newProjectName.trim(),
        memberIds: [],
        currencies: ['TWD'],
        ratesMode: 'unified',
        rates: {}, 
        showDecimals: false,
        createdAt: Date.now()
      });
      setNewProjectName('');
      setShowCreate(false);
      onOpenProject(docRef.id);
    } catch (e) {
      console.error("建立專案失敗", e);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <div className="p-4 flex flex-col min-h-screen pb-6">
      <div className="flex justify-between items-center mb-6 pt-4">
        <h1 className="text-2xl font-bold text-[#52B4CC] flex items-center gap-2">
          <Wallet size={28} /> 分帳 App
        </h1>
        <button onClick={onManageMembers} className="p-2 bg-white shadow-sm rounded-full text-[#52B4CC] hover:bg-[#C5E6EE] transition-colors">
          <Users size={20} />
        </button>
      </div>

      {/* PWA 安裝提示區塊 */}
      {!isStandalone && (deferredPrompt || (isIOS && !showIOSPrompt)) && (
        <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-[#C5E6EE] mb-4 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#3B93A8] text-sm flex items-center gap-1"><DownloadCloud size={16}/> 想要更方便使用嗎？</h3>
            <p className="text-[11px] text-gray-500 mt-1 leading-tight">將此 App 加入手機主畫面<br/>免開瀏覽器，體驗更流暢！</p>
          </div>
          {isIOS ? (
            <button 
              onClick={() => setShowIOSPrompt(true)}
              className="bg-[#C5E6EE]/50 text-[#3B93A8] px-3 py-1.5 rounded-lg text-sm font-bold border border-[#8BCDDD]"
            >
              看教學
            </button>
          ) : (
            <button 
              onClick={handleInstallClick}
              className="bg-[#52B4CC] text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm"
            >
              安裝
            </button>
          )}
        </div>
      )}

      {/* iOS 安裝教學展開 */}
      {showIOSPrompt && !isStandalone && (
        <div className="bg-[#C5E6EE]/30 p-4 rounded-xl border border-[#8BCDDD] mb-4 relative animate-in fade-in slide-in-from-top-2">
          <button onClick={() => setShowIOSPrompt(false)} className="absolute top-2 right-2 text-[#3B93A8]"><X size={16}/></button>
          <h3 className="font-bold text-[#3B93A8] text-sm mb-2">🍎 iOS 安裝步驟</h3>
          <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
            <li>請使用 <b>Safari 瀏覽器</b> 開啟此網頁</li>
            <li>點擊下方工具列的 <Share size={14} className="inline text-blue-500 mb-1"/> <b>分享按鈕</b></li>
            <li>往下滑，選擇 <Plus size={14} className="inline text-gray-700 bg-gray-200 p-0.5 rounded mb-1"/> <b>加入主畫面</b></li>
          </ol>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {projects.length === 0 ? (
          <div className="text-center text-[#8BCDDD] mt-10">
            <Receipt size={48} className="mx-auto mb-2 opacity-50" />
            <p className="font-medium text-gray-500">目前還沒有專案，趕快建立一個吧！</p>
          </div>
        ) : (
          projects.map(p => (
            <div 
              key={p.id} 
              onClick={() => onOpenProject(p.id)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer active:scale-95 transition-transform"
            >
              <div>
                <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                <p className="text-sm text-gray-400 font-medium mt-1">
                  {new Date(p.createdAt).toLocaleDateString('zh-TW')} 建立
                </p>
              </div>
              <div className="bg-[#FCFCFC] p-2 rounded-full">
                <ChevronDown size={20} className="text-[#52B4CC] -rotate-90" />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto">
        {showCreate ? (
          <div className="bg-white p-4 rounded-xl shadow-lg border border-[#C5E6EE] flex flex-col gap-3">
            <input 
              type="text" 
              placeholder="輸入專案名稱（例如：日本跨年行）"
              className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-[#8BCDDD] outline-none transition-all bg-gray-50"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 p-3 bg-gray-100 rounded-lg text-gray-600 font-bold hover:bg-gray-200 transition-colors">取消</button>
              <button onClick={handleCreateProject} className="flex-1 p-3 bg-[#52B4CC] rounded-lg text-white font-bold hover:bg-[#3FA1B8] transition-colors">建立</button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowCreate(true)}
            className="w-full bg-[#52B4CC] text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:bg-[#3FA1B8] hover:bg-[#3FA1B8] transition-colors"
          >
            <Plus size={24} /> 建立新專案
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 成員管理
// ==========================================
function MembersView({ members, onBack }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'members'), {
        name: newName.trim(),
        createdAt: Date.now()
      });
      setNewName('');
    } catch (e) { console.error(e); }
  };

  const handleExecuteDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'members', id));
      setDeletingId(null);
    } catch (e) { console.error(e); }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editingId) return;
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'members', editingId), {
        name: editName.trim()
      });
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="h-screen flex flex-col bg-[#FCFCFC]">
      <div className="bg-white p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10 border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">全域成員管理</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2">
          <input 
            type="text" 
            placeholder="新增成員名字..." 
            className="flex-1 border p-2 rounded-lg focus:ring-2 focus:ring-[#8BCDDD] outline-none bg-gray-50"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button onClick={handleAdd} className="bg-[#52B4CC] hover:bg-[#3FA1B8] text-white px-4 rounded-lg font-bold transition-colors">
            新增
          </button>
        </div>

        {members.map(m => (
          <div key={m.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center transition-all border border-transparent hover:border-[#C5E6EE]">
            {editingId === m.id ? (
              <div className="flex flex-1 gap-2">
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border p-2 rounded focus:ring-2 focus:ring-[#8BCDDD] outline-none"
                  autoFocus
                />
                <button onClick={handleSaveEdit} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"><Check size={20}/></button>
                <button onClick={() => setEditingId(null)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"><X size={20}/></button>
              </div>
            ) : deletingId === m.id ? (
              <div className="flex flex-1 justify-between items-center gap-2">
                <span className="font-bold text-red-500 ml-2">確定刪除 {m.name}？</span>
                <div className="flex gap-2">
                  <button onClick={() => setDeletingId(null)} className="p-1.5 px-3 bg-gray-100 text-gray-600 rounded text-sm font-bold">取消</button>
                  <button onClick={() => handleExecuteDelete(m.id)} className="p-1.5 px-3 bg-red-500 text-white rounded text-sm font-bold">確認</button>
                </div>
              </div>
            ) : (
              <>
                <span className="font-medium text-lg ml-2 text-gray-700">{m.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(m.id); setEditName(m.name); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded transition-colors">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => setDeletingId(m.id)} className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 專案主畫面 (包含四個 Tab)
// ==========================================
function ProjectView({ project, expenses, globalMembers, onBack }) {
  const [tab, setTab] = useState('list');
  const [editingExpense, setEditingExpense] = useState(null);

  const projectMembers = useMemo(() => {
    return globalMembers.filter(m => project.memberIds?.includes(m.id));
  }, [globalMembers, project.memberIds]);

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setTab('add');
  };

  return (
    <div className="h-screen flex flex-col bg-[#FCFCFC] relative">
      <div className="bg-[#52B4CC] text-white p-4 flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-[#3FA1B8] transition">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold truncate flex-1">{project.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'list' && (
          <ExpenseList 
            project={project}
            expenses={expenses} 
            members={projectMembers} 
            onEdit={handleEditExpense} 
          />
        )}
        {tab === 'add' && (
          <ExpenseForm 
            project={project}
            members={projectMembers}
            initialData={editingExpense}
            onSuccess={() => { setTab('list'); setEditingExpense(null); }}
            onCancel={() => { setTab('list'); setEditingExpense(null); }}
          />
        )}
        {tab === 'settle' && (
          <SettlementView 
            project={project} 
            expenses={expenses} 
            members={projectMembers} 
          />
        )}
        {tab === 'settings' && (
          <ProjectSettings 
            project={project} 
            globalMembers={globalMembers} 
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <TabButton icon={<Receipt />} label="紀錄" active={tab === 'list'} onClick={() => { setTab('list'); setEditingExpense(null); }} />
        <TabButton icon={<Plus />} label="記一筆" active={tab === 'add'} onClick={() => { setTab('add'); setEditingExpense(null); }} className="bg-[#FCFCFC] text-[#52B4CC] rounded-xl border border-[#C5E6EE] shadow-sm my-1" />
        <TabButton icon={<DollarSign />} label="結算" active={tab === 'settle'} onClick={() => setTab('settle')} />
        <TabButton icon={<Settings />} label="設定" active={tab === 'settings'} onClick={() => setTab('settings')} />
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick, className = '' }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center p-2 w-16 gap-1 transition-colors ${active ? 'text-[#52B4CC] font-bold' : 'text-gray-400 hover:text-[#8BCDDD]'} ${className}`}
    >
      {React.cloneElement(icon, { size: active ? 24 : 22 })}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

// ==========================================
// 專案設定 Tab
// ==========================================
function ProjectSettings({ project, globalMembers }) {
  const [name, setName] = useState(project.name);
  const [showDecimals, setShowDecimals] = useState(project.showDecimals || false);
  
  const handleSaveName = async () => {
    if (!name.trim() || name === project.name) return;
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', project.id), { name });
    } catch(e) {}
  };

  const toggleMember = async (memberId) => {
    const currentIds = project.memberIds || [];
    const newIds = currentIds.includes(memberId) 
      ? currentIds.filter(id => id !== memberId)
      : [...currentIds, memberId];
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', project.id), { memberIds: newIds });
    } catch(e) {}
  };

  const toggleCurrency = async (currency) => {
    const currentList = project.currencies || ['TWD'];
    const newList = currentList.includes(currency)
      ? currentList.filter(c => c !== currency)
      : [...currentList, currency];
    if (newList.length === 0) return;
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', project.id), { currencies: newList });
    } catch(e) {}
  };

  const handleToggleDecimals = async () => {
    const newValue = !showDecimals;
    setShowDecimals(newValue);
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', project.id), { 
        showDecimals: newValue 
      });
    } catch(e) { console.error(e); }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-gray-500 text-sm mb-2 font-bold">專案名稱</h3>
        <div className="flex gap-2">
          <input 
            className="flex-1 border p-2 rounded-lg focus:ring-2 focus:ring-[#8BCDDD] outline-none bg-gray-50" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
          <button onClick={handleSaveName} className="bg-[#52B4CC] hover:bg-[#3FA1B8] text-white px-4 rounded-lg transition-colors font-bold">儲存</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center cursor-pointer select-none border border-gray-100" onClick={handleToggleDecimals}>
        <div>
          <h3 className="font-bold text-gray-700">顯示小數點</h3>
          <p className="text-xs text-gray-500 mt-1">台幣、日幣、韓元建議關閉，維持整數</p>
        </div>
        <input 
          type="checkbox" 
          checked={showDecimals} 
          onChange={handleToggleDecimals}
          onClick={(e) => e.stopPropagation()}
          className="w-6 h-6 text-[#52B4CC] rounded focus:ring-[#8BCDDD] accent-[#52B4CC]"
        />
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-gray-500 text-sm mb-3 font-bold">參與成員 (勾選本次參與的人)</h3>
        <div className="grid grid-cols-2 gap-2">
          {globalMembers.map(m => {
            const isSelected = project.memberIds?.includes(m.id);
            return (
              <div 
                key={m.id} 
                onClick={() => toggleMember(m.id)}
                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition ${isSelected ? 'border-[#52B4CC] bg-[#C5E6EE]/40 text-[#3B93A8] font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <span>{m.name}</span>
                {isSelected && <Check size={18} className="text-[#52B4CC]" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-gray-500 text-sm mb-3 font-bold">使用幣別 (可多選)</h3>
        <div className="flex flex-wrap gap-2">
          {CURRENCY_OPTIONS.map(c => {
            const isSelected = project.currencies?.includes(c);
            return (
              <span 
                key={c} 
                onClick={() => toggleCurrency(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer border transition-colors ${isSelected ? 'bg-[#52B4CC] text-white border-[#52B4CC] shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
              >
                {c}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 記一筆表單 Tab
// ==========================================
function ExpenseForm({ project, members, initialData, onSuccess, onCancel }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [payerId, setPayerId] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitMode, setSplitMode] = useState('equal');
  const [selectedSplitters, setSelectedSplitters] = useState([]);
  const [unequalSplits, setUnequalSplits] = useState({});

  useEffect(() => {
    if (members.length > 0 && !payerId) {
      setPayerId(members[0].id);
    }
    if (project.currencies?.length > 0 && !project.currencies.includes(currency)) {
      setCurrency(project.currencies[0]);
    }
  }, [members, project.currencies]);

  useEffect(() => {
    if (initialData) {
      setDate(initialData.date);
      setTitle(initialData.title);
      setPayerId(initialData.payerId);
      setCurrency(initialData.currency);
      setTotalAmount(initialData.totalAmount.toString());
      setSplitMode(initialData.splitMode);
      if (initialData.splitMode === 'equal') {
        setSelectedSplitters(Object.keys(initialData.splits));
      } else {
        setUnequalSplits(initialData.splits);
      }
    } else {
      setSelectedSplitters(members.map(m => m.id));
    }
  }, [initialData, members]);

  useEffect(() => {
    if (splitMode === 'unequal') {
      const sum = Object.values(unequalSplits).reduce((a, b) => a + (Number(b) || 0), 0);
      setTotalAmount(sum > 0 ? sum.toString() : '');
    }
  }, [unequalSplits, splitMode]);

  const handleToggleSplitter = (id) => {
    if (selectedSplitters.includes(id)) {
      setSelectedSplitters(selectedSplitters.filter(s => s !== id));
    } else {
      setSelectedSplitters([...selectedSplitters, id]);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !payerId || !totalAmount || Number(totalAmount) <= 0) return;
    
    let splits = {};
    let isPersonal = false;

    if (splitMode === 'equal') {
      if (selectedSplitters.length === 0) return;
      splits = calculateEqualSplits(Number(totalAmount), selectedSplitters);
      if (selectedSplitters.length === 1 && selectedSplitters[0] === payerId) {
        isPersonal = true;
      }
    } else {
      for (const [id, amt] of Object.entries(unequalSplits)) {
        if (Number(amt) > 0) splits[id] = Number(amt);
      }
      if (Object.keys(splits).length === 0) return;
      if (Object.keys(splits).length === 1 && Object.keys(splits)[0] === payerId) {
        isPersonal = true;
      }
    }

    const payload = {
      projectId: project.id,
      date,
      title: title.trim(),
      payerId,
      currency,
      totalAmount: Number(totalAmount),
      splitMode,
      splits,
      isPersonal,
      updatedAt: Date.now()
    };

    try {
      if (initialData) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'expenses', initialData.id), payload);
      } else {
        payload.createdAt = Date.now();
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses'), payload);
      }
      onSuccess();
    } catch (e) {
      console.error(e);
    }
  };

  if (members.length === 0) {
    return <div className="p-8 text-center text-[#8BCDDD] font-bold">請先到「設定」頁面勾選本次參與的成員！</div>;
  }

  return (
    <div className="p-4 space-y-4 pb-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <h2 className="font-bold text-lg text-[#52B4CC]">{initialData ? '編輯紀錄' : '記一筆新的'}</h2>
        {initialData && <button onClick={onCancel} className="text-gray-400 hover:bg-gray-100 p-1 rounded-full transition-colors"><X size={20}/></button>}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border border-gray-100">
        <div className="flex gap-3">
          <div className="w-1/3">
            <label className="text-xs font-bold text-gray-500 block mb-1">日期</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#8BCDDD] outline-none" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 block mb-1">品項名稱</label>
            <input type="text" placeholder="例如：晚餐、計程車" value={title} onChange={e=>setTitle(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 focus:ring-2 focus:ring-[#8BCDDD] outline-none" />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 block mb-1">先墊錢的人 (付款人)</label>
            <select value={payerId} onChange={e=>setPayerId(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 text-[#52B4CC] font-bold focus:ring-2 focus:ring-[#8BCDDD] outline-none">
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="w-1/3">
            <label className="text-xs font-bold text-gray-500 block mb-1">幣別</label>
            <select value={currency} onChange={e=>setCurrency(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 focus:ring-2 focus:ring-[#8BCDDD] outline-none">
              {project.currencies?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex bg-white shadow-sm p-1 rounded-xl border border-gray-100">
        <button onClick={() => setSplitMode('equal')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${splitMode==='equal'?'bg-[#FCFCFC] text-[#52B4CC] border border-[#C5E6EE] shadow-sm':'text-gray-400 hover:text-gray-600 bg-transparent'}`}>大家平分</button>
        <button onClick={() => setSplitMode('unequal')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${splitMode==='unequal'?'bg-[#FCFCFC] text-[#52B4CC] border border-[#C5E6EE] shadow-sm':'text-gray-400 hover:text-gray-600 bg-transparent'}`}>各付各的 (不平分)</button>
      </div>

      {splitMode === 'equal' && (
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border-l-4 border-[#52B4CC] transition-all">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">總金額</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold">{currency}</span>
              <input type="number" placeholder="輸入總金額" value={totalAmount} onChange={e=>setTotalAmount(e.target.value)} className="flex-1 border-b-2 border-[#8BCDDD] p-2 text-2xl font-bold text-[#3B93A8] focus:border-[#52B4CC] outline-none transition-colors" />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-xs font-bold text-gray-500">誰要分攤？</label>
              <button onClick={() => setSelectedSplitters(members.map(m=>m.id))} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium hover:bg-gray-200 transition-colors">全選</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {members.map(m => (
                <div key={m.id} onClick={() => handleToggleSplitter(m.id)} className={`p-2 rounded-lg text-center text-sm font-bold cursor-pointer transition-all ${selectedSplitters.includes(m.id) ? 'bg-[#C5E6EE]/50 text-[#3B93A8] border-2 border-[#52B4CC]' : 'bg-gray-50 text-gray-400 border-2 border-transparent hover:bg-gray-100'}`}>
                  {m.name}
                </div>
              ))}
            </div>
            
            {totalAmount > 0 && selectedSplitters.length > 0 && (
              <div className="mt-4 p-3 bg-[#FCFCFC] border border-[#C5E6EE] rounded-lg text-sm text-[#3B93A8] flex justify-between items-center">
                <span className="font-medium">每人約負擔：</span>
                <span className="font-bold text-lg">{formatMoney(Math.floor(totalAmount/selectedSplitters.length), project.showDecimals)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {splitMode === 'unequal' && (
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border-l-4 border-[#8BCDDD] transition-all">
          <div className="flex justify-between items-center bg-[#FCFCFC] border border-[#C5E6EE] p-3 rounded-lg shadow-sm">
            <span className="font-bold text-[#3B93A8]">目前總計</span>
            <span className="text-xl font-bold text-[#52B4CC]">{currency} {formatMoney(totalAmount || 0, project.showDecimals)}</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 block">請輸入每個人各自的金額：</label>
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                <span className="w-16 font-bold text-gray-700 ml-2">{m.name}</span>
                <input 
                  type="number" 
                  placeholder="0"
                  value={unequalSplits[m.id] || ''}
                  onChange={e => setUnequalSplits({...unequalSplits, [m.id]: e.target.value})}
                  className="flex-1 border border-gray-200 p-2 rounded bg-white focus:ring-2 focus:ring-[#8BCDDD] outline-none transition-colors font-bold text-[#3B93A8]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleSave} className="w-full bg-[#52B4CC] hover:bg-[#3FA1B8] text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-[#52B4CC]/20 active:scale-95 transition-all">
        {initialData ? '儲存修改' : '儲存紀錄'}
      </button>
    </div>
  );
}

// ==========================================
// 記帳紀錄列表 Tab
// ==========================================
function ExpenseList({ project, expenses, members, onEdit }) {
  const [filterMemberId, setFilterMemberId] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);

  const getMemberName = (id) => members.find(m => m.id === id)?.name || '未知';

  const executeDelete = async (e, id) => {
    e.stopPropagation();
    try { 
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'expenses', id)); 
      setDeletingExpenseId(null);
    } catch(e){}
  };

  const filtered = expenses.filter(exp => {
    if (filterMemberId === 'all') return true;
    return exp.payerId === filterMemberId || Object.keys(exp.splits).includes(filterMemberId);
  });

  const grouped = filtered.reduce((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = [];
    acc[exp.date].push(exp);
    return acc;
  }, {});

  if (expenses.length === 0) return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-[#8BCDDD]">
      <Receipt size={64} className="opacity-40 mb-4"/>
      <p className="font-bold text-gray-500">還沒有花費紀錄</p>
      <p className="text-sm text-gray-400 mt-1">點擊下方「記一筆」開始記帳！</p>
    </div>
  );

  return (
    <div className="p-4 pb-24">
      <div className="mb-4 bg-white p-2 rounded-xl shadow-sm flex items-center gap-2 border border-gray-100">
        <Users size={18} className="text-[#8BCDDD] ml-2" />
        <select value={filterMemberId} onChange={e=>setFilterMemberId(e.target.value)} className="flex-1 bg-transparent outline-none p-1 font-bold text-[#3B93A8]">
          <option value="all">顯示所有人相關的紀錄</option>
          {members.map(m => <option key={m.id} value={m.id}>只看 {m.name} 相關的</option>)}
        </select>
      </div>

      {Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a)).map(date => (
        <div key={date} className="mb-6">
          <div className="sticky top-[72px] bg-[#FCFCFC]/90 backdrop-blur py-1 z-10 mb-2">
            <span className="bg-[#C5E6EE]/60 text-[#3B93A8] px-3 py-1 rounded-full text-xs font-bold flex items-center w-max gap-1 shadow-sm border border-[#C5E6EE]">
              <Calendar size={14}/> {date}
            </span>
          </div>
          
          <div className="space-y-3">
            {grouped[date].map(exp => {
              const isExpanded = expandedId === exp.id;
              let subtitle = `代墊：${getMemberName(exp.payerId)}`;
              let badgeText = '平分';
              let badgeColor = 'bg-[#C5E6EE] text-[#3B93A8]';
              
              if (exp.isPersonal) {
                badgeText = '個人';
                badgeColor = 'bg-gray-200 text-gray-600';
              } else if (exp.splitMode === 'unequal') {
                badgeText = '各付各';
                badgeColor = 'bg-[#FCFCFC] text-[#52B4CC] border border-[#52B4CC]/30';
              }

              return (
                <div key={exp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:border-[#C5E6EE]">
                  <div 
                    onClick={() => {
                      setExpandedId(isExpanded ? null : exp.id);
                      setDeletingExpenseId(null); 
                    }}
                    className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${badgeColor}`}>
                        {getMemberName(exp.payerId).charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">{exp.title}</h4>
                        <div className="flex gap-2 items-center text-xs text-gray-500">
                          <span className="font-medium">{subtitle}</span>
                          <span className={`px-1.5 py-0.5 rounded ${badgeColor} text-[10px] font-bold`}>{badgeText}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-bold text-lg text-[#3B93A8]">{exp.currency} {formatMoney(exp.totalAmount, project.showDecimals)}</span>
                      <ChevronDown size={18} className={`text-[#8BCDDD] mt-1 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 p-4 border-t border-gray-100 text-sm animate-in slide-in-from-top-2">
                      {!exp.isPersonal && (
                        <div className="mb-4 space-y-2">
                          <p className="font-bold text-[#8BCDDD] mb-2 border-b border-gray-200 pb-1">分攤明細</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {Object.entries(exp.splits).map(([uid, amt]) => (
                              <div key={uid} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                                <span className="font-bold text-gray-700">{getMemberName(uid)}</span>
                                <span className="text-[#52B4CC] font-bold">{formatMoney(amt, project.showDecimals)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-end pt-2 border-t border-gray-200 mt-2">
                        {deletingExpenseId === exp.id ? (
                           <div className="flex items-center w-full justify-between bg-red-50 p-2 rounded-lg border border-red-100">
                             <span className="text-red-600 text-sm font-bold ml-1">確定要刪除？</span>
                             <div className="flex gap-2">
                               <button onClick={(e) => { e.stopPropagation(); setDeletingExpenseId(null); }} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50">取消</button>
                               <button onClick={(e) => executeDelete(e, exp.id)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 shadow-sm">刪除</button>
                             </div>
                           </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onEdit(exp); }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#C5E6EE] text-[#52B4CC] rounded-lg font-bold hover:bg-[#C5E6EE]/30 transition-colors">
                              <Edit2 size={16}/> 編輯
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeletingExpenseId(exp.id); }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-100 text-red-500 rounded-lg font-bold hover:bg-red-50 transition-colors">
                              <Trash2 size={16}/> 刪除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// 結算 Tab (包含最佳還款計算)
// ==========================================
function SettlementView({ project, expenses, members }) {
  const [ratesMode, setRatesMode] = useState(project.ratesMode || 'unified');
  const [rates, setRates] = useState(project.rates || {});

  const usedCurrencies = useMemo(() => {
    const s = new Set();
    expenses.forEach(e => { if (e.currency !== 'TWD') s.add(e.currency); });
    return Array.from(s);
  }, [expenses]);

  const usedDatesForCurrencies = useMemo(() => {
    const datesMap = {}; 
    expenses.forEach(e => {
      if (e.currency !== 'TWD') {
        if (!datesMap[e.date]) datesMap[e.date] = new Set();
        datesMap[e.date].add(e.currency);
      }
    });
    return Object.fromEntries(Object.entries(datesMap).map(([d, s]) => [d, Array.from(s)]));
  }, [expenses]);

  const handleRateChange = async (key, value) => {
    const newRates = { ...rates, [key]: Number(value) };
    setRates(newRates);
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', project.id), { rates: newRates });
    } catch(e){}
  };

  const handleModeChange = async (mode) => {
    setRatesMode(mode);
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', project.id), { ratesMode: mode });
    } catch(e){}
  };

  const settlementData = useMemo(() => {
    const balances = {}; 
    const personalTotals = {}; 
    
    members.forEach(m => { balances[m.id] = 0; personalTotals[m.id] = 0; });

    expenses.forEach(exp => {
      let rate = 1;
      if (exp.currency !== 'TWD') {
        if (ratesMode === 'unified') {
          rate = rates[exp.currency] || 1;
        } else {
          rate = rates[`${exp.date}_${exp.currency}`] || rates[exp.currency] || 1; 
        }
      }

      const totalTWD = exp.totalAmount * rate;

      if (balances[exp.payerId] !== undefined) {
        balances[exp.payerId] += totalTWD;
      }

      Object.entries(exp.splits).forEach(([uid, amt]) => {
        if (balances[uid] !== undefined) {
          const amtTWD = amt * rate;
          balances[uid] -= amtTWD;
          personalTotals[uid] += amtTWD;
        }
      });
    });

    const debtors = [];
    const creditors = [];
    Object.entries(balances).forEach(([id, amt]) => {
      if (amt < -0.5) debtors.push({ id, amount: Math.abs(amt) });
      else if (amt > 0.5) creditors.push({ id, amount: amt });
    });

    debtors.sort((a,b) => b.amount - a.amount);
    creditors.sort((a,b) => b.amount - a.amount);

    const transfers = [];
    let d = 0, c = 0;
    while (d < debtors.length && c < creditors.length) {
      const minAmount = Math.min(debtors[d].amount, creditors[c].amount);
      if (minAmount > 0.5) {
        transfers.push({
          from: debtors[d].id,
          to: creditors[c].id,
          amount: Math.round(minAmount)
        });
      }
      debtors[d].amount -= minAmount;
      creditors[c].amount -= minAmount;
      if (debtors[d].amount < 0.5) d++;
      if (creditors[c].amount < 0.5) c++;
    }

    return { balances, personalTotals, transfers };
  }, [expenses, rates, ratesMode, members]);

  const getMemberName = (id) => members.find(m => m.id === id)?.name || '未知';

  const exportCSV = () => {
    let csv = '\uFEFF'; 
    csv += '日期,品項,付款人,幣別,外幣總金額,匯率,台幣總額,備註,分攤明細\n';
    
    expenses.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(exp => {
      const payer = getMemberName(exp.payerId);
      
      let rate = 1;
      if (exp.currency !== 'TWD') {
         rate = ratesMode === 'unified' ? (rates[exp.currency] || 1) : (rates[`${exp.date}_${exp.currency}`] || 1);
      }
      const twdTotal = Math.round(exp.totalAmount * rate);
      const note = exp.isPersonal ? '個人' : (exp.splitMode === 'equal' ? '平分' : '不平分');
      
      const details = Object.entries(exp.splits).map(([uid, amt]) => `${getMemberName(uid)}:${amt}`).join(';');
      
      csv += `${exp.date},${exp.title},${payer},${exp.currency},${exp.totalAmount},${rate},${twdTotal},${note},${details}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${project.name}_記帳明細.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      {usedCurrencies.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#C5E6EE]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-[#52B4CC]"><ArrowRightLeft size={18}/> 匯率設定 (換算回台幣)</h3>
            <select value={ratesMode} onChange={e=>handleModeChange(e.target.value)} className="bg-gray-100 p-1.5 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#8BCDDD]">
              <option value="unified">統一匯率</option>
              <option value="daily">每日匯率</option>
            </select>
          </div>

          {ratesMode === 'unified' ? (
             <div className="grid grid-cols-2 gap-3">
               {usedCurrencies.map(c => (
                 <div key={c} className="flex flex-col bg-gray-50 p-2 rounded-lg border border-gray-100">
                   <label className="text-xs text-gray-500 font-bold mb-1">{c} 匯率</label>
                   <input type="number" step="0.001" placeholder="例如: 0.22" value={rates[c] || ''} onChange={e=>handleRateChange(c, e.target.value)} className="border border-gray-200 p-2 rounded bg-white focus:ring-2 focus:ring-[#8BCDDD] outline-none text-[#3B93A8] font-bold" />
                 </div>
               ))}
             </div>
          ) : (
             <div className="space-y-4">
               {Object.entries(usedDatesForCurrencies).sort((a,b)=>new Date(b[0])-new Date(a[0])).map(([date, curs]) => (
                 <div key={date} className="border-l-4 border-[#8BCDDD] pl-3 py-1 bg-gray-50 rounded-r-lg pr-2">
                   <div className="text-xs font-bold text-gray-500 mb-2">{date}</div>
                   <div className="flex flex-wrap gap-2">
                     {curs.map(c => (
                       <div key={c} className="flex items-center gap-2 bg-white p-1.5 rounded border border-gray-200 shadow-sm">
                         <span className="text-sm font-bold text-gray-700">{c}:</span>
                         <input type="number" step="0.001" value={rates[`${date}_${c}`] || ''} onChange={e=>handleRateChange(`${date}_${c}`, e.target.value)} className="p-1 rounded w-20 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-[#8BCDDD] font-bold text-[#3B93A8]" placeholder="匯率" />
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-[#52B4CC] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-[#C5E6EE]/30 rounded-bl-full -z-10"></div>
        <h3 className="font-bold text-lg text-[#3B93A8] mb-4 flex items-center gap-2">
          <Check size={24} className="text-[#52B4CC]"/> 最佳還款方案
        </h3>
        {settlementData.transfers.length === 0 ? (
          <div className="text-center text-[#52B4CC] py-6 font-bold bg-[#C5E6EE]/40 rounded-lg border border-[#C5E6EE]">
            大家都不欠彼此錢，太讚啦！ 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {settlementData.transfers.map((t, i) => (
              <div key={i} className="flex items-center justify-between bg-[#C5E6EE]/30 p-3 rounded-lg border border-[#C5E6EE] shadow-sm">
                <span className="font-bold text-red-500 w-16 text-center">{getMemberName(t.from)}</span>
                <div className="flex flex-col items-center flex-1 px-2">
                  <span className="text-[10px] text-[#3B93A8] font-bold mb-1 tracking-wider">應轉帳給</span>
                  <div className="w-full relative flex items-center justify-center my-1">
                    <div className="absolute w-full h-px bg-[#8BCDDD]"></div>
                    <div className="bg-white px-3 py-1 rounded-full font-bold text-[#52B4CC] text-lg border border-[#8BCDDD] shadow-sm z-10 whitespace-nowrap">
                      NT$ {formatMoney(t.amount, project.showDecimals)}
                    </div>
                  </div>
                  <ArrowRightLeft size={14} className="text-[#8BCDDD] mt-1"/>
                </div>
                <span className="font-bold text-green-500 w-16 text-center">{getMemberName(t.to)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
          <h3 className="font-bold text-gray-800 text-lg">成員淨額與總花費</h3>
          <button onClick={exportCSV} className="text-sm bg-white text-[#52B4CC] border border-[#C5E6EE] px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold hover:bg-[#FCFCFC] transition-colors shadow-sm">
            <Download size={16}/> 匯出 CSV
          </button>
        </div>
        <div className="space-y-1">
          {members.map(m => {
            const balance = Math.round(settlementData.balances[m.id]);
            const isPos = balance > 0;
            const isNeg = balance < 0;
            return (
              <div key={m.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                <div>
                  <div className="font-bold text-gray-800 text-lg">{m.name}</div>
                  <div className="text-xs text-gray-400 font-bold mt-0.5">總花費: <span className="text-gray-600">NT$ {formatMoney(settlementData.personalTotals[m.id], project.showDecimals)}</span></div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-xl ${isPos ? 'text-green-500' : isNeg ? 'text-red-500' : 'text-gray-400'}`}>
                    {isPos ? '+' : ''}{formatMoney(balance, project.showDecimals)}
                  </div>
                  <div className={`text-[11px] font-bold mt-0.5 ${isPos ? 'text-green-500/70' : isNeg ? 'text-red-500/70' : 'text-gray-400'}`}>
                    {isPos ? '可收回' : isNeg ? '需付款' : '結清'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}