import { useTranslation } from 'react-i18next';

const getMarketingInfo = (lang: string) => {
  const dict: any = {
    de: {
      s_title: 'Mathe ohne Frust', s_desc: '60-Sekunden Sprints, die sich wie Spiele anfühlen.',
      f_title: 'Mit Freunden messen', f_desc: 'Mitschüler hinzufügen und die Rangliste erklimmen.',
      a_title: 'Im perfekten Tempo lernen', a_desc: 'Unsere adaptive Engine passt sich deinem Niveau an.',
      m_title: 'Formative Tests automatisieren', m_desc: 'Sofort sehen, welche Konzepte sitzen.',
      c_title: 'Sofort sehen, wer Hilfe braucht', c_desc: 'Echtzeit-Fortschritt der Klasse überwachen.'
    },
    en: {
      s_title: 'Master Math Without Frustration', s_desc: '60-second sprints that feel like a game.',
      f_title: 'Compete With Friends', f_desc: 'Add peers and climb the weekly leaderboard.',
      a_title: 'Learn At Your Perfect Pace', a_desc: 'Our adaptive engine matches your exact skill level.',
      m_title: 'Automate Formative Assessments', m_desc: 'Instantly see which concepts are mastered.',
      c_title: 'Spot Who Needs Help Instantly', c_desc: "Monitor your classroom's live progress."
    },
    es: {
      s_title: 'Domina las Mates sin Frustración', s_desc: 'Sprints de 60 segundos que parecen un juego.',
      f_title: 'Compite con Amigos', f_desc: 'Sube en la clasificación semanal.',
      a_title: 'Aprende a tu Ritmo', a_desc: 'Nuestro motor se adapta a tu nivel exacto.',
      m_title: 'Automatiza la Evaluación', m_desc: 'Ve al instante qué conceptos dominan.',
      c_title: 'Descubre Quién Necesita Ayuda', c_desc: 'Sigue el progreso de tu clase en vivo.'
    },
    fr: {
      s_title: 'Maîtrisez les Maths sans Frustration', s_desc: 'Des sprints de 60s sous forme de jeu.',
      f_title: 'Affrontez vos Amis', f_desc: 'Gravissez le classement hebdomadaire.',
      a_title: 'Apprenez à votre Rythme', a_desc: 'Notre moteur adaptatif cible votre niveau.',
      m_title: 'Automatisez vos Évaluations', m_desc: 'Voyez instantanément les acquis.',
      c_title: 'Repérez Qui a Besoin d\'Aide', c_desc: 'Suivez la progression de la classe en direct.'
    },
    nl: {
      s_title: 'Beheers Rekenen Zonder Frustratie', s_desc: '60-seconden sprints als een spel.',
      f_title: 'Speel Tegen Vrienden', f_desc: 'Klim in het wekelijkse klassement.',
      a_title: 'Leer op Jouw Ideale Tempo', a_desc: 'Onze adaptieve engine past zich aan jouw niveau aan.',
      m_title: 'Automatiseer Formatief Toetsen', m_desc: 'Zie direct welke doelen bereikt zijn.',
      c_title: 'Zie Direct Wie Hulp Nodig Heeft', c_desc: 'Monitor de voortgang van je klas live.'
    },
    tr: {
      s_title: 'Matematiği Eğlenerek Öğren', s_desc: 'Oyun hissi veren 60 saniyelik sprintler.',
      f_title: 'Arkadaşlarınla Yarış', f_desc: 'Haftalık liderlik tablosunda yüksel.',
      a_title: 'Kendi Hızında Öğren', a_desc: 'Yapay zeka tam senin seviyene göre uyarlanır.',
      m_title: 'Değerlendirmeyi Otomatikleştir', m_desc: 'Hangi konuların anlaşıldığını anında gör.',
      c_title: 'Kim Yardıma Muhtaç Anında Gör', c_desc: 'Sınıfın canlı ilerlemesini izle.'
    },
    uk: {
      s_title: 'Математика Без Сліз', s_desc: '60-секундні спринти, що відчуваються як гра.',
      f_title: 'Змагайся з Друзями', f_desc: 'Додавай друзів і піднімайся в рейтингу.',
      a_title: 'Вчись у Своєму Темпі', a_desc: 'Наш двигун адаптується до твого рівня.',
      m_title: 'Автоматизуй Оцінювання', m_desc: 'Миттєво бач, що вже засвоєно.',
      c_title: 'Одразу Бач Кому Потрібна Допомога', c_desc: 'Слідкуй за прогресом класу наживо.'
    },
    ar: {
      s_title: 'إتقان الرياضيات بدون إحباط', s_desc: 'اختبارات ٦٠ ثانية تشبه اللعبة.',
      f_title: 'تنافس مع الأصدقاء', f_desc: 'ارتق في لوحة الصدارة الأسبوعية.',
      a_title: 'تعلم بالسرعة التي تناسبك', a_desc: 'محركنا يتكيف مع مستوى مهارتك الدقيق.',
      m_title: 'أتمتة التقييم التكويني', m_desc: 'شاهد على الفور المفاهيم المتقنة.',
      c_title: 'حدد من يحتاج المساعدة فوراً', c_desc: 'راقب تقدم فصلك المباشر.'
    },
    zh: {
      s_title: '告别数学挫折感', s_desc: '游戏般有趣的60秒速算。',
      f_title: '同伴PK与激励', f_desc: '加入好友，登顶周榜。',
      a_title: '专属节奏学习', a_desc: '智能算法贴合你的真实水平。',
      m_title: '自动化形成性评价', m_desc: '即时掌握学情与短板。',
      c_title: '一秒定位卡壳学生', c_desc: '实时全景监控课堂进度。'
    }
  };
  return dict[lang.split('-')[0] || 'en'] || dict['en'];
};

const HeaderText = ({ title, desc }: { title: string, desc: string }) => (
  <div className="w-full mb-10 text-left px-4 flex flex-col gap-2">
    <div className="flex flex-row items-center gap-3">
      <div className="shrink-0 inline-block bg-white p-1.5 rounded-[12px] shadow-sm border border-slate-200/60 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 190 190">
          <rect x="5" y="5" width="56" height="56" rx="10" fill="var(--color-green)" />
          <rect x="67" y="5" width="56" height="56" rx="10" fill="var(--color-green)" />
          <rect x="129" y="5" width="56" height="56" rx="10" fill="var(--color-yellow)" />
          <rect x="5" y="67" width="56" height="56" rx="10" fill="var(--color-green)" />
          <rect x="67" y="67" width="56" height="56" rx="10" fill="var(--color-yellow)" />
          <rect x="129" y="67" width="56" height="56" rx="10" fill="var(--color-blue)" />
          <rect x="5" y="129" width="56" height="56" rx="10" fill="var(--color-blue)" />
          <rect x="67" y="129" width="56" height="56" rx="10" fill="var(--color-red)" />
          <rect x="129" y="129" width="56" height="56" rx="10" fill="#cbd5e1" />
        </svg>
      </div>
      <h1 className="text-[26px] font-black text-[#0f172a] leading-tight tracking-tight">
        {title}
      </h1>
    </div>
    <p className="text-[#64748b] text-[15px] font-medium leading-snug line-clamp-2 w-[90%]">
      {desc}
    </p>
  </div>
);

// JTBD 1
export function SprintScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);

  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col font-[var(--font)] relative pt-16">
      <div className="flex-1 flex flex-col md:flex-row items-stretch w-full px-4 md:px-12 gap-8 md:gap-14 overflow-hidden mb-12">
        {/* Left Column: Essential Mobile UI */}
        <div className="flex-1 flex flex-col items-center bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.05)] pt-10 px-6 border border-slate-200">
          <div className="text-slate-400 text-[12px] uppercase tracking-[0.2em] font-bold mb-4">
            1UP
          </div>
          <div className="text-slate-800 text-[88px] font-[900] leading-none text-center mb-10 w-full" dir="ltr">
            7 × 8
          </div>
          <div className="bg-[var(--color-green)] bg-opacity-10 border-4 border-[var(--color-green)] rounded-[16px] px-14 py-4 flex items-center justify-center shadow-sm mb-14" dir="ltr">
            <span className="text-[var(--color-green)] text-[48px] font-bold leading-none">= 56</span>
          </div>
          <div className="relative w-[72px] h-[72px] mb-8 flex items-center justify-center" dir="ltr">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-yellow)" strokeWidth="8" strokeDasharray="289" strokeDashoffset="96" strokeLinecap="round" transform="rotate(-90 50 50)" />
            </svg>
            <span className="text-slate-800 text-[18px] font-bold z-10">42</span>
          </div>
          <div className="flex items-center text-slate-500 text-[14px] font-medium tracking-wide">
            <span>{t('results.score', 'Score')} &nbsp; <span className="text-slate-800 font-bold">340</span></span>
            <span className="mx-4 text-[20px] leading-none mb-1 text-slate-300">·</span>
            <span>{t('results.accuracy', 'Accuracy')} &nbsp; <span className="text-slate-800 font-bold">94%</span></span>
          </div>
        </div>

        {/* Right Column: iPad Dashboard Enhancements */}
        <div className="hidden md:flex flex-col justify-start w-1/2">
          <HeaderText title={texts.s_title} desc={texts.s_desc} />
          
          <div className="bg-white rounded-[32px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col mt-4">
            <h3 className="text-[14px] uppercase tracking-widest font-bold text-slate-400 mb-6 w-full flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Smart Analytics
            </h3>
            <div className="flex gap-4 mb-8">
              <div className="flex-1 bg-slate-50 rounded-[20px] p-5 border border-slate-100">
                <div className="text-[32px] font-black text-slate-800 mb-1">5</div>
                <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Day Streak 🔥</div>
              </div>
              <div className="flex-1 bg-slate-50 rounded-[20px] p-5 border border-slate-100">
                <div className="text-[32px] font-black text-[var(--color-green)] mb-1">94%</div>
                <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Avg. Accuracy</div>
              </div>
            </div>
            
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-blue)]/10 flex items-center justify-center text-[var(--color-blue)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-[16px]">Spaced Repetition</div>
                  <div className="text-slate-500 text-[14px] mt-0.5">Optimized memory retention</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-yellow)]/10 flex items-center justify-center text-[var(--color-yellow)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-[16px]">Bite-sized Learning</div>
                  <div className="text-slate-500 text-[14px] mt-0.5">60 seconds per session</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// JTBD 2
export function FriendsLeaderboard({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);

  const friendsNames = {
    de: ['Alex', 'Lukas', 'Jonas'],
    fr: ['Alex', 'Léo', 'Arthur'],
    es: ['Alex', 'Mateo', 'Lucas'],
    nl: ['Alex', 'Milan', 'Luuk'],
    tr: ['Can', 'Deniz', 'Ali'],
    uk: ['Саша', 'Олег', 'Максим'],
    ar: ['نور', 'زين', 'علي'],
    zh: ['张伟', '李娜', '王强'],
    en: ['Alex', 'Sam', 'Jordan']
  }[lang.split('-')[0] || 'en'] || ['Alex', 'Sam', 'Jordan'];

  const friends = [
    { rank: 1, name: friendsNames[0], score: 1450, badge: 'var(--color-yellow)' },
    { rank: 2, name: t('common.you', 'You'), score: 1200, badge: 'var(--color-blue)', isCurrent: true },
    { rank: 3, name: friendsNames[1], score: 950, badge: 'var(--color-green)' },
    { rank: 4, name: friendsNames[2], score: 820, badge: 'var(--color-red)' },
  ];

  const localizedFriendsTitle = {
    de: 'FREUNDE', fr: 'AMIS', es: 'AMIGOS', nl: 'VRIENDEN',
    tr: 'ARKADAŞLAR', uk: 'ДРУЗІ', ar: 'الأصدقاء', zh: '好友',
    en: 'FRIENDS'
  }[lang.split('-')[0] || 'en'] || 'FRIENDS';

  const localizedInviteBtn = {
    de: 'Freund einladen', fr: 'Inviter un ami', es: 'Invitar a un amigo',
    nl: 'Vriend uitnodigen', tr: 'Arkadaş Davet Et', uk: 'Запросити друга',
    ar: 'دعوة صديق', zh: '邀请朋友', en: 'Invite Friend'
  }[lang.split('-')[0] || 'en'] || 'Invite Friend';

  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col font-[var(--font)] relative pt-16">
      <div className="flex-1 flex flex-col md:flex-row items-stretch w-full px-4 md:px-12 gap-8 md:gap-14 overflow-hidden mb-12">
        {/* Left Column: Essential Mobile UI */}
        <div className="flex-1 flex flex-col items-center bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.05)] pt-10 px-6 border border-slate-200">
          <h2 className="text-[20px] font-black text-slate-800 mb-6 uppercase tracking-widest text-center w-full">🏆 {localizedFriendsTitle}</h2>
          
          <div className="w-full flex-1 flex flex-col gap-3">
            {friends.map((f, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-4 rounded-3xl border ${f.isCurrent ? 'bg-[var(--color-blue)]/5 border-[var(--color-blue)]/30 ring-1 ring-[var(--color-blue)]/10' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center">
                  <span className={`text-[16px] font-black w-6 ${f.rank === 1 ? 'text-[var(--color-yellow)]' : 'text-slate-400'}`}>#{f.rank}</span>
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-white text-[16px] ml-1 mr-3 shadow-sm" style={{ backgroundColor: f.badge }}>
                    {f.name.charAt(0)}
                  </div>
                  <span className={`text-[18px] font-bold ${f.isCurrent ? 'text-[var(--color-blue)]' : f.rank===1 ? 'text-[var(--color-yellow)]' : 'text-slate-700'}`}>{f.name}</span>
                </div>
                <div className={`text-[20px] font-black tracking-wide ${f.isCurrent ? 'text-[var(--color-blue)]' : f.rank===1 ? 'text-[var(--color-yellow)]' : 'text-slate-700'}`}>{f.score}</div>
              </div>
            ))}
            
            <button className="mt-4 w-full bg-[var(--color-yellow)] text-slate-900 text-[16px] font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm">
              <span className="text-xl">+</span> {localizedInviteBtn}
            </button>
          </div>
        </div>

        {/* Right Column: iPad Dashboard Enhancements */}
        <div className="hidden md:flex flex-col justify-start w-1/2">
          <HeaderText title={texts.f_title} desc={texts.f_desc} />
          
          <div className="bg-white rounded-[32px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col mt-4">
            <h3 className="text-[14px] uppercase tracking-widest font-bold text-slate-400 mb-6 w-full flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Recent Activity
            </h3>

            <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-[var(--color-yellow)] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold text-sm z-10">
                  {friendsNames[0].charAt(0)}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-slate-800 text-sm">{friendsNames[0]}</div>
                    <time className="text-xs font-medium text-slate-400">10 min ago</time>
                  </div>
                  <div className="text-slate-600 text-sm">Crushed a new high score of <span className="font-bold text-[var(--color-yellow)]">1450</span>! 🚀</div>
                </div>
              </div>

              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-[var(--color-green)] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold text-sm z-10">
                  {friendsNames[1].charAt(0)}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-slate-800 text-sm">{friendsNames[1]}</div>
                    <time className="text-xs font-medium text-slate-400">Yesterday</time>
                  </div>
                  <div className="text-slate-600 text-sm">Passed the elusive <span className="font-bold text-slate-800">Boss Facts</span> tier! 👑</div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

// JTBD 3
export function AdaptiveTiers({ lang }: { lang: string }) {
  const texts = getMarketingInfo(lang);
  
  const localizedTiers = {
    de: ["Einfach", "Quadratzahlen", "×6 ×7", "Schwer", "Boss", "Meister", "Zusatz ×11–×20"],
    fr: ["Facile", "Carrés", "×6 ×7", "Difficile", "Boss", "Maître", "Extension ×11–×20"],
    es: ["Fácil", "Cuadrados", "×6 ×7", "Difícil", "Jefe", "Maestro", "Extensión ×11–×20"],
    nl: ["Makkelijk", "Kwadraten", "×6 ×7", "Moeilijk", "Baas", "Meester", "Uitbreiding ×11–×20"],
    tr: ["Kolay", "Kare Sayılar", "×6 ×7", "Zor", "Patron", "Usta", "Ekstra ×11–×20"],
    uk: ["Легко", "Квадрати", "×6 ×7", "Складно", "Бос", "Майстер", "Розширені ×11–×20"],
    ar: ["سهل", "مربعات الأرقام", "×6 ×7", "صعب", "الزعيم", "سيد", "إضافي ×11–×20"],
    zh: ["基础乘法", "平方数", "×6 ×7", "高阶挑战", "首领关卡", "大师", "延展 ×11–×20"],
    en: ["Easy Facts", "Square Numbers", "×6 ×7", "Hard Facts", "Boss Facts", "Master", "Extended ×11–×20"]
  }[lang.split('-')[0] || 'en'] || ["Easy Facts", "Square Numbers", "×6 ×7", "Hard Facts", "Boss Facts", "Master", "Extended ×11–×20"];

  const tiers = [
    { title: localizedTiers[0], status: "unlocked" },
    { title: localizedTiers[1], status: "unlocked" },
    { title: localizedTiers[2], status: "unlocked" },
    { title: localizedTiers[3], status: "unlocked" },
    { title: localizedTiers[4], status: "current" },
    { title: localizedTiers[5], status: "locked" },
    { title: localizedTiers[6], status: "locked" }
  ];

  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col font-[var(--font)] relative pt-16">
      <div className="flex-1 flex flex-col md:flex-row items-stretch w-full px-4 md:px-12 gap-8 md:gap-14 overflow-hidden mb-12">
        {/* Left Column: Essential Mobile UI */}
        <div className="flex-1 flex flex-col items-center bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.05)] pt-8 px-5 border border-slate-200">
          <div className="w-full flex-1 flex flex-col gap-2.5">
            {tiers.map((tier, i) => (
              <div key={i} className={`relative flex items-center justify-between px-5 py-[16px] rounded-2xl w-full border overflow-hidden ${tier.status === 'current' ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]/20 shadow-sm' : tier.status === 'unlocked' ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 opacity-60'}`}>
                {tier.status === 'current' && (
                  <div className="absolute bottom-0 left-0 h-1 bg-[var(--color-green)]" style={{ width: '60%' }}></div>
                )}
                <div className="flex items-center w-full z-10">
                  <span className={`text-[12px] font-black mr-4 uppercase tracking-widest ${tier.status === 'current' ? 'text-[var(--color-green)]' : tier.status === 'unlocked' ? 'text-slate-400' : 'text-slate-300'}`}>T{i + 1}</span>
                  <span className={`text-[17px] font-bold tracking-tight ${tier.status === 'current' ? 'text-slate-900' : tier.status === 'unlocked' ? 'text-slate-700' : 'text-slate-400'}`}>{tier.title}</span>
                </div>
                <div className="shrink-0 flex items-center justify-end w-8 ml-2 z-10">
                  {tier.status === 'unlocked' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                  {tier.status === 'current' && (
                    <span className="text-[var(--color-green)] text-[12px] font-black tracking-widest">60%</span>
                  )}
                  {tier.status === 'locked' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: iPad Dashboard Enhancements */}
        <div className="hidden md:flex flex-col justify-start w-1/2">
          <HeaderText title={texts.a_title} desc={texts.a_desc} />
          
          <div className="bg-[var(--color-green)]/5 rounded-[32px] p-8 border border-[var(--color-green)]/20 shadow-sm flex flex-col mt-4">
            <h3 className="text-[14px] uppercase tracking-widest font-black text-[var(--color-green)] mb-6 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              {localizedTiers[4]} Insight
            </h3>

            <div className="flex flex-col gap-6">
              <div>
                <div className="flex justify-between text-[14px] font-bold text-slate-700 mb-2">
                  <span>9 × 6</span>
                  <span className="text-[var(--color-green)]">100%</span>
                </div>
                <div className="w-full bg-[var(--color-green)]/10 rounded-full h-2">
                  <div className="bg-[var(--color-green)] h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[14px] font-bold text-slate-700 mb-2">
                  <span>7 × 8</span>
                  <span className="text-[var(--color-blue)]">60%</span>
                </div>
                <div className="w-full bg-[var(--color-blue)]/10 rounded-full h-2">
                  <div className="bg-[var(--color-blue)] h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[14px] font-bold text-slate-700 mb-2">
                  <span>Reversed Factors (8×7)</span>
                  <span className="text-[var(--color-red)]">20%</span>
                </div>
                <div className="w-full bg-[var(--color-red)]/10 rounded-full h-2">
                  <div className="bg-[var(--color-red)] h-2 rounded-full" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 bg-white/60 p-4 rounded-xl border border-white flex items-center gap-4">
              <div className="text-2xl">💡</div>
              <div className="text-sm font-medium text-slate-700">The engine is currently prioritizing reversed factors to solidify your mastery of {localizedTiers[4]}.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// JTBD 4
export function MasteryGrid({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);

  const getCellColor = (r: number, c: number) => {
    if (r <= 5 && c <= 5) return "var(--color-green)"; // Mastered
    if (r === 6 || c === 6 || r === 7 || c === 7) return "var(--color-yellow)"; // Learning
    if (r === 8 || c === 8) return "var(--color-red)"; // Hard
    return "#e2e8f0"; // slate-200 untouched
  };

  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col font-[var(--font)] relative pt-16">
      <div className="flex-1 flex flex-col md:flex-row items-stretch w-full px-4 md:px-12 gap-8 md:gap-14 overflow-hidden mb-12">
        {/* Left Column: Essential Mobile UI */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.05)] py-10 border border-slate-200">
          <div className="w-full aspect-square bg-slate-50 border border-slate-100 rounded-3xl p-4 mb-10 flex flex-col justify-center mx-auto" style={{ maxWidth: '85%' }}>
            <div className="grid grid-cols-10 grid-rows-10 gap-1 w-full h-full">
              {[...Array(10)].map((_, r) => (
                [...Array(10)].map((_, c) => (
                  <div key={`${r}-${c}`} className="rounded-[4px] w-full h-full" style={{ backgroundColor: getCellColor(r + 1, c + 1) }}></div>
                ))
              ))}
            </div>
          </div>

          <div className="w-full flex justify-center items-center gap-6 px-4 flex-wrap">
            {[
              { color: 'var(--color-green)', label: t('mastery.mastered', 'Mastered') },
              { color: 'var(--color-yellow)', label: t('mastery.learning', 'Learning') },
              { color: 'var(--color-red)', label: t('mastery.hardDiff', 'Struggling') },
              { color: '#cbd5e1', label: t('mastery.untouched', 'Untouched') }
            ].map((leg, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: leg.color }}></div>
                <span className="text-slate-600 font-bold text-[12px] uppercase tracking-wider">{leg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: iPad Dashboard Enhancements */}
        <div className="hidden md:flex flex-col justify-start w-1/2">
          <HeaderText title={texts.m_title} desc={texts.m_desc} />
          
          <div className="bg-white rounded-[32px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col mt-4">
            <h3 className="text-[14px] uppercase tracking-widest font-bold text-slate-400 mb-6 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Intervention Report
            </h3>

            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-[var(--color-red)]/5 border border-[var(--color-red)]/20 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-[var(--color-red)]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2.5 h-2.5 bg-[var(--color-red)] rounded-full"></div>
                </div>
                <div>
                  <div className="font-bold text-[var(--color-red)] text-sm mb-1">Targeted Review Needed</div>
                  <div className="text-slate-700 text-sm">4 students are continuously struggling with the <strong>8×</strong> and <strong>9×</strong> tables.</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--color-green)]/5 border border-[var(--color-green)]/20 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-[var(--color-green)]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2.5 h-2.5 bg-[var(--color-green)] rounded-full"></div>
                </div>
                <div>
                  <div className="font-bold text-[var(--color-green)] text-sm mb-1">Milestone Achieved</div>
                  <div className="text-slate-700 text-sm"><strong>85%</strong> of the class has achieved automaticity on Square Numbers.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// JTBD 5
export const ClassroomLive = ({ lang }: { lang: string }) => {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);
  
  const names = {
    de: ['Emma', 'Leon', 'Anna', 'Paul', 'Mia'],
    fr: ['Léa', 'Noah', 'Chloé', 'Louis', 'Inès'],
    es: ['María', 'Carlos', 'Sofía', 'Hugo', 'Lucía'],
    tr: ['Ayşe', 'Emre', 'Zeynep', 'Kerem', 'Elif'],
    nl: ['Lotte', 'Daan', 'Emma', 'Sem', 'Julia'],
    uk: ['Олена', 'Іван', 'Анна', 'Максим', 'Марія'],
    ar: ['يوسف', 'سارة', 'عمر', 'فاطمة', 'علي'],
    zh: ['小红', '小明', '王丽', '张伟', '芳芳'],
    en: ['Emma', 'Noah', 'Olivia', 'Liam', 'Ava']
  }[lang.split('-')[0] || 'en'] || ['Emma', 'Noah', 'Olivia', 'Liam', 'Ava'];

  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col font-[var(--font)] relative pt-16">
      <div className="flex-1 flex flex-col md:flex-row items-stretch w-full px-4 md:px-12 gap-8 md:gap-14 overflow-hidden mb-12">
        {/* Left Column: Essential Mobile UI */}
        <div className="flex-1 flex flex-col items-center bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.05)] pt-8 px-6 border border-slate-200 relative">
          <div className="flex items-center gap-2 mb-6 w-full justify-center">
            <div className="text-[14px] font-black text-slate-800 tracking-widest uppercase flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1">
              <div className="w-2.5 h-2.5 bg-[var(--color-red)] rounded-full animate-pulse shadow-[0_0_10px_rgba(232,57,29,0.4)] mr-1"></div>
              {t('classSprint.live', 'CLASSROOM LIVE')}
            </div>
          </div>

          <div className="w-full flex-1 flex flex-col gap-3">
            {[
              { rank: 1, name: names[0], score: 480, badge: 'var(--color-green)' },
              { rank: 2, name: names[1], score: 420, badge: 'var(--color-blue)' },
              { rank: 3, name: names[2], score: 390, badge: 'var(--color-yellow)' },
              { rank: 4, name: names[3], score: 310, badge: 'var(--color-red)', alert: true },
              { rank: 5, name: names[4], score: 280, badge: 'var(--color-red)', alert: true }
            ].map((p, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-4 rounded-3xl border ${p.alert ? 'bg-[var(--color-red)]/5 border-[var(--color-red)]/20 shadow-sm relative overflow-hidden' : 'bg-slate-50 border-slate-100'}`}>
                {p.alert && <div className="absolute top-0 left-0 h-full w-1.5 bg-[var(--color-red)]"></div>}
                <div className="flex items-center">
                  <span className={`text-[16px] font-black w-6 text-slate-400`}>#{p.rank}</span>
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-white text-[16px] ml-1 mr-3 shadow-sm" style={{ backgroundColor: p.badge }}>
                    {p.name.charAt(0)}
                  </div>
                  <span className={`text-[18px] font-bold ${p.alert ? 'text-[var(--color-red)]' : 'text-slate-800'}`}>{p.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {p.alert && <span className="text-[16px] animate-bounce">⚠️</span>}
                  <div className={`text-[20px] font-black tracking-wide ${p.alert ? 'text-[var(--color-red)]' : 'text-slate-800'}`}>{p.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: iPad Dashboard Enhancements */}
        <div className="hidden md:flex flex-col justify-start w-1/2">
          <HeaderText title={texts.c_title} desc={texts.c_desc} />
          
          <div className="bg-slate-800 rounded-[32px] p-8 shadow-xl flex flex-col mt-4 relative overflow-hidden">
            <svg className="absolute top-0 right-0 opacity-10" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            
            <h3 className="text-[14px] uppercase tracking-widest font-bold text-slate-400 mb-8 flex items-center gap-2 relative z-10">
              <span className="w-2.5 h-2.5 bg-green-400 rounded-full inline-block blink"></span>
              Live Metrics
            </h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8 relative z-10 mb-8">
              <div>
                <div className="text-[36px] font-black text-white leading-none mb-1">24<span className="text-xl text-slate-500 font-bold">/25</span></div>
                <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Active</div>
              </div>
              <div>
                <div className="text-[36px] font-black text-green-400 leading-none mb-1">92%</div>
                <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Global Avg.</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/5 relative z-10 w-full mb-4">
              <div className="text-[12px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                <span>{names[3]} is struggling</span>
                <span className="text-white bg-[var(--color-red)] px-2 py-0.5 rounded text-[10px]">Current</span>
              </div>
              <div className="text-white text-sm">Failed <strong>9×4</strong> consecutively 3 times. Requires immediate check-in.</div>
            </div>
            
            <button className="relative z-10 w-full bg-[var(--color-blue)] hover:bg-blue-600 transition-colors text-white text-[15px] font-bold py-3.5 rounded-xl shadow-sm">
              Pause Class Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SCREENS_MAP: Record<string, any> = {
  SprintScreen,
  FriendsLeaderboard,
  AdaptiveTiers,
  MasteryGrid,
  ClassroomLive
};
