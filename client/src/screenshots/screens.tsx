import { useTranslation } from 'react-i18next';

export function SprintScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  
  const marketing = {
    de: { was_ist: "WAS IST", f1_title: "60-Sekunden Sprints", f1_desc: "Pädagogisch wertvoll. Wahnsinnig motivierend." },
    fr: { was_ist: "QUEL EST", f1_title: "Sprints de 60 secondes", f1_desc: "Pédagogiquement précieux. Incroyablement motivant." },
    es: { was_ist: "CUÁL ES", f1_title: "Sprints de 60 segundos", f1_desc: "Pedagógicamente valioso. Increíblemente motivador." },
    nl: { was_ist: "WAT IS", f1_title: "Sprints van 60 seconden", f1_desc: "Pedagogisch verantwoord. Waanzinnig motiverend." },
    tr: { was_ist: "NEDİR", f1_title: "60 Saniyelik Sprint'ler", f1_desc: "Eğitici ve inanılmaz motive edici." },
    uk: { was_ist: "СКАЖИ", f1_title: "60-секундні спринти", f1_desc: "Педагогічно цінно. Неймовірно мотивує." },
    ar: { was_ist: "ما هو", f1_title: "اختبارات مدتها ٦٠ ثانية", f1_desc: "قيمة تعليمياً. محفزة بشكل لا يصدق." },
    zh: { was_ist: "解答", f1_title: "60秒高强度冲刺", f1_desc: "极具教育价值，令人难以置信的动力。" },
    en: { was_ist: "WHAT IS", f1_title: "60-Second Sprints", f1_desc: "Educationally valuable. Insanely motivating." }
  }[lang.split('-')[0] || 'en'] || { was_ist: "WHAT IS", f1_title: "60-Second Sprints", f1_desc: "Educationally valuable. Insanely motivating." };

  return (
    <div className="w-full h-full bg-[var(--color-darkest)] flex flex-col font-[var(--font)] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-white opacity-[0.02]" style={{ 
        backgroundImage: 'radial-gradient(circle, var(--color-green) 2px, transparent 2px)',
        backgroundSize: '40px 40px',
        backgroundPosition: '0 0'
      }}></div>

      <div className="flex justify-between items-center px-10 pt-12 pb-4 text-[14px] font-bold text-white relative z-10 w-full" dir="ltr">
        <span>9:41</span>
        <div className="flex items-center tracking-tighter">
          ●●●▷ 100%
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 -mt-10">
        <div className="text-[#888] text-[12px] uppercase tracking-[0.2em] font-bold mb-4">
          {marketing.was_ist}
        </div>
        
        <div className="text-white text-[88px] font-[900] leading-none text-center mb-10 w-full" dir="ltr">
          7 × 8
        </div>
        
        <div className="bg-[var(--color-green)] bg-opacity-10 border-4 border-[var(--color-green)] rounded-[16px] px-14 py-4 flex items-center justify-center shadow-[0_0_80px_rgba(93,210,60,0.2)] mb-14" dir="ltr">
          <span className="text-[var(--color-green)] text-[48px] font-bold leading-none">= 56</span>
        </div>
        
        <div className="relative w-[72px] h-[72px] mb-8 flex items-center justify-center" dir="ltr">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-yellow)" strokeWidth="8" strokeDasharray="289" strokeDashoffset="96" strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <span className="text-white text-[18px] font-bold z-10">42</span>
        </div>
        
        <div className="flex items-center text-[#888] text-[14px] font-medium tracking-wide">
          <span>{t('results.score', 'Score')} &nbsp; <span className="text-white font-bold">340</span></span>
          <span className="mx-4 text-[20px] leading-none mb-1">·</span>
          <span>{t('results.accuracy', 'Accuracy')} &nbsp; <span className="text-white font-bold">94%</span></span>
        </div>
      </div>
      
      <div className="w-full bg-gradient-to-t from-black/80 to-transparent pt-12 pb-8 px-10 flex flex-col items-center z-10 border-t border-white/10 mt-auto">
        <div className="text-white text-[16px] font-bold mb-1 tracking-wide">
          {marketing.f1_title}
        </div>
        <div className="text-[#888] text-[13px] font-medium text-center">
          {marketing.f1_desc}
        </div>
      </div>
    </div>
  );
}

export function MasteryGrid({ lang }: { lang: string }) {
  const { t } = useTranslation();
  
  const marketing = {
    de: { f3_title: "Lernmatrix", f3_desc: "Führt automatisch formative Lernstandserhebungen durch – Sie sehen sofort, ob Kompetenzen automatisiert sind.", f3_cta: "Auf einen Blick sehen, was bereits beherrscht wird." },
    fr: { f3_title: "Matrice de Maîtrise", f3_desc: "Opère comme une évaluation formative automatique continue pour observer l'apprentissage.", f3_cta: "Voir exactement ce que vous maîtrisez en un coup d'œil." },
    es: { f3_title: "Matriz de Dominio", f3_desc: "Funciona operativamente como una evaluación formativa automatizada.", f3_cta: "Ve exactamente qué dominas de un vistazo." },
    nl: { f3_title: "Beheersing Matrix", f3_desc: "Levert real-time formatieve toetsingsdata op. Ontdek onmiddellijk op individueel niveau of kerndoelen behaald zijn.", f3_cta: "Zie in één oogopslag wat al beheerst wordt." },
    tr: { f3_title: "Gelişim Matrisi", f3_desc: "Öğretmenler için formatif ölçme aracı. Otomatik analizle zayıf noktaları saptar.", f3_cta: "Bir bakışta tam olarak ne bildiğini gör." },
    uk: { f3_title: "Діагностична Матриця", f3_desc: "Прозорий зріз знань. Працює як інструмент формувального оцінювання.", f3_cta: "Побач одразу, що вже засвоєно." },
    ar: { f3_title: "مصفوفة الكفاءة", f3_desc: "شبكة تقييم تكويني فورية للمعلم. ترصد الأتمتة التامة.", f3_cta: "شاهد ما تتقنه بنظرة واحدة." },
    zh: { f3_title: "形成性评价矩阵", f3_desc: "充当可视化助教，自动化全维评价机制。", f3_cta: "一眼看清掌握了什么。" },
    en: { f3_title: "Mastery Grid", f3_desc: "Automatically performs formative assessment so you instantly see which problems are mastered.", f3_cta: "See exactly what you know at a glance." }
  }[lang.split('-')[0] || 'en'] || { f3_title: "Mastery Grid", f3_desc: "Automatically performs formative assessment so you instantly see which problems are mastered.", f3_cta: "See exactly what you know at a glance." };

  const getCellColor = (r: number, c: number) => {
    if (r <= 5 && c <= 5) return "var(--color-green)"; // ~30 cells Green
    if (r === 6 || c === 6 || r === 7 || c === 7) return "var(--color-yellow)"; // ~20 Yellow
    if (r === 8 || c === 8) return "var(--color-red)"; // ~10 Red
    return "var(--color-gray)";
  };

  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col font-[var(--font)] relative px-6 pt-16 pb-12">
      <div className="w-full mb-10 text-left">
        <h1 className="text-[28px] font-bold text-[#1c1c1e] leading-tight mb-2 tracking-tight">
          {marketing.f3_title}
        </h1>
        <p className="text-[#555] text-[15px] font-medium leading-snug line-clamp-2 max-w-[85%]">
          {marketing.f3_desc}
        </p>
      </div>

      <div className="w-full aspect-square bg-white border border-[#E9E9E9] rounded-3xl p-4 shadow-sm mb-8 flex flex-col justify-center">
        <div className="grid grid-cols-10 grid-rows-10 gap-1 w-full h-full">
          {[...Array(10)].map((_, r) => (
            [...Array(10)].map((_, c) => (
              <div key={`${r}-${c}`} className="rounded-[4px] w-full h-full" style={{ backgroundColor: getCellColor(r + 1, c + 1) }}></div>
            ))
          ))}
        </div>
      </div>

      <div className="w-full flex flex-col justify-center items-start gap-4 mb-auto px-2">
        {[
          { color: 'var(--color-green)', label: t('mastery.mastered') },
          { color: 'var(--color-yellow)', label: t('mastery.learning') },
          { color: 'var(--color-red)', label: t('mastery.hardDiff') },
          { color: 'var(--color-gray)', label: t('mastery.untouched') }
        ].map((leg, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: leg.color }}></div>
            <span className="text-[#1c1c1e] font-bold text-[14px] uppercase tracking-wider">{leg.label}</span>
          </div>
        ))}
      </div>
      
      <div className="w-full text-center border-t border-[#E9E9E9] pt-6 mt-6">
        <div className="text-[#666] text-[13px] font-medium leading-snug">
          {marketing.f3_cta}
        </div>
      </div>
    </div>
  );
}

export const ClassroomLive = ({ lang }: { lang: string }) => {
  const { t } = useTranslation();
  
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

  const cl3 = {
    de: { active: '3a (24/24 aktiv)', join: '+ Klasse beitreten' },
    fr: { active: '3a (24/24 actifs)', join: '+ Rejoindre la classe' },
    es: { active: '3a (24/24 activos)', join: '+ Unirse a la clase' },
    nl: { active: '3a (24/24 actief)', join: '+ Klas aansluiten' },
    tr: { active: '3a (24/24 aktif)', join: '+ Sınıfa Katıl' },
    uk: { active: '3a (24/24 активних)', join: '+ Приєднатись до класу' },
    ar: { active: '٣أ (٢٤/٢٤ نشاط)', join: '+ انضم إلى الفصل' },
    zh: { active: '三班 (24/24 在线)', join: '+ 加入班级' },
    en: { active: '3a (24/24 active)', join: '+ Join Class' }
  }[lang.split('-')[0] || 'en'] || { active: '3a (24/24 active)', join: '+ Join Class' };

  return (
    <div className="w-full h-full bg-[var(--color-darkest)] flex flex-col font-[var(--font)] relative px-6 py-16 text-white pb-10">
      <div className="absolute top-0 right-0 left-0 h-[400px] pointer-events-none rounded-b-[150px] bg-[var(--color-blue)] opacity-10 blur-[100px] z-0"></div>
      
      <div className="relative z-10 w-full mb-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[20px] font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <div className="w-3 h-3 bg-[var(--color-red)] rounded-full animate-pulse shadow-[0_0_10px_var(--color-red)] mr-1"></div>
            LIVE
          </div>
        </div>
        <div className="text-[28px] font-black leading-tight text-white">{t('classSprint.live')}</div>
        <div className="text-[13px] font-bold text-[var(--color-blue)] mt-1 tracking-wide">{cl3.active}</div>
      </div>

      <div className="relative z-10 w-full flex-1 flex flex-col gap-3">
        {[
          { rank: 1, name: names[0], score: 480, badge: 'var(--color-yellow)' },
          { rank: 2, name: names[1], score: 420, badge: 'var(--color-blue)' },
          { rank: 3, name: names[2], score: 390, badge: 'var(--color-green)' },
          { rank: 4, name: names[3], score: 310, badge: 'var(--color-red)' },
          { rank: 5, name: names[4], score: 280, badge: '#fff' }
        ].map((p, i) => (
          <div key={i} className={`flex items-center justify-between px-5 py-4 rounded-3xl ${i === 0 ? 'bg-[var(--color-yellow)]/15 border border-[var(--color-yellow)]/30 shadow-lg' : 'bg-[var(--color-dark)] border border-transparent'}`}>
            <div className="flex items-center">
              <span className={`text-[18px] font-black w-7 ${i === 0 ? 'text-[var(--color-yellow)]' : 'text-gray-500'}`}>#{p.rank}</span>
              <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[#1c1c1e] text-[16px] ml-1 mr-4" style={{ backgroundColor: p.badge }}>
                {p.name.charAt(0)}
              </div>
              <span className={`text-[20px] font-bold ${i === 0 ? 'text-[var(--color-yellow)]' : 'text-white'}`}>{p.name}</span>
            </div>
            <div className={`text-[22px] font-black tracking-wide ${i === 0 ? 'text-[var(--color-yellow)]' : 'text-white'}`}>{p.score}</div>
          </div>
        ))}
      </div>

      <div className="w-full flex flex-col items-center mt-auto z-10 pt-4 gap-6">
        <div className="bg-[var(--color-red)]/10 text-[var(--color-red)] border border-[var(--color-red)]/30 rounded-full px-5 py-1.5 text-[14px] font-bold tracking-wide">
          {t('classSprint.alertStarting')}
        </div>
        <button className="w-full bg-[var(--color-blue)] text-white text-[18px] font-black rounded-3xl py-5 shadow-lg relative overflow-hidden">
          {cl3.join}
          <div className="absolute inset-0 bg-white/20 blur-xl scale-150 rotate-12 -translate-x-full"></div>
        </button>
      </div>
    </div>
  );
}

export function AdaptiveTiers({ lang }: { lang: string }) {
  
  const marketing = {
    de: { f4_title: "Adaptive Engine", f4_desc: "Passt den Schwierigkeitsgrad dynamisch und in Echtzeit an die Geschwindigkeit an." },
    fr: { f4_title: "Moteur Algorithmique", f4_desc: "Modifie la difficulté à la volée en jaugeant la fluidité cognitive." },
    es: { f4_title: "Algoritmo Adaptativo", f4_desc: "Ajusta dinámicamente el índice de dificultad en la Zona de Desarrollo Próximo." },
    nl: { f4_title: "Adaptieve Techniek", f4_desc: "Schat de vloeiendheid van het kind dynamisch in richting de zone van naaste ontwikkeling." },
    tr: { f4_title: "Akıllı Adaptif Motor", f4_desc: "Öğrencilere tam olarak 'Yakınsal Gelişim Alanlarında' test senaryoları sunar." },
    uk: { f4_title: "Адаптивний Двигун (AI)", f4_desc: "Підлаштовує рівень складності так, щоб дитина завжди працювала у своїй Зоні." },
    ar: { f4_title: "الخوارزمية المتكيفة", f4_desc: "يقوم الذكاء بتعديل التعقيد اللحظي باستمرار ضمن منطقة النمو الوشيك." },
    zh: { f4_title: "阻力降维引擎", f4_desc: "毫秒级刷新难度，锁定维果茨基最近发展区（ZPD）。" },
    en: { f4_title: "Adaptive Engine", f4_desc: "Dynamically matches problem difficulty to the student's speed and accuracy in real-time." }
  }[lang.split('-')[0] || 'en'] || { f4_title: "Adaptive Engine", f4_desc: "Dynamically matches problem difficulty to the student's speed and accuracy in real-time." };

  const tiers = [
    { title: "Easy Facts", status: "unlocked" },
    { title: "Square Numbers", status: "unlocked" },
    { title: "×6 ×7", status: "unlocked" },
    { title: "Hard Facts", status: "unlocked" },
    { title: "Boss Facts", status: "current" },
    { title: "Master", status: "locked" },
    { title: "Extended ×11–×20", status: "locked" },
    { title: "Champion", status: "locked" }
  ];

  return (
    <div className="w-full h-full flex flex-col font-[var(--font)] relative px-6 pt-16" style={{ background: 'linear-gradient(to bottom, var(--color-darkest) 0%, #1a1a2e 100%)' }}>
      <div className="w-full mb-8">
        <h1 className="text-[24px] font-bold text-white leading-tight mb-2 tracking-tight">
          {marketing.f4_title}
        </h1>
        <p className="text-[#888] text-[13px] font-semibold leading-snug line-clamp-2 max-w-[90%]">
          {marketing.f4_desc}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-start gap-2.5 pb-20 w-full">
        {tiers.map((tier, i) => (
          <div key={i} className={`relative flex items-center justify-between px-5 py-[16px] rounded-2xl w-full border ${tier.status === 'current' ? 'border-[var(--color-yellow)] bg-[var(--color-dark)] shadow-[0_4px_30px_rgba(250,204,21,0.15)] ring-1 ring-[var(--color-yellow)]/50' : tier.status === 'unlocked' ? 'bg-[var(--color-green)]/10 border-[var(--color-green)]/20' : 'bg-black/30 border-white/5 opacity-60'}`}>
            
            {tier.status === 'current' && (
              <div className="absolute bottom-0 left-0 h-1.5 bg-[var(--color-yellow)] rounded-bl-2xl" style={{ width: '60%' }}></div>
            )}
            
            <div className="flex items-center w-full">
              <span className={`text-[12px] font-black mr-4 uppercase tracking-widest ${tier.status === 'current' ? 'text-[var(--color-yellow)]' : tier.status === 'unlocked' ? 'text-[var(--color-green)]' : 'text-gray-500'}`}>T{i + 1}</span>
              <span className={`text-[18px] font-bold tracking-tight ${tier.status === 'current' ? 'text-white' : tier.status === 'unlocked' ? 'text-[var(--color-green)]' : 'text-gray-400'}`}>{tier.title}</span>
            </div>

            <div className="shrink-0 flex items-center justify-end w-8 ml-2">
              {tier.status === 'unlocked' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              )}
              {tier.status === 'current' && (
                <span className="text-[var(--color-yellow)] text-[12px] font-black tracking-widest">60%</span>
              )}
              {tier.status === 'locked' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const PrivacyScreen = ({ lang }: { lang: string }) => {

  const marketing = {
    de: { hero: "100% kostenlos. Keine Schüler-Accounts erforderlich.", f6_title: "Absolute Privatsphäre", f6_desc: "Keine Datensammlung.", ads: "Keine Werbung.", gdpr: "DSGVO-konform", desc_ads: "Keine Werbung im Unterricht.", desc_gdpr: "Es werden keine Schüler-Accounts erstellt oder benötigt." },
    fr: { hero: "100% gratuit. Aucun compte élève obligatoire.", f6_title: "Confidentialité Absolue (RGPD)", f6_desc: "Zéro collecte PII.", ads: "Zéro pub.", gdpr: "Conforme RGPD", desc_ads: "Jamais.", desc_gdpr: "Zéro compte." },
    es: { hero: "100% gratis. No requiere cuentas.", f6_title: "Privacidad Absoluta", f6_desc: "Cero recopilación PII.", ads: "Sin anuncios.", gdpr: "Conforme al RGPD", desc_ads: "Totalmente libre de estrés.", desc_gdpr: "Totalmente conforme." },
    nl: { hero: "100% gratis. Geen leerling-accounts vereist.", f6_title: "Absolute Data Privacy", f6_desc: "Geen schimmige PII-verzameling.", ads: "Geen reclame.", gdpr: "AVG-conform", desc_ads: "Geen afleidingen.", desc_gdpr: "Geen accounts." },
    tr: { hero: "%100 Ücretsiz. Öğrenci verisi toplanmaz.", f6_title: "Mutlak Gizlilik", f6_desc: "Zehirli veri politikası barındırmaz.", ads: "Reklam yok.", gdpr: "GDPR uyumlu", desc_ads: "Sadece öğrenme.", desc_gdpr: "Hesaba gerek yok." },
    uk: { hero: "Безкоштовно. Не потребує створення дитячих акаунтів.", f6_title: "100% Приватність", f6_desc: "Жодних персональних даних.", ads: "Без реклами.", gdpr: "GDPR-сумісний", desc_ads: "Без банерів.", desc_gdpr: "Без реєстрації." },
    ar: { hero: "مجاني بالكامل للقطاع التعليمي. لا يتطلب تفاصيل.", f6_title: "حماية الطفل", f6_desc: "لا بيانات.", ads: "بدون إعلانات.", gdpr: "متوافق مع GDPR", desc_ads: "تركيز تام.", desc_gdpr: "لا للحسابات." },
    zh: { hero: "100% 免费工具。不提取低龄身份。", f6_title: "保密安全", f6_desc: "纯离线存储，零收集识别信息。", ads: "无广告。", gdpr: "符合GDPR", desc_ads: "无商业推播。", desc_gdpr: "无强制机制。" },
    en: { hero: "100% free. No student accounts required.", f6_title: "Absolute Privacy", f6_desc: "No PII collection.", ads: "No Ads. Ever.", gdpr: "GDPR Compliant", desc_ads: "Fully ad-free and distraction free.", desc_gdpr: "Fully compliant with the strict data minimization protocol." }
  }[lang.split('-')[0] || 'en'] || { hero: "100% free. No student accounts required.", f6_title: "Absolute Privacy", f6_desc: "No PII collection.", ads: "No Ads. Ever.", gdpr: "GDPR Compliant", desc_ads: "Fully ad-free and distraction free.", desc_gdpr: "Fully compliant with the strict data minimization protocol." };

  return (
    <div className="w-full h-full bg-white flex flex-col font-[var(--font)] relative px-8 pt-16 pb-16 overflow-hidden z-0">
      <div className="flex justify-center items-center gap-3 mb-12">
        <svg width="48" height="48" viewBox="0 0 190 190">
          <rect x="5" y="5" width="56" height="56" rx="10" fill="var(--color-green)" />
          <rect x="67" y="5" width="56" height="56" rx="10" fill="var(--color-green)" />
          <rect x="129" y="5" width="56" height="56" rx="10" fill="var(--color-yellow)" />
          <rect x="5" y="67" width="56" height="56" rx="10" fill="var(--color-green)" />
          <rect x="67" y="67" width="56" height="56" rx="10" fill="var(--color-yellow)" />
          <rect x="129" y="67" width="56" height="56" rx="10" fill="var(--color-blue)" />
          <rect x="5" y="129" width="56" height="56" rx="10" fill="var(--color-blue)" />
          <rect x="67" y="129" width="56" height="56" rx="10" fill="var(--color-red)" />
          <rect x="129" y="129" width="56" height="56" rx="10" fill="var(--color-gray)" />
        </svg>
        <div className="text-[24px] font-black text-[#1c1c1e] tracking-tight">Better 1UP</div>
      </div>

      <div className="text-[32px] font-black text-[#1c1c1e] text-center leading-[1.1] mb-16 px-4 relative z-10">
        {marketing.hero.split('.').map((sentence, i: number, arr: string[]) => (
          <span key={i}>{sentence}{i < arr.length - 1 ? '.' : ''}<br /></span>
        ))}
      </div>

      <div className="w-full border-t border-slate-100 flex flex-col gap-0 w-[95%] mx-auto relative z-10">
        <div className="flex gap-5 items-start py-6 border-b border-slate-100">
          <div className="text-4xl shrink-0">🚫</div>
          <div className="pt-1">
            <div className="text-[17px] font-black text-[#1c1c1e] mb-1 leading-none tracking-tight">{marketing.f6_title}</div>
            <div className="text-[13px] font-medium text-[#555] leading-snug pr-4">{marketing.f6_desc}</div>
          </div>
        </div>

        <div className="flex gap-5 items-start py-6 border-b border-slate-100">
          <div className="text-4xl shrink-0">📵</div>
          <div className="pt-1">
            <div className="text-[17px] font-black text-[#1c1c1e] mb-1 leading-none tracking-tight">{marketing.ads}</div>
            <div className="text-[13px] font-medium text-[#555] leading-snug pr-4">{marketing.desc_ads}</div>
          </div>
        </div>

        <div className="flex gap-5 items-start py-6">
          <div className="text-4xl shrink-0">🇪🇺</div>
          <div className="pt-1">
            <div className="text-[17px] font-black text-[#1c1c1e] mb-1 leading-none tracking-tight">{marketing.gdpr}</div>
            <div className="text-[13px] font-medium text-[#555] leading-snug pr-4">{marketing.desc_gdpr}</div>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 -bottom-20 z-0 opacity-40">
        <svg width="240" height="240" viewBox="0 0 190 190" style={{ transform: 'rotate(8deg)' }}>
          <rect x="5" y="5" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="67" y="5" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="129" y="5" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="5" y="67" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="67" y="67" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="129" y="67" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="5" y="129" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="67" y="129" width="56" height="56" rx="10" fill="var(--color-gray)" />
          <rect x="129" y="129" width="56" height="56" rx="10" fill="var(--color-gray)" />
        </svg>
      </div>
    </div>
  );
}

export const SCREENS_MAP: Record<string, any> = {
  SprintScreen,
  MasteryGrid,
  ClassroomLive,
  AdaptiveTiers,
  PrivacyScreen
};
