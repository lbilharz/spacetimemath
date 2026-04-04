import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { QRCodeCanvas } from 'qrcode.react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Friendship, FriendInvite } from '../module_bindings/types.js';
import PageContainer from '../components/PageContainer.js';
import { FriendsIcon } from '../components/Icons.js';

export default function FriendsPage() {
  const { t } = useTranslation();
  const { identity } = useSpacetimeDB();
  const [friendships] = useTable(tables.friendships);
  const [friendInvites] = useTable(tables.friend_invites);
  const [players] = useTable(tables.players);
  const [onlinePlayers] = useTable(tables.online_players);
  
  const createFriendInvite = useReducer(reducers.createFriendInvite);
  const acceptFriendInvite = useReducer(reducers.acceptFriendInvite);
  const removeFriend = useReducer(reducers.removeFriend);
  const revokeFriendInvite = useReducer(reducers.revokeFriendInvite);
  
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const myIdentityHex = identity?.toHexString();
  
  const myFriends = (friendships as unknown as Friendship[]).filter(f => 
    f.initiatorIdentity.toHexString() === myIdentityHex || 
    f.recipientIdentity.toHexString() === myIdentityHex
  );

  const activeInvite = myIdentityHex 
    ? (friendInvites as unknown as FriendInvite[]).find(i => {
        if (i.creatorIdentity.toHexString() === myIdentityHex) {
          let expMs = 0;
          if (i.expiresAt && typeof i.expiresAt === 'object' && '__timestamp_micros_since_unix_epoch__' in (i.expiresAt as any)) {
            expMs = Number((i.expiresAt as any).__timestamp_micros_since_unix_epoch__) / 1000;
          } else {
            expMs = Number(i.expiresAt) / 1000;
          }
          return expMs > Date.now();
        }
        return false;
      })
    : undefined;
    
  // ALWAYS use up.bilharz.eu so iOS Universal Links intercept it, even if generated locally
  const inviteLink = activeInvite ? `https://up.bilharz.eu/friend/${activeInvite.token}` : '';
  const displayCode = activeInvite?.token ? activeInvite.token.replace(/(..)(..)(..)(..)/, "$1-$2-$3-$4") : '';

  const handleCreateInvite = async () => {
    setLoading(true);
    setCopied(false);
    try {
      await createFriendInvite();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = joinCode.replace(/-/g, '').trim();
    if (token.length !== 8) return;
    setJoining(true);
    setJoinError('');
    try {
      await acceptFriendInvite({ token });
      setJoinCode('');
    } catch (err: any) {
      setJoinError(err?.message || 'Invalid code');
    } finally {
      setJoining(false);
    }
  };

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
            <FriendsIcon className="drop-shadow-sm scale-110" />
          </div>
          {t('nav.friends', { defaultValue: 'Friends' })}
        </h1>
        <button
          onClick={handleCreateInvite}
          disabled={loading || !!activeInvite}
          className="rounded-2xl bg-brand-yellow px-5 py-3 text-[15px] font-bold text-slate-900 shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          {loading ? t('common.generating') : activeInvite ? t('friends.inviteActive') : '+ ' + t('friends.createInvite')}
        </button>
      </div>

      <div className="flex flex-col gap-6 mt-6">
        {/* Accept form */}
        <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800/80 dark:border-slate-800">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">{t('friends.haveCode')}</h2>
          <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3.5 text-center text-xl tracking-widest font-bold text-slate-900 dark:text-white uppercase placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 shadow-inner"
              type="text"
              placeholder="12-34-56-78"
              value={joinCode}
              onChange={e => {
                // Auto format with dashes
                let val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                if (val.length > 8) val = val.slice(0, 8);
                const chunks = val.match(/.{1,2}/g);
                setJoinCode(chunks ? chunks.join('-') : val);
              }}
              disabled={joining}
            />
            <button className="flex-1 sm:flex-none rounded-2xl bg-brand-yellow px-6 py-3.5 text-[15px] font-bold text-slate-900 transition-transform active:scale-95 disabled:opacity-50" type="submit" disabled={joining || joinCode.replace(/-/g, '').length !== 8}>
              {joining ? t('friends.adding') : t('friends.add')}
            </button>
          </form>
          {joinError && <p className="text-red-500 text-sm font-bold mt-2">⚠ {t('friends.invalidCode')}</p>}
        </div>

        {activeInvite && (
          <div className="rounded-3xl border-2 border-brand-yellow/50 bg-brand-yellow/5 p-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col md:flex-row gap-6 items-center">
            <div className="shrink-0 bg-white p-3 rounded-2xl shadow-sm border border-brand-yellow/30">
               <QRCodeCanvas value={inviteLink} size={120} level={"M"} fgColor={"#0f172a"} />
            </div>
            <div className="flex-1 flex flex-col w-full text-center md:text-left">
               <div className="text-sm font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-widest">{t('friends.yourLink')}</div>
               <div className="text-4xl font-black font-mono tracking-wider text-slate-900 dark:text-brand-yellow mb-4 drop-shadow-sm">
                 {displayCode}
               </div>
               <div className="flex gap-2">
                 <input 
                   readOnly 
                   value={inviteLink} 
                   onClick={e => (e.target as HTMLInputElement).select()}
                   className="flex-1 rounded-xl bg-white dark:bg-slate-900 px-4 py-3 font-mono text-[11px] border border-slate-200 dark:border-slate-700 outline-none text-slate-400 dark:text-slate-500 shadow-inner"
                 />
                 <button 
                   onClick={handleCopy}
                   className="shrink-0 rounded-xl px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold transition-transform active:scale-95 text-sm md:w-auto w-full"
                 >
                   {copied ? t('common.copied', { defaultValue: 'Copied!' }) : t('common.copy', { defaultValue: 'Copy' })}
                 </button>
                 <button 
                   onClick={() => revokeFriendInvite({ token: activeInvite.token })}
                   className="shrink-0 flex items-center justify-center rounded-xl p-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-all active:scale-95 group"
                   title="Deactivate Code"
                 >
                   ✕
                 </button>
               </div>
               <div className="text-xs text-slate-500 mt-3 font-medium">
                  {t('friends.inviteHelp')}
               </div>
            </div>
          </div>
        )}
        {myFriends.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white dark:bg-slate-800/50 dark:border-slate-800 p-8 text-center shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-yellow via-brand-yellow to-brand-yellow animate-pulse" />
             <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 mt-2">{t('friends.levelUp')}</h3>
             <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm mx-auto mb-6">
                {t('friends.levelUpDesc')}
             </p>
             <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">— {t('friends.empty')} —</div>
          </div>
        ) : (
          myFriends.map(f => {
            const isInitiator = f.initiatorIdentity.toHexString() === myIdentityHex;
            const friendIdentityHex = isInitiator ? f.recipientIdentity.toHexString() : f.initiatorIdentity.toHexString();
            const friendPlayer = players.find(p => p.identity.toHexString() === friendIdentityHex);
            const isOnline = onlinePlayers.some(p => p.identity.toHexString() === friendIdentityHex);
            
            return (
              <div key={f.id.toString()} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {friendPlayer?.username || t('friends.unknownPlayer')}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t('friends.score')}: {Math.floor(friendPlayer?.bestScore ?? 0)}
                    </div>
                  </div>
                </div>
                {confirmRemoveId === f.id.toString() ? (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2">
                    <button 
                      onClick={() => {
                        removeFriend({ friendIdentity: isInitiator ? f.recipientIdentity : f.initiatorIdentity });
                        setConfirmRemoveId(null);
                      }}
                      className="rounded-lg bg-red-100 dark:bg-red-900/40 px-3 py-1.5 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                    >
                      {t('friends.confirm')}
                    </button>
                    <button 
                      onClick={() => setConfirmRemoveId(null)}
                      className="text-slate-500 text-sm font-bold hover:text-slate-600 dark:text-slate-400 transition-colors"
                    >
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmRemoveId(f.id.toString())}
                    className="text-red-500 text-sm font-bold hover:text-red-600 transition-colors"
                  >
                    {t('friends.remove')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
