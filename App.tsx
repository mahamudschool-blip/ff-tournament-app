
import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider } from './firebase';
import { ref, onValue, set, update, push, get } from 'firebase/database';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

// --- Types ---
type MatchType = 'Solo' | 'Duo' | 'Squad';
type MatchStatus = 'Upcoming' | 'Live' | 'Finished';

interface PlayerRecord {
  userId: string;
  names: string[];
  participationType: MatchType;
  kills?: number;
  rank?: number;
}

interface Tournament {
  id: string;
  title: string;
  type: MatchType;
  baseEntryFee: number;
  perKill: number;
  prize1: number;
  prize2: number;
  prize3: number;
  startTime: number;
  maxPlayers: number; 
  joinedPlayers: PlayerRecord[];
  status: MatchStatus;
  roomId?: string;
  roomPass?: string;
  map: string;
}

interface UserData {
  id: string;
  name: string;
  balance: number;
  gameId: string;
  role: 'user' | 'admin';
}

interface Transaction {
  id: string;
  userId: string;
  type: 'Deposit' | 'Withdraw' | 'Reward' | 'Manual';
  amount: number;
  method?: 'bKash' | 'Nagad';
  number?: string;
  senderNumber?: string;
  transactionId?: string;
  status: 'Pending' | 'Completed' | 'Rejected';
  date: number;
}

interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  reply?: string;
  date: number;
  status: 'Pending' | 'Replied';
}

interface Notice {
  id: string;
  text: string;
  date: number;
}

interface AdminSettings {
  bkashNumber: string;
  nagadNumber: string;
}

// --- Helpers ---
const getDerivedStatus = (startTime: number, dbStatus?: MatchStatus): MatchStatus => {
  if (dbStatus === 'Finished') return 'Finished'; // Allow force finish from DB
  
  const now = Date.now();
  const tenMins = 10 * 60 * 1000;
  const twentyMins = 20 * 60 * 1000;
  
  if (now < startTime - tenMins) return 'Upcoming';
  if (now < startTime + twentyMins) return 'Live';
  return 'Finished';
};

// --- Sub-Components ---

const LoginView = ({ authId, setAuthId, authPass, setAuthPass, handleLogin, handleGoogleLogin, setView, isSubmitting }: any) => (
  <div className="min-h-screen bg-black flex items-center justify-center px-6">
    <div className="w-full max-w-sm space-y-8 bg-[#1a1a1a] p-8 rounded-3xl border border-white/5 shadow-2xl">
      <div className="text-center">
        <h1 className="text-3xl font-black text-orange-600 italic uppercase">FF পোর্টাল</h1>
        <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest">খেলুন এবং জিতুন</p>
      </div>
      <div className="space-y-4">
        <input placeholder="ইমেইল বা ইউজার আইডি" value={authId} onChange={e => setAuthId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
        <input type="password" placeholder="পাসওয়ার্ড" value={authPass} onChange={e => setAuthPass(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
        <button 
          onClick={handleLogin} 
          disabled={isSubmitting}
          className="w-full bg-orange-600 py-4 rounded-xl font-black text-xs uppercase text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {isSubmitting ? 'অপেক্ষা করুন...' : 'লগইন'}
        </button>
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase text-gray-500 font-bold bg-[#1a1a1a] px-2">অন্যান্য</div>
        </div>
        <button onClick={handleGoogleLogin} className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform">
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" /> Gmail দিয়ে লগইন
        </button>
        <p className="text-center text-[10px] text-gray-500">অ্যাকাউন্ট নেই? <button onClick={() => setView('register')} className="text-orange-500 font-bold uppercase">নিবন্ধন করুন</button></p>
      </div>
    </div>
  </div>
);

const RegisterView = ({ regName, setRegName, authId, setAuthId, regGameId, setRegGameId, authPass, setAuthPass, handleRegister, setView, isSubmitting }: any) => (
  <div className="min-h-screen bg-black flex items-center justify-center px-6">
    <div className="w-full max-w-sm space-y-6 bg-[#1a1a1a] p-8 rounded-3xl border border-white/5 shadow-2xl">
      <h2 className="text-2xl font-black text-white text-center italic uppercase">নিবন্ধন</h2>
      <div className="space-y-4">
        <input placeholder="পুরো নাম" value={regName} onChange={e => setRegName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
        <input placeholder="ইউজার আইডি বা ইমেইল" value={authId} onChange={e => setAuthId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
        <input placeholder="ফ্রি ফায়ার গেম আইডি" value={regGameId} onChange={e => setRegGameId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
        <input type="password" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ ডিজিট)" value={authPass} onChange={e => setAuthPass(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
        <button 
          onClick={handleRegister} 
          disabled={isSubmitting}
          className="w-full bg-orange-600 py-4 rounded-xl font-black text-xs uppercase text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {isSubmitting ? 'প্রসেসিং...' : 'নিবন্ধন সম্পন্ন করুন'}
        </button>
        <button onClick={() => setView('login')} className="w-full text-center text-[10px] text-gray-500 uppercase font-bold">লগইন এ ফিরে যান</button>
      </div>
    </div>
  </div>
);

const TournamentCard = ({ tournament, currentUser, setShowPlayerList, setShowJoinModal, setSelectedJoinType, setJoinNames }: any) => {
  const currentStatus = getDerivedStatus(tournament.startTime, tournament.status);
  const userRecord = tournament.joinedPlayers?.find((p: any) => p.userId === currentUser?.id);
  const isJoined = !!userRecord;
  const showRoomInfo = isJoined && currentStatus === 'Live';

  const statusColors = {
    Upcoming: 'bg-blue-600',
    Live: 'bg-red-600 animate-pulse',
    Finished: 'bg-gray-600'
  };

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl mb-4">
      <div className="relative h-24 bg-gray-800">
         <img src={`https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070`} className="w-full h-full object-cover opacity-40 grayscale" alt="FF Banner" />
         <div className="absolute top-2 left-3 flex gap-2">
           <span className="bg-orange-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase italic">{tournament.type}</span>
           <span className={`${statusColors[currentStatus]} text-white text-[9px] font-black px-3 py-1 rounded-full uppercase italic shadow-lg`}>
             {currentStatus === 'Finished' ? 'Complete' : currentStatus}
           </span>
         </div>
         <div className="absolute bottom-2 left-3">
            <h3 className="text-lg font-black text-white uppercase italic leading-none">{tournament.title}</h3>
         </div>
      </div>
      <div className="p-4 space-y-3">
         <div className="grid grid-cols-3 gap-1 text-center border-b border-white/5 pb-3">
            <div><span className="text-[8px] font-bold text-gray-500 uppercase block">১ম পুরস্কার</span><span className="text-xs font-black text-orange-400">৳{tournament.prize1}</span></div>
            <div className="border-x border-white/10"><span className="text-[8px] font-bold text-gray-500 uppercase block">প্রতি কিল</span><span className="text-xs font-black text-emerald-400">৳{tournament.perKill}</span></div>
            <div><span className="text-[8px] font-bold text-gray-500 uppercase block">বেস ফি</span><span className="text-xs font-black text-white">৳{tournament.baseEntryFee}</span></div>
         </div>
         <div className="flex justify-between items-end">
            <div className="space-y-2">
              <p className="text-[10px] text-gray-400 font-bold">ম্যাপ: <span className="text-white uppercase">{tournament.map}</span></p>
              <p className="text-[10px] text-gray-400 font-bold">সময়: <span className="text-white">{new Date(tournament.startTime).toLocaleString('bn-BD', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span></p>
              <button onClick={() => setShowPlayerList(tournament.id)} className="text-[9px] font-black text-orange-500 uppercase flex items-center gap-1">👥 প্লেয়ার লিস্ট ({tournament.joinedPlayers?.length || 0})</button>
            </div>
            <div className="text-right space-y-2">
              {isJoined ? (
                <div className="space-y-1">
                  <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black px-3 py-1 rounded-lg uppercase inline-block">জয়েন করেছেন ({userRecord?.participationType})</span>
                  {currentStatus === 'Finished' ? (
                     <p className="text-[8px] text-gray-400 font-bold italic block">ম্যাচ শেষ</p>
                  ) : showRoomInfo ? (
                    <div className="bg-orange-600 p-2 rounded-lg text-left shadow-lg border border-white/20">
                      <p className="text-[9px] font-black text-white">ID: {tournament.roomId || 'রুম খোলার অপেক্ষায়'}</p>
                      <p className="text-[9px] font-black text-white">PASS: {tournament.roomPass || 'রুম খোলার অপেক্ষায়'}</p>
                    </div>
                  ) : <p className="text-[8px] text-gray-500 font-bold uppercase italic block">১০ মিনিট আগে রুম আইডি আসবে</p>}
                </div>
              ) : (
                <button 
                  onClick={() => { setSelectedJoinType('Solo'); setJoinNames(['']); setShowJoinModal(tournament.id); }}
                  disabled={(tournament.joinedPlayers?.length || 0) >= tournament.maxPlayers || currentStatus === 'Finished'}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-xl font-black uppercase text-xs shadow-lg disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {currentStatus === 'Finished' ? 'বন্ধ হয়েছে' : (tournament.joinedPlayers?.length || 0) >= tournament.maxPlayers ? 'ফুল হয়ে গেছে' : 'জয়েন করুন'}
                </button>
              )}
            </div>
         </div>
      </div>
    </div>
  );
};

const WalletView = ({ currentUser, settings, updateUserBalance }: any) => {
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'bKash' | 'Nagad'>('bKash');
  const [senderNum, setSenderNum] = useState('');
  const [txId, setTxId] = useState('');
  const [withdrawNum, setWithdrawNum] = useState('');

  const handleDeposit = async () => {
    if (!amount || Number(amount) < 100) return alert("নূন্যতম ১০০ টাকা জমা দিতে হবে!");
    if (!senderNum || !txId) return alert("সব তথ্য পূরণ করুন!");
    const newTx: Transaction = {
      id: 'tx_' + Date.now(),
      userId: currentUser!.id,
      type: 'Deposit',
      amount: Number(amount),
      method,
      senderNumber: senderNum,
      transactionId: txId,
      status: 'Pending',
      date: Date.now()
    };
    await set(ref(db, `transactions/${newTx.id}`), newTx);
    setAmount(''); setSenderNum(''); setTxId('');
    alert("আবেদন জমা হয়েছে!");
  };

  const handleWithdraw = async () => {
    if (!amount || Number(amount) < 200) return alert("নূন্যতম ২০০ টাকা উত্তোলন করতে হবে!");
    if (Number(amount) > currentUser!.balance) return alert("ব্যালেন্স যথেষ্ট নয়!");
    if (!withdrawNum) return alert("সঠিক নাম্বার দিন!");
    const newTx: Transaction = {
      id: 'tx_' + Date.now(),
      userId: currentUser!.id,
      type: 'Withdraw',
      amount: Number(amount),
      method,
      number: withdrawNum,
      status: 'Pending',
      date: Date.now()
    };
    await updateUserBalance(currentUser!.id, -Number(amount));
    await set(ref(db, `transactions/${newTx.id}`), newTx);
    setAmount(''); setWithdrawNum('');
    alert("উত্তোলন সফলভাবে জমা হয়েছে!");
  };

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      <h2 className="text-xl font-black text-white border-b border-orange-500/30 pb-3 uppercase italic">ওয়ালেট</h2>
      <div className="bg-gradient-to-r from-orange-600 to-orange-400 p-8 rounded-3xl text-center shadow-xl">
         <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">বর্তমান ব্যালেন্স</span>
         <h3 className="text-5xl font-black text-white italic">৳{currentUser?.balance || 0}</h3>
      </div>
      <div className="flex bg-[#1a1a1a] p-1 rounded-2xl border border-white/5">
         <button onClick={() => setWalletTab('deposit')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${walletTab === 'deposit' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}>টাকা যোগ</button>
         <button onClick={() => setWalletTab('withdraw')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${walletTab === 'withdraw' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}>টাকা উত্তোলন</button>
      </div>
      <div className="bg-[#1a1a1a] p-5 rounded-3xl border border-white/5 space-y-4">
         {walletTab === 'deposit' ? (
           <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMethod('bKash')} className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase ${method === 'bKash' ? 'border-pink-500 bg-pink-500/10 text-pink-500' : 'border-white/5 text-gray-500'}`}>bKash</button>
                  <button onClick={() => setMethod('Nagad')} className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase ${method === 'Nagad' ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-white/5 text-gray-500'}`}>Nagad</button>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] text-gray-500 font-black">আমাদের {method} নাম্বার</p>
                <p className="text-xl font-black text-orange-500">{method === 'bKash' ? settings.bkashNumber : settings.nagadNumber}</p>
              </div>
              <input type="number" placeholder="টাকার পরিমাণ (৳ ১০০+)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
              <input placeholder="বিকাশ/নগদ নাম্বার" value={senderNum} onChange={e => setSenderNum(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
              <input placeholder="ট্রানজেকশন আইডি (TxID)" value={txId} onChange={e => setTxId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
              <button onClick={handleDeposit} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-transform">টাকা যোগের আবেদন করুন</button>
           </div>
         ) : (
           <div className="space-y-4">
              <input type="number" placeholder="কত টাকা তুলবেন (৳ ২০০+)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
              <input placeholder="বিকাশ/নগদ নাম্বার" value={withdrawNum} onChange={e => setWithdrawNum(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-500 outline-none" />
              <button onClick={handleWithdraw} className="w-full bg-orange-600 text-white py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-transform">টাকা উত্তোলনের আবেদন করুন</button>
           </div>
         )}
      </div>
    </div>
  );
};

const Navbar = ({ view, setView, currentUser }: any) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-orange-500/30 flex justify-around py-3 z-50 safe-area-pb">
    {[
      { id: 'home', icon: '🏠', label: 'হোম' },
      { id: 'my-matches', icon: '🏆', label: 'ম্যাচ' },
      { id: 'wallet', icon: '💰', label: 'ওয়ালেট' },
      { id: 'support', icon: '💬', label: 'সাপোর্ট' },
      { id: 'admin', icon: '⚙️', label: 'এডমিন', adminOnly: true }
    ].filter(tab => !tab.adminOnly || currentUser?.role === 'admin').map(tab => (
      <button 
        key={tab.id} 
        onClick={() => setView(tab.id as any)}
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${view === tab.id ? 'text-orange-500 scale-110' : 'text-gray-500'}`}
      >
        <span className="text-xl">{tab.icon}</span>
        <span className="text-[10px] font-bold uppercase">{tab.label}</span>
      </button>
    ))}
  </nav>
);

// --- Main App ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [view, setView] = useState<'home' | 'my-matches' | 'wallet' | 'support' | 'admin' | 'profile' | 'login' | 'register'>('login');
  const [tick, setTick] = useState(0); // For dynamic UI updates every minute
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({ bkashNumber: '017XXXXXXXX', nagadNumber: '019XXXXXXXX' });
  const [marqueeText, setMarqueeText] = useState("🔥 নতুন মেগা টুর্নামেন্টে জয়েন করুন! 🔥 রুম আইডি ১০ মিনিট আগে দেওয়া হবে।");

  const [authId, setAuthId] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regGameId, setRegGameId] = useState('');

  const [showJoinModal, setShowJoinModal] = useState<string | null>(null);
  const [showPlayerList, setShowPlayerList] = useState<string | null>(null);
  const [selectedJoinType, setSelectedJoinType] = useState<MatchType>('Solo');
  const [joinNames, setJoinNames] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000); // Tick every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setCurrentUser(data);
            if (view === 'login' || view === 'register') setView('home');
          }
        });
      } else {
        if (currentUser?.id !== 'admin_root') {
          setCurrentUser(null);
          setView('login');
        }
      }
      setLoading(false);
    });

    onValue(ref(db, 'tournaments'), snapshot => setTournaments(snapshot.val() ? Object.values(snapshot.val()) : []));
    onValue(ref(db, 'transactions'), snapshot => setTransactions(snapshot.val() ? Object.values(snapshot.val()) : []));
    onValue(ref(db, 'messages'), snapshot => setMessages(snapshot.val() ? Object.values(snapshot.val()) : []));
    onValue(ref(db, 'notices'), snapshot => setNotices(snapshot.val() ? Object.values(snapshot.val()) : []));
    onValue(ref(db, 'settings'), snapshot => snapshot.val() && setSettings(snapshot.val()));
    onValue(ref(db, 'marquee'), snapshot => snapshot.val() && setMarqueeText(snapshot.val()));

    return () => unsubAuth();
  }, []);

  const handleAdminLogin = () => {
    if (authId === 'mahamud5545' && authPass === '545545') {
      const admin: UserData = { id: 'admin_root', name: 'Super Admin', balance: 999999, gameId: 'ADMIN', role: 'admin' };
      setCurrentUser(admin);
      setView('home');
    } else alert("ভুল অ্যাডমিন ক্রেডেনশিয়াল!");
  };

  const handleRegister = async () => {
    if (!regName || !regGameId || !authPass || !authId) return alert("সব তথ্য দিন!");
    if (authPass.length < 6) return alert("পাসওয়ার্ড কমপক্ষে ৬ ডিজিট হতে হবে!");
    
    setIsSubmitting(true);
    try {
      const email = authId.includes('@') ? authId : `${authId}@ffportal.com`;
      const res = await createUserWithEmailAndPassword(auth, email, authPass);
      const userData: UserData = { id: res.user.uid, name: regName, balance: 0, gameId: regGameId, role: 'user' };
      await set(ref(db, `users/${res.user.uid}`), userData);
      setCurrentUser(userData);
      alert("নিবন্ধন সফল হয়েছে!");
      setView('home');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') alert("এই ইউজার আইডি ইতিমধ্যে ব্যবহৃত হয়েছে।");
      else alert("ত্রুটি: " + err.message);
    } finally { setIsSubmitting(false); }
  };

  const handleLogin = async () => {
    if (authId === 'mahamud5545') { handleAdminLogin(); return; }
    setIsSubmitting(true);
    try {
      const email = authId.includes('@') ? authId : `${authId}@ffportal.com`;
      await signInWithEmailAndPassword(auth, email, authPass);
    } catch (err: any) { alert("ভুল আইডি বা পাসওয়ার্ড!"); } 
    finally { setIsSubmitting(false); }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const userRef = ref(db, `users/${res.user.uid}`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        const userData: UserData = { id: res.user.uid, name: res.user.displayName || 'Unnamed', balance: 0, gameId: 'SET_ID', role: 'user' };
        await set(userRef, userData);
        setCurrentUser(userData);
      }
    } catch (err: any) { alert(err.message); }
  };

  const handleLogout = async () => {
    if (window.confirm("লগআউট করতে চান?")) {
      if (currentUser?.id === 'admin_root') { setCurrentUser(null); setView('login'); } 
      else await signOut(auth);
    }
  };

  const updateUserBalance = async (userId: string, amount: number) => {
    const userRef = ref(db, `users/${userId}/balance`);
    const snapshot = await get(userRef);
    const current = snapshot.val() || 0;
    await set(userRef, current + amount);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-black font-sans text-gray-200 select-none">
      {view === 'login' && <LoginView {...{authId, setAuthId, authPass, setAuthPass, handleLogin, handleGoogleLogin, setView, isSubmitting}} />}
      {view === 'register' && <RegisterView {...{regName, setRegName, authId, setAuthId, regGameId, setRegGameId, authPass, setAuthPass, handleRegister, setView, isSubmitting}} />}
      
      {(view !== 'login' && view !== 'register') && (
        <>
          <div className="bg-orange-600 overflow-hidden py-1.5 shadow-lg relative z-[60]">
            <div className="whitespace-nowrap animate-marquee font-black uppercase text-[9px] tracking-widest text-white italic">{marqueeText}</div>
          </div>
          <div className="px-4 py-4 h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
            {view === 'home' && (
              <div className="space-y-6 pb-20">
                <header className="flex justify-between items-center bg-[#1a1a1a] p-5 rounded-3xl border border-white/5 shadow-2xl">
                  <div onClick={() => setView('profile')} className="flex items-center gap-4 cursor-pointer group">
                     <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center font-black text-white italic text-xl shadow-lg group-active:scale-95">{currentUser?.name?.charAt(0) || 'U'}</div>
                     <div><h1 className="text-xl font-black text-white uppercase italic leading-none group-hover:text-orange-500">FF পোর্টাল</h1><p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">{currentUser?.name} ⚙️</p></div>
                  </div>
                  <div className="text-right"><span className="text-[8px] font-bold text-gray-500 uppercase block">ব্যালেন্স</span><span className="text-xl font-black text-emerald-400">৳{currentUser?.balance || 0}</span></div>
                </header>
                {notices.length > 0 && (
                  <section className="bg-[#1a1a1a] p-4 rounded-3xl border border-orange-500/20 space-y-3">
                    <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" /> গুরুত্বপূর্ণ নোটিশ</h2>
                    {notices.map((n: Notice) => <div key={n.id} className="flex gap-2 items-start bg-black/40 p-3 rounded-2xl border border-white/5"><span className="text-orange-500 text-xs">🔔</span><p className="text-[11px] text-gray-300 leading-snug">{n.text}</p></div>)}
                  </section>
                )}
                <section className="space-y-4">
                  <h2 className="text-xs font-black text-white uppercase border-l-4 border-orange-500 pl-3">চলমান টুর্নামেন্ট</h2>
                  {tournaments.filter(t => getDerivedStatus(t.startTime, t.status) !== 'Finished').map(t => <TournamentCard key={t.id} {...{tournament: t, currentUser, setShowPlayerList, setShowJoinModal, setSelectedJoinType, setJoinNames}} />)}
                  {tournaments.filter(t => getDerivedStatus(t.startTime, t.status) !== 'Finished').length === 0 && <p className="text-center text-gray-600 italic py-10 text-xs uppercase">বর্তমানে কোনো টুর্নামেন্ট নেই</p>}
                </section>
              </div>
            )}
            {view === 'wallet' && <WalletView {...{currentUser, settings, updateUserBalance}} />}
            {view === 'profile' && (
              <div className="px-4 py-6 space-y-6 pb-24">
                <h2 className="text-xl font-black text-white border-b border-orange-500/30 pb-3 uppercase italic">প্রোফাইল সেটিংস</h2>
                <div className="bg-[#1a1a1a] p-6 rounded-3xl border border-white/5 space-y-5">
                   <div className="space-y-1">
                     <label className="text-[10px] text-gray-500 uppercase font-black ml-1">নাম</label>
                     <div className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm">{currentUser?.name}</div>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] text-gray-500 uppercase font-black ml-1">গেম আইডি</label>
                     <div className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm">{currentUser?.gameId}</div>
                   </div>
                </div>
                <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-red-600/10 border border-red-600/30 text-red-500 font-black text-xs uppercase shadow-lg active:scale-95 transition-transform mt-10">লগআউট করুন</button>
              </div>
            )}
            {view === 'my-matches' && (
              <div className="space-y-6 pb-20">
                <h2 className="text-xl font-black text-white border-b border-orange-500/30 pb-3 uppercase italic">আমার ম্যাচ</h2>
                {tournaments.filter(t => t.joinedPlayers?.some(p => p.userId === currentUser?.id)).map(t => <TournamentCard key={t.id} {...{tournament: t, currentUser, setShowPlayerList, setShowJoinModal, setSelectedJoinType, setJoinNames}} />)}
                {tournaments.filter(t => t.joinedPlayers?.some(p => p.userId === currentUser?.id)).length === 0 && <p className="text-center text-gray-600 italic py-10 text-xs uppercase">আপনি কোনো ম্যাচে জয়েন করেননি</p>}
              </div>
            )}
            {view === 'support' && (
              <div className="px-4 py-6 space-y-6 pb-24">
                <h2 className="text-xl font-black text-white border-b border-orange-500/30 pb-3 uppercase italic">সাপোর্ট</h2>
                <textarea id="support_msg" placeholder="আপনার সমস্যার কথা বিস্তারিত লিখুন..." className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-white text-sm h-32 focus:border-orange-500 outline-none" />
                <button onClick={async () => {
                   const m = (document.getElementById('support_msg') as HTMLTextAreaElement).value;
                   if(m) {
                     const msgId = 'm'+Date.now();
                     await set(ref(db, `messages/${msgId}`), {id: msgId, userId: currentUser!.id, userName: currentUser!.name, message: m, status: 'Pending', date: Date.now()});
                     alert("বার্তা পাঠানো হয়েছে!");
                     (document.getElementById('support_msg') as HTMLTextAreaElement).value = '';
                   }
                }} className="w-full bg-orange-600 text-white py-4 rounded-xl font-black uppercase text-xs active:scale-95 transition-transform shadow-lg">মেসেজ পাঠান</button>
                <div className="space-y-4">
                  {messages.filter(m => m.userId === currentUser?.id).map(m => <div key={m.id} className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5"><p className="text-xs text-white">{m.message}</p>{m.reply && <p className="mt-2 text-[10px] text-orange-500 italic bg-black/20 p-2 rounded">রিপ্লাই: {m.reply}</p>}</div>)}
                </div>
              </div>
            )}
            {view === 'admin' && currentUser?.role === 'admin' && (
              <div className="px-4 py-6 space-y-6 pb-24">
                <h2 className="text-xl font-black text-white border-b border-orange-500/30 pb-3 uppercase italic">অ্যাডমিন কন্ট্রোল</h2>
                <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5"><p className="text-xs text-gray-400 italic">অ্যাডমিন টুলস শীঘ্রই আপডেট করা হবে।</p></div>
              </div>
            )}
          </div>
          <Navbar {...{view, setView, currentUser}} />
        </>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center px-6">
           <div className="bg-[#1a1a1a] border border-orange-500/30 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl scale-in-center">
              <h3 className="text-lg font-black text-white uppercase italic">ম্যাচ মোড</h3>
              <div className="flex gap-2 bg-black p-1 rounded-xl border border-white/5">
                {(['Solo', 'Duo', 'Squad'] as MatchType[]).map(type => (
                  <button key={type} onClick={() => { setSelectedJoinType(type); setJoinNames(Array(type === 'Solo' ? 1 : type === 'Duo' ? 2 : 4).fill('')); }}
                    className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${selectedJoinType === type ? 'bg-orange-600 text-white' : 'text-gray-500'}`}>{type}</button>
                ))}
              </div>
              <div className="space-y-3 pt-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                {joinNames.map((name, i) => (
                  <input key={i} placeholder={`প্লেয়ার ${i+1} গেম নাম`} value={name} onChange={(e) => { const n = [...joinNames]; n[i] = e.target.value; setJoinNames(n); }} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-orange-500 outline-none" />
                ))}
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                 <p className="text-[10px] text-gray-500 uppercase font-black">মোট ফি</p>
                 <p className="text-xl font-black text-orange-500">৳{(function(){
                    const t = tournaments.find(x => x.id === showJoinModal);
                    if(!t) return 0;
                    if(selectedJoinType === 'Duo') return t.baseEntryFee * 2;
                    if(selectedJoinType === 'Squad') return t.baseEntryFee * 4;
                    return t.baseEntryFee;
                 })()}</p>
              </div>
              <div className="flex gap-3 pt-2">
                 <button onClick={() => setShowJoinModal(null)} className="flex-1 bg-white/5 text-white py-3 rounded-xl font-black text-[10px] uppercase">বাতিল</button>
                 <button onClick={async () => {
                   const t = tournaments.find(x => x.id === showJoinModal);
                   if (!t || joinNames.some(n => !n.trim())) return alert("সব প্লেয়ারের নাম দিন!");
                   const fee = selectedJoinType === 'Duo' ? t.baseEntryFee * 2 : selectedJoinType === 'Squad' ? t.baseEntryFee * 4 : t.baseEntryFee;
                   if (currentUser!.balance < fee) return alert("ব্যালেন্স কম!");
                   
                   await updateUserBalance(currentUser!.id, -fee);
                   const updatedPlayers = [...(t.joinedPlayers || []), {userId: currentUser!.id, names: joinNames, participationType: selectedJoinType}];
                   await update(ref(db, `tournaments/${showJoinModal}`), { joinedPlayers: updatedPlayers });
                   setShowJoinModal(null);
                   alert("জয়েন সফল হয়েছে!");
                 }} className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-transform">কনফার্ম</button>
              </div>
           </div>
        </div>
      )}
      
      {showPlayerList && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center px-6">
          <div className="bg-[#1a1a1a] border border-orange-500/30 p-6 rounded-3xl w-full max-w-sm max-h-[70vh] flex flex-col shadow-2xl">
            <h3 className="text-lg font-black text-white italic mb-4 uppercase">প্লেয়ার লিস্ট</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {tournaments.find(t => t.id === showPlayerList)?.joinedPlayers?.map((p, i) => (
                <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/5"><p className="text-[9px] text-orange-500 font-black uppercase">টিম {i+1} ({p.participationType})</p><p className="text-xs text-white font-bold">{p.names.join(' , ')}</p></div>
              ))}
              {(!tournaments.find(t => t.id === showPlayerList)?.joinedPlayers || tournaments.find(t => t.id === showPlayerList)?.joinedPlayers?.length === 0) && <p className="text-center text-gray-600 italic py-6 uppercase text-[10px]">এখনো কেউ অংশগ্রহণ করেনি</p>}
            </div>
            <button onClick={() => setShowPlayerList(null)} className="mt-4 bg-orange-600 text-white py-3 rounded-xl font-black text-[10px] uppercase">বন্ধ করুন</button>
          </div>
        </div>
      )}
    </div>
  );
}
